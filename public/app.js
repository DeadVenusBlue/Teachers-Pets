import {
  VERSION, PENDING_INVITE_KEY, PETS, COLOURS, SHOP, AWARDS, MILESTONES,
  initialProgress, cleanPetName, cleanDisplayName, normaliseEmail,
  createRoundTimer, parseInviteCode
} from './model.js';
import { drawPet, drawItem, drawBadge, drawWelcome, drawCareArt, drawArcade } from './artwork.js';

const $ = id => document.getElementById(id);
const VIEW_IDS = ['loadingView', 'authView', 'verifyView', 'unlinkedView', 'teacherView', 'studentView'];
const timer = createRoundTimer();
let client;
let currentUser = null;
let access = null;
let progress = null;
let roster = [];
let selectedStudentId = '';
let stopData = () => {};
let routeGeneration = 0;
let studentActionPending = false;
let teacherActionQueue = Promise.resolve();
let focusGameWhenReady = false;
let pendingInvite = '';
const teacherActivity = [];

function showView(id) {
  for (const viewId of VIEW_IDS) $(viewId).hidden = viewId !== id;
  $('accountBar').hidden = !['teacherView', 'studentView'].includes(id);
}

function setMessage(node, text, error = false) {
  node.textContent = text;
  node.classList.toggle('error', error);
}

function authMessage(text, error = false) {
  setMessage($('authMessage'), text, error);
}

function studentMessage(text, error = false) {
  setMessage($('message'), text, error);
}

function teacherMessage(text, error = false) {
  setMessage($('teacherMessage'), text, error);
}

function button(text, handler, className = '') {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = text;
  node.className = className;
  node.addEventListener('click', handler);
  return node;
}

function selectButton(text, handler, selected, className = '') {
  const node = button(text, handler, className);
  node.setAttribute('aria-pressed', String(selected));
  return node;
}

function friendlyError(error) {
  const code = error?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'The email address or password was not recognised.';
  if (code.includes('email-already-in-use')) return 'An account already uses that email. Sign in instead, or reset its password.';
  if (code.includes('weak-password')) return 'Choose a stronger password with at least 6 characters.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a little while before trying again.';
  if (code.includes('network-request-failed') || code.includes('unavailable')) return 'The service could not be reached. Check your connection and try again.';
  if (code.includes('permission-denied')) return 'That action is not permitted for this account.';
  return error?.message?.replace(/^Firebase:\s*/i, '') || 'Something went wrong. Please try again.';
}

function getStoredInvite() {
  try { return window.localStorage.getItem(PENDING_INVITE_KEY) || ''; } catch { return ''; }
}

function storeInvite(code) {
  pendingInvite = code;
  try {
    if (code) window.localStorage.setItem(PENDING_INVITE_KEY, code);
    else window.localStorage.removeItem(PENDING_INVITE_KEY);
  } catch { /* The verified email still protects the invitation. */ }
}

