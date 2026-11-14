import type { Asset } from '../model/types';
import { getMedia } from '../storage/media';

// 把本機素材檔變成 object URL 給 <video>/<img> 用。整個編輯器共用，離開專案時釋放。
const urls = new Map<string, string>();
const previewUrls = new Map<string, { side: number; url: string }>();
const key = (projectId: string, assetId: string) => `${projectId}/${assetId}`;

export async function ensureUrls(
  projectId: string,
  assets: Asset[],
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const missing: string[] = [];
  let done = 0;
  await Promise.all(
    assets.map(async (a) => {
      if (urls.has(key(projectId, a.id))) {
        onProgress?.(++done, assets.length);
        return;
      }
      try {
        const f = await getMedia(projectId, a.id, a.mime);
        urls.set(key(projectId, a.id), URL.createObjectURL(f));
      } catch {
        missing.push(a.name);
      } finally {
        onProgress?.(++done, assets.length);
      }
    }),
  );
  return missing;
}

export function urlFor(projectId: string, assetId: string): string | undefined {
  return urls.get(key(projectId, assetId));
}

export function releaseProjectUrls(projectId: string): void {
  for (const [k, value] of previewUrls)
    if (k.startsWith(`${projectId}/`)) {
      URL.revokeObjectURL(value.url);
      previewUrls.delete(k);
    }
  for (const [k, u] of urls) {
    if (k.startsWith(`${projectId}/`)) {
      URL.revokeObjectURL(u);
      urls.delete(k);
    }
  }
}

export function bindPreviewUrl(projectId: string, assetId: string, side: number, blob: Blob) {
  const k = key(projectId, assetId),
    old = previewUrls.get(k);
  if (old) URL.revokeObjectURL(old.url);
  previewUrls.set(k, { side, url: URL.createObjectURL(blob) });
}
export function previewUrlFor(projectId: string, assetId: string, side?: number) {
  const cached = previewUrls.get(key(projectId, assetId));
  return cached && (side === undefined || cached.side === side) ? cached.url : urlFor(projectId, assetId);
}
