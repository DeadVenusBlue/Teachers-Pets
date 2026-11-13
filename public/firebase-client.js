import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  signOut as firebaseSignOut, reload, getIdToken
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, doc, collection, getDoc, onSnapshot,
  runTransaction, writeBatch, updateDoc, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig, isLocalEmulatorHost } from './firebase-config.js';
import {
  initialProgress, validateProgress, careValue, purchaseChange, startRoundChange,
  flipCard, settleRound, cleanDisplayName, normaliseEmail, formatInviteCode, parseInviteCode
} from './model.js';

const clone = value => structuredClone(value);
const progressPath = access => doc(
  access.db,
  'classes', access.classId, 'students', access.studentId, 'progress', 'current'
);

export function createFirebaseClient({ hostname = window.location.hostname } = {}) {
  const local = isLocalEmulatorHost(hostname);
  const app = initializeApp(firebaseConfig(hostname));
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (local) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }

  const accessWithDb = access => ({ ...access, db });
  const rosterRef = (classId, studentId) => doc(db, 'classes', classId, 'students', studentId);
  const inviteRef = (classId, inviteId) => doc(db, 'classes', classId, 'invites', inviteId);
  const currentProgressRef = access => progressPath(accessWithDb(access));

  async function claimInvitation(user, parsed) {
    // Email verification can change in another tab. Refresh the ID-token claim
    // before Firestore Rules compare email_verified and the invited address.
    await getIdToken(user, true);
    await runTransaction(db, async transaction => {
      const invitation = await transaction.get(inviteRef(parsed.classId, parsed.inviteId));
      if (!invitation.exists()) throw new Error('This invitation could not be found.');
      const invite = invitation.data();
      if (invite.status !== 'open') throw new Error('This invitation has already been used or removed.');
      if (normaliseEmail(invite.email) !== normaliseEmail(user.email)) throw new Error('Sign in with the email address named on the invitation.');
      const assignment = doc(db, 'assignments', user.uid);
      transaction.set(assignment, {
        classId: parsed.classId,
        studentId: invite.studentId,
        inviteId: parsed.inviteId,
        email: user.email,
        active: true,
        joinedAt: serverTimestamp()
      });
      transaction.update(rosterRef(parsed.classId, invite.studentId), {
        userId: user.uid,
        status: 'joined',
        updatedAt: serverTimestamp()
      });
      transaction.update(invitation.ref, {
        status: 'claimed',
        claimedBy: user.uid,
        claimedAt: serverTimestamp()
      });
    });
  }

  async function resolveAccess(user, inviteCode = '') {
    const staff = await getDoc(doc(db, 'staff', user.uid));
    if (staff.exists() && staff.data().active === true && Array.isArray(staff.data().classIds) && staff.data().classIds.length) {
      const staffData = staff.data();
      const classId = staffData.classIds[0];
      const classSnapshot = await getDoc(doc(db, 'classes', classId));
      if (!classSnapshot.exists() || classSnapshot.data().active !== true) return { kind: 'unlinked', reason: 'Your assigned class is not active.' };
      return {
        kind: 'teacher', classId, className: classSnapshot.data().name,
        displayName: staffData.displayName, email: staffData.email
      };
    }

    const assignmentSnapshot = await getDoc(doc(db, 'assignments', user.uid));
    if (assignmentSnapshot.exists()) {
      const assignment = assignmentSnapshot.data();
      if (assignment.active !== true) return { kind: 'removed', reason: 'Your class access has been removed.' };
      const studentSnapshot = await getDoc(rosterRef(assignment.classId, assignment.studentId));
      if (!studentSnapshot.exists() || studentSnapshot.data().status !== 'joined') {
        return { kind: 'removed', reason: 'Your class access has been removed. Ask your teacher or Cal if this is unexpected.' };
      }
      const classSnapshot = await getDoc(doc(db, 'classes', assignment.classId));
      if (!classSnapshot.exists() || classSnapshot.data().active !== true) return { kind: 'unlinked', reason: 'Your assigned class is not active.' };
      return {
        kind: 'student', ...assignment,
        displayName: studentSnapshot.data().displayName,
        className: classSnapshot.exists() ? classSnapshot.data().name : 'Art & Design'
      };
    }

    const parsed = parseInviteCode(inviteCode);
    if (parsed && user.emailVerified) {
      await claimInvitation(user, parsed);
      return resolveAccess(user, '');
    }
    return { kind: 'unlinked', reason: parsed ? 'This invitation could not be linked. Check that you verified the invited email.' : 'This account has not been linked to a class profile.' };
  }

  function watchStudent(access, onValue, onError) {
    const unsubs = [];
    unsubs.push(onSnapshot(rosterRef(access.classId, access.studentId), snapshot => {
      if (!snapshot.exists() || snapshot.data().status !== 'joined') onError(new Error('Class access removed.'));
    }, onError));
    unsubs.push(onSnapshot(currentProgressRef(access), snapshot => {
      if (!snapshot.exists()) return onError(new Error('Your pet profile is missing.'));
      onValue(validateProgress(snapshot.data()));
    }, onError));
    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }

  function watchTeacherClass(classId, onValue, onError) {
    const roster = new Map();
    const progress = new Map();
    const progressUnsubs = new Map();
    const publish = () => onValue([...roster.values()].map(student => ({
      ...student,
      progress: progress.get(student.id) || null
    })).sort((a, b) => a.displayName.localeCompare(b.displayName, 'en-GB')));
    const stopRoster = onSnapshot(collection(db, 'classes', classId, 'students'), snapshot => {
      const activeIds = new Set();
      for (const item of snapshot.docs) {
        activeIds.add(item.id);
        roster.set(item.id, { id: item.id, ...item.data() });
        if (!progressUnsubs.has(item.id)) {
          const ref = doc(db, 'classes', classId, 'students', item.id, 'progress', 'current');
          progressUnsubs.set(item.id, onSnapshot(ref, progressSnapshot => {
            progress.set(item.id, progressSnapshot.exists() ? validateProgress(progressSnapshot.data()) : null);
            publish();
          }, onError));
        }
      }
      for (const id of [...roster.keys()]) {
        if (activeIds.has(id)) continue;
        roster.delete(id);
        progress.delete(id);
        progressUnsubs.get(id)?.();
        progressUnsubs.delete(id);
      }
      publish();
    }, onError);
    return () => {
      stopRoster();
      for (const unsubscribe of progressUnsubs.values()) unsubscribe();
    };
  }

  async function createInvitation(classId, displayNameValue, emailValue) {
    const displayName = cleanDisplayName(displayNameValue);
    const email = normaliseEmail(emailValue);
    if (!displayName || !email.includes('@')) throw new Error('Enter a display name and a valid email address.');
    const studentId = `student_${crypto.randomUUID().replaceAll('-', '')}`;
    const inviteId = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
    const batch = writeBatch(db);
    const student = rosterRef(classId, studentId);
    const invitation = inviteRef(classId, inviteId);
    const progress = doc(student, 'progress', 'current');
    batch.set(student, {
      displayName, invitedEmail: email, inviteId, userId: null, status: 'invited',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    batch.set(invitation, {
      studentId, email, status: 'open', createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
      claimedBy: null, claimedAt: null
    });
    batch.set(progress, { ...initialProgress(), updatedAt: serverTimestamp() });
    await batch.commit();
    return formatInviteCode(classId, inviteId);
  }

  async function updateStudentName(classId, studentId, displayNameValue) {
    const displayName = cleanDisplayName(displayNameValue);
    if (!displayName) throw new Error('Enter a display name.');
    await updateDoc(rosterRef(classId, studentId), { displayName, updatedAt: serverTimestamp() });
  }

  async function removeStudent(classId, student) {
    const studentDocument = rosterRef(classId, student.id);
    if (student.status === 'invited') {
      const batch = writeBatch(db);
      batch.update(studentDocument, { status: 'removed', updatedAt: serverTimestamp() });
      batch.update(inviteRef(classId, student.inviteId), { status: 'revoked' });
      await batch.commit();
      return;
    }
    if (student.status === 'joined') await updateDoc(studentDocument, { status: 'removed', updatedAt: serverTimestamp() });
  }

  async function awardStudent(classId, studentId, points) {
    if (![2, 3].includes(points)) throw new Error('That award amount is not allowed.');
    const ref = doc(db, 'classes', classId, 'students', studentId, 'progress', 'current');
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error('Student progress is missing.');
      const value = validateProgress(snapshot.data());
      transaction.update(ref, { balance: value.balance + points, lifetime: value.lifetime + points, updatedAt: serverTimestamp() });
    });
  }

  async function grantPass(classId, studentId) {
    const ref = doc(db, 'classes', classId, 'students', studentId, 'progress', 'current');
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error('Student progress is missing.');
      transaction.update(ref, { passes: snapshot.data().passes + 1, updatedAt: serverTimestamp() });
    });
  }

  async function updateCosmetic(access, change) {
    await updateDoc(currentProgressRef(access), { ...change, updatedAt: serverTimestamp() });
  }

  async function care(access, stat, amount) {
    const ref = currentProgressRef(access);
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const value = validateProgress(snapshot.data());
      transaction.update(ref, { [stat]: careValue(value[stat], amount), updatedAt: serverTimestamp() });
    });
  }

  async function wear(access, itemId) {
    await updateDoc(currentProgressRef(access), { wear: itemId, updatedAt: serverTimestamp() });
  }

  async function purchase(access, itemId) {
    const ref = currentProgressRef(access);
    let purchased;
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const result = purchaseChange(validateProgress(snapshot.data()), itemId);
      if (result.error) throw new Error(result.error);
      purchased = result.item;
      transaction.update(ref, { ...result.change, updatedAt: serverTimestamp() });
    });
    return purchased;
  }

  async function startMemory(access) {
    const ref = currentProgressRef(access);
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const result = startRoundChange(validateProgress(snapshot.data()));
      if (result.error) throw new Error(result.error);
      transaction.update(ref, { ...result.change, updatedAt: serverTimestamp() });
    });
  }

  async function flipMemory(access, expectedRoundId, cardIndex) {
    const ref = currentProgressRef(access);
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const current = validateProgress(snapshot.data());
      if (!current.round || current.round.id !== expectedRoundId) throw new Error('That Memory Match round changed.');
      const round = clone(current.round);
      if (!flipCard(round, cardIndex)) return;
      transaction.update(ref, { round, updatedAt: serverTimestamp() });
    });
  }

  async function settleMemory(access, expectedRoundId) {
    const ref = currentProgressRef(access);
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const current = validateProgress(snapshot.data());
      if (!current.round || current.round.id !== expectedRoundId) return;
      const round = clone(current.round);
      if (!settleRound(round)) return;
      transaction.update(ref, { round, updatedAt: serverTimestamp() });
    });
  }

  return {
    auth, db, local,
    onAuthChanged: callback => onAuthStateChanged(auth, callback),
    login: (email, password) => signInWithEmailAndPassword(auth, normaliseEmail(email), password),
    register: (email, password) => createUserWithEmailAndPassword(auth, normaliseEmail(email), password),
    sendVerification: (user, inviteCode = '') => sendEmailVerification(user, {
      url: `${window.location.origin}${window.location.pathname}${inviteCode ? `#join=${encodeURIComponent(inviteCode)}` : ''}`
    }),
    resetPassword: email => sendPasswordResetEmail(auth, normaliseEmail(email)),
    refreshUser: async user => { await reload(user); await getIdToken(user, true); return auth.currentUser; },
    signOut: () => firebaseSignOut(auth),
    resolveAccess, watchStudent, watchTeacherClass, createInvitation,
    updateStudentName, removeStudent, awardStudent, grantPass,
    updateCosmetic, care, wear, purchase, startMemory, flipMemory, settleMemory
  };
}
