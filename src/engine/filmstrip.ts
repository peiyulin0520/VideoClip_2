import { ALL_FORMATS, BlobSource, CanvasSink, EncodedPacketSink, Input } from 'mediabunny';
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
  nativeTimes: Map<number, { timestamp: number; seek: number }>,
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
  // Capture in the presentation callback itself: loadeddata/seeked can precede
  // the first drawable surface, and awaiting seeked after a callback may expose
  // another surface. Never persist that transient blank as a valid thumbnail.
  const capture = (frame: Filmstrip['frames'][number], t: number, timeout = 5000) => {
    if (!v.requestVideoFrameCallback) return null;
    return new Promise<boolean>((resolve) => {
      let callback = 0;
      const finish = (ok: boolean) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        v.removeEventListener('error', abort);
        if (callback) v.cancelVideoFrameCallback(callback);
        resolve(ok);
      };
      const abort = () => finish(false);
      const timer = setTimeout(abort, timeout);
      const presented: VideoFrameRequestCallback = (_now, info) => {
        if (Math.abs(info.mediaTime - t) <= 0.1 && v.readyState >= 2) {
          frame.src = snapshot(v, v.videoWidth, v.videoHeight);
          finish(true);
        } else callback = v.requestVideoFrameCallback(presented);
      };
      signal.addEventListener('abort', abort, { once: true });
      v.addEventListener('error', abort, { once: true });
      if (signal.aborted) abort();
      else callback = v.requestVideoFrameCallback(presented);
    });
  };
  try {
    const first = frames[0];
    const initial = first && !first.src ? capture(first, 0, 8000) : null;
    const loaded = wait('loadeddata', 8000);
    v.src = url;
    v.load();
    if (!(await loaded)) return;
    if (initial) await initial;
    let failures = 0;
    for (const frame of frames) {
      signal.throwIfAborted();
      if (frame.src) continue;
      const packet = nativeTimes.get(frame.time);
      const t = Math.min(packet?.seek ?? frame.time, Math.max(0, v.duration - 0.001));
      const presented = capture(frame, packet?.timestamp ?? t);
      const moved =
        Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2 && !v.seeking
          ? true
          : (() => {
              const ready = wait('seeked', 5000);
              v.currentTime = t;
              return ready;
            })();
      const decoded = await moved;
      if (presented) await presented;
      else if (decoded && v.readyState >= 2 && !v.seeking && Math.abs(v.currentTime - t) < 0.05) {
        // Older browsers without presentation callbacks expose the decoded frame
        // via seeked; scale directly, without allocating a 4K canvas.
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
  previous?: Filmstrip,
  onPartial?: (strip: Filmstrip) => void,
): Promise<Filmstrip> {
  signal.throwIfAborted();
  const frames = filmstripTimes(duration).map((time, index) => ({
    time,
    src:
      previous?.version === 1 && previous.duration === duration && previous.frames[index]?.time === time
        ? previous.frames[index]!.src
        : null,
  }));
  const pending = frames.filter((frame) => !frame.src);
  const publish = () => {
    signal.throwIfAborted();
    onPartial?.({ version: 1, interval: 2, duration, frames: frames.map((frame) => ({ ...frame })) });
  };
  publish();
  const nativeTimes = new Map<number, { timestamp: number; seek: number }>();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const cancel = () => input.dispose();
  signal.addEventListener('abort', cancel, { once: true });
  let idle = setTimeout(cancel, 30000);
  let done = 0;
  try {
    const track = await input.getPrimaryVideoTrack();
    if (track && (await track.canDecode())) {
      const sink = new CanvasSink(track, { height: 80, fit: 'contain' });
      for await (const wrapped of sink.canvasesAtTimestamps(pending.map((f) => f.time))) {
        signal.throwIfAborted();
        clearTimeout(idle);
        idle = setTimeout(cancel, 30000);
        const frame = pending[done++];
        if (!frame) break;
        if (wrapped && frameCovers(frame.time, wrapped.timestamp, wrapped.duration))
          frame.src = snapshot(wrapped.canvas, wrapped.canvas.width, wrapped.canvas.height);
        onProgress((0.85 * done) / Math.max(1, frames.length));
        if (done === 1 || done % 8 === 0 || done === pending.length) publish();
        if (done % 8 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    }
    if (track && frames.some((frame) => !frame.src)) {
      // An audio tail can outlast the last video packet. Seek inside the actual
      // packet covering each requested time, rather than into an audio-only EOF.
      // Header-only reads also identify the correct surface for variable-rate video.
      const packets = new EncodedPacketSink(track);
      for (const frame of frames) {
        signal.throwIfAborted();
        if (frame.src) continue;
        const packet = await packets.getPacket(frame.time, { metadataOnly: true });
        if (packet)
          nativeTimes.set(frame.time, {
            timestamp: packet.timestamp,
            seek: packet.timestamp + (packet.duration > 0 ? packet.duration / 2 : 0.001),
          });
      }
    }
  } catch (error) {
    if (signal.aborted) throw error;
  } finally {
    clearTimeout(idle);
    signal.removeEventListener('abort', cancel);
    input.dispose();
  }
  // A native decoder can miss a presentation under resource pressure. A fresh
  // element gets one bounded retry for missing times only; valid images stay intact.
  for (let attempt = 0; attempt < 2 && frames.some((f) => !f.src); attempt++)
    await nativeFrames(
      file,
      frames,
      signal,
      () => {
        onProgress(0.85 + (0.15 * frames.filter((f) => !!f.src).length) / Math.max(1, frames.length));
        publish();
      },
      nativeTimes,
    );
  signal.throwIfAborted();
  onProgress(1);
  return { version: 1, interval: 2, duration, frames };
}
