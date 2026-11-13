// Fictional emulator data only. Never reads credentials or targets a live project.
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initialProgress } from '../public/model.js';

const projectId = 'demo-my-art-pets';
const classId = 'level-1-art';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

const accounts = [
  { uid: 'local-erin', email: 'erin@example.test', password: 'Teacher123!', displayName: 'Erin' },
  { uid: 'local-alex', email: 'alex@example.test', password: 'Student123!', displayName: 'Alex' },
  { uid: 'local-jamie', email: 'jamie@example.test', password: 'Student123!', displayName: 'Jamie' }
];

async function main() {
  // Fail promptly if the local services are not running.
  const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/config`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Auth emulator returned HTTP ${response.status}`);
  const app = initializeApp({ projectId });
  try {
    const auth = getAuth(app);
    const db = getFirestore(app);
    const classRef = db.doc(`classes/${classId}`);
    if (!(await classRef.get()).exists) await classRef.create({ name: 'Level 1 Art & Design', active: true });
    for (const account of accounts) {
      try { await auth.getUser(account.uid); }
      catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
        await auth.createUser({ ...account, emailVerified: true });
      }
      if (account.uid === 'local-erin') {
        await db.doc(`staff/${account.uid}`).set({ active: true, displayName: account.displayName, email: account.email, classIds: [classId] });
        continue;
      }
      // Rerunning keeps progress and removals intact. Restart without --import for a fresh class.
      const studentId = account.uid;
      const studentRef = db.doc(`classes/${classId}/students/${studentId}`);
      if ((await studentRef.get()).exists) continue;
      const inviteId = `local-invitation-${studentId}-00000001`;
      const stamp = Timestamp.now();
      const batch = db.batch();
      batch.create(studentRef, {
        displayName: account.displayName, invitedEmail: account.email, inviteId,
        userId: account.uid, status: 'joined', createdAt: stamp, updatedAt: stamp
      });
      batch.create(studentRef.collection('progress').doc('current'), initialProgress(stamp));
      batch.create(db.doc(`assignments/${account.uid}`), {
        classId, studentId, inviteId, email: account.email, active: true, joinedAt: stamp
      });
      batch.create(db.doc(`classes/${classId}/invites/${inviteId}`), {
        studentId, email: account.email, status: 'claimed', createdAt: stamp,
        expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400000), claimedBy: account.uid, claimedAt: stamp
      });
      await batch.commit();
    }
    console.log('Local fictional accounts are ready at http://127.0.0.1:5000');
    for (const account of accounts) console.log(`${account.displayName}: ${account.email} / ${account.password}`);
    console.log('Use separate browser profiles for teacher and students. These credentials work only in the emulators.');
  } finally { await deleteApp(app); }
}

main().catch(error => {
  console.error(`Local seed failed: ${error.message}. Start npm.cmd run emulators first.`);
  process.exitCode = 1;
});
