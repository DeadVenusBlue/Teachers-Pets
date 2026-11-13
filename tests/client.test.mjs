import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { firebaseConfig, isLocalEmulatorHost, LIVE_PROJECT_ID, EMULATOR_PROJECT_ID } from '../public/firebase-config.js';

test('local hosts are hard-wired to the isolated demo emulator project', () => {
  for (const host of ['localhost', '127.0.0.1']) {
    assert.equal(isLocalEmulatorHost(host), true);
    assert.equal(firebaseConfig(host).projectId, EMULATOR_PROJECT_ID);
  }
  assert.equal(EMULATOR_PROJECT_ID.startsWith('demo-'), true);
  assert.equal(firebaseConfig('erins-proj-788fe.web.app').projectId, LIVE_PROJECT_ID);
});

test('Firebase client uses transactions for every reward or spend operation', async () => {
  const source = await readFile(new URL('../public/firebase-client.js', import.meta.url), 'utf8');
  for (const functionName of ['awardStudent', 'grantPass', 'purchase', 'startMemory']) {
    const start = source.indexOf(`function ${functionName}`);
    assert.ok(start > 0, `${functionName} exists`);
    assert.match(source.slice(start, start + 900), /runTransaction\(/, `${functionName} is transactional`);
  }
  assert.match(source, /connectAuthEmulator\(auth, 'http:\/\/127\.0\.0\.1:9099'/);
  assert.match(source, /connectFirestoreEmulator\(db, '127\.0\.0\.1', 8080\)/);
});

test('passwords are passed only to Firebase Authentication and never written to Firestore', async () => {
  const source = await readFile(new URL('../public/firebase-client.js', import.meta.url), 'utf8');
  assert.match(source, /signInWithEmailAndPassword/);
  assert.match(source, /createUserWithEmailAndPassword/);
  for (const write of source.matchAll(/(?:transaction\.(?:set|update)|batch\.set|updateDoc)\([^;]+/gs)) {
    assert.doesNotMatch(write[0], /password/i);
  }
});

test('browser Firestore uses memory caching by default', async () => {
  const source = await readFile(new URL('../public/firebase-client.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /enableIndexedDbPersistence|persistentLocalCache|persistentMultipleTabManager/);
});
