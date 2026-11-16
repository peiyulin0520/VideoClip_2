import { expect, it } from 'vitest';
import { createProject, createClip } from '../model/defaults';
import type { Asset } from '../model/types';
import { originalProfile } from './exportProfile';
import { PlaybackPerformance, previewSeekTolerance } from './playbackPerformance';
const media = (id: string, width: number, height: number, frameRate: number): Asset => ({
  id,
  name: id,
  kind: 'video',
  mime: 'video/mp4',
  width,
  height,
  frameRate,
  size: 1,
  duration: 10,
  hasAudio: true,
  thumbs: [],
  videoBitrate: 40000000,
});
it('mixed native exports use only referenced source dimensions and native fps, keeping project aspect and even dimensions', () => {
  const p = createProject('native');
  p.assets = [
    media('4k', 3840, 2160, 60000 / 1001),
    media('hd', 1920, 1080, 30),
    media('unused', 7680, 4320, 120),
  ];
  p.tracks[0]!.items = p.assets.slice(0, 2).map(createClip);
  expect(originalProfile(p)).toMatchObject({
    width: 2160,
    height: 3840,
    fps: 60000 / 1001,
    bitrate: 40000000,
  });
  p.tracks[0]!.items = [createClip(media('hd', 1920, 1080, 24))];
  p.assets[1]!.frameRate = 24;
  expect(originalProfile(p).fps).toBe(24);
});
it('performance measures actual frame intervals and bounded rolling render times, tracks slow transition frames', () => {
  const perf = new PlaybackPerformance();
  perf.inTransition = true;
  perf.record(0, 2, 3, 30);
  perf.record(1000 / 30, 2, 3, 30);
  perf.record(2000 / 30, 2, 3, 30);
  expect(perf.snapshot().fps).toBeCloseTo(30);
  expect(perf.snapshot().worstMs).toBe(5);
  perf.record(200, 4, 5, 30);
  perf.seek();
  expect(perf.snapshot()).toMatchObject({
    slowFrames: 1,
    hardSeeks: 1,
    transition: { frames: 4, slowFrames: 1, hardSeeks: 1 },
  });
  perf.reset();
  expect(perf.snapshot().fps).toBe(0);
});
it('predecoded incoming frame tolerates one late tick without seeking again, explicit seek stays precise', () => {
  expect(previewSeekTolerance(true, false, false, true, true, true)).toBe(0.12);
  expect(previewSeekTolerance(true, false, true, true, true, true)).toBe(0.02);
  expect(previewSeekTolerance(true, true, false, false, false, true)).toBe(1);
  expect(previewSeekTolerance(true, true, false, false, false, false)).toBe(0.5);
});
