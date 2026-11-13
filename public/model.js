/* Browser-independent My Art Pets rules. Firestore rules repeat every reward invariant. */
export const VERSION = '0.3.0';
export const PENDING_INVITE_KEY = 'my-art-pets-pending-invite-v1';
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
export const MAX_COUNT = 1_000_000;
export const INVENTORY_IDS = SHOP.filter(item => !item.treat).map(item => item.id);

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, fallback, max = MAX_COUNT) => Number.isInteger(value) ? Math.max(0, Math.min(max, value)) : fallback;
const validIndex = (value, length, fallback) => Number.isInteger(value) && value >= 0 && value < length ? value : fallback;

export function cleanPetName(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 18) : '';
}

export function cleanDisplayName(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 60) : '';
}

export function normaliseEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 254) : '';
}

export function emptyInventory() {
  return { bow: false, glasses: false, crown: false, headphones: false };
}

export function initialProgress(updatedAt = null) {
  return {
    schema: 3, petName: 'Pebble', petType: 0, colour: 0,
    balance: 0, lifetime: 0, happy: 75, full: 70, energy: 80,
    inventory: emptyInventory(), wear: '', passes: 0, round: null, updatedAt
  };
}

export function validateRound(raw) {
  if (!isObject(raw) || typeof raw.id !== 'string' || !raw.id || raw.id.length > 100) return null;
  if (!Array.isArray(raw.cards) || raw.cards.length !== 12) return null;
  const cards = raw.cards.map(card => isObject(card)
    && Number.isInteger(card.symbol) && card.symbol >= 0 && card.symbol < PETS.length
    && typeof card.matched === 'boolean'
    ? { symbol: card.symbol, matched: card.matched }
    : null);
  if (cards.some(card => !card)) return null;
  for (let symbol = 0; symbol < PETS.length; symbol++) {
    const pair = cards.filter(card => card.symbol === symbol);
    if (pair.length !== 2 || pair[0].matched !== pair[1].matched) return null;
  }
  if (!Array.isArray(raw.open) || raw.open.length > 2 || new Set(raw.open).size !== raw.open.length) return null;
  if (raw.open.some(index => !Number.isInteger(index) || !cards[index] || cards[index].matched)) return null;
  if (raw.open.length === 2 && (cards[raw.open[0]].symbol === cards[raw.open[1]].symbol || !Number.isFinite(raw.resolveAt))) return null;
  return {
    id: raw.id,
    cards,
    open: [...raw.open],
    moves: integer(raw.moves, 0),
    resolveAt: raw.open.length === 2 ? Math.max(0, Math.floor(raw.resolveAt)) : null,
    finished: cards.every(card => card.matched)
  };
}

export function validateProgress(raw) {
  const result = initialProgress(raw?.updatedAt ?? null);
  if (!isObject(raw)) return result;
  result.petName = cleanPetName(raw.petName) || result.petName;
  result.petType = validIndex(raw.petType, PETS.length, result.petType);
  result.colour = validIndex(raw.colour, COLOURS.length, result.colour);
  result.balance = integer(raw.balance, 0);
  result.lifetime = Math.max(result.balance, integer(raw.lifetime, 0));
  for (const stat of ['happy', 'full', 'energy']) result[stat] = integer(raw[stat], result[stat], 100);
  result.inventory = Object.fromEntries(INVENTORY_IDS.map(id => [id, raw.inventory?.[id] === true]));
  result.wear = INVENTORY_IDS.includes(raw.wear) && result.inventory[raw.wear] ? raw.wear : '';
  result.passes = integer(raw.passes, 0);
  result.round = validateRound(raw.round);
  return result;
}

export function careValue(current, amount) {
  return Math.min(100, current + amount);
}

export function purchaseChange(progress, itemId) {
  const item = SHOP.find(entry => entry.id === itemId);
  if (!item) return { error: 'That shop item is unavailable.' };
  if (!item.treat && progress.inventory[itemId]) return { error: 'You already own this accessory.' };
  if (progress.balance < item.price) return { error: `Not enough stars yet. ${item.name} costs ${item.price}; you have ${progress.balance}.` };
  if (item.treat) {
    return { item, change: { balance: progress.balance - item.price, happy: careValue(progress.happy, 20), full: careValue(progress.full, 25) } };
  }
  return { item, change: { balance: progress.balance - item.price, inventory: { ...progress.inventory, [itemId]: true }, wear: itemId } };
}

export function createRound({ random = Math.random, now = Date.now, randomId = () => Math.random().toString(36).slice(2) } = {}) {
  const cards = Array.from({ length: 12 }, (_, index) => ({ symbol: index % PETS.length, matched: false }));
  for (let index = cards.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return { id: `${now()}-${randomId()}`.slice(0, 100), cards, open: [], moves: 0, resolveAt: null, finished: false };
}

export function startRoundChange(progress, options) {
  if (progress.round && !progress.round.finished) return { error: 'Finish your saved round first. No extra pass has been used.' };
  if (progress.passes < 1) return { error: 'Ask your teacher for a Memory Match pass first.' };
  return { change: { passes: progress.passes - 1, round: createRound(options) } };
}

export function flipCard(round, index, now = Date.now()) {
  if (!round || round.finished || round.open.length === 2 || !Number.isInteger(index)
      || !round.cards[index] || round.cards[index].matched || round.open.includes(index)) return false;
  round.open.push(index);
  if (round.open.length === 2) {
    round.moves++;
    const [first, second] = round.open;
    if (round.cards[first].symbol === round.cards[second].symbol) {
      round.cards[first].matched = true;
      round.cards[second].matched = true;
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

// Generation and UID/round-ID checks stop callbacks after snapshots, sign-out or role changes.
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
    arm(uid, round, getActive, onResolve) {
      stop();
      if (!round || round.resolveAt === null) return;
      const token = generation;
      const roundId = round.id;
      handle = schedule(() => {
        const active = getActive();
        if (token !== generation || active.uid !== uid || active.roundId !== roundId) return;
        handle = null;
        onResolve(roundId);
      }, Math.max(0, round.resolveAt - now()));
    }
  };
}

export function formatInviteCode(classId, inviteId) {
  return `${classId}:${inviteId}`;
}

export function parseInviteCode(value) {
  if (typeof value !== 'string') return null;
  let candidate = value.trim();
  const marker = candidate.match(/#join=([^&]+)/);
  if (marker) {
    try { candidate = decodeURIComponent(marker[1]); } catch { return null; }
  }
  const separator = candidate.indexOf(':');
  if (separator < 1) return null;
  const classId = candidate.slice(0, separator);
  const inviteId = candidate.slice(separator + 1);
  const safe = /^[A-Za-z0-9_-]+$/;
  return safe.test(classId) && safe.test(inviteId)
    && classId.length <= 120 && inviteId.length >= 20 && inviteId.length <= 120
    ? { classId, inviteId, code: formatInviteCode(classId, inviteId) }
    : null;
}
