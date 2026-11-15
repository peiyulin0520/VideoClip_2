import { afterEach, expect, it, vi } from 'vitest';
import { restorePreviews } from './preparePreviews';
import { getMedia } from '../storage/media';
import { bindPreviewUrl } from './assetUrls';
import type { Asset } from '../model/types';
const mock = vi.hoisted(() => ({ audio: true, dispose: vi.fn() }));
vi.mock('../storage/media', () => ({ getMedia: vi.fn(async () => new Blob(['cached'])), putMedia: vi.fn() }));
vi.mock('./assetUrls', () => ({ bindPreviewUrl: vi.fn() }));
vi.mock('./previewProxy', () => ({
  makePreview: vi.fn(),
  previewKey: (id: string, side: number) => `${id}-${side}`,
}));
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [],
  BlobSource: class {},
  Input: class {
    getPrimaryAudioTrack = async () => (mock.audio ? {} : null);
    dispose = mock.dispose;
  },
}));
afterEach(() => {
  vi.clearAllMocks();
  mock.audio = true;
});
const asset = () =>
  ({
    id: 'a',
    kind: 'video',
    hasAudio: true,
    previewFiles: { '540': { version: 1, status: 'ready', mime: 'video/mp4' } },
  }) as unknown as Asset;
it('rejects a legacy silent derived file and keeps original source metadata untouched', async () => {
  mock.audio = false;
  const original = asset(),
    save = vi.fn();
  await restorePreviews('p', [original], 540, new AbortController().signal, save);
  expect(bindPreviewUrl).not.toHaveBeenCalled();
  expect(save).toHaveBeenCalledWith('a', undefined);
  expect(original.hasAudio).toBe(true);
  expect(original.previewFiles!['540']!.status).toBe('ready');
  expect(mock.dispose).toHaveBeenCalledOnce();
});
it('restores verified audio caches without starting any conversion, and ignores uncached assets', async () => {
  const a = asset(),
    save = vi.fn();
  await restorePreviews(
    'p',
    [a, { ...a, id: 'new', previewFiles: undefined }],
    540,
    new AbortController().signal,
    save,
  );
  expect(getMedia).toHaveBeenCalledTimes(1);
  expect(bindPreviewUrl).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledWith('a', expect.objectContaining({ audioVerified: true }));
});
it('an abort cannot bind a late cache or invalidate user metadata', async () => {
  const c = new AbortController(),
    save = vi.fn();
  c.abort();
  await expect(restorePreviews('p', [asset()], 540, c.signal, save)).rejects.toThrow();
  expect(bindPreviewUrl).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});
