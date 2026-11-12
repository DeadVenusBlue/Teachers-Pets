// This lightweight DOM harness runs real app event handlers. It is not a browser
// and makes no claims about rendering, clipboard permissions or touch behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STORAGE_KEY, FEEDBACK_KEY, VERSION, initialState } from '../public/model.js';

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName; this.children = []; this.handlers = {}; this.attributes = {};
    this.dataset = {}; this.style = {}; this.value = ''; this.hidden = false;
    this.disabled = false; this.className = ''; this._text = ''; this._html = '';
    this.classList = { toggle: (name, active) => {
      const values = new Set(this.className.split(' ').filter(Boolean));
      if (active) values.add(name); else values.delete(name);
      this.className = [...values].join(' ');
    } };
  }
  set textContent(value) { this._text = value; }
  get textContent() { return this._text; }
  set innerHTML(value) { this._html = value; this.children = []; }
  get innerHTML() { return this._html; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children.forEach(node => node.parent = null); this.children = []; this.append(...nodes); }
  addEventListener(name, handler) { (this.handlers[name] ||= []).push(handler); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  querySelector(tag) { return this.children.find(node => node.tagName === tag) || this.children.map(node => node.querySelector(tag)).find(Boolean); }
  contains(target) { return this === target || this.children.some(node => node.contains(target)); }
  focus() { document.activeElement = this; }
  select() { this.selected = true; }
  get firstElementChild() { return this.children[0]; }
  async emit(name, extra = {}) {
    for (const handler of this.handlers[name] || []) await handler({ target: this, preventDefault() {}, ...extra });
  }
}

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
let bootNumber = 0;
async function boot({ data = {}, blocked = false, clipboardRejects = false } = {}) {
  const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
  const values = new Map(Object.entries(data));
  const jobs = [];
  const app = { now: 10000, jobs, values, elements, copied: '', confirmations: 0, confirmResult: true };
  const storage = {
    getItem(key) { if (blocked) throw Error('Storage blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw Error('Storage blocked'); values.set(key, value); },
    removeItem(key) { if (blocked) throw Error('Storage blocked'); values.delete(key); }
  };
  globalThis.document = {
    activeElement: null, visibilityState: 'visible',
    getElementById: id => elements[id], createElement: tag => new Element(tag), addEventListener() {}
  };
  globalThis.window = { localStorage: storage, addEventListener() {}, confirm() { app.confirmations++; return app.confirmResult; } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { async writeText(text) {
    if (clipboardRejects) throw Error('Permission unavailable'); app.copied = text;
  } } } });
  const realSet = globalThis.setTimeout;
  const realClear = globalThis.clearTimeout;
  globalThis.setTimeout = fn => { jobs.push(fn); return jobs.length; };
  globalThis.clearTimeout = () => {};
  Date.now = () => app.now;
  try { await import(`../public/app.js?test=${++bootNumber}`); }
  finally { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; }
  app.saved = () => JSON.parse(values.get(STORAGE_KEY));
  app.click = async id => elements[id].emit('click');
  app.switchTo = async name => { elements.student.value = name; await elements.student.emit('change'); };
  return app;
}

