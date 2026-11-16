import { afterEach, expect, it, vi } from 'vitest';
import {
  buildFilmstrip,
  filmstripSegments,
  filmstripTimes,
  frameCovers,
  hasFilmstrip,
  type Filmstrip,
} from './filmstrip';
import { createProject } from '../model/defaults';
import { setAssetFilmstrip, useProjectStore } from '../store/projectStore';
import type { Asset } from '../model/types';
const mock = vi.hoisted(() => ({
  frames: [] as ({ canvas: { width: number; height: number }; timestamp: number; duration: number } | null)[],
  dispose: vi.fn(),
}));
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [],
  BlobSource: class {},
  Input: class {
    dispose = mock.dispose;
    async getPrimaryVideoTrack() {
      return { canDecode: async () => true };
    }
  },
  CanvasSink: class {
    async *canvasesAtTimestamps() {
      for (const frame of mock.frames) yield frame;
    }
  },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useProjectStore.getState().close();
});
const strip = (duration: number): Filmstrip => ({
  version: 1,
  interval: 2,
  duration,
  frames: filmstripTimes(duration).map((time) => ({ time, src: `image-at-${time}` })),
});
const asset = (duration = 126) =>
  ({
    id: 'video',
    kind: 'video',
    duration,
    filmstrip: strip(duration),
    thumbs: ['legacy-first'],
  }) as unknown as Asset;
