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
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 1.036);
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
  expect(gain.gain.cancelScheduledValues).toHaveBeenCalled();
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
  ctx.currentTime = 1.06;
  v.dataset.previewIntent = 'pause';
  bus.pause(v);
  expect(pause).not.toHaveBeenCalled();
  ctx.currentTime = 1.08;
  vi.advanceTimersByTime(20);
  expect(pause).toHaveBeenCalledTimes(1);
  bus.set(v, 1);
  bus.flush();
  ctx.currentTime += 0.05;
  v.dataset.previewIntent = 'play';
  const first = vi.fn(),
    last = vi.fn();
  bus.deferSeek(v, first);
  bus.deferSeek(v, last);
  expect(bus.isSeeking(v)).toBe(true);
  vi.advanceTimersByTime(20);
  expect(last).not.toHaveBeenCalled(); // Wall timers can outrun the audio clock under load.
  ctx.currentTime += 0.05;
  vi.advanceTimersByTime(8);
  expect(first).not.toHaveBeenCalled();
  expect(last).toHaveBeenCalledOnce();
  expect(bus.isSeeking(v)).toBe(false);
  bus.set(v, 1);
  bus.flush();
  ctx.currentTime += 0.05;
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

it('anchors repeated pause/seek in one audio quantum without dropping or restarting the fade', () => {
  vi.useFakeTimers();
  const { ctx, gain } = context();
  const v = document.createElement('video');
  vi.spyOn(v, 'paused', 'get').mockReturnValue(false);
  vi.spyOn(v, 'pause').mockImplementation(() => {});
  const bus = new AudioBus([v], ctx as unknown as AudioContext);
  bus.set(v, 2, { start: 0, end: 3 }, 0);
  bus.flush();
  ctx.currentTime = 1.5;
  v.dataset.previewIntent = 'pause';
  gain.gain.linearRampToValueAtTime.mockClear();
  bus.pause(v);
  bus.deferSeek(v, () => {});
  expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(2, 1.5);
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(1);
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 1.512);
  expect(gain.gain.cancelAndHoldAtTime).not.toHaveBeenCalled();
  bus.destroy();
});

it.each(['window', 'pause', 'seek'] as const)(
  'does not extend an imminent audio fade deadline when %s requests silence',
  (action) => {
    vi.useFakeTimers();
    const { ctx, gain } = context();
    const el = document.createElement('video');
    vi.spyOn(el, 'paused', 'get').mockReturnValue(false);
    const pause = vi.spyOn(el, 'pause').mockImplementation(() => {});
    const seek = vi.fn();
    const bus = new AudioBus([el], ctx as unknown as AudioContext);
    bus.set(el, 2, { start: 0, end: 3 }, 0); // Audio-clock deadline is 4.
    bus.flush();
    ctx.currentTime = 3.994;
    gain.gain.linearRampToValueAtTime.mockClear();
    el.dataset.previewIntent = 'pause';
    if (action === 'window') {
      bus.clear();
      bus.flush();
    } else if (action === 'pause') bus.pause(el);
    else bus.deferSeek(el, seek);
    const [level, deadline] = gain.gain.linearRampToValueAtTime.mock.calls.at(-1)!;
    expect(level).toBe(0);
    expect(deadline).toBeCloseTo(4, 8);
    expect(pause).not.toHaveBeenCalled();
    expect(seek).not.toHaveBeenCalled();
    ctx.currentTime = 4.001;
    vi.advanceTimersByTime(20);
    if (action === 'pause') expect(pause).toHaveBeenCalledOnce();
    if (action === 'seek') expect(seek).toHaveBeenCalledOnce();
    bus.destroy();
  },
);

