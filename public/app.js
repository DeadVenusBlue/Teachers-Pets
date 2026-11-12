import {
  VERSION, STORAGE_KEY, LEGACY_KEY, FEEDBACK_KEY, STUDENTS, PETS, COLOURS, SHOP, AWARDS, MILESTONES,
  initialState, loadState, cleanName, award, grantPass, buy, care, startRound, flipCard, settleRound,
  createRoundTimer, feedbackText
} from './model.js';
import { drawPet, drawItem, drawBadge, drawWelcome, drawCareArt, drawArcade } from './artwork.js';

const $ = id => document.getElementById(id);
// Access to the localStorage property itself can throw in restricted browsers.
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const loaded = loadState(storage);
let state = loaded.state;
let teacherOpen = false;
const timer = createRoundTimer();
const pet = () => state.students[state.current];

function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}

function storageWarning(text) {
  $('storageWarning').hidden = false;
  $('storageWarning').textContent = text;
}

function save() {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { storageWarning('This browser cannot save progress. You can still try the demo, but changes may be lost when this page closes or reloads.'); }
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

// Keep static buttons in place when updating selection, so keyboard focus stays put.
function render() {
  const p = pet();
  $('student').value = state.current;
  $('studentLabel').textContent = `${state.current}'s pet`;
  $('teacherStudent').textContent = `Selected: ${state.current}`;
  $('petArt').innerHTML = drawPet(p.type);
  $('petBg').style.background = COLOURS[p.color][0];
  $('petAccessory').innerHTML = p.wear ? drawItem(p.wear) : '';
  $('wearDescription').textContent = p.wear ? `Wearing ${SHOP.find(item => item.id === p.wear).name.toLowerCase()}` : 'No accessory';
  $('petName').textContent = p.name;
  $('balance').textContent = `${p.balance} ★ available`;
  $('lifetime').textContent = `${p.lifetime} lifetime stars`;
  // Care/awards should never overwrite a pet name being edited.
  if (document.activeElement !== $('rename')) $('rename').value = p.name;
  for (const [key, prefix] of [['happy', 'happy'], ['full', 'full'], ['energy', 'energy']]) {
    $(`${prefix}Bar`).value = p[key];
    $(`${prefix}Bar`).textContent = `${p[key]}%`;
    $(`${prefix}Text`).textContent = `${p[key]}%`;
  }
  $('teacherPanel').hidden = !teacherOpen;
  $('teacherToggle').setAttribute('aria-expanded', String(teacherOpen));
  $('teacherToggle').textContent = teacherOpen ? 'Hide teacher demo' : 'Teacher demo';
  [...$('pets').children].forEach((node, i) => node.setAttribute('aria-pressed', String(p.type === i)));
  [...$('colors').children].forEach((node, i) => node.setAttribute('aria-pressed', String(p.color === i)));
  renderOwned();
  [...$('shop').children].forEach((box, i) => {
    const item = SHOP[i];
    const owned = !item.treat && p.owned.includes(item.id);
    const buyButton = box.querySelector('button');
    buyButton.disabled = owned;
    buyButton.textContent = owned ? 'Already owned ✓' : `${item.price} ★ · ${item.treat ? 'Buy treat' : 'Buy accessory'}`;
    buyButton.setAttribute('aria-label', owned ? `${item.name}, already owned` : `Buy ${item.name} for ${item.price} stars`);
  });
  $('history').replaceChildren(...(p.history.length ? p.history : ['No activity yet.']).map(text => {
    const node = document.createElement('li');
    node.textContent = text;
    return node;
  }));
  $('badges').replaceChildren(...MILESTONES.map(([threshold, label]) => {
    const earned = p.lifetime >= threshold;
    const node = document.createElement('div');
    node.className = 'badge' + (earned ? ' earned' : '');
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

function renderOwned() {
  const p = pet();
  const focusedId = $('owned').contains(document.activeElement) ? document.activeElement.dataset.item : null;
  const entries = [{ id: '', name: 'No accessory' }, ...p.owned.map(id => SHOP.find(item => item.id === id))];
  $('owned').replaceChildren(...entries.map(item => {
    const node = selectButton(item.name, () => {
      pet().wear = item.id;
      save();
      render();
      message(item.id ? `Wearing ${item.name.toLowerCase()}.` : 'Accessory put away. You still own it.');
    }, p.wear === item.id);
    node.dataset.item = item.id;
    return node;
  }));
  if (focusedId !== null) [...$('owned').children].find(node => node.dataset.item === focusedId)?.focus();
}

function renderGame() {
  const p = pet();
  if (settleRound(p.round)) save();
  const round = p.round;
  const active = round && !round.finished;
  $('passes').textContent = `${p.passes} game ${p.passes === 1 ? 'pass' : 'passes'}`;
  $('startGame').disabled = Boolean(active);
  $('startGame').textContent = active ? 'Your saved round is below' : 'Use 1 pass · Memory Match';
  $('game').hidden = !round;
  if (!round) {
    $('memory').replaceChildren();
    $('memory').dataset.round = '';
    $('gameStatus').textContent = '';
    timer.stop();
    return;
  }
  const pairs = round.cards.filter(card => card.matched).length / 2;
  $('gameStatus').textContent = round.finished
    ? `You matched all six pairs in ${round.moves} moves! Lovely work. No stars awarded.`
    : `${state.current}'s round · ${pairs} of 6 pairs · ${round.moves} moves${round.open.length === 2 ? ' · Try again in a moment…' : ''}`;
  // Update existing cards rather than replacing a focused keyboard button.
  if ($('memory').dataset.round !== round.id) {
    $('memory').dataset.round = round.id;
    $('memory').replaceChildren(...round.cards.map((_, i) => button('', () => {
      if (!flipCard(pet().round, i)) return;
      save();
      renderGame();
    })));
  }
  [...$('memory').children].forEach((node, i) => {
    const card = round.cards[i];
    const revealed = card.matched || round.open.includes(i);
    node.className = card.matched ? 'matched' : revealed ? 'revealed' : '';
    node.innerHTML = revealed ? drawPet(card.symbol) : '<span aria-hidden="true">✿</span>';
    node.setAttribute('aria-label', `Card ${i + 1}: ${revealed ? PETS[card.symbol] + (card.matched ? ', matched' : ', face up') : 'face down'}`);
    // aria-disabled keeps keyboard focus stable while the two cards are showing.
    node.setAttribute('aria-disabled', String(card.matched || revealed || round.open.length === 2 || round.finished));
  });
  timer.arm(state.current, round, () => ({ student: state.current, round: pet().round }), () => { save(); renderGame(); });
}

function initialiseControls() {
  $('welcomeArt').innerHTML = drawWelcome();
  $('careArt').innerHTML = drawCareArt();
  $('arcadeArt').innerHTML = drawArcade();
  $('version').textContent = `Demo v${VERSION}`;
  $('pets').replaceChildren(...PETS.map((name, i) => {
    const node = selectButton('', () => { pet().type = i; save(); render(); message(`${name} chosen. Your name, care and collection stay with you.`); }, false, 'pet-choice');
    node.innerHTML = drawPet(i);
    const label = document.createElement('span');
    label.textContent = name;
    node.append(label);
    node.setAttribute('aria-label', name);
    return node;
  }));
  $('colors').replaceChildren(...COLOURS.map(([hex, name], i) => {
    const node = selectButton(name, () => { pet().color = i; save(); render(); message(`${name} background chosen.`); }, false, 'colour-choice');
    node.style.background = hex;
    return node;
  }));
  $('awards').replaceChildren(...AWARDS.map(([reason, points], i) => button(`${reason} +${points} ★`, () => {
    if (!award(pet(), i, teacherOpen)) return;
    save(); render(); message(`${state.current} earned ${points} stars for ${reason.toLowerCase()}!`);
  }, 'mint')));
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
    const purchase = button('', () => {
      const error = buy(pet(), item.id);
      if (error) return message(error, true);
      save(); render(); message(`Purchased ${item.name.toLowerCase()}! ${item.treat ? 'Your pet enjoyed its snack.' : 'It is yours to keep.'}`);
    }, 'yellow');
    box.append(art, title, description, purchase);
    return box;
  }));

  $('student').addEventListener('change', event => {
    if (!STUDENTS.includes(event.target.value)) return;
    timer.stop();
    state.current = event.target.value;
    $('rename').value = pet().name;
    save(); render();
    message(`Viewing ${state.current}'s fictional pet. Unfinished rounds are kept for each student.`);
  });
  $('teacherToggle').addEventListener('click', () => {
    teacherOpen = !teacherOpen;
    render();
  });
  $('renameForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = cleanName($('rename').value);
    if (!name) { message('Please enter a pet name.', true); $('rename').focus(); return; }
    pet().name = name;
    $('rename').value = name;
    save(); render(); message(`Say hello to ${name}!`);
  });
  for (const [id, stat, amount, text] of [
    ['feed', 'full', 20, 'Yum! Your pet enjoyed a free snack.'],
    ['play', 'happy', 15, 'Your pet had fun!'],
    ['rest', 'energy', 25, 'Your pet is refreshed!']
  ]) $(id).addEventListener('click', () => { care(pet(), stat, amount); save(); render(); message(text); });
  $('grantPass').addEventListener('click', () => {
    if (!grantPass(pet(), teacherOpen)) return;
    save(); render(); message(`One game pass granted to ${state.current}.`);
  });
  $('startGame').addEventListener('click', () => {
    const error = startRound(pet());
    if (error) return message(error, true);
    timer.stop(); save(); render(); message('A round is ready! Match the six pairs.');
    $('memory').firstElementChild?.focus();
  });
  $('reset').addEventListener('click', () => {
    if (!teacherOpen || !window.confirm('Reset all three fictional students, stars, purchases and Memory Match rounds in this browser? Your feedback notes will be kept.')) return;
    timer.stop();
    state = initialState();
    $('memory').dataset.round = '';
    $('rename').value = pet().name;
    try { storage.removeItem(LEGACY_KEY); } catch { /* save() reports storage failures. */ }
    save(); render(); message('All fictional demo progress and active games have been reset. Feedback notes were kept.');
  });

  try { $('feedback').value = (storage.getItem(FEEDBACK_KEY) || '').slice(0, 6000); } catch { /* Optional draft. */ }
  $('feedback').addEventListener('input', () => {
    $('copyFallback').hidden = true;
    $('feedbackStatus').textContent = '';
    try { storage.setItem(FEEDBACK_KEY, $('feedback').value); }
    catch { $('feedbackStatus').textContent = 'Notes cannot be saved in this browser. Copy them before closing the page.'; }
  });
  $('copyFeedback').addEventListener('click', async () => {
    const text = feedbackText($('feedback').value);
    try {
      await navigator.clipboard.writeText(text);
      $('copyFallback').hidden = true;
      $('feedbackStatus').textContent = `Copied with demo version ${VERSION}. Paste it into your preferred message or document.`;
    } catch {
      $('copyFallback').hidden = false;
      $('feedbackCopy').value = text;
      $('feedbackCopy').focus();
      $('feedbackCopy').select();
      $('feedbackStatus').textContent = 'Automatic copying is unavailable. The versioned feedback is selected above; use Copy on your device.';
    }
  });
  // Timers can be throttled in a background phone tab. Resolve on returning.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renderGame();
  });
  window.addEventListener('pagehide', () => timer.stop());
  window.addEventListener('pageshow', () => renderGame());
}

initialiseControls();
render();
save();
if (loaded.notice) message(loaded.notice);
