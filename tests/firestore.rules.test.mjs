import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';

const EMULATOR_AVAILABLE = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const rulesTest = (name, fn) => test(name, { skip: !EMULATOR_AVAILABLE }, fn);
const PROJECT_ID = 'demo-my-art-pets';
const CLASS_ID = 'level-1-art';
const TEACHER_UID = 'teacher-erin';
const STUDENT_A_UID = 'student-alex';
const STUDENT_B_UID = 'student-jamie';
const STUDENT_A_ID = 'alex-profile';
const STUDENT_B_ID = 'jamie-profile';
const INVITE_A = 'invite-token-alex-000000000001';
const INVITE_B = 'invite-token-jamie-0000000001';
const A_EMAIL = 'alex@example.test';
const B_EMAIL = 'jamie@example.test';

let env;

const now = () => Timestamp.now();
const future = () => Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

function teacherContext() {
  return env.authenticatedContext(TEACHER_UID, {
    email: 'erin@example.test', email_verified: true
  });
}

function studentContext(uid, email, verified = true) {
  return env.authenticatedContext(uid, {
    email, email_verified: verified
  });
}

function inventory(overrides = {}) {
  return {
    bow: false,
    glasses: false,
    crown: false,
    headphones: false,
    ...overrides
  };
}

function progress(overrides = {}) {
  return {
    schema: 3,
    petName: 'Pebble',
    petType: 0,
    colour: 0,
    balance: 0,
    lifetime: 0,
    happy: 75,
    full: 70,
    energy: 80,
    inventory: inventory(),
    wear: '',
    passes: 0,
    round: null,
    updatedAt: now(),
    ...overrides
  };
}

function openStudent(studentId, inviteId, email, displayName) {
  const stamp = now();
  return {
    displayName,
    invitedEmail: email,
    inviteId,
    userId: null,
    status: 'invited',
    createdAt: stamp,
    updatedAt: stamp
  };
}

function openInvite(studentId, email) {
  return {
    studentId,
    email,
    status: 'open',
    createdAt: now(),
    expiresAt: future(),
    claimedBy: null,
    claimedAt: null
  };
}

function assignment(classId, studentId, inviteId, email) {
  return {
    classId,
    studentId,
    inviteId,
    email,
    active: true,
    joinedAt: now()
  };
}

function refs(db, studentId = STUDENT_A_ID, inviteId = INVITE_A, uid = STUDENT_A_UID) {
  return {
    staff: doc(db, 'staff', uid),
    assignment: doc(db, 'assignments', uid),
    class: doc(db, 'classes', CLASS_ID),
    student: doc(db, 'classes', CLASS_ID, 'students', studentId),
    progress: doc(db, 'classes', CLASS_ID, 'students', studentId, 'progress', 'current'),
    invite: doc(db, 'classes', CLASS_ID, 'invites', inviteId)
  };
}

async function seedBase() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'classes', CLASS_ID), {
        name: 'Level 1 Art & Design', active: true
      }),
      setDoc(doc(db, 'staff', TEACHER_UID), {
        active: true,
        displayName: 'Erin',
        email: 'erin@example.test',
        classIds: [CLASS_ID]
      })
    ]);
  });
}

async function seedOpen({
  studentId = STUDENT_A_ID,
  inviteId = INVITE_A,
  email = A_EMAIL,
  displayName = 'Alex',
  progressData = progress()
} = {}) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const r = refs(db, studentId, inviteId);
    await Promise.all([
      setDoc(r.student, openStudent(studentId, inviteId, email, displayName)),
      setDoc(r.invite, openInvite(studentId, email)),
      setDoc(r.progress, progressData)
    ]);
  });
}

async function seedJoined({
  uid = STUDENT_A_UID,
  studentId = STUDENT_A_ID,
  inviteId = INVITE_A,
  email = A_EMAIL,
  displayName = 'Alex',
  progressData = progress()
} = {}) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const r = refs(db, studentId, inviteId, uid);
    const stamp = now();
    await Promise.all([
      setDoc(r.student, {
        ...openStudent(studentId, inviteId, email, displayName),
        userId: uid,
        status: 'joined',
        updatedAt: stamp
      }),
      setDoc(r.invite, {
        ...openInvite(studentId, email),
        status: 'claimed',
        claimedBy: uid,
        claimedAt: stamp
      }),
      setDoc(r.assignment, assignment(CLASS_ID, studentId, inviteId, email)),
      setDoc(r.progress, progressData)
    ]);
  });
}

