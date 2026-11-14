import { cellMediaTime } from './templateTiming';
import type { Project, VideoItem, Track, Asset } from '../model/types';
import { AUDIO_FADE, type AudioWindow } from './audioEnvelope';
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

type Envelope = { at: number; from: number; to: number; riseEnd: number; fadeStart?: number; end?: number };
type AudioNodeState = {
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  target: number;
  windowKey?: string;
  envelope: Envelope;
};
/** Web Audio envelopes keep native mute/pause/seek from cutting a nonzero sample. */
export class AudioBus {
  private ctx: AudioContext | null = null;
  get context() {
    return this.ctx;
  }
  private analyser: AnalyserNode | null = null;
  private output: DynamicsCompressorNode | null = null;
  private master: GainNode | null = null;
  private nodes = new Map<HTMLMediaElement, AudioNodeState>();
  private wanted = new Map<HTMLMediaElement, { value: number; window?: AudioWindow; time?: number }>();
  private stops = new Map<HTMLMediaElement, ReturnType<typeof setTimeout>>();
  private seeks = new Map<HTMLMediaElement, { apply: () => void; timer: ReturnType<typeof setTimeout> }>();
  private allowed: Set<HTMLMediaElement>;
  constructor(elements: HTMLMediaElement[], existing?: AudioContext) {
    this.allowed = new Set(elements);
    if (existing) this.initialize(existing);
  }
  private initialize(ctx: AudioContext) {
    this.ctx = ctx;
    this.output = ctx.createDynamicsCompressor();
    this.output.threshold.value = -6;
    this.output.knee.value = 3;
    this.output.ratio.value = 20;
    this.output.attack.value = 0.001;
    this.output.release.value = 0.12;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.output.connect(this.master);
    this.master.connect(ctx.destination);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.master.connect(this.analyser);
  }
  unlock() {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* Older Safari. */
    }
    try {
      if (!this.ctx && typeof AudioContext !== 'undefined')
        this.initialize(new AudioContext({ latencyHint: 'playback' }));
    } catch {
      /* Keep native audio available. */
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {});
  }
  owns(el: HTMLMediaElement) {
    return this.nodes.has(el);
  }
  isSeeking(el: HTMLMediaElement) {
    return this.seeks.has(el);
  }
  private value(node: AudioNodeState, now: number) {
    const e = node.envelope;
    if (now < e.riseEnd)
      return e.from + (e.to - e.from) * Math.max(0, (now - e.at) / Math.max(0.00001, e.riseEnd - e.at));
    if (e.fadeStart !== undefined && e.end !== undefined && now >= e.fadeStart)
      return e.to * Math.max(0, (e.end - now) / Math.max(0.00001, e.end - e.fadeStart));
    return e.to;
  }
  private ramp(node: AudioNodeState, target: number, end?: number) {
    const now = this.ctx!.currentTime,
      param = node.gain.gain,
      current = this.value(node, now);
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else {
      param.cancelScheduledValues(now);
      param.setValueAtTime(current, now);
    }
    const fade = end === undefined ? AUDIO_FADE : Math.max(0, Math.min(AUDIO_FADE, (end - now) / 2));
    param.linearRampToValueAtTime(target, now + fade);
    if (end !== undefined && target > 0) {
      param.setValueAtTime(target, Math.max(now + fade, end - fade));
      param.linearRampToValueAtTime(0, end);
    }
    node.envelope = {
      at: now,
      from: current,
      to: target,
      riseEnd: now + fade,
      fadeStart: end === undefined ? undefined : end - fade,
      end,
    };
    node.target = target;
  }
  set(el: HTMLMediaElement, value: number, window?: AudioWindow, time?: number) {
    this.wanted.set(el, { value: Math.max(0, value), window, time });
  }
  clear() {
    this.wanted.clear();
  }
  pause(el: HTMLMediaElement) {
    if (this.stops.has(el) || this.seeks.has(el)) return;
    const node = this.nodes.get(el);
    if (!node || !this.ctx || el.paused || this.value(node, this.ctx.currentTime) <= 0.000001) {
      if (!el.paused) el.pause();
      return;
    }
    this.ramp(node, 0);
    el.dataset.audioFading = '1';
    node.windowKey = undefined;
    this.stops.set(
      el,
      setTimeout(
        () => {
          this.stops.delete(el);
          if (!this.seeks.has(el)) delete el.dataset.audioFading;
          if (el.dataset.previewIntent !== 'play' && !el.dataset.priming) el.pause();
        },
        AUDIO_FADE * 1000 + 4,
      ),
    );
  }
  deferSeek(el: HTMLMediaElement, apply: () => void) {
    const pending = this.seeks.get(el);
    if (pending) {
      pending.apply = apply;
      return;
    }
    const node = this.nodes.get(el);
    if (!node || !this.ctx || el.paused || this.value(node, this.ctx.currentTime) <= 0.000001) {
      apply();
      return;
    }
    this.ramp(node, 0);
    el.dataset.audioFading = '1';
    node.windowKey = undefined;
    const task = {
      apply,
      timer: setTimeout(
        () => {
          this.seeks.delete(el);
          if (!this.stops.has(el)) delete el.dataset.audioFading;
          task.apply();
        },
        AUDIO_FADE * 1000 + 4,
      ),
    };
    this.seeks.set(el, task);
  }
  flush() {
    if (this.ctx && this.output)
      for (const [el, wanted] of this.wanted)
        if (wanted.value > 0 && this.allowed.has(el) && !this.nodes.has(el)) {
          try {
            const source = this.ctx.createMediaElementSource(el),
              gain = this.ctx.createGain();
            gain.gain.value = 0;
            source.connect(gain).connect(this.output);
            this.nodes.set(el, {
              source,
              gain,
              target: 0,
              envelope: { at: this.ctx.currentTime, from: 0, to: 0, riseEnd: this.ctx.currentTime },
            });
          } catch {
            /* Never attach one element to two contexts. */
          }
        }
    for (const [el, node] of this.nodes) {
      const wanted = this.wanted.get(el),
        value = wanted?.value ?? 0;
      const key = value > 0 && wanted?.window ? `${wanted.window.start}|${wanted.window.end}` : undefined;
      if (value > 0) {
        const stop = this.stops.get(el);
        if (stop) {
          clearTimeout(stop);
          this.stops.delete(el);
          if (!this.seeks.has(el)) delete el.dataset.audioFading;
        }
      }
      if (node.target !== value || node.windowKey !== key) {
        const end =
          value > 0 && wanted?.window && wanted.time !== undefined
            ? this.ctx!.currentTime + Math.max(0, wanted.window.end - wanted.time)
            : undefined;
        this.ramp(node, value, end);
        node.windowKey = key;
      }
      if (el.volume !== 1) el.volume = 1;
      el.muted = !!el.dataset.priming;
    }
    for (const [el, wanted] of this.wanted)
      if (!this.nodes.has(el)) {
        if (el.volume !== Math.min(1, wanted.value)) el.volume = Math.min(1, wanted.value);
        el.muted = !!el.dataset.priming || wanted.value === 0;
      }
  }
  /** Local debug-only waveform meter; normal playback never creates a worklet. */
  async probe(milliseconds: number) {
    const ctx = this.ctx,
      master = this.master;
    if (!ctx || !master) throw Error('Start playback before measuring audio');
    const name = `lm-meter-${Math.random().toString(36).slice(2)}`;
    const code = `class Meter extends AudioWorkletProcessor { constructor(){ super(); this.peak=0; this.jump=0; this.samples=0; this.last=null; this.port.onmessage=()=>this.port.postMessage({peak:this.peak,maxJump:this.jump,samples:this.samples}); } process(inputs){ const x=inputs[0]?.[0]; if(x)for(const v of x){ this.peak=Math.max(this.peak,Math.abs(v)); if(this.last!==null)this.jump=Math.max(this.jump,Math.abs(v-this.last)); this.last=v; this.samples++; } return true; } } registerProcessor('${name}',Meter);`;
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    let node: AudioWorkletNode | null = null;
    try {
      await ctx.audioWorklet.addModule(url);
      node = new AudioWorkletNode(ctx, name);
      master.connect(node);
      node.connect(ctx.destination);
      return await new Promise<{ peak: number; maxJump: number; samples: number }>((resolve) => {
        node!.port.onmessage = (event) => resolve(event.data);
        setTimeout(() => node!.port.postMessage('done'), milliseconds);
      });
    } finally {
      if (node) {
        try {
          master.disconnect(node);
          node.disconnect();
        } catch {
          /* Project closed. */
        }
      }
      URL.revokeObjectURL(url);
    }
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
    this.master?.connect(dest);
    return dest.stream;
  }
  destroy() {
    for (const timer of this.stops.values()) clearTimeout(timer);
    for (const task of this.seeks.values()) clearTimeout(task.timer);
    this.stops.clear();
    this.seeks.clear();
    for (const { source, gain } of this.nodes.values()) {
      source.disconnect();
      gain.disconnect();
    }
    this.analyser?.disconnect();
    this.output?.disconnect();
    this.master?.disconnect();
    this.nodes.clear();
    void this.ctx?.close().catch(() => {});
  }
}
