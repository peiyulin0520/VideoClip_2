import type { VideoItem } from '../model/types';
import { mediaSegments } from './templateTiming';
export const AUDIO_FADE = 0.012;
export type AudioWindow = { start: number; end: number };
/** Fade actual edit boundaries, never every decoded buffer or animation frame. */
export function audioWindows(item: VideoItem): AudioWindow[] {
  return mediaSegments(item).flatMap((s) =>
    item.audioRanges === undefined
      ? [{ start: s.start, end: s.end }]
      : item.audioRanges.flatMap(([a, b]) => {
          const start = Math.max(s.start, s.start + (a - s.sourceStart) / item.speed);
          const end = Math.min(s.end, s.start + (b - s.sourceStart) / item.speed);
          return end > start ? [{ start, end }] : [];
        }),
  );
}
export function audioWindowAt(item: VideoItem, time: number) {
  return audioWindows(item).find((w) => time >= w.start && time < w.end);
}
export function windowGain(window: AudioWindow, time: number, gain: number) {
  const fade = Math.min(AUDIO_FADE, (window.end - window.start) / 2);
  return gain * Math.max(0, Math.min(1, (time - window.start) / fade, (window.end - time) / fade));
}
export function softLimit(sample: number) {
  const x = Math.abs(sample);
  return x <= 0.9 ? sample : Math.sign(sample) * (0.9 + 0.1 * Math.tanh((x - 0.9) / 0.1));
}
