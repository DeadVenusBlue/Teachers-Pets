import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERSION, PETS, COLOURS, initialProgress, validateProgress, cleanPetName,
  cleanDisplayName, normaliseEmail, careValue, purchaseChange, createRound,
  startRoundChange, flipCard, settleRound, createRoundTimer,
  formatInviteCode, parseInviteCode
} from '../public/model.js';

const mismatch = round => [0, round.cards.findIndex(card => card.symbol !== round.cards[0].symbol)];

test('fresh online progress is private-profile shaped with no rewards', () => {
  const value = initialProgress();
  assert.equal(value.schema, 3);
  assert.deepEqual([value.balance, value.lifetime, value.passes, value.round], [0, 0, 0, null]);
  assert.deepEqual([value.happy, value.full, value.energy], [75, 70, 80]);
  assert.deepEqual(value.inventory, { bow: false, glasses: false, crown: false, headphones: false });
  assert.equal('students' in value, false);
});

test('names and emails are bounded and normalised before online writes', () => {
  assert.equal(cleanPetName('  Button\n  '), 'Button');
  assert.equal(cleanPetName('a'.repeat(30)).length, 18);
  assert.equal(cleanDisplayName(`  Alex\u0000 ${'R'.repeat(80)}  `).length, 60);
  assert.equal(normaliseEmail('  ALEX@Example.TEST '), 'alex@example.test');
});

test('online snapshots are validated field by field', () => {
  const fixed = validateProgress({
    petName: '', petType: 99, colour: -1, balance: -5, lifetime: 2,
    happy: 500, full: -2, energy: null, passes: Infinity,
    inventory: { bow: true, fake: true }, wear: 'fake', round: { bad: true }
  });
  assert.equal(fixed.petName, 'Pebble');
  assert.deepEqual([fixed.petType, fixed.colour, fixed.balance, fixed.lifetime], [0, 0, 0, 2]);
  assert.deepEqual([fixed.happy, fixed.full, fixed.energy], [100, 0, 80]);
  assert.deepEqual(fixed.inventory, { bow: true, glasses: false, crown: false, headphones: false });
  assert.equal(fixed.wear, '');
  assert.equal(fixed.round, null);
});

test('permanent purchases use exact prices once and never lower lifetime stars', () => {
  const value = initialProgress();
  assert.match(purchaseChange(value, 'bow').error, /Not enough/);
  value.balance = value.lifetime = 25;
  const first = purchaseChange(value, 'bow');
  Object.assign(value, first.change);
  assert.deepEqual([value.balance, value.lifetime, value.inventory.bow, value.wear], [15, 25, true, 'bow']);
  assert.match(purchaseChange(value, 'bow').error, /already own/);
  assert.equal(value.balance, 15);
});

test('repeatable treats deduct five and cap free-care stats at 100', () => {
  const value = initialProgress();
  value.balance = value.lifetime = 10;
  for (let count = 0; count < 2; count++) Object.assign(value, purchaseChange(value, 'sparkle').change);
  assert.deepEqual([value.balance, value.lifetime, value.happy, value.full], [0, 10, 100, 100]);
  assert.equal(careValue(97, 20), 100);
});

test('a new Memory Match round consumes exactly one pass and cannot replace an unfinished round', () => {
  const value = initialProgress();
  assert.match(startRoundChange(value).error, /teacher/);
  value.passes = 2;
  const started = startRoundChange(value, { random: () => 0.2, now: () => 10, randomId: () => 'fixed' });
  Object.assign(value, started.change);
  assert.equal(value.passes, 1);
  assert.equal(value.round.cards.length, 12);
  for (let symbol = 0; symbol < PETS.length; symbol++) assert.equal(value.round.cards.filter(card => card.symbol === symbol).length, 2);
  assert.match(startRoundChange(value).error, /saved round/);
  assert.equal(value.passes, 1);
});

test('matching all pairs finishes without changing stars', () => {
  const value = initialProgress();
  value.passes = 1;
  Object.assign(value, startRoundChange(value).change);
  for (let symbol = 0; symbol < PETS.length; symbol++) {
    const indexes = value.round.cards.flatMap((card, index) => card.symbol === symbol ? [index] : []);
    for (const index of indexes) assert.equal(flipCard(value.round, index), true);
  }
  assert.equal(value.round.finished, true);
  assert.deepEqual([value.balance, value.lifetime, value.passes], [0, 0, 0]);
});

test('mismatches lock until the saved epoch-millisecond deadline', () => {
  const round = createRound({ random: () => 0.3 });
  const [first, second] = mismatch(round);
  assert.equal(flipCard(round, first, 1000), true);
  assert.equal(flipCard(round, first, 1000), false);
  assert.equal(flipCard(round, second, 1000), true);
  assert.equal(round.resolveAt, 1850);
  assert.equal(flipCard(round, 3, 1001), false);
  assert.equal(settleRound(round, 1849), false);
  assert.equal(settleRound(round, 1850), true);
  assert.deepEqual(round.open, []);
});

test('valid saved rounds survive validation and corrupt decks are discarded', () => {
  const value = initialProgress();
  value.passes = 1;
  Object.assign(value, startRoundChange(value).change);
  const [first, second] = mismatch(value.round);
  flipCard(value.round, first, 1000);
  flipCard(value.round, second, 1000);
  const reloaded = validateProgress(structuredClone(value));
  assert.deepEqual(reloaded.round, value.round);
  const bad = structuredClone(value);
  bad.round.cards[0].symbol = 99;
  assert.equal(validateProgress(bad).round, null);
});

test('stale timer callbacks check both generation and round identity', () => {
  let now = 1000;
  const jobs = [];
  const timer = createRoundTimer({ schedule: fn => { jobs.push(fn); return jobs.length; }, cancel() {}, now: () => now });
  const first = createRound();
  for (const index of mismatch(first)) flipCard(first, index, now);
  let active = { uid: 'student-a', roundId: first.id };
  let resolved = 0;
  timer.arm('student-a', first, () => active, () => resolved++);
  active = { uid: 'student-b', roundId: 'another-round' };
  timer.stop();
  now = 2000;
  jobs[0]();
  assert.equal(resolved, 0);
  active = { uid: 'student-a', roundId: first.id };
  timer.arm('student-a', first, () => active, () => resolved++);
  jobs[1]();
  assert.equal(resolved, 1);
});

test('invitation codes accept only bounded Firestore-safe identifiers', () => {
  const code = formatInviteCode('level-1-art', 'a'.repeat(32));
  assert.deepEqual(parseInviteCode(code), { classId: 'level-1-art', inviteId: 'a'.repeat(32), code });
  assert.deepEqual(parseInviteCode(`https://example.test/#join=${encodeURIComponent(code)}`), parseInviteCode(code));
  for (const invalid of ['', 'class:short', '../class:' + 'a'.repeat(32), `class:${'!' .repeat(30)}`]) assert.equal(parseInviteCode(invalid), null);
});

test('version and choice bounds remain aligned with the Cutie Edition UI', () => {
  assert.equal(VERSION, '0.3.0');
  assert.equal(PETS.length, 6);
  assert.equal(COLOURS.length, 5);
});
