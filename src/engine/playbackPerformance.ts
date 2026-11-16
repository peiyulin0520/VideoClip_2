/** Fixed-size rolling diagnostics. No pixel readback, timers or per-frame UI notifications. */
export class PlaybackPerformance {
  private samples: { at: number; scene: number; composite: number }[] = [];
  slowFrames = 0;
  hardSeeks = 0;
  transition = { frames: 0, slowFrames: 0, hardSeeks: 0 };
  inTransition = false;
  reset() {
    this.samples.length = 0;
    this.slowFrames = 0;
    this.hardSeeks = 0;
    this.transition = { frames: 0, slowFrames: 0, hardSeeks: 0 };
  }
  record(at: number, scene: number, composite: number, fps: number) {
    const previous = this.samples.at(-1)?.at;
    const slow = previous !== undefined && at - previous > Math.max(50, 1500 / fps);
    if (slow) this.slowFrames++;
    if (this.inTransition) {
      this.transition.frames++;
      if (slow) this.transition.slowFrames++;
    }
    this.samples.push({ at, scene, composite });
    if (this.samples.length > 90) this.samples.shift();
  }
  seek() {
    this.hardSeeks++;
    if (this.inTransition) this.transition.hardSeeks++;
  }
  snapshot() {
    const a = this.samples,
      elapsed = (a.at(-1)?.at ?? 0) - (a[0]?.at ?? 0),
      count = Math.max(1, a.length);
    return {
      fps: elapsed > 0 ? ((a.length - 1) * 1000) / elapsed : 0,
      sceneMs: a.reduce((n, s) => n + s.scene, 0) / count,
      compositeMs: a.reduce((n, s) => n + s.composite, 0) / count,
      worstMs: Math.max(0, ...a.map((s) => s.scene + s.composite)),
      slowFrames: this.slowFrames,
      hardSeeks: this.hardSeeks,
      transition: { ...this.transition },
    };
  }
}
/** An already decoded clip start tolerates one late UI frame; don't seek away from the warm frame. */
export function previewSeekTolerance(
  active: boolean,
  running: boolean,
  requested: boolean,
  rebound: boolean,
  warmStart: boolean,
  transition: boolean,
) {
  if (requested || !active) return 0.02;
  if (warmStart) return 0.12;
  return running && !rebound ? (transition ? 1 : 0.5) : 0.02;
}
