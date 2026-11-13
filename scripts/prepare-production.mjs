// Package only the reviewed public assets, with production-only Firebase wiring.
// The development source remains buildless and keeps its local emulator support.
import { mkdir, readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { firebaseConfig, LIVE_PROJECT_ID } from '../public/firebase-config.js';

const root = new URL('../', import.meta.url);
const release = new URL('.firebase/production/', root);
const assets = ['index.html', 'styles.css', 'app.js', 'model.js', 'artwork.js', 'firebase-client.js', 'firebase-config.js', 'assets/paw.svg'];

async function safeDirectory(url) {
  await mkdir(url, { recursive: true });
  if ((await lstat(url)).isSymbolicLink()) throw new Error('Release directories must not be symbolic links.');
}

await safeDirectory(new URL('.firebase/', root));
await safeDirectory(release);
await safeDirectory(new URL('public/', release));
await safeDirectory(new URL('public/assets/', release));

for (const asset of assets) {
  let source = await readFile(new URL(`public/${asset}`, root), 'utf8');
  if (asset === 'firebase-config.js') {
    const config = firebaseConfig('erins-proj-788fe.web.app');
    assert.equal(config.projectId, 'erins-proj-788fe');
    assert.equal(LIVE_PROJECT_ID, config.projectId);
    source = `// Generated production-only Firebase web configuration.\nexport const LIVE_PROJECT_ID = ${JSON.stringify(LIVE_PROJECT_ID)};\nexport function firebaseConfig() { return ${JSON.stringify(config, null, 2)}; }\n`;
  }
  if (asset === 'firebase-client.js') {
    source = source.replaceAll('\r\n', '\n');
    const connectionBlock = /  if \(local\) \{\n    connectAuthEmulator\(auth, 'http:\/\/127\.0\.0\.1:9099', \{ disableWarnings: true \}\);\n    connectFirestoreEmulator\(db, '127\.0\.0\.1', 8080\);\n  \}\n/;
    assert.ok(connectionBlock.test(source), 'Development connection block changed: review release packaging.');
    source = source.replace(connectionBlock, '')
      .replace('getAuth, connectAuthEmulator,', 'getAuth,')
      .replace('getFirestore, connectFirestoreEmulator,', 'getFirestore,')
      .replace('firebaseConfig, isLocalEmulatorHost', 'firebaseConfig')
      .replace('const local = isLocalEmulatorHost(hostname);', 'const local = false;');
  }
  assert.doesNotMatch(source, /localhost|127\.0\.0\.1|demo-my-art-pets|connectAuthEmulator|connectFirestoreEmulator|Teacher123|Student123|example\.test|private_key|firebase-admin/);
  const target = new URL(`public/${asset}`, release);
  await writeFile(target, source);
  if (asset.endsWith('.js')) {
    const checked = spawnSync(process.execPath, ['--check', fileURLToPath(target)], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr);
  }
}
const actual = (await readdir(new URL('public/', release), { recursive: true })).map(path => path.replaceAll('\\', '/')).filter(path => path !== 'assets').sort();
assert.deepEqual(actual, [...assets].sort(), 'Unexpected file in release public directory.');
const config = JSON.parse(await readFile(new URL('firebase.json', root), 'utf8'));
for (const group of config.hosting.headers) for (const header of group.headers) {
  if (header.key === 'Content-Security-Policy') header.value = header.value.replace(' http://127.0.0.1:* ws://127.0.0.1:*', '');
}
const production = { hosting: { ...config.hosting, public: 'public' } };
assert.doesNotMatch(JSON.stringify(production), /localhost|127\.0\.0\.1|emulators/);
await writeFile(new URL('firebase.json', release), JSON.stringify(production, null, 2) + '\n');
console.log(`Prepared ${assets.length} production assets in .firebase/production/public; no emulator endpoints or seed credentials.`);
