import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny';
import type { Asset, VideoItem } from '../model/types';

export type Filmstrip = NonNullable<Asset['filmstrip']>;
export const FILMSTRIP_STEP = 2;
export function filmstripTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  return Array.from({ length: Math.ceil(duration / FILMSTRIP_STEP) }, (_, i) => i * FILMSTRIP_STEP);
}
export function hasFilmstrip(asset: Asset) {
  const strip = asset.filmstrip;
  const times = filmstripTimes(asset.duration);
  return (
    !!strip &&
    strip.version === 1 &&
    strip.interval === 2 &&
    strip.duration === asset.duration &&
    times.length === strip.frames.length &&
    times.every((time, i) => strip.frames[i]?.time === time && !!strip.frames[i]?.src)
  );
}
export function frameCovers(time: number, timestamp: number, duration: number) {
  return timestamp <= time + 0.05 && timestamp + duration >= time - 0.05;
}
export function filmstripSegments(
  item: Pick<VideoItem, 'trimIn' | 'duration' | 'speed'>,
  strip: Filmstrip,
  from: number,
  to: number,
) {
  const sourceEnd = Math.min(strip.duration, item.trimIn + item.duration * item.speed);
  const first = Math.max(0, Math.floor((item.trimIn + Math.max(0, from) * item.speed) / 2));
  const last = Math.min(
    strip.frames.length - 1,
    Math.floor((item.trimIn + Math.min(item.duration, to) * item.speed) / 2),
  );
  const out: { time: number; src: string | null; start: number; duration: number }[] = [];
  for (let i = first; i <= last; i++) {
    const frame = strip.frames[i]!;
    const a = Math.max(item.trimIn, frame.time),
      b = Math.min(sourceEnd, frame.time + 2);
    if (b > a) out.push({ ...frame, start: (a - item.trimIn) / item.speed, duration: (b - a) / item.speed });
  }
  return out;
}
function snapshot(source: CanvasImageSource, width: number, height: number) {
  const c = document.createElement('canvas');
  const scale = Math.min(80 / Math.max(1, height), 240 / Math.max(1, width));
  c.width = Math.max(1, Math.round(width * scale));
  c.height = Math.max(1, Math.round(height * scale));
  c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.65);
}

async function nativeFrames(
  file: Blob,
  frames: Filmstrip['frames'],
  signal: AbortSignal,
  progress: () => void,
) {
  const v = document.createElement('video'),
    url = URL.createObjectURL(file);
  v.setAttribute('webkit-playsinline', '');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.append(v);
  const wait = (event: string, ms: number) =>
    new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        clearTimeout(timer);
        v.removeEventListener(event, yes);
        v.removeEventListener('error', no);
        signal.removeEventListener('abort', no);
        resolve(ok);
      };
      const yes = () => done(true),
        no = () => done(false);
      const timer = setTimeout(no, ms);
      v.addEventListener(event, yes, { once: true });
      v.addEventListener('error', no, { once: true });
      signal.addEventListener('abort', no, { once: true });
      if (signal.aborted) no();
    });
  try {
    const loaded = wait('loadeddata', 8000);
    v.src = url;
    v.load();
    if (!(await loaded)) return;
    let failures = 0;
    for (const frame of frames) {
      signal.throwIfAborted();
      if (frame.src) continue;
      const t = Math.min(frame.time, Math.max(0, v.duration - 0.001));
      let callback = 0;
      const presented =
        t > 0.001 && v.requestVideoFrameCallback
          ? new Promise<boolean>((resolve) => {
              const timer = setTimeout(() => {
                v.cancelVideoFrameCallback(callback);
                resolve(false);
              }, 2000);
              callback = v.requestVideoFrameCallback((_now, info) => {
                clearTimeout(timer);
                resolve(
                  Math.abs(info.mediaTime - t) <= 0.1 || (info.mediaTime <= t && info.mediaTime >= t - 1),
                );
              });
            })
          : null;
      const moved =
        Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2 && !v.seeking
          ? true
          : (() => {
              const ready = wait('seeked', 5000);
              v.currentTime = t;
              return ready;
            })();
      const decoded = await moved;
      const fresh = presented ? await presented : decoded;
      signal.throwIfAborted();
      if (decoded && fresh && v.readyState >= 2 && !v.seeking && Math.abs(v.currentTime - t) < 0.05) {
        // Scale directly from the decoded video, never allocate a 4K canvas per thumbnail.
        frame.src = snapshot(v, v.videoWidth, v.videoHeight);
      }
      progress();
      if (frame.src) failures = 0;
      else if (++failures >= 3) break;
    }
  } finally {
    v.pause();
    v.removeAttribute('src');
    v.load();
    v.remove();
    URL.revokeObjectURL(url);
  }
}
/** Never substitute an earlier frame for a missing or stale decoded timestamp. */
export async function buildFilmstrip(
  file: Blob,
  duration: number,
  signal: AbortSignal,
  onProgress: (f: number) => void,
): Promise<Filmstrip> {
  signal.throwIfAborted();
  const frames = filmstripTimes(duration).map((time) => ({ time, src: null as string | null }));
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const cancel = () => input.dispose();
  signal.addEventListener('abort', cancel, { once: true });
  let idle = setTimeout(cancel, 30000);
  let done = 0;
  try {
    const track = await input.getPrimaryVideoTrack();
    if (track && (await track.canDecode())) {
      const sink = new CanvasSink(track, { height: 80, fit: 'contain' });
      for await (const wrapped of sink.canvasesAtTimestamps(frames.map((f) => f.time))) {
        signal.throwIfAborted();
        clearTimeout(idle);
        idle = setTimeout(cancel, 30000);
        const frame = frames[done++];
        if (!frame) break;
        if (wrapped && frameCovers(frame.time, wrapped.timestamp, wrapped.duration))
          frame.src = snapshot(wrapped.canvas, wrapped.canvas.width, wrapped.canvas.height);
        onProgress((0.85 * done) / Math.max(1, frames.length));
        if (done % 8 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    }
  } catch (error) {
    if (signal.aborted) throw error;
  } finally {
    clearTimeout(idle);
    signal.removeEventListener('abort', cancel);
    input.dispose();
  }
  if (frames.some((f) => !f.src))
    await nativeFrames(file, frames, signal, () =>
      onProgress(0.85 + (0.15 * frames.filter((f) => !!f.src).length) / Math.max(1, frames.length)),
    );
  signal.throwIfAborted();
  onProgress(1);
  return { version: 1, interval: 2, duration, frames };
}
