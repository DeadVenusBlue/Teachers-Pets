import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERSION, STORAGE_KEY, LEGACY_KEY, initialState, validateState, loadState, cleanName,
  award, grantPass, buy, care, startRound, flipCard, settleRound, createRoundTimer, feedbackText
} from '../public/model.js';

const pet = () => initialState().students.Alex;
const memoryStorage = entries => ({ getItem: key => entries[key] ?? null });
const mismatch = round => [0, round.cards.findIndex(card => card.symbol !== round.cards[0].symbol)];

test('fresh demo has three fictional students, free care and zero stars/passes', () => {
  const state = initialState();
  assert.deepEqual(Object.keys(state.students), ['Alex', 'Jamie', 'Taylor']);
  for (const p of Object.values(state.students)) {
    assert.equal(p.balance, 0); assert.equal(p.lifetime, 0); assert.equal(p.passes, 0); assert.equal(p.round, null);
  }
  const p = state.students.Alex;
  for (let i = 0; i < 10; i++) for (const stat of ['happy', 'full', 'energy']) care(p, stat, 25);
  assert.deepEqual([p.happy, p.full, p.energy, p.balance, p.lifetime], [100, 100, 100, 0, 0]);
});

test('only explicit teacher demo actions award stars or passes', () => {
  const p = pet();
  assert.equal(award(p, 0, false), false); assert.equal(grantPass(p, false), false);
  assert.equal(p.balance, 0); assert.equal(p.passes, 0);
  assert.equal(award(p, 0, true), true); assert.equal(grantPass(p, true), true);
  assert.deepEqual([p.balance, p.lifetime, p.passes], [3, 3, 1]);
});

test('insufficient funds and duplicate permanent purchases never spend stars', () => {
  const p = pet();
  assert.match(buy(p, 'bow'), /Not enough/); assert.equal(p.balance, 0);
  p.balance = p.lifetime = 25;
  assert.equal(buy(p, 'bow'), '');
  assert.deepEqual([p.balance, p.lifetime, p.wear], [15, 25, 'bow']);
  assert.deepEqual(p.owned, ['bow']);
  assert.match(buy(p, 'bow'), /already own/); assert.equal(p.balance, 15);
  assert.equal(buy(p, 'glasses'), ''); assert.equal(p.balance, 0); assert.equal(p.lifetime, 25);
});

test('repeatable treats cap care at 100 and preserve permanent collection/lifetime', () => {
  const p = pet(); p.balance = p.lifetime = 10;
  assert.equal(buy(p, 'sparkle'), ''); assert.equal(buy(p, 'sparkle'), '');
  assert.deepEqual([p.balance, p.lifetime, p.happy, p.full], [0, 10, 100, 100]);
  assert.deepEqual(p.owned, []);
});

test('saved shape is repaired field by field without throwing or losing healthy profiles', () => {
  const raw = initialState();
  raw.current = 'Someone real';
  Object.assign(raw.students.Alex, { name: '   ', type: 400, color: -2, balance: -3, lifetime: 'ten', happy: 900, full: -50, energy: null, passes: Infinity, owned: ['bow', 'bow', 'sparkle', 'fake'], wear: 'fake', history: [42, 'safe'] });
  raw.students.Jamie.name = 'Healthy'; delete raw.students.Taylor;
  const fixed = validateState(raw);
  assert.equal(fixed.current, 'Alex'); assert.equal(fixed.students.Alex.name, 'Pebble');
  assert.deepEqual([fixed.students.Alex.type, fixed.students.Alex.color, fixed.students.Alex.happy, fixed.students.Alex.full, fixed.students.Alex.energy], [0, 0, 100, 0, 80]);
  assert.deepEqual(fixed.students.Alex.owned, ['bow']); assert.equal(fixed.students.Alex.wear, '');
  assert.deepEqual(fixed.students.Alex.history, ['safe']);
  assert.equal(fixed.students.Jamie.name, 'Healthy'); assert.equal(fixed.students.Taylor.name, 'Pip');
  assert.equal(validateState({ Alex: { balance: 25, lifetime: 10 } }).students.Alex.lifetime, 25);
});

test('malformed JSON, null, arrays and blocked storage recover gracefully', () => {
  for (const value of ['{broken', 'null', '[]', 'false', '"hello"']) {
    const result = loadState(memoryStorage({ [STORAGE_KEY]: value }));
    assert.deepEqual(result.state, initialState()); assert.ok(result.notice);
  }
  assert.ok(loadState({ getItem() { throw Error('blocked'); } }).notice);
  assert.ok(loadState(null).notice);
});

test('legacy progress migrates and JSON reload preserves valid names and purchases', () => {
  const legacy = initialState().students;
  legacy.Alex.name = 'Button'; legacy.Alex.balance = 8; legacy.Alex.lifetime = 18; legacy.Alex.owned = ['bow']; legacy.Alex.wear = 'bow';
  const loaded = loadState(memoryStorage({ [LEGACY_KEY]: JSON.stringify(legacy) }));
  assert.match(loaded.notice, /Imported/);
  const reloaded = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(loaded.state) }));
  assert.deepEqual(reloaded.state, loaded.state); assert.equal(reloaded.notice, '');
});

