import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import type { Asset } from '../model/types';
import { getMedia, putMedia } from '../storage/media';
import { makePreview, previewKey, type PreviewResult, type PreviewFile } from './previewProxy';
import { bindPreviewUrl } from './assetUrls';

/** Existing derived files may predate the audio-preservation check. Validate metadata, never decode. */
async function cachedPreview(projectId: string, asset: Asset, side: number) {
  const saved = asset.previewFiles?.[String(side)];
  const blob = await getMedia(projectId, previewKey(asset.id, side), saved?.mime ?? 'video/mp4');
  if (asset.hasAudio && !saved?.audioVerified) {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
      if (!(await input.getPrimaryAudioTrack())) throw Error('舊輕量檔未保留原音');
    } finally {
      input.dispose();
    }
  }
  return blob;
}
/** Opening a project only restores completed caches; it never waits for transcoding. */
export async function restorePreviews(
  projectId: string,
  assets: Asset[],
  side: number,
  signal: AbortSignal,
  save: (id: string, metadata: PreviewFile | undefined) => void,
) {
  for (const asset of assets) {
    if (asset.kind !== 'video' || asset.previewFiles?.[String(side)]?.status !== 'ready') continue;
    try {
      const blob = await cachedPreview(projectId, asset, side);
      signal.throwIfAborted();
      bindPreviewUrl(projectId, asset.id, side, blob);
      if (!asset.previewFiles[String(side)]?.audioVerified)
        save(asset.id, { ...asset.previewFiles[String(side)]!, audioVerified: true });
    } catch (error) {
      if (signal.aborted) throw error;
      save(asset.id, undefined); // Rebuild only the optional derived file; original media stays intact.
    }
  }
}

function convertInWorker(
  file: Blob,
  side: number,
  progress: (value: number) => void,
  signal: AbortSignal,
): Promise<PreviewResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./previewProxy.worker.ts', import.meta.url), { type: 'module' });
    let idle: ReturnType<typeof setTimeout>;
    const watchdog = () => {
      clearTimeout(idle);
      idle = setTimeout(() => {
        cleanup();
        reject(Error('背景預覽轉換沒有進度'));
      }, 30000);
    };
    const cleanup = () => {
      clearTimeout(idle);
      worker.terminate();
      signal.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      cleanup();
      reject(new DOMException('預覽準備已取消', 'AbortError'));
    };
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) return cancel();
    worker.onerror = () => {
      cleanup();
      reject(Error('背景預覽轉換無法執行'));
    };
    worker.onmessage = (
      event: MessageEvent<{ type: string; value?: number; result?: PreviewResult; message?: string }>,
    ) => {
      const data = event.data;
      if (data.type === 'progress') {
        watchdog();
        progress(data.value ?? 0);
      } else {
        cleanup();
        if (data.type === 'done' && data.result) resolve(data.result);
        else reject(Error(data.message ?? '無法準備輕量預覽'));
      }
    };
    watchdog();
    worker.postMessage({ file, side });
  });
}
async function convert(file: Blob, side: number, progress: (value: number) => void, signal: AbortSignal) {
  try {
    return await convertInWorker(file, side, progress, signal);
  } catch (error) {
    if (
      signal.aborted ||
      typeof VideoEncoder === 'undefined' ||
      typeof VideoDecoder === 'undefined' ||
      String(error).includes('沒有進度')
    )
      throw error;
    // Some Safari releases expose codecs only on the main thread. Keep VideoClip's compatible path.
    return makePreview(file, side, progress, signal);
  }
}
/** Sequential, cancellable local jobs. Cached files survive reopening; original media is untouched. */
export async function preparePreviews(
  projectId: string,
  assets: Asset[],
  side: number,
  signal: AbortSignal,
  onProgress: (value: number, message: string) => void,
  onMetadata: (id: string, metadata: PreviewFile) => void,
) {
  const videos = assets.filter((a) => a.kind === 'video');
  let failed = 0;
  for (const [index, asset] of videos.entries()) {
    signal.throwIfAborted();
    const key = String(side),
      saved = asset.previewFiles?.[key];
    const progress = (f: number) =>
      onProgress(
        (index + Math.max(0, Math.min(1, f))) / Math.max(1, videos.length),
        `準備輕量影片 ${index + 1}/${videos.length}`,
      );
    progress(0);
    if (saved?.version === 1 && saved.status === 'none') {
      progress(1);
      continue;
    }
    if (saved?.version === 1 && saved.status === 'ready')
      try {
        const blob = await cachedPreview(projectId, asset, side);
        signal.throwIfAborted();
        bindPreviewUrl(projectId, asset.id, side, blob);
        if (!saved.audioVerified) onMetadata(asset.id, { ...saved, audioVerified: true });
        progress(1);
        continue;
      } catch {
        /* A restored project may have metadata without its optional cache. Rebuild it. */
      }
    try {
      const file = await getMedia(projectId, asset.id, asset.mime);
      const result = await convert(file, side, progress, signal);
      signal.throwIfAborted();
      if (result.blob) {
        await putMedia(projectId, previewKey(asset.id, side), result.blob);
        signal.throwIfAborted();
        bindPreviewUrl(projectId, asset.id, side, result.blob);
      }
      onMetadata(asset.id, result.metadata);
    } catch (error) {
      if (signal.aborted) throw error;
      failed++;
    }
    progress(1);
  }
  onProgress(1, '準備預覽畫面');
  return failed;
}
