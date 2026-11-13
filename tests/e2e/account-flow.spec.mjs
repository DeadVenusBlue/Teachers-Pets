import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initialProgress } from '../../public/model.js';

const PROJECT_ID = 'demo-my-art-pets';
const CLASS_ID = 'level-1-art';
const TEACHER = { uid: 'teacher-erin', email: 'erin@example.test', password: 'Teacher123!', displayName: 'Erin' };
const JAMIE = { uid: 'student-jamie', email: 'jamie@example.test', password: 'Student123!', displayName: 'Jamie', studentId: 'student_jamie_seed' };

let adminApp;

async function seedEmulators() {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Tests require the local demo emulators.');
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  adminApp = initializeApp({ projectId: PROJECT_ID }, `e2e-${Date.now()}`);
  const auth = getAuth(adminApp);
  await auth.createUser({ ...TEACHER, emailVerified: true });
  await auth.createUser({ ...JAMIE, emailVerified: true });
  const db = getFirestore(adminApp);
  const stamp = Timestamp.now();
  await Promise.all([
    db.doc(`classes/${CLASS_ID}`).set({ name: 'Level 1 Art & Design', active: true }),
    db.doc(`staff/${TEACHER.uid}`).set({ active: true, displayName: TEACHER.displayName, email: TEACHER.email, classIds: [CLASS_ID] }),
    db.doc(`assignments/${JAMIE.uid}`).set({
      classId: CLASS_ID, studentId: JAMIE.studentId, inviteId: 'seed-invite-jamie-000000000001',
      email: JAMIE.email, active: true, joinedAt: stamp
    }),
    db.doc(`classes/${CLASS_ID}/students/${JAMIE.studentId}`).set({
      displayName: JAMIE.displayName, invitedEmail: JAMIE.email,
      inviteId: 'seed-invite-jamie-000000000001', userId: JAMIE.uid,
      status: 'joined', createdAt: stamp, updatedAt: stamp
    }),
    db.doc(`classes/${CLASS_ID}/students/${JAMIE.studentId}/progress/current`).set({ ...initialProgress(), updatedAt: stamp }),
    db.doc(`classes/${CLASS_ID}/invites/seed-invite-jamie-000000000001`).set({
      studentId: JAMIE.studentId, email: JAMIE.email, status: 'claimed',
      createdAt: stamp, expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
      claimedBy: JAMIE.uid, claimedAt: stamp
    })
  ]);
}

async function signIn(page, email, password) {
  await page.goto('/');
  await expect(page.locator('#authView')).toBeVisible();
  await page.locator('#loginEmail').fill(email);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#loginSubmit').click();
}

async function outbox() {
  const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  return (await response.json()).oobCodes || [];
}

