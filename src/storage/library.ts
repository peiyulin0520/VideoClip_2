import { newId } from '../model/defaults';
import { getDB, type LibraryRecord } from './db';
import { requestPersistence } from './media';
export async function listLibrary() {
  return (await (await getDB()).getAll('library')).sort((a, b) => b.createdAt - a.createdAt);
}
export async function saveLibrary(
  file: Blob,
  name: string,
  origin: LibraryRecord['origin'] = 'upload',
  settings?: LibraryRecord['settings'],
) {
  const record: LibraryRecord = {
    id: newId('lib_'),
    file,
    name,
    mime: file.type,
    createdAt: Date.now(),
    origin,
    ...(settings ? { settings } : {}),
  };
  await (await getDB()).put('library', record);
  void requestPersistence();
  return record;
}
export async function removeLibrary(id: string) {
  await (await getDB()).delete('library', id);
}
export async function readGiphyKey(): Promise<string> {
  return ((await (await getDB()).get('meta', 'giphyKey')) as string | undefined) ?? '';
}
export async function writeGiphyKey(key: string) {
  const db = await getDB();
  if (key.trim()) await db.put('meta', key.trim(), 'giphyKey');
  else await db.delete('meta', 'giphyKey');
}