function clearInviteFromAddress() {
  if (window.location.hash.startsWith('#join=')) history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

function clearSensitiveUi() {
  timer.stop();
  stopData();
  stopData = () => {};
  access = null;
  progress = null;
  roster = [];
  selectedStudentId = '';
  studentActionPending = false;
  focusGameWhenReady = false;
  teacherActivity.length = 0;
  teacherActionQueue = Promise.resolve();
  for (const id of ['accountName', 'accountEmail', 'studentLabel', 'petName', 'balance', 'lifetime', 'className', 'classSummary', 'selectedStudentStatus', 'selectedStudentBalance', 'teacherMessage', 'message']) $(id).textContent = '';
  for (const id of ['rename', 'inviteLink', 'inviteName', 'inviteEmail', 'loginPassword', 'registerPassword', 'registerConfirm']) $(id).value = '';
  $('inviteResult').hidden = true;
  $('teacherStudentSelect').replaceChildren();
  $('owned').replaceChildren();
  $('badges').replaceChildren();
  $('petArt').replaceChildren();
  $('petAccessory').replaceChildren();
  $('memory').replaceChildren();
  $('memory').dataset.round = '';
  $('roster').replaceChildren();
  $('teacherActivity').replaceChildren();
}

function setAccount(displayName, email) {
  $('accountName').textContent = displayName || 'My Art Pets';
  $('accountEmail').textContent = email || '';
}

function setAuthPanel(name = '') {
  $('resetPanel').hidden = name !== 'reset';
  $('registerPanel').hidden = name !== 'register';
  $('loginForm').hidden = Boolean(name);
  $('showReset').hidden = Boolean(name);
  $('showRegister').hidden = Boolean(name);
}

async function routeSignedInUser(user) {
  const generation = ++routeGeneration;
  clearSensitiveUi();
  showView('loadingView');
  if (!user.emailVerified) {
    $('verifyEmail').textContent = user.email || '';
    showView('verifyView');
    return;
  }
  try {
    const resolved = await client.resolveAccess(user, pendingInvite);
    if (generation !== routeGeneration || currentUser?.uid !== user.uid) return;
    access = resolved;
    if (resolved.kind === 'teacher') {
      setAccount(resolved.displayName, user.email);
      initialiseTeacher(resolved);
      showView('teacherView');
      return;
    }
    if (resolved.kind === 'student') {
      storeInvite('');
      clearInviteFromAddress();
      setAccount(resolved.displayName, user.email);
      initialiseStudent(resolved);
      showView('studentView');
      return;
    }
    $('unlinkedEmail').textContent = user.email || '';
    $('unlinkedMessage').textContent = resolved.reason;
    showView('unlinkedView');
  } catch (error) {
    if (generation !== routeGeneration) return;
    $('unlinkedEmail').textContent = user.email || '';
    $('unlinkedMessage').textContent = friendlyError(error);
    showView('unlinkedView');
  }
}

async function signOut() {
  routeGeneration++;
  clearSensitiveUi();
  await client.signOut();
}

function initialiseAuthControls() {
  const hashInvite = parseInviteCode(window.location.href);
  const savedInvite = parseInviteCode(getStoredInvite());
  if (hashInvite || savedInvite) {
    storeInvite((hashInvite || savedInvite).code);
    $('inviteCode').value = pendingInvite;
  }

  $('showReset').addEventListener('click', () => {
    setAuthPanel('reset');
    $('resetEmail').value = $('loginEmail').value;
    $('resetEmail').focus();
    authMessage('');
  });
  $('showRegister').addEventListener('click', () => {
    setAuthPanel('register');
    $('registerEmail').value = $('loginEmail').value;
    if (pendingInvite) $('inviteCode').value = pendingInvite;
    $('registerEmail').focus();
    authMessage(pendingInvite ? 'Invitation found. Create the account with the email your teacher invited.' : 'Paste the invitation code your teacher shared with you.');
  });
  $('cancelReset').addEventListener('click', () => { setAuthPanel(); authMessage(''); });
  $('cancelRegister').addEventListener('click', () => { setAuthPanel(); authMessage(''); });

  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('loginSubmit').disabled = true;
    authMessage('Signing in…');
    try {
      await client.login($('loginEmail').value, $('loginPassword').value);
      $('loginPassword').value = '';
    } catch (error) {
      authMessage(friendlyError(error), true);
    } finally {
      $('loginSubmit').disabled = false;
    }
  });

  $('registerForm').addEventListener('submit', async event => {
    event.preventDefault();
    const parsed = parseInviteCode($('inviteCode').value);
    if (!parsed) return authMessage('Enter the complete invitation code from your teacher.', true);
    if ($('registerPassword').value !== $('registerConfirm').value) return authMessage('The two passwords do not match.', true);
    storeInvite(parsed.code);
    const submit = event.submitter || $('registerForm').querySelector('button[type="submit"]');
    submit.disabled = true;
    authMessage('Creating your account…');
    try {
      const result = await client.register($('registerEmail').value, $('registerPassword').value);
      await client.sendVerification(result.user, pendingInvite);
      $('registerPassword').value = '';
      $('registerConfirm').value = '';
      $('verifyEmail').textContent = result.user.email || '';
      showView('verifyView');
    } catch (error) {
      if (currentUser) $('verifyView').querySelector('.muted').textContent = friendlyError(error);
      else authMessage(friendlyError(error), true);
    } finally {
      submit.disabled = false;
    }
  });

  $('resetForm').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = event.submitter || $('resetForm').querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await client.resetPassword($('resetEmail').value);
      authMessage('If an account exists for that email, a password reset message is on its way.');
      setAuthPanel();
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        authMessage('If an account exists for that email, a password reset message is on its way.');
        setAuthPanel();
      } else authMessage(friendlyError(error), true);
    } finally { submit.disabled = false; }
  });

  $('resendVerification').addEventListener('click', async () => {
    try {
      await client.sendVerification(currentUser, pendingInvite);
      $('verifyView').querySelector('.muted').textContent = 'Another verification message has been sent. Check your inbox and junk folder.';
    } catch (error) {
      $('verifyView').querySelector('.muted').textContent = friendlyError(error);
    }
  });
  $('refreshVerification').addEventListener('click', async () => {
    $('refreshVerification').disabled = true;
    try {
      const refreshed = await client.refreshUser(currentUser);
      currentUser = refreshed;
      if (refreshed?.emailVerified) await routeSignedInUser(refreshed);
      else $('verifyView').querySelector('.muted').textContent = 'That email is not verified yet. Open the link in your email, then try again.';
    } catch (error) {
      $('verifyView').querySelector('.muted').textContent = friendlyError(error);
    } finally {
      $('refreshVerification').disabled = false;
    }
  });
  $('verifySignOut').addEventListener('click', signOut);
  $('unlinkedSignOut').addEventListener('click', signOut);
  $('signOut').addEventListener('click', signOut);
}

