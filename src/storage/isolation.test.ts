import { openDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '../model/defaults';
import { getDB } from './db';
import { deleteProjectMedia, getMedia, putMedia } from './media';

afterEach(() => vi.unstubAllGlobals());

describe('同網域的 VideoClip 與 VideoClip_2 資料隔離', () => {
  it('儲存與刪除相同專案 ID，不會改動原版的專案或個人字體', async () => {
    const legacy = await openDB('videoclip', 2, {
      upgrade(db) {
        db.createObjectStore('projects', { keyPath: 'id' });
        db.createObjectStore('userFonts', { keyPath: 'id' });
      },
    });
    const old = { ...createProject('原版專案'), id: 'same-project' };
    await legacy.put('projects', old);
    await legacy.put('userFonts', { id: 'personal-font', name: '我的字體' });
    const next = await getDB();
    await next.put('projects', { ...old, name: '新版專案' });
    expect((await legacy.get('projects', old.id)).name).toBe('原版專案');
    expect((await next.get('projects', old.id))?.name).toBe('新版專案');
    await next.delete('projects', old.id);
    expect(await legacy.get('projects', old.id)).toEqual(old);
    expect(await legacy.get('userFonts', 'personal-font')).toEqual({
      id: 'personal-font',
      name: '我的字體',
    });
    legacy.close();
  });

  it('OPFS 寫入、讀取與刪除都使用自己的目錄，保留舊目錄及相同 ID 素材', async () => {
    class FileHandle {
      blob = new Blob();
      async createWritable() {
        return {
          write: async (data: Blob) => void (this.blob = data),
          close: async () => {},
          abort: async () => {},
        };
      }
      async getFile() {
        return this.blob;
      }
    }
    class Directory {
      dirs = new Map<string, Directory>();
      files = new Map<string, FileHandle>();
      async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<Directory> {
        if (!this.dirs.has(name)) {
          if (!options?.create) throw new Error('not found');
          this.dirs.set(name, new Directory());
        }
        return this.dirs.get(name)!;
      }
      async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle> {
        if (!this.files.has(name)) {
          if (!options?.create) throw new Error('not found');
          this.files.set(name, new FileHandle());
        }
        return this.files.get(name)!;
      }
      async removeEntry(name: string) {
        this.dirs.delete(name);
      }
    }
    const root = new Directory();
    const oldRoot = await root.getDirectoryHandle('projects', { create: true });
    const oldProject = await oldRoot.getDirectoryHandle('same-project', { create: true });
    const oldHandle = await oldProject.getFileHandle('same-asset', { create: true });
    oldHandle.blob = new Blob(['original']);
    vi.stubGlobal('FileSystemFileHandle', FileHandle);
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => root } });
    await putMedia('same-project', 'same-asset', new Blob(['new-version']));
    expect((await getMedia('same-project', 'same-asset', 'image/png')).size).toBe(11);
    expect(root.dirs.size).toBe(2);
    await deleteProjectMedia('same-project');
    expect(oldRoot.dirs.has('same-project')).toBe(true);
    expect(oldHandle.blob.size).toBe(8);
    const nextRoot = await root.getDirectoryHandle('little-moments-videoclip-2');
    expect(nextRoot.dirs.has('same-project')).toBe(false);
  });
});
