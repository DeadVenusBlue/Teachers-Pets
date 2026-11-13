import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

test('authentication routes to separate teacher, student and unlinked views', () => {
  for (const id of ['authView', 'verifyView', 'unlinkedView', 'teacherView', 'studentView']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /resolved\.kind === 'teacher'/);
  assert.match(app, /resolved\.kind === 'student'/);
  assert.match(app, /showView\('unlinkedView'\)/);
  assert.doesNotMatch(html, /id="student"|id="teacherToggle"|Teacher demo/);
});

test('login, invited registration, verification, reset and sign-out handlers are wired', () => {
  for (const id of ['loginForm', 'registerForm', 'resetForm', 'resendVerification', 'refreshVerification', 'signOut']) {
    assert.match(app, new RegExp(`\\$\\('${id}'\\)\\.addEventListener`));
  }
  assert.match(app, /If an account exists for that email/);
  assert.match(app, /parseInviteCode/);
});

test('student UI performs online operations instead of local reward mutation', () => {
  for (const call of ['updateCosmetic', 'care', 'wear', 'purchase', 'startMemory', 'flipMemory', 'settleMemory']) assert.match(app, new RegExp(`client\\.${call}\\(`));
  assert.doesNotMatch(app, /localStorage\.setItem\([^,]+JSON\.stringify\(progress/);
  assert.doesNotMatch(app, /balance\s*\+=|lifetime\s*\+=|passes\s*\+\+/);
});

test('untrusted names and messages render as text, while innerHTML is limited to developer artwork', () => {
  assert.match(app, /name\.textContent = student\.displayName/);
  assert.match(app, /email\.textContent = student\.invitedEmail/);
  for (const assignment of app.matchAll(/innerHTML\s*=\s*([^;]+);/g)) {
    assert.match(assignment[1], /drawPet|drawItem|drawBadge|drawWelcome|drawCareArt|drawArcade|<span aria-hidden/);
  }
});