function addTeacherActivity(text) {
  teacherActivity.unshift(`${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — ${text}`);
  teacherActivity.splice(10);
  renderTeacherActivity();
}

function renderTeacherActivity() {
  const lines = teacherActivity.length ? teacherActivity : ['Actions from this signed-in session will appear here.'];
  $('teacherActivity').replaceChildren(...lines.map(text => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
}

function selectedStudent() {
  return roster.find(student => student.id === selectedStudentId && student.status === 'joined');
}

function renderTeacher() {
  const joined = roster.filter(student => student.status === 'joined');
  const invited = roster.filter(student => student.status === 'invited');
  const removed = roster.filter(student => student.status === 'removed');
  $('classSummary').textContent = `${joined.length} joined · ${invited.length} awaiting invitation · ${removed.length} removed`;
  if (!joined.some(student => student.id === selectedStudentId)) selectedStudentId = '';
  const previous = selectedStudentId;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choose a joined student…';
  $('teacherStudentSelect').replaceChildren(placeholder, ...joined.map(student => {
    const option = document.createElement('option');
    option.value = student.id;
    option.textContent = student.displayName;
    return option;
  }));
  $('teacherStudentSelect').value = previous;
  const selected = selectedStudent();
  $('selectedStudentStatus').textContent = selected ? `Selected: ${selected.displayName}` : 'Choose a student';
  $('selectedStudentBalance').textContent = selected?.progress ? `${selected.progress.balance} ★` : '—';
  for (const awardButton of $('teacherAwards').children) awardButton.disabled = !selected;
  $('teacherGrantPass').disabled = !selected;
  renderRoster();
  renderTeacherActivity();
}

async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    $('inviteResult').hidden = false;
    input.value = text;
    input.focus();
    input.select();
    throw new Error('Automatic copy was blocked. The link is selected; use Copy on this device.');
  }
}

function invitationUrl(code) {
  return `${window.location.origin}${window.location.pathname}#join=${encodeURIComponent(code)}`;
}

function renderRoster() {
  if (!roster.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No students have been invited yet.';
    $('roster').replaceChildren(empty);
    return;
  }
  $('roster').replaceChildren(...roster.map(student => {
    const card = document.createElement('article');
    const details = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = student.displayName;
    const email = document.createElement('p');
    email.textContent = student.invitedEmail;
    const status = document.createElement('span');
    status.className = 'status-chip';
    status.textContent = student.status === 'joined' ? 'Joined' : student.status === 'invited' ? 'Invitation ready' : 'Access removed';
    details.append(name, email, status);
    const actions = document.createElement('div');
    actions.className = 'roster-actions';
    if (student.status === 'invited') {
      actions.append(button('Copy invite', async () => {
        const code = `${access.classId}:${student.inviteId}`;
        try { await copyText(invitationUrl(code), $('inviteLink')); teacherMessage(`Invitation copied for ${student.displayName}.`); }
        catch (error) { teacherMessage(error.message, true); }
      }, 'lilac'));
    }
    if (student.status !== 'removed') {
      actions.append(button('Edit name', async () => {
        const next = cleanDisplayName(window.prompt('Student display name', student.displayName));
        if (!next || next === student.displayName) return;
        try { await client.updateStudentName(access.classId, student.id, next); teacherMessage(`Display name updated to ${next}.`); }
        catch (error) { teacherMessage(friendlyError(error), true); }
      }, 'quiet'));
      actions.append(button(student.status === 'joined' ? 'Remove access' : 'Remove invitation', async () => {
        if (!window.confirm(`Remove ${student.displayName}${student.status === 'joined' ? '’s class access' : '’s invitation'}? Their saved pet will not be deleted.`)) return;
        try {
          await client.removeStudent(access.classId, student);
          teacherMessage(`${student.displayName} no longer has class access.`);
          addTeacherActivity(`Removed class access for ${student.displayName}`);
        } catch (error) { teacherMessage(friendlyError(error), true); }
      }, 'quiet'));
    }
    card.append(details, actions);
    return card;
  }));
}