function claimInvite(context, {
  uid = STUDENT_A_UID,
  studentId = STUDENT_A_ID,
  inviteId = INVITE_A,
  email = A_EMAIL
} = {}) {
  const db = context.firestore();
  const r = refs(db, studentId, inviteId, uid);
  const batch = writeBatch(db);
  batch.set(r.assignment, {
    classId: CLASS_ID,
    studentId,
    inviteId,
    email,
    active: true,
    joinedAt: serverTimestamp()
  });
  batch.update(r.student, {
    userId: uid,
    status: 'joined',
    updatedAt: serverTimestamp()
  });
  batch.update(r.invite, {
    status: 'claimed',
    claimedBy: uid,
    claimedAt: serverTimestamp()
  });
  return batch.commit();
}

function memoryRound(id = 'round-1') {
  return {
    id,
    cards: Array.from({ length: 12 }, (_, index) => ({
      symbol: index % 6, matched: false
    })),
    open: [],
    moves: 0,
    resolveAt: null,
    finished: false
  };
}

before(async () => {
  if (!EMULATOR_AVAILABLE) return;
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules }
  });
});

beforeEach(async () => {
  if (!EMULATOR_AVAILABLE) return;
  await env.clearFirestore();
  await seedBase();
});

after(async () => {
  if (env) await env.cleanup();
});

