import type { Asset } from '../model/types';
import { previewUrlFor } from './assetUrls';
import { buildFilmstrip, hasFilmstrip, type Filmstrip } from './filmstrip';

/** Rebuild legacy/single-frame thumbnails once before playback; complete results persist with the asset. */
export async function prepareFilmstrips(
  projectId: string,
  assets: Asset[],
  signal: AbortSignal,
  progress: (f: number, message: string) => void,
  save: (id: string, strip: Filmstrip) => void,
) {
  const pending = assets.filter((a) => a.kind === 'video' && !hasFilmstrip(a));
  let failed = 0;
  for (const [i, asset] of pending.entries()) {
    signal.throwIfAborted();
    const update = (f: number) =>
      progress((i + f) / Math.max(1, pending.length), `建立每2秒縮圖 ${i + 1}/${pending.length}`);
    update(0);
    try {
      const url = previewUrlFor(projectId, asset.id);
      if (!url) {
        failed++;
        continue;
      }
      const file = await (await fetch(url, { signal })).blob();
      const strip = await buildFilmstrip(file, asset.duration, signal, update);
      signal.throwIfAborted();
      save(asset.id, strip);
      if (strip.frames.some((f) => !f.src)) failed++;
    } catch (error) {
      if (signal.aborted) throw error;
      failed++;
    }
    update(1);
  }
  progress(1, '準備預覽畫面');
  return failed;
}