it.each([
  { sourceTime: 0, rate: 1, windowEnd: 3, expected: 3.988 },
  { sourceTime: 0, rate: 1, windowEnd: 2.5, expected: 3.5 },
  { sourceTime: 1, rate: 2, windowEnd: 1, expected: 1.988 },
])(
  'guards native EOF at $rate x without moving interior edit boundaries',
  ({ sourceTime, rate, windowEnd, expected }) => {
    const { ctx, gain } = context();
    const el = document.createElement('video');
    vi.spyOn(el, 'duration', 'get').mockReturnValue(3);
    el.currentTime = sourceTime;
    el.playbackRate = rate;
    const bus = new AudioBus([el], ctx as unknown as AudioContext);
    bus.set(el, 1, { start: 0, end: windowEnd }, 0);
    bus.flush();
    const [level, deadline] = gain.gain.linearRampToValueAtTime.mock.calls.at(-1)!;
    expect(level).toBe(0);
    expect(deadline).toBeCloseTo(expected, 8);
    bus.destroy();
  },
);

it('routes and unmutes before play, with a silent initial gain and a reusable audio context', () => {
  const { ctx, gain } = context();
  ctx.state = 'interrupted';
  const video = document.createElement('video');
  video.muted = true;
  const bus = new AudioBus([video], ctx as unknown as AudioContext);
  bus.unlock();
  expect(ctx.resume).toHaveBeenCalledOnce();
  expect(bus.prime(video)).toBe(true);
  expect(video.muted).toBe(false);
  expect(gain.gain.value).toBe(0);
  expect(bus.owns(video)).toBe(true);
  bus.destroy(false);
  expect(ctx.close).not.toHaveBeenCalled();
  const next = new AudioBus([], ctx as unknown as AudioContext);
  next.destroy();
  expect(ctx.close).toHaveBeenCalledOnce();
});
it('uses native sound on iOS without AudioSession, keeping older Safari out of a silent WebAudio session', () => {
  vi.stubGlobal('navigator', { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5 });
  const factory = vi.fn();
  vi.stubGlobal('AudioContext', factory);
  const el = document.createElement('video');
  el.muted = true;
  const bus = new AudioBus([el]);
  expect(bus.mode).toBe('element');
  bus.unlock();
  expect(factory).not.toHaveBeenCalled();
  expect(bus.prime(el, 1)).toBe(false);
  expect(el.muted).toBe(false);
  bus.prime(el, 0);
  expect(el.muted).toBe(true);
  bus.destroy();
});
it('queued separated audio is authorized unmuted inside the gesture and synchronously paused', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const mutedAtPlay: boolean[] = [];
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    mutedAtPlay.push(this.muted);
    return Promise.resolve();
  });
  const pool = new AudioPool(document.createElement('div'), 1, () => {});
  const el = pool.acquire('sound', 'a', 'blob:original', new Set())!;
  el.muted = true;
  pause.mockClear();
  pool.unlock();
  expect(mutedAtPlay).toEqual([false]);
  expect(pause).toHaveBeenCalledOnce();
  expect(el.muted).toBe(true);
  pool.destroy();
});
it('does not replace an active decoder URL during playback; paused video and audio adopt the ready proxy', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const host = document.createElement('div');
  const video = new VideoPool(host, 1, () => {}),
    audio = new AudioPool(host, 1, () => {});
  const v = video.acquire('v', 'a', 'blob:original', new Set())!;
  const a = audio.acquire('a', 'a', 'blob:original', new Set())!;
  video.acquire('v', 'a', 'blob:proxy', new Set(), false, false);
  audio.acquire('a', 'a', 'blob:proxy', new Set(), false);
  expect(v.getAttribute('src')).toBe('blob:original');
  expect(a.getAttribute('src')).toBe('blob:original');
  video.acquire('v', 'a', 'blob:proxy', new Set());
  audio.acquire('a', 'a', 'blob:proxy', new Set());
  expect(v.getAttribute('src')).toBe('blob:proxy');
  expect(a.getAttribute('src')).toBe('blob:proxy');
  video.destroy();
  audio.destroy();
});
