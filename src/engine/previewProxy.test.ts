import { afterEach, expect, it, vi } from 'vitest';
import { needsPreview, previewFileSize, previewKey } from './previewProxy';
import { bindPreviewUrl, previewUrlFor, releaseProjectUrls, urlFor, ensureUrls } from './assetUrls';
import type { Asset } from '../model/types';
vi.mock('../storage/media', () => ({ getMedia: vi.fn(async () => new Blob(['original'])) }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('converts 4K, HEVC and HDR, but leaves already light H264/WebM sources alone', () => {
  expect(needsPreview({ width: 3840, height: 2160, codec: 'avc' }, 720)).toBe(true);
  expect(needsPreview({ width: 640, height: 480, codec: 'hevc' }, 720)).toBe(true);
  expect(needsPreview({ width: 640, height: 480, codec: 'avc', hdr: true }, 720)).toBe(true);
  expect(needsPreview({ width: 320, height: 568, codec: 'vp8' }, 540)).toBe(false);
  expect(previewFileSize(3840, 2160, 720)).toEqual({ width: 720, height: 406 });
  expect(previewFileSize(100, 200, 540)).toEqual({ width: 100, height: 200 });
  expect(previewKey('asset', 720)).not.toBe(previewKey('asset', 540));
});
it('keeps original URLs for every export even after a lightweight file is bound, and releases both', async () => {
  let n = 0;
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: () => `blob:${++n}`, revokeObjectURL: revoke });
  const asset = { id: 'asset', name: 'source', mime: 'video/mp4' } as Asset;
  await ensureUrls('project', [asset]);
  const original = urlFor('project', 'asset');
  bindPreviewUrl('project', 'asset', 540, new Blob(['preview']));
  expect(previewUrlFor('project', 'asset', 540)).not.toBe(original);
  expect(urlFor('project', 'asset')).toBe(original);
  expect(previewUrlFor('project', 'asset', 720)).toBe(original);
  releaseProjectUrls('project');
  expect(revoke).toHaveBeenCalledTimes(2);
  expect(urlFor('project', 'asset')).toBeUndefined();
});