function initialiseTeacher(resolved) {
  $('className').textContent = resolved.className;
  teacherMessage('');
  stopData = client.watchTeacherClass(resolved.classId, value => {
    roster = value;
    renderTeacher();
  }, error => teacherMessage(friendlyError(error), true));
}

function initialiseTeacherControls() {
  $('teacherAwards').replaceChildren(...AWARDS.map(([reason, points]) => button(`${reason} +${points} ★`, async () => {
    const student = selectedStudent();
    if (!student) return;
    try {
      await queueTeacherAction(() => client.awardStudent(access.classId, student.id, points));
      teacherMessage(`${student.displayName} earned ${points} stars for ${reason.toLowerCase()}.`);
      addTeacherActivity(`Awarded ${points} stars to ${student.displayName}: ${reason}`);
    } catch (error) { teacherMessage(friendlyError(error), true); }
  }, 'mint')));
  $('teacherStudentSelect').addEventListener('change', event => {
    selectedStudentId = event.target.value;
    renderTeacher();
  });
  $('teacherGrantPass').addEventListener('click', async () => {
    const student = selectedStudent();
    if (!student) return;
    try {
      await queueTeacherAction(() => client.grantPass(access.classId, student.id));
      teacherMessage(`One Memory Match pass granted to ${student.displayName}.`);
      addTeacherActivity(`Granted a game pass to ${student.displayName}`);
    } catch (error) { teacherMessage(friendlyError(error), true); }
  });
  $('inviteForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('inviteSubmit').disabled = true;
    try {
      const code = await client.createInvitation(access.classId, $('inviteName').value, $('inviteEmail').value);
      $('inviteLink').value = invitationUrl(code);
      $('inviteResult').hidden = false;
      $('inviteName').value = '';
      $('inviteEmail').value = '';
      teacherMessage('Invitation created. Copy the private link and send it through your usual college channel.');
      addTeacherActivity('Created a verified-email student invitation');
    } catch (error) { teacherMessage(friendlyError(error), true); }
    finally { $('inviteSubmit').disabled = false; }
  });
  $('copyInvite').addEventListener('click', async () => {
    try { await copyText($('inviteLink').value, $('inviteLink')); teacherMessage('Invitation link copied.'); }
    catch (error) { teacherMessage(error.message, true); }
  });
}

// Preserve rapid teacher taps in order, without overlapping transactions based
// on the same previous balance. A sign-out cancels work that has not started.
function queueTeacherAction(action) {
  const generation = routeGeneration;
  const result = teacherActionQueue.then(() => {
    if (generation !== routeGeneration || access?.kind !== 'teacher') return;
    return action();
  });
  teacherActionQueue = result.catch(() => {});
  return result;
}

async function studentAction(action, success) {
  if (studentActionPending || !access || !progress) return;
  const generation = routeGeneration;
  studentActionPending = true;
  timer.stop();
  renderStudent();
  let succeeded = false;
  try {
    await action();
    succeeded = true;
    if (generation === routeGeneration && success) studentMessage(success);
  } catch (error) {
    if (generation === routeGeneration) studentMessage(friendlyError(error), true);
  } finally {
    if (generation === routeGeneration) {
      studentActionPending = false;
      renderStudent();
      // Avoid a tight retry loop when an offline/denied mismatch cannot save.
      if (!succeeded) timer.stop();
    }
  }
}

function renderOwned() {
  const focusedId = $('owned').contains(document.activeElement) ? document.activeElement.dataset.item : null;
  const items = [{ id: '', name: 'No accessory' }, ...SHOP.filter(item => !item.treat && progress.inventory[item.id])];
  $('owned').replaceChildren(...items.map(item => {
    const node = selectButton(item.name, () => progress.wear !== item.id && studentAction(
      () => client.wear(access, item.id),
      item.id ? `Wearing ${item.name.toLowerCase()}.` : 'Accessory put away. You still own it.'
    ), progress.wear === item.id);
    node.dataset.item = item.id;
    return node;
  }));
  if (focusedId !== null) [...$('owned').children].find(node => node.dataset.item === focusedId)?.focus();
}

