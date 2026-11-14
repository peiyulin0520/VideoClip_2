import { AUDIO_FADE, audioWindowAt, windowGain, softLimit } from './audioEnvelope';
import { mediaSegments } from './templateTiming';
import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny';
import type { Project, VideoItem, Track, Asset } from '../model/types';
import { getMedia } from '../storage/media';
import { audibleClips } from './audio';
import { audioBoundaries } from './audioRanges';

export function audioEntries(project: Project) {
  return project.tracks.flatMap((track) =>
    track.items.flatMap((item) => {
      if (
        track.hidden ||
        track.muted ||
        item.type === 'text' ||
        item.type === 'image' ||
        item.audioEnabled === false ||
        item.volume <= 0
      )
        return [];
      const asset = project.assets.find((a) => a.id === item.assetId);
      return asset?.hasAudio ? [{ item, track, asset }] : [];
    }),
  );
}
export class AudioRenderer {
  private inputs = new Map<string, Input>();
  private sinks = new Map<string, AudioBufferSink>();
  private boundaries: number[];
  private constructor(
    private project: Project,
    private entries: { item: VideoItem; track: Track; asset: Asset }[],
  ) {
    this.boundaries = [
      ...entries.flatMap(({ item }) => audioBoundaries(item)),
      ...project.tracks
        .filter((tr) => tr.template && !tr.hidden)
        .flatMap((tr) => tr.items.flatMap((it) => [it.start, it.start + it.duration])),
    ];
  }
  static async create(project: Project, signal: AbortSignal) {
    const renderer = new AudioRenderer(project, audioEntries(project));
    try {
      for (const { asset } of renderer.entries) {
        signal.throwIfAborted();
        if (renderer.inputs.has(asset.id)) continue;
        const input = new Input({
          source: new BlobSource(await getMedia(project.id, asset.id, asset.mime)),
          formats: ALL_FORMATS,
        });
        renderer.inputs.set(asset.id, input);
        const track = await input.getPrimaryAudioTrack();
        if (!track || !(await track.canDecode()))
          throw Error(`無法解碼「${asset.name}」的音訊，請改用相容即時匯出`);
        renderer.sinks.set(asset.id, new AudioBufferSink(track));
      }
      return renderer;
    } catch (e) {
      renderer.destroy();
      throw e;
    }
  }
  async chunk(start: number, end: number, signal: AbortSignal): Promise<AudioBuffer> {
    const rate = 48000,
      frames = Math.max(1, Math.round((end - start) * rate));
    const ctx = new OfflineAudioContext(2, frames, rate);
    for (const { item, asset } of this.entries) {
      for (const segment of mediaSegments(item)) {
        const a = Math.max(start, segment.start),
          b = Math.min(end, segment.end);
        if (b <= a) continue;
        const sink = this.sinks.get(asset.id)!;
        const s0 = segment.sourceStart + (a - segment.start) * item.speed,
          s1 = segment.sourceStart + (b - segment.start) * item.speed;
        for await (const wrapped of sink.buffers(s0, s1)) {
          signal.throwIfAborted();
          const at = segment.start + (wrapped.timestamp - segment.sourceStart) / item.speed;
          const from = Math.max(a, at),
            to = Math.min(b, at + wrapped.duration / item.speed);
          if (to <= from) continue;
          const cuts = [from, ...this.boundaries.filter((t) => t > from && t < to), to].sort((x, y) => x - y);
          for (let i = 0; i < cuts.length - 1; i++) {
            const l = cuts[i]!,
              r = cuts[i + 1]!,
              volume = audibleClips(this.project, (l + r) / 2).find((x) => x.item.id === item.id)?.gain ?? 0;
            if (volume <= 0) continue;
            const source = ctx.createBufferSource(),
              gain = ctx.createGain();
            source.buffer = wrapped.buffer;
            source.playbackRate.value = item.speed;
            const window = audioWindowAt(item, (l + r) / 2)!;
            const fade = Math.min(AUDIO_FADE, (window.end - window.start) / 2);
            gain.gain.setValueAtTime(windowGain(window, l, volume), l - start);
            for (const at of [window.start + fade, window.end - fade, r]
              .filter((t) => t > l && t <= r)
              .sort((a, b) => a - b))
              gain.gain.linearRampToValueAtTime(windowGain(window, at, volume), at - start);
            source.connect(gain).connect(ctx.destination);
            source.start(l - start, Math.max(0, (l - at) * item.speed), (r - l) * item.speed);
          }
        }
      }
    }
    signal.throwIfAborted();
    const mixed = await ctx.startRendering();
    for (let channel = 0; channel < mixed.numberOfChannels; channel++) {
      const samples = mixed.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) samples[i] = softLimit(samples[i]!);
    }
    return mixed;
  }
  destroy() {
    for (const input of this.inputs.values()) input.dispose();
    this.inputs.clear();
    this.sinks.clear();
  }
}
