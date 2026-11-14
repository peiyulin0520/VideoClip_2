import { afterEach, expect, it, vi } from 'vitest';
import { AudioBus, previewPlaybackRate } from './audio';
import { VideoPool } from './mediaPool';
import { AudioPool } from './audioPool';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function context() {
  const parameter = () => ({
    value: 0,
    cancelScheduledValues: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  const gain = { gain: parameter(), connect: vi.fn().mockReturnThis(), disconnect: vi.fn() };
  const master = { gain: parameter(), connect: vi.fn().mockReturnThis(), disconnect: vi.fn() };
  const limiter = {
    threshold: parameter(),
    knee: parameter(),
    ratio: parameter(),
    attack: parameter(),
    release: parameter(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const ctx = {
    state: 'running',
    currentTime: 1,
    destination: {},
    createGain: vi.fn().mockReturnValueOnce(master).mockReturnValue(gain),
    createDynamicsCompressor: vi.fn(() => limiter),
    createAnalyser: vi.fn(() => ({ fftSize: 1024, getFloatTimeDomainData: vi.fn(), disconnect: vi.fn() })),
    createMediaElementSource: vi.fn(() => ({ connect: vi.fn(() => gain), disconnect: vi.fn() })),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  return { ctx, gain, limiter, master };
}
it('does not initialize Web Audio on project entry; connects only audible sources after a gesture', () => {
  const { ctx, gain, limiter } = context(),
    factory = vi.fn(function () {
      return ctx;
    });
  vi.stubGlobal('AudioContext', factory);
  const video = document.createElement('video'),
    silent = document.createElement('video');
  const bus = new AudioBus([video, silent]);
  expect(factory).not.toHaveBeenCalled();
  bus.unlock();
  expect(factory).toHaveBeenCalledWith({ latencyHint: 'playback' });
  expect(ctx.createMediaElementSource).not.toHaveBeenCalled();
  for (let i = 0; i < 30; i++) {
    bus.clear();
    bus.set(video, 1);
    bus.set(silent, 0);
    bus.flush();
  }
  expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(1);
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 1.012);
  bus.clear();
  bus.flush();
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 1.012);
  expect(limiter.threshold.value).toBe(-6);
  expect(limiter.ratio.value).toBe(20);
  bus.destroy();
});
it('never nudges the iPhone playback rate; other browsers may gently correct small drift', () => {
  expect(previewPlaybackRate(0.2, 1, true)).toBe(1);
  expect(previewPlaybackRate(-0.2, 0.5, true)).toBe(0.5);
  expect(previewPlaybackRate(0.2, 1, false)).toBeGreaterThan(1);
});
it('unlock pauses queued native players synchronously, and a late priming promise cannot leave autoplay running', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const paused = new WeakMap<HTMLMediaElement, boolean>();
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(function (this: HTMLMediaElement) {
    return paused.get(this) ?? true;
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    paused.set(this, true);
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  let finish: () => void = () => {};
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    paused.set(this, false);
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  const pool = new VideoPool(document.createElement('div'), 1, () => {}),
    v = pool.acquire('item', 'asset', 'blob:source', new Set())!;
  pool.unlock();
  expect(v.paused).toBe(true);
  finish();
  await Promise.resolve();
  expect(v.paused).toBe(true);
  v.dispatchEvent(new Event('loadedmetadata'));
  pool.pauseAllExcept(new Set());
  finish();
  await Promise.resolve();
  expect(v.paused).toBe(true);
  expect(v.dataset.priming).toBeUndefined();
  pool.destroy();
});
it('separated sound uses audio elements and stays paused unless explicitly requested', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const host = document.createElement('div'),
    pool = new AudioPool(host, 2, () => {});
  const el = pool.acquire('audio', 'asset', 'blob:source', new Set());
  expect(el).toBeInstanceOf(HTMLAudioElement);
  expect(host.querySelector('video')).toBeNull();
  expect(el?.dataset.previewIntent).toBe('pause');
  pool.destroy();
});

it('schedules an edit boundary in the audio clock once and keeps zero-gain sources unmuted for the ramp', () => {
  const { ctx, gain } = context();
  const v = document.createElement('video');
  const bus = new AudioBus([v], ctx as unknown as AudioContext);
  for (let i = 0; i < 30; i++) {
    bus.clear();
    bus.set(v, 1, { start: 0, end: 2 }, 0);
    bus.flush();
  }
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(2);
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 3);
  bus.clear();
  bus.set(v, 0);
  bus.flush();
  expect(v.muted).toBe(false);
  expect(gain.gain.cancelAndHoldAtTime).toHaveBeenCalled();
  bus.destroy();
});
it('fades before pause and seek, coalesces scrubbing, and cancels a stale pause when resumed', () => {
  vi.useFakeTimers();
  const { ctx, gain } = context();
  const v = document.createElement('video');
  vi.spyOn(v, 'paused', 'get').mockReturnValue(false);
  const pause = vi.spyOn(v, 'pause').mockImplementation(() => {});
  const bus = new AudioBus([v], ctx as unknown as AudioContext);
  bus.set(v, 1);
  bus.flush();
  ctx.currentTime = 1.02;
  v.dataset.previewIntent = 'pause';
  bus.pause(v);
  expect(pause).not.toHaveBeenCalled();
  ctx.currentTime = 1.04;
  vi.advanceTimersByTime(20);
  expect(pause).toHaveBeenCalledTimes(1);
  bus.set(v, 1);
  bus.flush();
  ctx.currentTime += 0.02;
  v.dataset.previewIntent = 'play';
  const first = vi.fn(),
    last = vi.fn();
  bus.deferSeek(v, first);
  bus.deferSeek(v, last);
  expect(bus.isSeeking(v)).toBe(true);
  vi.advanceTimersByTime(20);
  expect(last).not.toHaveBeenCalled(); // Wall timers can outrun the audio clock under load.
  ctx.currentTime += 0.02;
  vi.advanceTimersByTime(8);
  expect(first).not.toHaveBeenCalled();
  expect(last).toHaveBeenCalledOnce();
  expect(bus.isSeeking(v)).toBe(false);
  bus.set(v, 1);
  bus.flush();
  ctx.currentTime += 0.02;
  v.dataset.previewIntent = 'pause';
  bus.pause(v);
  v.dataset.previewIntent = 'play';
  bus.set(v, 1);
  bus.flush();
  vi.advanceTimersByTime(20);
  expect(pause).toHaveBeenCalledTimes(1);
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalled();
  bus.destroy();
});

it('native playing guards allow the intentional short fade but still stop unintended autoplay', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  for (const pool of [
    new VideoPool(document.createElement('div'), 1, () => {}),
    new AudioPool(document.createElement('div'), 1, () => {}),
  ]) {
    const el = pool.els[0]!;
    el.dataset.previewIntent = 'pause';
    el.dataset.audioFading = '1';
    pause.mockClear();
    el.dispatchEvent(new Event('playing'));
    expect(pause).not.toHaveBeenCalled();
    delete el.dataset.audioFading;
    el.dispatchEvent(new Event('playing'));
    expect(pause).toHaveBeenCalledOnce();
    pool.destroy();
  }
});

it('seeking back inside the same window after its scheduled fade-out re-arms audible gain', () => {
  const { ctx, gain } = context();
  const v = document.createElement('video');
  vi.spyOn(v, 'paused', 'get').mockReturnValue(false);
  const bus = new AudioBus([v], ctx as unknown as AudioContext);
  bus.set(v, 1, { start: 0, end: 2 }, 0);
  bus.flush();
  ctx.currentTime = 4;
  const apply = vi.fn();
  bus.deferSeek(v, apply);
  expect(apply).toHaveBeenCalledOnce();
  bus.set(v, 1, { start: 0, end: 2 }, 0);
  bus.flush();
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 6);
  bus.destroy();
});
