import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
import { drawPet } from '../public/artwork.js';
import { PETS, VERSION } from '../public/model.js';

const root = new URL('../', import.meta.url);
test('all six original pet drawings are preserved', async () => {
  const source = await readFile(new URL('My_Art_Pets_Cutie_Edition.html', root), 'utf8');
  const start = source.indexOf('function drawPet(t)');
  const end = source.indexOf('function render()', start);
  assert.ok(start > 0 && end > start);
  const context = vm.createContext({ types: PETS.map(name => ['', name]) });
  vm.runInContext(source.slice(start, end), context);
  for (let i = 0; i < PETS.length; i++) {
    const original = vm.runInContext(`drawPet(${i})`, context).replace(' width="190" height="190"', '');
    assert.equal(drawPet(i), original, `Original ${PETS[i]} illustration changed`);
  }
});

test('Hosting contains only static public assets and uses the user-confirmed project', async () => {
  const config = JSON.parse(await readFile(new URL('firebase.json', root), 'utf8'));
  assert.deepEqual(Object.keys(config), ['hosting']); assert.equal(config.hosting.public, 'public');
  assert.equal(config.hosting.site, undefined); assert.equal(config.hosting.target, undefined);
  const project = JSON.parse(await readFile(new URL('.firebaserc', root), 'utf8'));
  assert.deepEqual(project, { projects: { default: 'erins-proj-788fe' } });
  assert.ok(config.hosting.headers[0].headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex')));
  const files = await readdir(new URL('public/', root), { recursive: true });
  assert.ok(!files.some(file => /\.html$/.test(file) && file !== 'index.html'));
  assert.ok(!files.some(file => /README|AGENTS|DEVELOPMENT|firebase|test|node_modules/.test(file)));
  const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(packageJson.version, VERSION); assert.equal(packageJson.dependencies, undefined);
});

test('page references resolve; noindex, form labels, focus and reduced motion rules exist', async () => {
  const html = await readFile(new URL('public/index.html', root), 'utf8');
  const css = await readFile(new URL('public/styles.css', root), 'utf8');
  assert.match(html, /name="robots" content="noindex/);
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const match of html.matchAll(/(?:for|aria-controls)="([^"]+)"/g)) assert.ok(ids.includes(match[1]), `Missing target ${match[1]}`);
  for (const match of html.matchAll(/(?:href|src)="([^"#][^"]+)"/g)) {
    assert.ok(!/^https?:/.test(match[1]), 'Unexpected external resource');
    await readFile(new URL('public/' + match[1].replace(/^\.\//, ''), root));
  }
  assert.match(css, /:focus-visible/); assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(max-width: 650px\)/); assert.match(css, /min-height: 46px/);
});