function renderGame() {
  const round = progress.round;
  const active = round && !round.finished;
  $('passes').textContent = `${progress.passes} game ${progress.passes === 1 ? 'pass' : 'passes'}`;
  $('startGame').disabled = Boolean(active) || studentActionPending;
  $('startGame').textContent = active ? 'Your saved round is below' : 'Use 1 pass · Memory Match';
  $('game').hidden = !round;
  if (!round) {
    timer.stop();
    $('memory').replaceChildren();
    $('memory').dataset.round = '';
    $('gameStatus').textContent = '';
    return;
  }
  const pairs = round.cards.filter(card => card.matched).length / 2;
  $('gameStatus').textContent = round.finished
    ? `You matched all six pairs in ${round.moves} moves! Lovely work. No stars awarded.`
    : `${pairs} of 6 pairs · ${round.moves} moves${round.open.length === 2 ? ' · Try again in a moment…' : ''}`;
  if ($('memory').dataset.round !== round.id) {
    $('memory').dataset.round = round.id;
    $('memory').replaceChildren(...round.cards.map((_, index) => button('', () => {
      const currentRound = progress?.round;
      if (!currentRound || currentRound.id !== round.id) return;
      studentAction(() => client.flipMemory(access, round.id, index));
    })));
  }
  [...$('memory').children].forEach((node, index) => {
    const card = round.cards[index];
    const revealed = card.matched || round.open.includes(index);
    node.className = card.matched ? 'matched' : revealed ? 'revealed' : '';
    node.innerHTML = revealed ? drawPet(card.symbol) : '<span aria-hidden="true">✿</span>';
    node.setAttribute('aria-label', `Card ${index + 1}: ${revealed ? PETS[card.symbol] + (card.matched ? ', matched' : ', face up') : 'face down'}`);
    node.setAttribute('aria-disabled', String(card.matched || revealed || round.open.length === 2 || round.finished || studentActionPending));
  });
  if (!studentActionPending) timer.arm(currentUser.uid, round, () => ({ uid: currentUser?.uid, roundId: progress?.round?.id }), roundId => {
    studentAction(() => client.settleMemory(access, roundId));
  });
  if (focusGameWhenReady) {
    focusGameWhenReady = false;
    $('memory').firstElementChild?.focus();
  }
}

function renderStudent() {
  if (!progress) return;
  $('studentLabel').textContent = `${access.displayName}’s pet`;
  $('petArt').innerHTML = drawPet(progress.petType);
  $('petBg').style.background = COLOURS[progress.colour][0];
  $('petAccessory').innerHTML = progress.wear ? drawItem(progress.wear) : '';
  const worn = SHOP.find(item => item.id === progress.wear);
  $('wearDescription').textContent = worn ? `Wearing ${worn.name.toLowerCase()}` : 'No accessory';
  $('petName').textContent = progress.petName;
  $('balance').textContent = `${progress.balance} ★ available`;
  $('lifetime').textContent = `${progress.lifetime} lifetime stars`;
  if (document.activeElement !== $('rename')) $('rename').value = progress.petName;
  for (const key of ['happy', 'full', 'energy']) {
    $(`${key}Bar`).value = progress[key];
    $(`${key}Bar`).textContent = `${progress[key]}%`;
    $(`${key}Text`).textContent = `${progress[key]}%`;
  }
  [...$('pets').children].forEach((node, index) => node.setAttribute('aria-pressed', String(progress.petType === index)));
  [...$('colors').children].forEach((node, index) => node.setAttribute('aria-pressed', String(progress.colour === index)));
  renderOwned();
  [...$('shop').children].forEach((box, index) => {
    const item = SHOP[index];
    const owned = !item.treat && progress.inventory[item.id];
    const purchase = box.querySelector('button');
    purchase.disabled = owned || studentActionPending;
    purchase.textContent = owned ? 'Already owned ✓' : `${item.price} ★ · ${item.treat ? 'Buy treat' : 'Buy accessory'}`;
  });
  $('badges').replaceChildren(...MILESTONES.map(([threshold, label]) => {
    const earned = progress.lifetime >= threshold;
    const node = document.createElement('div');
    node.className = `badge${earned ? ' earned' : ''}`;
    node.innerHTML = drawBadge(earned);
    const title = document.createElement('strong');
    title.textContent = label;
    const caption = document.createElement('span');
    caption.textContent = `${earned ? 'Earned' : 'Locked'} · ${threshold} lifetime ★`;
    node.append(title, caption);
    return node;
  }));
  renderGame();
}

