import { openDB } from 'idb';
import { afterEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
afterEach(() => vi.unstubAllGlobals());
import { getDB } from './db';
import { listLibrary, saveLibrary, removeLibrary, writeGiphyKey, readGiphyKey } from './library';
import { createProject } from '../model/defaults';
import { putMedia, getMedia } from './media';

it('v2 升級保留專案、字體與原檔；收藏獨立於專案，Key 不進專案或收藏', async () => {
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('File', NodeFile);
  const old = await openDB('little-moments-videoclip-2', 2, {
    upgrade(db) {
      db.createObjectStore('projects', { keyPath: 'id' });
      db.createObjectStore('blobs');
      db.createObjectStore('meta');
      db.createObjectStore('userFonts', { keyPath: 'id' });
    },
  });
  const project = createProject('以前的專案');
  await old.put('projects', project);
  await old.put('userFonts', {
    id: 'font',
    name: '自己的字體',
    file: new Blob(['font-data']),
    bytes: 9,
    createdAt: 1,
  });
  old.close();
  const db = await getDB();
  expect(db.version).toBe(3);
  expect((await db.get('projects', project.id))?.name).toBe(project.name);
  expect((await db.get('userFonts', 'font'))?.file.size).toBe(9);
  const record = await saveLibrary(new Blob(['my-drawing'], { type: 'image/png' }), '我的畫作', 'drawing');
  await putMedia(project.id, 'copy', record.file);
  await writeGiphyKey('device-private-test-key');
  expect(await readGiphyKey()).toBe('device-private-test-key');
  expect(JSON.stringify(await listLibrary())).not.toContain('device-private-test-key');
  expect(JSON.stringify(await db.get('projects', project.id))).not.toContain('device-private-test-key');
  await removeLibrary(record.id);
  expect(await listLibrary()).toHaveLength(0);
  expect((await getMedia(project.id, 'copy', 'image/png')).size).toBe(10);
  await writeGiphyKey('');
  expect(await readGiphyKey()).toBe('');
});