rulesTest('teacher must create roster, invite and fresh progress atomically', async () => {
  const teacherDb = teacherContext().firestore();
  const r = refs(teacherDb);
  const batch = writeBatch(teacherDb);
  batch.set(r.student, {
    displayName: 'Alex',
    invitedEmail: A_EMAIL,
    inviteId: INVITE_A,
    userId: null,
    status: 'invited',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  batch.set(r.invite, {
    studentId: STUDENT_A_ID,
    email: A_EMAIL,
    status: 'open',
    createdAt: serverTimestamp(),
    expiresAt: future(),
    claimedBy: null,
    claimedAt: null
  });
  batch.set(r.progress, {
    ...progress(),
    updatedAt: serverTimestamp()
  });
  await assertSucceeds(batch.commit());
  assert.equal((await getDoc(r.progress)).data().balance, 0);

  const loneStudent = refs(teacherDb, STUDENT_B_ID, INVITE_B);
  await assertFails(setDoc(loneStudent.student, {
    displayName: 'Jamie',
    invitedEmail: B_EMAIL,
    inviteId: INVITE_B,
    userId: null,
    status: 'invited',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));

  const outsiderDb = studentContext('outsider', 'outsider@example.test').firestore();
  const outsiderRefs = refs(outsiderDb, STUDENT_B_ID, INVITE_B);
  const outsiderBatch = writeBatch(outsiderDb);
  outsiderBatch.set(outsiderRefs.student, {
    displayName: 'Jamie', invitedEmail: B_EMAIL, inviteId: INVITE_B,
    userId: null, status: 'invited', createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  outsiderBatch.set(outsiderRefs.invite, {
    studentId: STUDENT_B_ID, email: B_EMAIL, status: 'open',
    createdAt: serverTimestamp(), expiresAt: future(), claimedBy: null,
    claimedAt: null
  });
  outsiderBatch.set(outsiderRefs.progress, {
    ...progress(), updatedAt: serverTimestamp()
  });
  await assertFails(outsiderBatch.commit());
});

rulesTest('only a verified matching email can claim an invitation, and claim is one-time', async () => {
  await seedOpen();
  const correct = studentContext(STUDENT_A_UID, A_EMAIL, true);
  await assertSucceeds(claimInvite(correct));

  const db = correct.firestore();
  assert.equal((await getDoc(refs(db).assignment)).data().studentId, STUDENT_A_ID);
  assert.equal((await getDoc(refs(db).student)).data().status, 'joined');

  const duplicate = studentContext('second-alex-uid', A_EMAIL, true);
  await assertFails(claimInvite(duplicate, { uid: 'second-alex-uid' }));
});

rulesTest('wrong-email, unverified and partial invitation claims are denied', async () => {
  await seedOpen();
  await assertFails(claimInvite(
    studentContext(STUDENT_A_UID, 'wrong@example.test', true),
    { email: 'wrong@example.test' }
  ));
  await assertFails(claimInvite(
    studentContext(STUDENT_A_UID, A_EMAIL, false)
  ));

  const partial = studentContext(STUDENT_A_UID, A_EMAIL, true).firestore();
  await assertFails(setDoc(refs(partial).assignment, {
    classId: CLASS_ID,
    studentId: STUDENT_A_ID,
    inviteId: INVITE_A,
    email: A_EMAIL,
    active: true,
    joinedAt: serverTimestamp()
  }));

  const wrongEmailDb = studentContext('wrong-reader', 'wrong@example.test', true).firestore();
  await assertFails(getDoc(refs(wrongEmailDb).invite));
});

rulesTest('expired invitations and client-created roles or assignments are denied', async () => {
  await seedOpen();
  await env.withSecurityRulesDisabled(async context => {
    await updateDoc(refs(context.firestore()).invite, {
      expiresAt: Timestamp.fromMillis(Date.now() - 1000)
    });
  });
  await assertFails(claimInvite(studentContext(STUDENT_A_UID, A_EMAIL, true)));

  const studentDb = studentContext(STUDENT_A_UID, A_EMAIL, true).firestore();
  await assertFails(setDoc(doc(studentDb, 'staff', STUDENT_A_UID), {
    active: true, displayName: 'Not a teacher', email: A_EMAIL,
    classIds: [CLASS_ID]
  }));
  await assertFails(setDoc(doc(studentDb, 'assignments', STUDENT_A_UID), {
    ...assignment(CLASS_ID, STUDENT_A_ID, INVITE_A, A_EMAIL),
    role: 'teacher'
  }));
});

rulesTest('students can access only their active profile; roster, peers and staff remain private', async () => {
  await seedJoined();
  await seedJoined({
    uid: STUDENT_B_UID,
    studentId: STUDENT_B_ID,
    inviteId: INVITE_B,
    email: B_EMAIL,
    displayName: 'Jamie'
  });

  const aDb = studentContext(STUDENT_A_UID, A_EMAIL).firestore();
  const a = refs(aDb);
  const peer = refs(aDb, STUDENT_B_ID, INVITE_B, STUDENT_B_UID);
  await assertSucceeds(getDoc(a.student));
  await assertSucceeds(getDoc(a.progress));
  await assertSucceeds(getDoc(a.assignment));
  await assertFails(getDoc(peer.student));
  await assertFails(getDoc(peer.progress));
  await assertFails(getDoc(peer.assignment));
  await assertFails(getDoc(doc(aDb, 'staff', TEACHER_UID)));
  await assertFails(getDocs(collection(aDb, 'classes', CLASS_ID, 'students')));

  const teacherDb = teacherContext().firestore();
  const roster = await assertSucceeds(
    getDocs(collection(teacherDb, 'classes', CLASS_ID, 'students'))
  );
  assert.equal(roster.size, 2);

  const guestDb = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(refs(guestDb).progress));
});

rulesTest('assignment links are immutable from the browser', async () => {
  await seedJoined();
  const db = studentContext(STUDENT_A_UID, A_EMAIL).firestore();
  const assignmentRef = refs(db).assignment;
  await assertFails(updateDoc(assignmentRef, { studentId: STUDENT_B_ID }));
  await assertFails(updateDoc(assignmentRef, { active: false }));
});

rulesTest('teacher awards only exact two or three stars and grants one pass', async () => {
  await seedJoined();
  const db = teacherContext().firestore();
  const progressRef = refs(db).progress;

  await assertSucceeds(updateDoc(progressRef, {
    balance: 3, lifetime: 3, updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(progressRef, {
    balance: 5, lifetime: 5, updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(progressRef, {
    passes: 1, updatedAt: serverTimestamp()
  }));

  await assertFails(updateDoc(progressRef, {
    balance: 9, lifetime: 9, updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    balance: 8, updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    passes: 3, updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    petName: 'Teacher changed this', updatedAt: serverTimestamp()
  }));

  const saved = (await getDoc(progressRef)).data();
  assert.deepEqual([saved.balance, saved.lifetime, saved.passes], [5, 5, 1]);
});

rulesTest('students cannot award stars, increase lifetime or grant passes', async () => {
  await seedJoined({ progressData: progress({ balance: 10, lifetime: 20, passes: 1 }) });
  const db = studentContext(STUDENT_A_UID, A_EMAIL).firestore();
  const progressRef = refs(db).progress;
  await assertFails(updateDoc(progressRef, {
    balance: 13, lifetime: 23, updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    lifetime: 21, updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    passes: 2, updatedAt: serverTimestamp()
  }));
});

rulesTest('teacher can rename and remove a joined student; removal immediately revokes progress', async () => {
  await seedJoined();
  const teacherDb = teacherContext().firestore();
  const teacherRefs = refs(teacherDb);
  await assertSucceeds(updateDoc(teacherRefs.student, {
    displayName: 'Alex R', updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(teacherRefs.student, {
    invitedEmail: 'changed@example.test', updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(teacherRefs.student, {
    status: 'removed', updatedAt: serverTimestamp()
  }));

  const studentDb = studentContext(STUDENT_A_UID, A_EMAIL).firestore();
  await assertFails(getDoc(refs(studentDb).progress));
  await assertFails(updateDoc(refs(studentDb).progress, {
    full: 90, updatedAt: serverTimestamp()
  }));
  const ownRosterRow = await assertSucceeds(getDoc(refs(studentDb).student));
  assert.equal(ownRosterRow.data().status, 'removed');

  await assertFails(updateDoc(teacherRefs.progress, {
    balance: 3, lifetime: 3, updatedAt: serverTimestamp()
  }));
});

rulesTest('removing an unjoined student must atomically revoke the open invitation', async () => {
  await seedOpen();
  const db = teacherContext().firestore();
  const r = refs(db);
  await assertFails(updateDoc(r.student, {
    status: 'removed', updatedAt: serverTimestamp()
  }));

  const batch = writeBatch(db);
  batch.update(r.student, { status: 'removed', updatedAt: serverTimestamp() });
  batch.update(r.invite, { status: 'revoked' });
  await assertSucceeds(batch.commit());
  assert.equal((await getDoc(r.invite)).data().status, 'revoked');
});

rulesTest('student cosmetics, capped care and owned wardrobe changes are narrowly allowed', async () => {
  await seedJoined({
    progressData: progress({
      balance: 10,
      lifetime: 10,
      inventory: inventory({ bow: true })
    })
  });
  const db = studentContext(STUDENT_A_UID, A_EMAIL).firestore();
  const progressRef = refs(db).progress;
  await assertSucceeds(updateDoc(progressRef, {
    petName: 'Mochi', petType: 5, colour: 4, updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(progressRef, {
    full: 90, updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(progressRef, {
    happy: 90, updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(progressRef, {
    energy: 100, updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(progressRef, {
    wear: 'bow', updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    wear: 'crown', updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    full: 95, updatedAt: serverTimestamp()
  }));
});

rulesTest('an exact-price permanent purchase succeeds once and preserves lifetime stars', async () => {
  await seedJoined({ progressData: progress({ balance: 30, lifetime: 30 }) });
  const db = studentContext(STUDENT_A_UID, A_EMAIL).firestore();
  const progressRef = refs(db).progress;

  await assertSucceeds(runTransaction(db, async transaction => {
    const snapshot = await transaction.get(progressRef);
    const current = snapshot.data();
    transaction.update(progressRef, {
      balance: current.balance - 10,
      inventory: { ...current.inventory, bow: true },
      wear: 'bow',
      updatedAt: serverTimestamp()
    });
  }));

  let saved = (await getDoc(progressRef)).data();
  assert.deepEqual([saved.balance, saved.lifetime, saved.inventory.bow], [20, 30, true]);

  await assertFails(runTransaction(db, async transaction => {
    const snapshot = await transaction.get(progressRef);
    const current = snapshot.data();
    transaction.update(progressRef, {
      balance: current.balance - 10,
      inventory: { ...current.inventory, bow: true },
      wear: 'bow',
      updatedAt: serverTimestamp()
    });
  }));
  saved = (await getDoc(progressRef)).data();
  assert.equal(saved.balance, 20);
});

rulesTest('forged-price, insufficient, multi-item and malformed purchases are denied', async () => {
  await seedJoined({ progressData: progress({ balance: 10, lifetime: 10 }) });
  const db = studentContext(STUDENT_A_UID, A_EMAIL).firestore();
  const progressRef = refs(db).progress;
  await assertFails(updateDoc(progressRef, {
    balance: 9,
    inventory: inventory({ bow: true }),
    wear: 'bow',
    updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    balance: 0,
    inventory: inventory({ bow: true, glasses: true }),
    wear: 'bow',
    updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    balance: -15,
    inventory: inventory({ crown: true }),
    wear: 'crown',
    updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    balance: 0,
    lifetime: 0,
    inventory: inventory({ bow: true }),
    wear: 'bow',
    updatedAt: serverTimestamp()
  }));
});

rulesTest('simultaneous purchases serialize and cannot overspend', async () => {
  await seedJoined({ progressData: progress({ balance: 15, lifetime: 15 }) });
  const db = studentContext(STUDENT_A_UID, A_EMAIL).firestore();
  const progressRef = refs(db).progress;

  const purchase = (itemId, price) => runTransaction(db, async transaction => {
    const snapshot = await transaction.get(progressRef);
    const current = snapshot.data();
    transaction.update(progressRef, {
      balance: current.balance - price,
      inventory: { ...current.inventory, [itemId]: true },
      wear: itemId,
      updatedAt: serverTimestamp()
    });
  });

  const results = await Promise.allSettled([
    purchase('bow', 10),
    purchase('glasses', 15)
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const saved = (await getDoc(progressRef)).data();
  assert.ok(saved.balance === 5 || saved.balance === 0);
  assert.ok(saved.inventory.bow !== saved.inventory.glasses);
  assert.ok(saved.balance >= 0);
  assert.equal(saved.lifetime, 15);
});

rulesTest('repeatable treat deducts exactly five stars and applies capped care', async () => {
  await seedJoined({
    progressData: progress({ balance: 5, lifetime: 5, happy: 90, full: 90 })
  });
  const db = studentContext(STUDENT_A_UID, A_EMAIL).firestore();
  const progressRef = refs(db).progress;
  await assertSucceeds(updateDoc(progressRef, {
    balance: 0, happy: 100, full: 100, updatedAt: serverTimestamp()
  }));
  const saved = (await getDoc(progressRef)).data();
  assert.deepEqual([saved.balance, saved.lifetime, saved.happy, saved.full], [0, 5, 100, 100]);
  await assertFails(updateDoc(progressRef, {
    balance: -5, happy: 100, full: 100, updatedAt: serverTimestamp()
  }));
});

rulesTest('Memory Match consumes one pass, persists owner changes and cannot mint passes', async () => {
  await seedJoined({ progressData: progress({ passes: 1 }) });
  const db = studentContext(STUDENT_A_UID, A_EMAIL).firestore();
  const progressRef = refs(db).progress;
  const round = memoryRound();
  await assertSucceeds(updateDoc(progressRef, {
    passes: 0, round, updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(progressRef, {
    round: { ...round, open: [0] }, updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    passes: 1, updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(progressRef, {
    passes: 0,
    round: memoryRound('replacement-round'),
    updatedAt: serverTimestamp()
  }));
  const saved = (await getDoc(progressRef)).data();
  assert.equal(saved.round.id, 'round-1');
  assert.deepEqual(saved.round.open, [0]);
});

rulesTest('awards, care, every shop item and game completion work with a saved mismatch', async () => {
  const round = { ...memoryRound(), open: [0, 1], moves: 1, resolveAt: Date.now() + 850 };
  await seedJoined({ progressData: progress({ balance: 100, lifetime: 100, round }) });
  const teacherRef = refs(teacherContext().firestore()).progress;
  const studentRef = refs(studentContext(STUDENT_A_UID, A_EMAIL).firestore()).progress;
  for (const points of [3, 3, 2]) {
    const saved = (await getDoc(teacherRef)).data();
    await assertSucceeds(updateDoc(teacherRef, {
      balance: saved.balance + points, lifetime: saved.lifetime + points, updatedAt: serverTimestamp()
    }));
  }
  await assertSucceeds(updateDoc(teacherRef, { passes: 1, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(studentRef, { energy: 100, updatedAt: serverTimestamp() }));
  for (const [item, price] of [['bow', 10], ['glasses', 15], ['crown', 25], ['headphones', 20]]) {
    const saved = (await getDoc(studentRef)).data();
    await assertSucceeds(updateDoc(studentRef, {
      balance: saved.balance - price, inventory: { ...saved.inventory, [item]: true },
      wear: item, updatedAt: serverTimestamp()
    }));
  }
  await assertSucceeds(updateDoc(studentRef, { balance: 33, happy: 95, full: 95, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(studentRef, {
    round: { ...round, open: [], resolveAt: null, finished: true, cards: round.cards.map(card => ({ ...card, matched: true })) },
    updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(studentRef, { balance: 36, lifetime: 111, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(studentRef, { passes: 2, updatedAt: serverTimestamp() }));
  const saved = (await getDoc(studentRef)).data();
  assert.deepEqual([saved.balance, saved.lifetime, saved.passes], [33, 108, 1]);
});

rulesTest('inactive classes deny progress and new invitation claims', async () => {
  await seedJoined();
  await seedOpen({ studentId: STUDENT_B_ID, inviteId: INVITE_B, email: B_EMAIL });
  await env.withSecurityRulesDisabled(context => updateDoc(refs(context.firestore()).class, { active: false }));
  await assertFails(getDoc(refs(studentContext(STUDENT_A_UID, A_EMAIL).firestore()).progress));
  await assertFails(updateDoc(refs(teacherContext().firestore()).progress, {
    balance: 3, lifetime: 3, updatedAt: serverTimestamp()
  }));
  await assertFails(claimInvite(studentContext(STUDENT_B_UID, B_EMAIL), {
    uid: STUDENT_B_UID, studentId: STUDENT_B_ID, inviteId: INVITE_B, email: B_EMAIL
  }));
});