function initialiseStudent(resolved) {
  progress = initialProgress();
  studentMessage('Loading your saved pet…');
  stopData = client.watchStudent(resolved, value => {
    progress = value;
    renderStudent();
    if ($('message').textContent === 'Loading your saved pet…') studentMessage('Your online progress is up to date.');
  }, error => {
    routeGeneration++;
    clearSensitiveUi();
    $('unlinkedEmail').textContent = currentUser?.email || '';
    $('unlinkedMessage').textContent = error.message.includes('removed') ? 'Your class access has been removed.' : friendlyError(error);
    showView('unlinkedView');
  });
}

function initialiseStudentControls() {
  $('welcomeArt').innerHTML = drawWelcome();
  $('careArt').innerHTML = drawCareArt();
  $('arcadeArt').innerHTML = drawArcade();
  $('version').textContent = `My Art Pets v${VERSION} · Online progress`;
  $('pets').replaceChildren(...PETS.map((name, index) => {
    const node = selectButton('', () => progress?.petType !== index && studentAction(
      () => client.updateCosmetic(access, { petType: index }),
      `${name} chosen. Your name, care and collection stay with you.`
    ), false, 'pet-choice');
    node.innerHTML = drawPet(index);
    const label = document.createElement('span');
    label.textContent = name;
    node.append(label);
    node.setAttribute('aria-label', name);
    return node;
  }));
  $('colors').replaceChildren(...COLOURS.map(([hex, name], index) => {
    const node = selectButton(name, () => progress?.colour !== index && studentAction(
      () => client.updateCosmetic(access, { colour: index }), `${name} background chosen.`
    ), false, 'colour-choice');
    node.style.background = hex;
    return node;
  }));
  $('shop').replaceChildren(...SHOP.map(item => {
    const box = document.createElement('article');
    box.className = 'shop-item';
    const art = document.createElement('div');
    art.className = 'shop-art';
    art.innerHTML = drawItem(item.id);
    const title = document.createElement('h3');
    title.textContent = item.name;
    const description = document.createElement('p');
    description.textContent = item.description;
    const purchase = button('', () => studentAction(
      () => client.purchase(access, item.id),
      `Purchased ${item.name.toLowerCase()}! ${item.treat ? 'Your pet enjoyed its snack.' : 'It is yours to keep.'}`
    ), 'yellow');
    box.append(art, title, description, purchase);
    return box;
  }));
  $('renameForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = cleanPetName($('rename').value);
    if (!name) { studentMessage('Please enter a pet name.', true); $('rename').focus(); return; }
    if (name === progress?.petName) return;
    studentAction(() => client.updateCosmetic(access, { petName: name }), `Say hello to ${name}!`);
  });
  for (const [id, stat, amount, text] of [
    ['feed', 'full', 20, 'Yum! Your pet enjoyed a free snack.'],
    ['play', 'happy', 15, 'Your pet had fun!'],
    ['rest', 'energy', 25, 'Your pet is refreshed!']
  ]) $(id).addEventListener('click', () => studentAction(() => client.care(access, stat, amount), text));
  $('startGame').addEventListener('click', () => {
    focusGameWhenReady = true;
    studentAction(() => client.startMemory(access), 'A round is ready! Match the six pairs.');
  });
  document.addEventListener('visibilitychange', () => {
    const round = progress?.round;
    if (document.visibilityState === 'visible' && round && round.resolveAt !== null) {
      studentAction(() => client.settleMemory(access, round.id));
    }
  });
  window.addEventListener('pagehide', () => timer.stop());
}

async function boot() {
  initialiseStudentControls();
  initialiseTeacherControls();
  try {
    const module = await import('./firebase-client.js');
    client = module.createFirebaseClient();
  } catch (error) {
    showView('authView');
    authMessage(`Firebase could not start: ${friendlyError(error)}`, true);
    return;
  }
  initialiseAuthControls();
  client.onAuthChanged(async user => {
    routeGeneration++;
    clearSensitiveUi();
    currentUser = user;
    if (!user) {
      access = null;
      progress = null;
      setAccount('', '');
      setAuthPanel(pendingInvite ? 'register' : '');
      showView('authView');
      if (pendingInvite) authMessage('Invitation found. Create an account or sign in with the invited email.');
      return;
    }
    await routeSignedInUser(user);
  });
}

boot();