test('names are trimmed, bounded and control characters removed', () => {
  assert.equal(cleanName('  Button\n  '), 'Button'); assert.equal(cleanName('a'.repeat(30)).length, 18);
  assert.equal(cleanName(null), ''); assert.equal(cleanName('  '), '');
});

test('round consumes exactly one pass and cannot be replaced while unfinished', () => {
  const p = pet(); assert.match(startRound(p), /needed/);
  grantPass(p, true); grantPass(p, true); assert.equal(startRound(p), '');
  const first = p.round;
  assert.match(startRound(p), /saved round/); assert.equal(p.round, first); assert.equal(p.passes, 1);
  assert.equal(p.round.cards.length, 12);
  for (let s = 0; s < 6; s++) assert.equal(p.round.cards.filter(c => c.symbol === s).length, 2);
});

test('matching every pair finishes without awarding stars and a new round uses one pass', () => {
  const p = pet(); p.passes = 2; startRound(p);
  for (let s = 0; s < 6; s++) {
    const indices = p.round.cards.flatMap((c, i) => c.symbol === s ? [i] : []);
    for (const i of indices) assert.equal(flipCard(p.round, i), true);
  }
  assert.equal(p.round.finished, true); assert.equal(p.round.moves, 6);
  assert.deepEqual([p.balance, p.lifetime, p.passes], [0, 0, 1]);
  const oldId = p.round.id; assert.equal(startRound(p), '');
  assert.notEqual(p.round.id, oldId); assert.equal(p.passes, 0);
});

test('mismatch locks flipping until its deadline; duplicate/invalid flips are ignored', () => {
  const p = pet(); p.passes = 1; startRound(p);
  const [a, b] = mismatch(p.round);
  assert.equal(flipCard(p.round, a, 1000), true);
  assert.equal(flipCard(p.round, a, 1000), false); assert.equal(flipCard(p.round, -1), false);
  flipCard(p.round, b, 1000);
  assert.equal(p.round.moves, 1); assert.equal(flipCard(p.round, 3, 1001), false);
  assert.equal(settleRound(p.round, 1849), false); assert.equal(settleRound(p.round, 1850), true);
  assert.deepEqual(p.round.open, []); assert.equal(p.round.resolveAt, null);
});

test('unfinished and pending rounds survive JSON reload; corrupted rounds are discarded', () => {
  const state = initialState(); const p = state.students.Alex; p.passes = 1; startRound(p);
  const [a, b] = mismatch(p.round); flipCard(p.round, a); flipCard(p.round, b);
  const reloaded = validateState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(reloaded.students.Alex.round, p.round);
  assert.equal(reloaded.students.Alex.passes, 0);
  const bad = structuredClone(state); bad.students.Alex.round.cards[0].symbol = 99;
  assert.equal(validateState(bad).students.Alex.round, null);
});

test('cancelled callback cannot mutate a different student, reset state or a new round', () => {
  let now = 1000;
  const jobs = [];
  const timer = createRoundTimer({ schedule: fn => { jobs.push(fn); return jobs.length; }, cancel() {}, now: () => now });
  let state = initialState();
  for (const name of ['Alex', 'Jamie']) { state.students[name].passes = 1; startRound(state.students[name]); }
  const roundA = state.students.Alex.round;
  for (const i of mismatch(roundA)) flipCard(roundA, i, now);
  let student = 'Alex';
  const getActive = () => ({ student, round: state.students[student].round });
  let resolved = 0;
  timer.arm(student, roundA, getActive, () => resolved++);
  student = 'Jamie'; timer.stop();
  const roundB = state.students.Jamie.round;
  flipCard(roundB, 0, now); now = 2000; jobs[0]();
  assert.deepEqual(roundB.open, [0]); assert.equal(roundA.open.length, 2); assert.equal(resolved, 0);
  student = 'Alex'; timer.arm(student, roundA, getActive, () => resolved++); jobs[1]();
  assert.equal(roundA.open.length, 0); assert.equal(resolved, 1);
  for (const i of mismatch(roundA)) flipCard(roundA, i, now);
  timer.arm(student, roundA, getActive, () => resolved++);
  timer.stop(); state = initialState(); jobs[2]();
  assert.equal(state.students.Alex.round, null); assert.equal(resolved, 1);
  state.students.Alex.passes = 1; startRound(state.students.Alex); jobs[2]();
  assert.deepEqual(state.students.Alex.round.open, []); assert.equal(resolved, 1);
});

test('feedback includes the exact displayed version and browser-only limits', () => {
  const text = feedbackText('  Lovely pets!  ');
  assert.ok(text.includes(VERSION)); assert.match(text, /Lovely pets!/); assert.match(text, /current browser/);
});