test('real app handlers through a simulated DOM', async t => {
  const realNow = Date.now;
  try {
    await t.test('awards, insufficient balance, purchases, collection, milestones and care', async () => {
      const a = await boot(); const e = a.elements;
      assert.equal(e.shop.children.length, 5); assert.equal(e.pets.children.length, 6);
      await e.shop.children[0].querySelector('button').emit('click');
      assert.match(e.message.textContent, /Not enough/); assert.equal(a.saved().students.Alex.balance, 0);
      await e.awards.children[0].emit('click'); assert.equal(a.saved().students.Alex.balance, 0);
      await a.click('teacherToggle');
      for (let i = 0; i < 10; i++) await e.awards.children[0].emit('click');
      assert.equal(a.saved().students.Alex.balance, 30);
      await e.shop.children[0].querySelector('button').emit('click');
      assert.equal(a.saved().students.Alex.balance, 20); assert.equal(a.saved().students.Alex.lifetime, 30);
      assert.equal(e.shop.children[0].querySelector('button').disabled, true);
      await e.shop.children[0].querySelector('button').emit('click'); assert.equal(a.saved().students.Alex.balance, 20);
      assert.equal(e.badges.children.filter(node => node.className.includes('earned')).length, 2);
      await e.owned.children[0].emit('click'); assert.equal(a.saved().students.Alex.wear, '');
      await e.owned.children[1].emit('click'); assert.equal(a.saved().students.Alex.wear, 'bow');
      for (let i = 0; i < 5; i++) for (const id of ['feed', 'play', 'rest']) await a.click(id);
      assert.deepEqual([e.happyBar.value, e.fullBar.value, e.energyBar.value], [100, 100, 100]);
      assert.equal(a.saved().students.Alex.balance, 20);
      const reloaded = await boot({ data: Object.fromEntries(a.values) });
      assert.equal(reloaded.saved().students.Alex.balance, 20);
      assert.equal(reloaded.saved().students.Alex.lifetime, 30);
      assert.deepEqual(reloaded.saved().students.Alex.owned, ['bow']);
      assert.equal(reloaded.saved().students.Alex.wear, 'bow');
      assert.equal(reloaded.elements.fullBar.value, 100);
    });

    await t.test('renaming, all pet/colour choices and reload persistence', async () => {
      const a = await boot(); const e = a.elements;
      e.rename.value = '  Button  '; await e.renameForm.emit('submit');
      assert.equal(e.petName.textContent, 'Button');
      e.rename.value = '   '; await e.renameForm.emit('submit');
      assert.match(e.message.textContent, /enter a pet name/); assert.equal(e.petName.textContent, 'Button');
      for (let i = 0; i < 6; i++) { await e.pets.children[i].emit('click'); assert.equal(a.saved().students.Alex.type, i); }
      for (let i = 0; i < 5; i++) { await e.colors.children[i].emit('click'); assert.equal(a.saved().students.Alex.color, i); }
      await a.switchTo('Jamie'); assert.equal(e.petName.textContent, 'Mochi');
      await a.switchTo('Alex'); assert.equal(e.petName.textContent, 'Button');
      const b = await boot({ data: Object.fromEntries(a.values) });
      assert.equal(b.elements.petName.textContent, 'Button'); assert.equal(b.saved().students.Alex.type, 5);
      assert.equal(b.elements.teacherPanel.hidden, true);
    });

    await t.test('switching with a pending mismatch preserves both students and renders the saved round again', async () => {
      const a = await boot(); const e = a.elements;
      await a.click('teacherToggle'); await a.click('grantPass'); await a.click('startGame');
      const roundA = a.saved().students.Alex.round;
      const other = roundA.cards.findIndex(c => c.symbol !== roundA.cards[0].symbol);
      await e.memory.children[0].emit('click'); await e.memory.children[other].emit('click');
      const stale = a.jobs.at(-1); assert.equal(a.saved().students.Alex.round.open.length, 2);
      await a.switchTo('Jamie'); assert.equal(e.game.hidden, true);
      await a.click('grantPass'); await a.click('startGame'); await e.memory.children[0].emit('click');
      a.now += 1000; stale();
      assert.deepEqual(a.saved().students.Jamie.round.open, [0]);
      await a.switchTo('Alex'); assert.equal(e.memory.children.length, 12);
      assert.deepEqual(a.saved().students.Alex.round.open, []); assert.equal(a.saved().students.Alex.passes, 0);
      await a.switchTo('Taylor'); await a.switchTo('Alex');
      assert.equal(e.memory.children.length, 12); assert.equal(a.saved().students.Alex.round.id, roundA.id);
      const b = await boot({ data: Object.fromEntries(a.values) });
      assert.equal(b.elements.memory.children.length, 12); assert.equal(b.saved().students.Alex.round.id, roundA.id);
    });

    await t.test('completing Memory Match never awards stars', async () => {
      const a = await boot(); const e = a.elements;
      await a.click('teacherToggle'); await a.click('grantPass'); await a.click('startGame');
      const cards = a.saved().students.Alex.round.cards;
      for (let symbol = 0; symbol < 6; symbol++) {
        for (let i = 0; i < 12; i++) if (cards[i].symbol === symbol) await e.memory.children[i].emit('click');
      }
      assert.match(e.gameStatus.textContent, /all six pairs in 6 moves/);
      assert.equal(a.saved().students.Alex.balance, 0); assert.equal(a.saved().students.Alex.lifetime, 0);
      assert.equal(e.startGame.disabled, false);
    });

    await t.test('reset cancels pending callbacks, clears every profile and active game, preserves notes', async () => {
      const a = await boot({ data: { [FEEDBACK_KEY]: 'Keep the frog!' } }); const e = a.elements;
      await a.click('teacherToggle'); await a.click('grantPass'); await a.click('startGame');
      const cards = a.saved().students.Alex.round.cards;
      await e.memory.children[0].emit('click'); await e.memory.children[cards.findIndex(c => c.symbol !== cards[0].symbol)].emit('click');
      const stale = a.jobs.at(-1);
      a.confirmResult = false; await a.click('reset'); assert.ok(a.saved().students.Alex.round);
      a.confirmResult = true; await a.click('reset');
      assert.equal(a.confirmations, 2); assert.deepEqual(a.saved(), initialState());
      assert.equal(e.game.hidden, true); assert.equal(e.memory.children.length, 0);
      assert.equal(e.feedback.value, 'Keep the frog!');
      a.now += 1000; stale(); assert.deepEqual(a.saved(), initialState());
      await a.click('grantPass'); await a.click('startGame'); stale();
      assert.deepEqual(a.saved().students.Alex.round.open, []);
    });

    await t.test('malformed/incomplete/blocked saves still allow care and show recovery status', async () => {
      const a = await boot({ data: { [STORAGE_KEY]: '{oops' } });
      assert.match(a.elements.message.textContent, /could not be read/);
      await a.click('feed'); assert.equal(a.elements.fullBar.value, 90);
      const b = await boot({ data: { [STORAGE_KEY]: JSON.stringify({ schema: 2, students: { Alex: { owned: ['missing'], happy: 999 } } }) } });
      assert.equal(b.elements.happyBar.value, 100); assert.equal(b.elements.petName.textContent, 'Pebble');
      const c = await boot({ blocked: true });
      assert.equal(c.elements.storageWarning.hidden, false); await c.click('feed'); assert.equal(c.elements.fullBar.value, 90);
    });

    await t.test('feedback draft persistence, versioned copying and manual fallback', async () => {
      const a = await boot(); a.elements.feedback.value = 'Love the pets';
      await a.elements.feedback.emit('input'); assert.equal(a.values.get(FEEDBACK_KEY), 'Love the pets');
      await a.click('copyFeedback'); assert.ok(a.copied.includes(VERSION)); assert.match(a.copied, /Love the pets/);
      assert.equal(a.elements.version.textContent, `Demo v${VERSION}`);
      const b = await boot({ clipboardRejects: true, data: Object.fromEntries(a.values) });
      await b.click('copyFeedback'); assert.equal(b.elements.copyFallback.hidden, false);
      assert.ok(b.elements.feedbackCopy.value.includes(VERSION)); assert.equal(b.elements.feedbackCopy.selected, true);
    });
  } finally { Date.now = realNow; }
});
