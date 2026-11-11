import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
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
await access(resolve(output, 'sw.js'));
console.log(
  `Pages checks passed: ${base}, PWA scope, resources, ${catalog.fonts.length} fonts and licenses.`,
);
