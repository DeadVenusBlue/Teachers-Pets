/* Browser-independent rules. No network, accounts, or student-authorised awards. */
export const VERSION = '0.2.0';
export const STORAGE_KEY = 'my-art-pets-demo-v2';
export const LEGACY_KEY = 'my-art-pets-demo-v1';
export const FEEDBACK_KEY = 'my-art-pets-feedback-v1';
export const STUDENTS = ['Alex', 'Jamie', 'Taylor'];
export const PETS = ['Cat', 'Frog', 'Bat', 'Ghost', 'Axolotl', 'Fluffy monster'];
export const COLOURS = [
  ['#f9def3', 'Pink'], ['#e6dcff', 'Lilac'], ['#d7f6e9', 'Mint'],
  ['#fff0c5', 'Yellow'], ['#d8efff', 'Blue']
];
export const SHOP = [
  { id: 'bow', name: 'Pretty bow', price: 10, description: 'A little pop of pink' },
  { id: 'glasses', name: 'Cool glasses', price: 15, description: 'For a very cool buddy' },
  { id: 'crown', name: 'Star crown', price: 25, description: 'A touch of sparkle' },
  { id: 'headphones', name: 'Headphones', price: 20, description: 'In their happy place' },
  { id: 'sparkle', name: 'Sparkly treat', price: 5, treat: true, description: '+20 happiness · +25 fullness' }
];
export const AWARDS = [
  ['Attendance', 3], ['Punctuality', 2], ['Positive behaviour', 2],
  ['Completed task', 3], ['Excellent effort', 3], ['Helping others', 2], ['Creative challenge', 3]
];
export const MILESTONES = [[10, 'Creative Starter'], [25, 'Rising Artist'], [50, 'Art Superstar'], [75, 'Creative Champion'], [100, 'Art Legend']];
const MAX_COUNT = 1_000_000;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value, fallback, max = MAX_COUNT) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : fallback;
const index = (value, length, fallback) => Number.isInteger(value) && value >= 0 && value < length ? value : fallback;

export function cleanName(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 18) : '';
}

export function initialState() {
  return {
    schema: 2,
    current: STUDENTS[0],
    students: Object.fromEntries(STUDENTS.map((student, i) => [student, {
      name: ['Pebble', 'Mochi', 'Pip'][i], type: i, color: i,
      balance: 0, lifetime: 0, happy: 75, full: 70, energy: 80,
      owned: [], wear: '', passes: 0, history: [], round: null
    }]))
  };
}

function validateRound(raw) {
  if (!isObject(raw) || typeof raw.id !== 'string' || raw.id.length > 100 || !raw.id) return null;
  if (!Array.isArray(raw.cards) || raw.cards.length !== 12) return null;
  const cards = raw.cards.map(card => isObject(card) && Number.isInteger(card.symbol) && card.symbol >= 0 && card.symbol < 6 && typeof card.matched === 'boolean' ? { symbol: card.symbol, matched: card.matched } : null);
  if (cards.some(card => !card)) return null;
  for (let symbol = 0; symbol < 6; symbol++) {
    const pair = cards.filter(card => card.symbol === symbol);
    if (pair.length !== 2 || pair[0].matched !== pair[1].matched) return null;
  }
  if (!Array.isArray(raw.open) || raw.open.length > 2 || new Set(raw.open).size !== raw.open.length || raw.open.some(i => !Number.isInteger(i) || !cards[i] || cards[i].matched)) return null;
  if (raw.open.length === 2 && (cards[raw.open[0]].symbol === cards[raw.open[1]].symbol || !Number.isFinite(raw.resolveAt))) return null;
  return {
    id: raw.id, cards, open: [...raw.open], moves: number(raw.moves, 0),
    resolveAt: raw.open.length === 2 ? Math.min(raw.resolveAt, Date.now() + 850) : null,
    finished: cards.every(card => card.matched)
  };
}

export function validateState(raw) {
  const result = initialState();
  if (!isObject(raw)) return result;
  // Import the original prototype's shape without trusting any stored fields.
  const source = raw.schema === 2 && isObject(raw.students) ? raw.students : raw;
  result.current = STUDENTS.includes(raw.current) ? raw.current : STUDENTS[0];
  for (const student of STUDENTS) {
    const entry = source[student];
    if (!isObject(entry)) continue;
    const target = result.students[student];
    target.name = cleanName(entry.name) || target.name;
    target.type = index(entry.type, PETS.length, target.type);
    target.color = index(entry.color, COLOURS.length, target.color);
    target.balance = number(entry.balance, 0);
    target.lifetime = Math.max(target.balance, number(entry.lifetime, 0));
    for (const stat of ['happy', 'full', 'energy']) target[stat] = number(entry[stat], target[stat], 100);
    target.passes = number(entry.passes, 0);
    target.owned = Array.isArray(entry.owned) ? [...new Set(entry.owned.filter(id => SHOP.some(item => item.id === id && !item.treat)))] : [];
    target.wear = target.owned.includes(entry.wear) ? entry.wear : '';
    target.history = Array.isArray(entry.history) ? entry.history.filter(line => typeof line === 'string').slice(0, 30).map(line => line.slice(0, 250)) : [];
    target.round = validateRound(entry.round);
  }
  return result;
}

