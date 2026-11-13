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

/** One unlocked Web Audio output for all video and music elements (including iOS volume). */
export class AudioBus {
  readonly context: AudioContext | null;
  private analyser: AnalyserNode | null = null;
  private nodes = new Map<HTMLMediaElement, { source: MediaElementAudioSourceNode; gain: GainNode }>();
  constructor(elements: HTMLMediaElement[], existing?: AudioContext) {
    let ctx: AudioContext | null = existing ?? null;
    try {
      if (!ctx && typeof AudioContext !== 'undefined') ctx = new AudioContext();
    } catch {
      /* native output fallback */
    }
    this.context = ctx;
    if (ctx) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
    }
    if (ctx)
      for (const el of elements) {
        const source = ctx.createMediaElementSource(el),
          gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(ctx.destination);
        if (this.analyser) gain.connect(this.analyser);
        this.nodes.set(el, { source, gain });
      }
  }
  unlock() {
    if (this.context?.state === 'suspended') void this.context.resume();
  }
  set(el: HTMLMediaElement, value: number) {
    const node = this.nodes.get(el);
    if (node) {
      node.gain.gain.value = value;
      el.volume = 1;
    } else el.volume = Math.min(1, value);
  }
  clear() {
    for (const { gain } of this.nodes.values()) gain.gain.value = 0;
  }
  energy() {
    if (!this.analyser) return 0;
    const samples = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((n, v) => n + v * v, 0) / samples.length);
  }
  stream(): MediaStream | null {
    if (!this.context) return null;
    const dest = this.context.createMediaStreamDestination();
    for (const { gain } of this.nodes.values()) gain.connect(dest);
    return dest.stream;
  }
  destroy() {
    for (const { source, gain } of this.nodes.values()) {
      source.disconnect();
      gain.disconnect();
    }
    this.analyser?.disconnect();
    this.nodes.clear();
    void this.context?.close().catch(() => {});
  }
}
