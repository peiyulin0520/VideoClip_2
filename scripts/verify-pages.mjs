import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = '/VideoClip_2/';
const output = resolve('dist');
const html = await readFile(resolve(output, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(resolve(output, 'manifest.webmanifest'), 'utf8'));
for (const key of ['id', 'scope', 'start_url']) assert.equal(manifest[key], base, key);
assert.equal(manifest.name, 'Little Moments');
assert.match(html, /<title>Little Moments<\/title>/);
assert(!html.includes('/VideoClip/'), 'HTML still links to the reference app');
for (const [, resource] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert(resource.startsWith(base), `Resource outside deployment path: ${resource}`);
  await access(resolve(output, resource.slice(base.length)));
}
for (const icon of manifest.icons) await access(resolve(output, icon.src));
const catalog = JSON.parse(await readFile('src/fonts/catalog.generated.json', 'utf8'));
for (const font of catalog.fonts) {
  for (const face of font.faces) await access(resolve(output, 'fonts', font.key, face.file));
  await access(resolve(output, 'fonts', font.key, font.licenseFile));
  await access(resolve(output, 'fonts', font.key, font.preview));
}
const mainScripts = [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)].map(
  (match) => match[1],
);
assert.equal(mainScripts.length, 1, 'The app must load one complete code bundle');
const mainCode = await readFile(resolve(output, mainScripts[0].slice(base.length)), 'utf8');
assert(
  !/\bimport\s*\(\s*['"]\.[^'"]+\.js/.test(mainCode),
  'Project initialization must not fetch relative lazy code chunks',
);
const appBundles = (await readdir(resolve(output, 'assets'))).filter(
  (name) => name.endsWith('.js') && !/worker/i.test(name),
);
assert.equal(appBundles.length, 1, 'Renderer modules must be in the main bundle, with workers kept separate');
const sw = await readFile(resolve(output, 'sw.js'), 'utf8');
assert(sw.includes(mainScripts[0].slice(base.length)), 'The complete app code must be precached');
assert.match(
  sw,
  /self\.addEventListener\(["']message["'],[\s\S]{0,180}SKIP_WAITING[\s\S]{0,100}self\.skipWaiting\(\)/,
  'Worker activation must require an explicit update message',
);
assert.equal([...sw.matchAll(/self\.skipWaiting\(\)/g)].length, 1, 'No unconditional worker activation');
assert(!sw.includes('.clientsClaim()'), 'New workers must not take over an existing document');
console.log(
  `Pages checks passed: ${base}, PWA scope, resources, ${catalog.fonts.length} fonts and licenses.`,
);
