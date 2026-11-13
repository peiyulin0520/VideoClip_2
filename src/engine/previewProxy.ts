import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_MEDIUM,
  WebMOutputFormat,
  canEncodeVideo,
} from 'mediabunny';
export type PreviewFile = {
  status: 'ready' | 'none';
  mime?: string;
  width?: number;
  height?: number;
  version: 1;
};
export type PreviewResult = { metadata: PreviewFile; blob?: Blob };
export const previewKey = (id: string, side: number) => `${id}~preview-${side}-v1`;
export function needsPreview(
  info: { width: number; height: number; codec?: string | null; hdr?: boolean },
  side: number,
) {
  return (
    !!info.hdr ||
    Math.max(info.width, info.height) > Math.max(720, side * 1.25) ||
    !!(info.codec && !['avc', 'vp8', 'vp9'].includes(info.codec))
  );
}
export function previewFileSize(width: number, height: number, side: number) {
  const k = Math.min(1, side / Math.max(1, width, height));
  return {
    width: Math.max(2, Math.round((width * k) / 2) * 2),
    height: Math.max(2, Math.round((height * k) / 2) * 2),
  };
}
/** Adapted to this project's independent preview sizes from VideoClip's working proxy path. */
export async function makePreview(
  file: Blob,
  side: number,
  onProgress?: (f: number) => void,
  signal?: AbortSignal,
): Promise<PreviewResult> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return { metadata: { status: 'none', version: 1 } };
    const [codec, hdr] = await Promise.all([
      track.getCodec().catch(() => null),
      track.hasHighDynamicRange().catch(() => false),
    ]);
    if (!needsPreview({ width: track.displayWidth, height: track.displayHeight, codec, hdr }, side))
      return { metadata: { status: 'none', version: 1 } };
    const size = previewFileSize(track.displayWidth, track.displayHeight, side);
    const avc = await canEncodeVideo('avc', { ...size, quality: QUALITY_MEDIUM }).catch(() => false);
    const vp9 =
      !avc && (await canEncodeVideo('vp9', { ...size, quality: QUALITY_MEDIUM }).catch(() => false));
    if (!avc && !vp9) throw Error('此瀏覽器無法建立輕量預覽檔');
    const target = new BufferTarget(),
      output = new Output({ format: avc ? new Mp4OutputFormat() : new WebMOutputFormat(), target });
    let canvas: OffscreenCanvas | null = null;
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: {
        ...size,
        fit: 'fill',
        frameRate: 30,
        codec: avc ? 'avc' : 'vp9',
        quality: QUALITY_MEDIUM,
        forceTranscode: true,
        ...(hdr
          ? {
              process: (sample) => {
                canvas ??= new OffscreenCanvas(size.width, size.height);
                sample.draw(canvas.getContext('2d')!, 0, 0, size.width, size.height);
                return canvas;
              },
            }
          : {}),
      },
    });
    if (!conversion.isValid) throw Error('無法建立此影片的輕量預覽');
    const cancel = () => void conversion.cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    conversion.onProgress = (f) => onProgress?.(f);
    try {
      signal?.throwIfAborted();
      await conversion.execute();
      signal?.throwIfAborted();
    } finally {
      signal?.removeEventListener('abort', cancel);
    }
    if (!target.buffer?.byteLength) throw Error('輕量預覽檔是空的');
    const mime = avc ? 'video/mp4' : 'video/webm',
      blob = new Blob([target.buffer], { type: mime });
    // Never silently drop narration when a browser cannot preserve the audio track.
    const check = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
      if ((await input.getPrimaryAudioTrack()) && !(await check.getPrimaryAudioTrack()))
        throw Error('預覽檔未保留聲音，改用原始影片');
    } finally {
      check.dispose();
    }
    return { blob, metadata: { status: 'ready', version: 1, mime, ...size } };
  } finally {
    input.dispose();
  }
}
