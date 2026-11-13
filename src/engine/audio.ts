import { cellMediaTime } from './templateTiming';
import type { Project, VideoItem, Track, Asset } from '../model/types';
import { audioRetained } from './audioRanges';
export type AudibleClip = { item: VideoItem; track: Track; asset: Asset; gain: number };
export function audibleClips(project: Project, t: number): AudibleClip[] {
  const templateActive = project.tracks.some(
    (tr) => tr.template && !tr.hidden && tr.items.some((it) => t >= it.start && t < it.start + it.duration),
  );
  return project.tracks.flatMap((track) => {
    if (track.hidden || track.muted || (track.kind === 'main' && templateActive && !project.flexibleLayers))
      return [];
    return track.items.flatMap((item) => {
      if (
        item.type === 'text' ||
        item.type === 'image' ||
        item.audioEnabled === false ||
        cellMediaTime(item, t) === null ||
        !audioRetained(item, cellMediaTime(item, t) ?? item.trimIn) ||
        item.volume <= 0 ||
        t < item.start ||
        t >= item.start + item.duration
      )
        return [];
      const asset = project.assets.find((a) => a.id === item.assetId);
      return asset?.hasAudio ? [{ item, track, asset, gain: item.volume }] : [];
    });
  });
}

export function isIOSDevice() {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}
export function previewPlaybackRate(delta: number, speed: number, ios = isIOSDevice()) {
  // VideoClip's Safari path deliberately avoids rate nudges: each change can restart decoding.
  return ios || Math.abs(delta) <= 0.08 || Math.abs(delta) >= 0.3
    ? speed
    : speed * (1 + Math.max(-0.03, Math.min(0.03, delta * 0.1)));
}

/** Lazy, gesture-unlocked audio. Only audible sources get Web Audio nodes. */
export class AudioBus {
  private ctx: AudioContext | null = null;
  get context() {
    return this.ctx;
  }
  private analyser: AnalyserNode | null = null;
  private output: DynamicsCompressorNode | null = null;
  private nodes = new Map<
    HTMLMediaElement,
    { source: MediaElementAudioSourceNode; gain: GainNode; target: number }
  >();
  private wanted = new Map<HTMLMediaElement, number>();
  private allowed: Set<HTMLMediaElement>;
  constructor(elements: HTMLMediaElement[], existing?: AudioContext) {
    this.allowed = new Set(elements);
    if (existing) this.initialize(existing);
  }
  private initialize(ctx: AudioContext) {
    this.ctx = ctx;
    this.output = ctx.createDynamicsCompressor();
    this.output.threshold.value = -1;
    this.output.knee.value = 0;
    this.output.ratio.value = 20;
    this.output.attack.value = 0.003;
    this.output.release.value = 0.08;
    this.output.connect(ctx.destination);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.output.connect(this.analyser);
  }
  unlock() {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* Older Safari may not allow setting the session. */
    }
    try {
      if (!this.ctx && typeof AudioContext !== 'undefined')
        this.initialize(new AudioContext({ latencyHint: 'playback' }));
    } catch {
      /* Native element audio remains available. */
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  set(el: HTMLMediaElement, value: number) {
    this.wanted.set(el, Math.max(0, value));
  }
  clear() {
    this.wanted.clear();
  }
  flush() {
    if (this.ctx && this.output)
      for (const [el, value] of this.wanted)
        if (value > 0 && this.allowed.has(el) && !this.nodes.has(el)) {
          try {
            const source = this.ctx.createMediaElementSource(el),
              gain = this.ctx.createGain();
            gain.gain.value = 0;
            source.connect(gain).connect(this.output);
            this.nodes.set(el, { source, gain, target: 0 });
          } catch {
            /* A source must never be connected to two contexts. */
          }
        }
    for (const [el, node] of this.nodes) {
      const value = this.wanted.get(el) ?? 0;
      if (node.target !== value) {
        const now = this.ctx!.currentTime;
        node.gain.gain.cancelScheduledValues(now);
        node.gain.gain.setTargetAtTime(value, now, 0.008);
        node.target = value;
      }
      if (el.volume !== 1) el.volume = 1;
    }
    for (const [el, value] of this.wanted)
      if (!this.nodes.has(el) && el.volume !== Math.min(1, value)) el.volume = Math.min(1, value);
  }
  energy() {
    if (!this.analyser) return 0;
    const samples = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((n, v) => n + v * v, 0) / samples.length);
  }
  stream() {
    if (!this.ctx) return null;
    const dest = this.ctx.createMediaStreamDestination();
    this.output?.connect(dest);
    return dest.stream;
  }
  destroy() {
    for (const { source, gain } of this.nodes.values()) {
      source.disconnect();
      gain.disconnect();
    }
    this.analyser?.disconnect();
    this.output?.disconnect();
    this.nodes.clear();
    void this.ctx?.close().catch(() => {});
  }
}
