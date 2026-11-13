import { afterEach, expect, it, vi } from 'vitest';
import { createProject, createTextItem, createTrack } from '../model/defaults';
import { buildScene } from './scene';
import { Player, previewSize } from './player';

vi.mock('./compositor', () => ({
  Compositor: {
    create: vi.fn(async () => ({ width: 1080, height: 1920, render: vi.fn(), destroy: vi.fn() })),
  },
}));
vi.mock('./scene', () => ({ buildScene: vi.fn(() => []) }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('修剪的專案更新與邊緣預覽每幀只畫一次，解碼通知仍保留邊緣時間，放開後回播放頭', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++next, cb);
    return next;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const flush = () => {
    const batch = [...frames.values()];
    frames.clear();
    for (const cb of batch) cb(0);
  };
  const project = createProject('修剪');
  const track = createTrack('text', project.tracks);
  track.items = [createTextItem(0)];
  project.tracks.push(track);
  const player = await Player.create({
    host: document.createElement('div'),
    canvas: document.createElement('canvas'),
    getProject: () => project,
    urlFor: () => undefined,
  });
  player.refresh();
  player.peek(1);
  player.peek(2);
  expect(frames.size).toBe(1);
  expect(buildScene).not.toHaveBeenCalled();
  flush();
  expect(buildScene).toHaveBeenCalledTimes(1);
  expect(vi.mocked(buildScene).mock.calls.at(-1)![1]).toBe(2);
  player.scheduleRender(); // An asynchronously decoded frame arrives.
  flush();
  expect(vi.mocked(buildScene).mock.calls.at(-1)![1]).toBe(2);
  player.refresh(); // Pointer release restores the real playhead.
  flush();
  expect(vi.mocked(buildScene).mock.calls.at(-1)![1]).toBe(0);
  expect(player.time).toBe(0);
  player.destroy();
});

it('defaults to a 540px preview and permits a higher cap without changing project dimensions', () => {
  const p = { width: 1080, height: 1920 };
  expect(previewSize(p)).toEqual({ width: 304, height: 540 });
  expect(previewSize(p, 1080)).toEqual({ width: 608, height: 1080 });
  expect(p).toEqual({ width: 1080, height: 1920 });
});
