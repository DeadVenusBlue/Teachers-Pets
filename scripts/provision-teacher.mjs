// Trusted local administration. This file is outside public/ and uses Admin SDK credentials.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { readFile, realpath } from 'node:fs/promises';
import { relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'erins-proj-788fe';

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] || '') : '';
}

function required(name) {
  const value = option(name).trim();
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

async function main() {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Use seed:local for emulator accounts. Teacher provisioning is a separate live administration command.');
  const email = required('email').toLowerCase();
  const displayName = required('display-name').slice(0, 60);
  const prepare = process.argv.includes('--prepare');
  const classId = prepare ? '' : required('class-id');
  const className = prepare ? '' : required('class-name').slice(0, 120);
  if (!prepare && !/^[A-Za-z0-9_-]{1,120}$/.test(classId)) throw new Error('--class-id must use only letters, numbers, hyphens or underscores.');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to an Admin SDK service-account JSON file stored outside this repository.');
  }
  const credentialPath = await realpath(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const repoPath = await realpath(fileURLToPath(new URL('../', import.meta.url)));
  const relativePath = relative(repoPath, credentialPath);
  if (!relativePath.startsWith('..') && !isAbsolute(relativePath)) throw new Error('Credentials must be stored outside this repository.');
  const credential = JSON.parse(await readFile(credentialPath, 'utf8'));
  if (credential.project_id !== PROJECT_ID) throw new Error(`The service account must belong to ${PROJECT_ID}.`);

  const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const auth = getAuth(app);
  let user;
  try { user = await auth.getUserByEmail(email); }
  catch (error) {
    if (!prepare || error.code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({ email, displayName, emailVerified: false });
  }
  if (prepare) {
    console.log('Account prepared without any role or class access. Share these private links only with the intended teacher through your trusted college channel.');
    console.log(`Set a password: ${await auth.generatePasswordResetLink(email)}`);
    if (!user.emailVerified) console.log(`Verify email: ${await auth.generateEmailVerificationLink(email)}`);
    console.log('After the teacher completes both steps, run this command without --prepare and with --class-id / --class-name.');
    return;
  }
  if (user.disabled) throw new Error('This Authentication account is disabled.');
  if (!user.emailVerified) {
    throw new Error('The Authentication account must verify its email before it can be provisioned as a teacher.');
  }

  const db = getFirestore(app);
  const classRef = db.doc(`classes/${classId}`);
  const staffRef = db.doc(`staff/${user.uid}`);
  await db.runTransaction(async transaction => {
    const classSnapshot = await transaction.get(classRef);
    if (!classSnapshot.exists) transaction.create(classRef, { name: className, active: true });
    else transaction.set(classRef, { name: className }, { merge: true });
    transaction.set(staffRef, {
      active: true,
      displayName,
      email: user.email.toLowerCase(),
      classIds: FieldValue.arrayUnion(classId)
    }, { merge: true });
  });

  console.log(`Provisioned verified teacher ${email} (${user.uid}) for ${classId} in ${PROJECT_ID}.`);
}

main().catch(error => {
  console.error(`Teacher provisioning failed: ${error.message}`);
  process.exitCode = 1;
});