it('samples every two seconds across the whole source including the final partial interval', () => {
  expect(filmstripTimes(5.1)).toEqual([0, 2, 4]);
  expect(filmstripTimes(126)).toHaveLength(63);
  expect(filmstripTimes(126).at(-1)).toBe(124);
  expect(filmstripTimes(0)).toEqual([]);
});
it('legacy eight/single-frame caches, missing frames and wrong timestamp/duration caches require repair', () => {
  const a = asset();
  expect(hasFilmstrip(a)).toBe(true);
  expect(hasFilmstrip({ ...a, filmstrip: undefined })).toBe(false);
  expect(
    hasFilmstrip({ ...a, filmstrip: { ...a.filmstrip!, frames: a.filmstrip!.frames.slice(0, 8) } }),
  ).toBe(false);
  const missing = structuredClone(a);
  missing.filmstrip!.frames[35]!.src = null;
  expect(hasFilmstrip(missing)).toBe(false);
  const shifted = structuredClone(a);
  shifted.filmstrip!.frames[35]!.time = 0;
  expect(hasFilmstrip(shifted)).toBe(false);
  expect(hasFilmstrip({ ...a, duration: 128 })).toBe(false);
});
it('visible tiles use actual later source times, including trim and speed, without a 60 second cap', () => {
  const s = strip(126);
  const normal = filmstripSegments({ trimIn: 0, duration: 126, speed: 1 }, s, 110, 118);
  expect(normal.map((f) => f.time)).toEqual([110, 112, 114, 116, 118]);
  expect(normal[1]!.src).toBe('image-at-112');
  const trimmed = filmstripSegments({ trimIn: 57, duration: 10, speed: 2 }, s, 0, 10);
  expect(trimmed[0]).toMatchObject({ time: 56, start: 0, duration: 0.5 });
  expect(trimmed[1]).toMatchObject({ time: 58, start: 0.5, duration: 1 });
  expect(trimmed.at(-1)).toMatchObject({ time: 76, start: 9.5, duration: 0.5 });
});
it('bounds the DOM work to the visible neighborhood even for hours-long movies at maximum zoom', () => {
  const s = strip(7200);
  const visible = filmstripSegments({ trimIn: 0, duration: 7200, speed: 1 }, s, 3596, 3606);
  expect(visible).toHaveLength(6);
  expect(visible[0]!.time).toBe(3596);
  expect(visible.at(-1)!.time).toBe(3606);
});
it('accepts a frame that covers the requested second and rejects a repeated initial timestamp', () => {
  expect(frameCovers(58, 57.97, 0.04)).toBe(true);
  expect(frameCovers(58, 0, 0.04)).toBe(false);
  expect(frameCovers(58, 60, 0.04)).toBe(false);
});
it('missing or stale decoded frames never inherit the previous picture', async () => {
  mock.frames = [
    { canvas: { width: 160, height: 90 }, timestamp: 0, duration: 1 },
    { canvas: { width: 160, height: 90 }, timestamp: 0, duration: 1 },
    null,
  ];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,first');
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (this: HTMLMediaElement) {
    queueMicrotask(() => this.dispatchEvent(new Event('error')));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const s = await buildFilmstrip(new Blob(), 6, new AbortController().signal, () => {});
  expect(s.frames.map((f) => f.src)).toEqual(['data:image/jpeg;base64,first', null, null]);
  expect(document.querySelector('video')).toBeNull();
  expect(mock.dispose).toHaveBeenCalled();
});
it('repair persists across undo without adding an edit or changing the source and trims', () => {
  const p = createProject('test');
  p.assets = [{ ...asset(6), filmstrip: undefined }];
  useProjectStore.getState().load(p);
  useProjectStore.getState().apply((d) => {
    d.name = 'edited';
  });
  const history = useProjectStore.getState().past.length;
  setAssetFilmstrip('video', strip(6));
  expect(useProjectStore.getState().past).toHaveLength(history);
  useProjectStore.getState().undo();
  expect(useProjectStore.getState().project!.name).toBe('test');
  expect(hasFilmstrip(useProjectStore.getState().project!.assets[0]!)).toBe(true);
  expect(useProjectStore.getState().project!.assets[0]!.duration).toBe(6);
});
it('resumes missing source timestamps after an interrupted background job and publishes immutable partials', async () => {
  const old = strip(6);
  old.frames[1]!.src = null;
  old.frames[2]!.src = null;
  mock.frames = [
    { canvas: { width: 160, height: 90 }, timestamp: 2, duration: 1 },
    { canvas: { width: 160, height: 90 }, timestamp: 4, duration: 1 },
  ];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValueOnce('frame-2')
    .mockReturnValueOnce('frame-4');
  const partials: Filmstrip[] = [];
  const result = await buildFilmstrip(
    new Blob(),
    6,
    new AbortController().signal,
    () => {},
    old,
    (s) => partials.push(s),
  );
  expect(old.frames.map((f) => f.src)).toEqual(['image-at-0', null, null]);
  expect(partials[0]!.frames.map((f) => f.src)).toEqual(['image-at-0', null, null]);
  expect(partials[1]!.frames.map((f) => f.src)).toEqual(['image-at-0', 'frame-2', null]);
  expect(result.frames.map((f) => f.src)).toEqual(['image-at-0', 'frame-2', 'frame-4']);
});
it('captures native frames during presentation, before seeked can expose a transient blank surface', async () => {
  mock.frames = [];
  let shown = -1;
  let copied = -1;
  let nextCallback: VideoFrameRequestCallback | undefined;
  const original = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const element = original(tag);
    if (tag === 'video') {
      const video = element as HTMLVideoElement;
      let clock = 0;
      Object.defineProperties(video, {
        readyState: { get: () => 2 },
        videoWidth: { get: () => 160 },
        videoHeight: { get: () => 90 },
        duration: { get: () => 6 },
        seeking: { get: () => false },
        currentTime: {
          get: () => clock,
          set: (time: number) => {
            clock = time;
            queueMicrotask(() => {
              // A queued old presentation must not satisfy the new request.
              nextCallback?.(0, { mediaTime: time - 2 } as VideoFrameCallbackMetadata);
              shown = time;
              nextCallback?.(0, { mediaTime: time } as VideoFrameCallbackMetadata);
              shown = -1;
              video.dispatchEvent(new Event('seeked'));
            });
          },
        },
      });
      video.requestVideoFrameCallback = (callback) => {
        nextCallback = callback;
        return 1;
      };
      video.cancelVideoFrameCallback = () => {
        nextCallback = undefined;
      };
      video.load = () => {
        if (!video.getAttribute('src')) return;
        queueMicrotask(() => {
          shown = 0;
          nextCallback?.(0, { mediaTime: 0 } as VideoFrameCallbackMetadata);
          shown = -1;
          video.dispatchEvent(new Event('loadeddata'));
        });
      };
      video.pause = () => {};
    }
    return element;
  }) as typeof document.createElement);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: () => {
      copied = shown;
    },
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => `source-at-${copied}`);
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: vi.fn() });
  const result = await buildFilmstrip(new Blob(), 6, new AbortController().signal, () => {});
  expect(result.frames.map((frame) => frame.src)).toEqual(['source-at-0', 'source-at-2', 'source-at-4']);
  expect(document.querySelector('video')).toBeNull();
});