async function checkLayout(page, name, widths = [320, 390, 1280]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name} overflow at ${width}px`).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`${name}-${width}.png`), fullPage: true });
  }
}

test.beforeEach(async () => {
  await seedEmulators();
});

test.afterEach(async () => {
  if (adminApp) await deleteApp(adminApp);
  adminApp = null;
});

test('teacher and two isolated students complete the cross-device account flow', async ({ browser }) => {
  const teacherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const alexContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
  const jamieContext = await browser.newContext({ viewport: { width: 320, height: 760 } });
  const teacher = await teacherContext.newPage();
  const alex = await alexContext.newPage();
  const jamie = await jamieContext.newPage();
  const pageErrors = [];
  for (const page of [teacher, alex, jamie]) page.on('pageerror', error => pageErrors.push(error.message));

  await teacher.goto('/');
  await expect(teacher.locator('#authView')).toBeVisible();
  await checkLayout(teacher, 'login');
  await teacher.locator('#loginEmail').focus();
  await teacher.keyboard.press('Tab');
  await expect(teacher.locator('#loginPassword')).toBeFocused();
  await expect(teacher.locator('#loginPassword')).toHaveCSS('outline-style', 'solid');

  await signIn(teacher, TEACHER.email, TEACHER.password);
  await expect(teacher.locator('#teacherView')).toBeVisible();
  await expect(teacher.locator('#className')).toHaveText('Level 1 Art & Design');
  await expect(teacher.locator('#roster article')).toHaveCount(1);

  await teacher.locator('#inviteName').fill('Alex');
  await teacher.locator('#inviteEmail').fill('alex@example.test');
  await teacher.locator('#inviteSubmit').click();
  await expect(teacher.locator('#inviteResult')).toBeVisible();
  const inviteUrl = await teacher.locator('#inviteLink').inputValue();
  expect(inviteUrl).toContain('#join=');

  await alex.goto(inviteUrl);
  await expect(alex.locator('#registerPanel')).toBeVisible();
  await alex.locator('#registerEmail').fill('alex@example.test');
  await alex.locator('#registerPassword').fill('Student123!');
  await alex.locator('#registerConfirm').fill('Student123!');
  await alex.locator('#registerForm button[type="submit"]').click();
  await expect(alex.locator('#verifyView')).toBeVisible();

  await expect.poll(async () => (await outbox()).filter(code => code.email === 'alex@example.test').length).toBeGreaterThan(0);
  const verification = (await outbox()).find(code => code.email === 'alex@example.test' && code.requestType === 'VERIFY_EMAIL');
  expect(verification?.oobLink).toBeTruthy();
  await alex.goto(verification.oobLink);
  await alex.goto(inviteUrl);
  await expect.poll(async () => await alex.locator('#verifyView').isVisible() || await alex.locator('#studentView').isVisible()).toBe(true);
  if (await alex.locator('#verifyView').isVisible()) await alex.locator('#refreshVerification').click();
  await expect(alex.locator('#studentView')).toBeVisible();
  await expect(alex.locator('#balance')).toContainText('0 ★');

  await expect(teacher.locator('#teacherStudentSelect option')).toHaveCount(3);
  await teacher.locator('#teacherStudentSelect').selectOption({ label: 'Alex' });
  await teacher.locator('#teacherAwards button').filter({ hasText: 'Attendance' }).click();
  await expect(alex.locator('#balance')).toContainText('3 ★');

  await alex.locator('#signOut').click();
  await expect(alex.locator('#authView')).toBeVisible();
  await signIn(alex, 'alex@example.test', 'Student123!');
  await expect(alex.locator('#studentView')).toBeVisible();
  await expect(alex.locator('#balance')).toContainText('3 ★');

  await signIn(jamie, JAMIE.email, JAMIE.password);
  await expect(jamie.locator('#studentView')).toBeVisible();
  await expect(jamie.locator('#studentLabel')).toContainText('Jamie');
  await expect(jamie.locator('#balance')).toContainText('0 ★');

  await jamie.locator('#signOut').click();
  await jamie.locator('#showReset').click();
  await jamie.locator('#resetEmail').fill(JAMIE.email);
  await jamie.locator('#resetForm button[type="submit"]').click();
  await expect(jamie.locator('#authMessage')).toContainText('If an account exists');
  await expect.poll(async () => (await outbox()).some(code => code.email === JAMIE.email && code.requestType === 'PASSWORD_RESET')).toBe(true);
  const reset = (await outbox()).find(code => code.email === JAMIE.email && code.requestType === 'PASSWORD_RESET');
  const resetResponse = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=fake-api-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oobCode: reset.oobCode, newPassword: 'Changed123!' })
  });
  expect(resetResponse.ok).toBe(true);
  await signIn(jamie, JAMIE.email, 'Changed123!');
  await expect(jamie.locator('#studentView')).toBeVisible();

  await teacher.locator('#teacherAwards button').filter({ hasText: 'Attendance' }).click();
  await teacher.locator('#teacherAwards button').filter({ hasText: 'Attendance' }).click();
  await teacher.locator('#teacherAwards button').filter({ hasText: 'Punctuality' }).click();
  await expect(alex.locator('#balance')).toContainText('11 ★');
  await alex.locator('#shop article').filter({ hasText: 'Pretty bow' }).locator('button').tap();
  await expect(alex.locator('#balance')).toContainText('1 ★');
  await expect(alex.locator('#shop article').filter({ hasText: 'Cool glasses' }).locator('button')).toBeEnabled();

  await alex.locator('#feed').tap();
  await expect(alex.locator('#fullText')).toHaveText('90%');
  await alex.locator('#rename').fill('Button');
  await alex.locator('#renameForm button').tap();
  await expect(alex.locator('#petName')).toHaveText('Button');
  await expect(alex.locator('#message')).toContainText('Say hello');
  await alex.locator('#pets button').nth(4).tap();
  await expect(alex.locator('#pets button').nth(4)).toHaveAttribute('aria-pressed', 'true');
  await expect(alex.locator('#message')).toContainText('Axolotl chosen');
  await alex.locator('#colors button').nth(2).tap();
  await expect(alex.locator('#message')).toContainText('Mint background');
  await alex.reload();
  await expect(alex.locator('#petName')).toHaveText('Button');
  await expect(alex.locator('#pets button').nth(4)).toHaveAttribute('aria-pressed', 'true');
  await expect(alex.locator('#colors button').nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(alex.locator('#badges .earned')).toHaveCount(1);
  await expect(alex.locator('#lifetime')).toContainText('11 lifetime');
  await alex.reload();
  await expect(alex.locator('#studentView')).toBeVisible();
  await expect(alex.locator('#shop article').filter({ hasText: 'Pretty bow' }).locator('button')).toHaveText('Already owned ✓');
  await expect(alex.locator('#balance')).toContainText('1 ★');

  await expect(alex.locator('.pet')).toHaveCSS('animation-name', 'none');
  expect(await alex.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await jamie.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await checkLayout(teacher, 'dashboard');
  await checkLayout(alex, 'student');

  const alexCard = teacher.locator('#roster article').filter({ hasText: 'alex@example.test' });
  teacher.once('dialog', dialog => dialog.accept('Alex R'));
  await alexCard.getByRole('button', { name: 'Edit name' }).click();
  await expect(alexCard.locator('h3')).toHaveText('Alex R');
  teacher.once('dialog', dialog => dialog.accept());
  await alexCard.getByRole('button', { name: 'Remove access' }).click();
  await expect(alex.locator('#unlinkedView')).toBeVisible();
  await expect(alex.locator('#unlinkedMessage')).toContainText('removed');
  await alex.reload();
  await expect(alex.locator('#unlinkedView')).toBeVisible();
  expect(pageErrors).toEqual([]);

  await Promise.all([teacherContext.close(), alexContext.close(), jamieContext.close()]);
});

test('Memory Match resumes across reload and sign-out, and finishes without rewards', async ({ browser }) => {
  const teacherContext = await browser.newContext();
  const studentContext = await browser.newContext({ reducedMotion: 'reduce' });
  const teacher = await teacherContext.newPage();
  const student = await studentContext.newPage();
  await signIn(teacher, TEACHER.email, TEACHER.password);
  await expect(teacher.locator('#teacherView')).toBeVisible();
  await teacher.locator('#teacherStudentSelect').selectOption({ label: 'Jamie' });
  await teacher.locator('#teacherGrantPass').click();
  await teacher.locator('#teacherGrantPass').click();
  await signIn(student, JAMIE.email, JAMIE.password);
  await expect(student.locator('#passes')).toHaveText('2 game passes');
  await student.locator('#startGame').click();
  await expect(student.locator('#memory button')).toHaveCount(12);
  await expect(student.locator('#passes')).toHaveText('1 game pass');
  const progressRef = getFirestore(adminApp).doc(`classes/${CLASS_ID}/students/${JAMIE.studentId}/progress/current`);
  const round = (await progressRef.get()).data().round;
  await expect(student.locator('#memory button').nth(0)).toHaveAttribute('aria-disabled', 'false');
  await student.locator('#memory button').nth(0).focus();
  await student.keyboard.press('Enter');
  await expect(student.locator('#memory button').nth(0)).toHaveAttribute('aria-label', /face up/);
  await expect(student.locator('#memory button').nth(0)).toBeFocused();
  await student.reload();
  await expect(student.locator('#memory button').nth(0)).toHaveAttribute('aria-label', /face up/);
  const other = round.cards.findIndex(card => card.symbol !== round.cards[0].symbol);
  await student.locator('#memory button').nth(other).click();
  await expect(student.locator('#gameStatus')).toContainText('Try again');
  await student.locator('#signOut').click();
  await expect(student.locator('#authView')).toBeVisible();
  await signIn(student, JAMIE.email, JAMIE.password);
  await expect(student.locator('#memory button.revealed')).toHaveCount(0);
  await expect(student.locator('#passes')).toHaveText('1 game pass');
  expect((await progressRef.get()).data().round.id).toBe(round.id);
  for (let symbol = 0; symbol < 6; symbol++) {
    const indexes = round.cards.flatMap((card, index) => card.symbol === symbol ? [index] : []);
    for (const index of indexes) {
      await expect(student.locator('#memory button').nth(index)).toHaveAttribute('aria-disabled', 'false');
      await student.locator('#memory button').nth(index).click();
      await expect(student.locator('#memory button').nth(index)).toHaveAttribute('aria-label', /face up|matched/);
    }
  }
  await expect(student.locator('#gameStatus')).toContainText('matched all six');
  await expect(student.locator('#balance')).toContainText('0 ★');
  await expect(student.locator('#startGame')).toBeEnabled();
  await student.reload();
  await expect(student.locator('#gameStatus')).toContainText('matched all six');
  await expect(student.locator('#passes')).toHaveText('1 game pass');
  await Promise.all([teacherContext.close(), studentContext.close()]);
});

test('an authenticated account without a linked profile cannot choose a role', async ({ page }) => {
  await getAuth(adminApp).createUser({ email: 'unlinked@example.test', password: 'Unlinked123!', emailVerified: true });
  await signIn(page, 'unlinked@example.test', 'Unlinked123!');
  await expect(page.locator('#unlinkedView')).toBeVisible();
  await expect(page.locator('#unlinkedMessage')).toContainText('not been linked');
  await expect(page.locator('#teacherView')).toBeHidden();
  await expect(page.locator('#studentView')).toBeHidden();
  await page.locator('#unlinkedSignOut').click();
  await expect(page.locator('#authView')).toBeVisible();
});