export function loadState(storage) {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    const legacy = saved === null ? storage.getItem(LEGACY_KEY) : null;
    const text = saved ?? legacy;
    if (text === null) return { state: initialState(), notice: '' };
    const raw = JSON.parse(text);
    const state = validateState(raw);
    const repaired = JSON.stringify(raw) !== JSON.stringify(state);
    return { state, notice: legacy !== null ? 'Imported progress from the original demo in this browser.' : repaired ? 'Saved demo data was checked and repaired. Missing or invalid fields use safe defaults.' : '' };
  } catch {
    return { state: initialState(), notice: 'Saved demo data could not be read. Fresh fictional profiles are available; this browser may not save changes.' };
  }
}

export function activity(pet, text) {
  pet.history.unshift(new Date().toLocaleString('en-GB') + ' — ' + text);
  pet.history = pet.history.slice(0, 30);
}

export function award(pet, awardIndex, teacherOpen) {
  const entry = AWARDS[awardIndex];
  if (!teacherOpen || !entry) return false;
  const [reason, points] = entry;
  if (pet.balance + points > MAX_COUNT || pet.lifetime + points > MAX_COUNT) return false;
  pet.balance += points;
  pet.lifetime += points;
  activity(pet, `Teacher demo awarded ${points} stars: ${reason}`);
  return true;
}

export function grantPass(pet, teacherOpen) {
  if (!teacherOpen || pet.passes >= MAX_COUNT) return false;
  pet.passes++;
  activity(pet, 'Teacher demo granted 1 game pass');
  return true;
}

export function buy(pet, id) {
  const item = SHOP.find(entry => entry.id === id);
  if (!item) return 'Unknown item.';
  if (!item.treat && pet.owned.includes(id)) return 'You already own this accessory.';
  if (pet.balance < item.price) return `Not enough stars yet. ${item.name} costs ${item.price}; you have ${pet.balance}.`;
  pet.balance -= item.price;
  if (item.treat) {
    care(pet, 'happy', 20);
    care(pet, 'full', 25);
  } else {
    pet.owned.push(id);
    pet.wear = id;
  }
  activity(pet, `Bought ${item.name} for ${item.price} stars`);
  return '';
}

export function care(pet, stat, amount) {
  if (['happy', 'full', 'energy'].includes(stat)) pet[stat] = Math.min(100, pet[stat] + amount);
}

export function startRound(pet, random = Math.random) {
  if (pet.round && !pet.round.finished) return 'Finish your saved round first. No extra pass has been used.';
  if (pet.passes < 1) return 'A teacher demo game pass is needed. Open Teacher demo to grant one.';
  const cards = Array.from({ length: 12 }, (_, i) => ({ symbol: i % 6, matched: false }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  pet.round = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, cards, open: [], moves: 0, resolveAt: null, finished: false };
  pet.passes--;
  activity(pet, 'Used 1 pass to start Memory Match');
  return '';
}

export function flipCard(round, i, now = Date.now()) {
  if (!round || round.finished || round.open.length === 2 || !Number.isInteger(i) || !round.cards[i] || round.cards[i].matched || round.open.includes(i)) return false;
  round.open.push(i);
  if (round.open.length === 2) {
    round.moves++;
    const [a, b] = round.open;
    if (round.cards[a].symbol === round.cards[b].symbol) {
      round.cards[a].matched = round.cards[b].matched = true;
      round.open = [];
      round.finished = round.cards.every(card => card.matched);
    } else {
      round.resolveAt = now + 850;
    }
  }
  return true;
}

export function settleRound(round, now = Date.now()) {
  if (!round || round.resolveAt === null || now < round.resolveAt) return false;
  round.open = [];
  round.resolveAt = null;
  return true;
}

// Identity + generation checks stop stale callbacks after switch, reload or reset.
export function createRoundTimer({ schedule = setTimeout, cancel = clearTimeout, now = Date.now } = {}) {
  let handle = null;
  let generation = 0;
  function stop() {
    generation++;
    if (handle !== null) cancel(handle);
    handle = null;
  }
  return {
    stop,
    arm(student, round, getActive, onResolve) {
      stop();
      if (!round || round.resolveAt === null) return;
      const token = generation;
      const roundId = round.id;
      handle = schedule(() => {
        const active = getActive();
        if (token !== generation || active.student !== student || active.round !== round || active.round.id !== roundId) return;
        handle = null;
        if (settleRound(round, now())) onResolve();
      }, Math.max(0, round.resolveAt - now()));
    }
  };
}

export function feedbackText(notes) {
  return `My Art Pets · Cutie Edition\nDemo version: ${VERSION}\n\n${notes.trim() || '(No notes added yet.)'}\n\nProgress is saved only in the current browser on this device. Fictional demo; teacher controls are unrestricted.`;
}
