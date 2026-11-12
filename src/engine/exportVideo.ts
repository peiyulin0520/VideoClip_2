import { cellMediaTime } from './templateTiming';
import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from 'mediabunny';
import type { Project, VideoItem } from '../model/types';
import { ensureFont } from '../fonts/fontStore';
import { getMedia } from '../storage/media';
import { Compositor } from './compositor';
import { buildScene, type SourceProvider } from './scene';
import { sourceTimeAt, totalDuration, visibleLayers } from './timeline';
import { AnimatedGif } from './gif';
import { AudioRenderer, audioEntries } from './exportAudio';

export type ExportOptions = {
  maxSize: number;
  fps: number;
  audio: boolean;
  signal: AbortSignal;
  progress: (value: number, message: string) => void;
};
export type VideoResult = {
  blob: Blob;
  extension: 'mp4' | 'webm';
  method: 'offline' | 'realtime';
  width: number;
  height: number;
};
export function exportSize(project: Pick<Project, 'width' | 'height'>, maxSize: number) {
  const scale = Math.min(1, maxSize / Math.max(project.width, project.height));
  return {
    width: Math.max(2, Math.round((project.width * scale) / 2) * 2),
    height: Math.max(2, Math.round((project.height * scale) / 2) * 2),
  };
}
export async function prepareFonts(project: Project) {
  const ids = [
    ...new Set([
      ...project.tracks.flatMap((tr) => tr.layout?.story?.fontIds ?? []),
      ...project.tracks.flatMap((t) =>
        t.items.flatMap((it) => (it.type === 'text' ? it.card.runs.map((r) => r.fontId) : [])),
      ),
    ]),
  ];
  for (const id of ids)
    if (id !== 'system' && !(await ensureFont(id)))
      throw Error('專案使用的字體無法載入，請到設定確認或重新匯入字體');
}
export async function exportVideo(project: Project, options: ExportOptions): Promise<VideoResult> {
  const { signal, progress } = options,
    size = exportSize(project, options.maxSize),
    duration = totalDuration(project);
  if (duration <= 0) throw Error('請先加入影片、圖片或文字');
  signal.throwIfAborted();
  progress(0, '正在準備字體與編碼器…');
  await prepareFonts(project);
  signal.throwIfAborted();
  const hasAudio = options.audio && audioEntries(project).length > 0;
  const avc = await getFirstEncodableVideoCodec(['avc'], { ...size, frameRate: options.fps });
  const aac = hasAudio
    ? await getFirstEncodableAudioCodec(['aac'], { numberOfChannels: 2, sampleRate: 48000 })
    : null;
  const mp4 = !!avc && (!hasAudio || !!aac);
  const codec = mp4
    ? avc
    : await getFirstEncodableVideoCodec(['vp9', 'vp8'], { ...size, frameRate: options.fps });
  const audioCodec = hasAudio
    ? mp4
      ? aac
      : await getFirstEncodableAudioCodec(['opus'], { numberOfChannels: 2, sampleRate: 48000 })
    : null;
  if (!codec || (hasAudio && !audioCodec)) throw Error('這個瀏覽器無法逐格編碼，請選擇相容即時匯出');
  const inputs = new Map<string, Input>(),
    sinks = new Map<string, CanvasSink>(),
    images = new Map<string, HTMLImageElement>(),
    gifs = new Map<string, AnimatedGif>();
  const prepared = new Map<string, NonNullable<ReturnType<SourceProvider>>>();
  const imageUrls: string[] = [];
  let comp: Compositor | null = null,
    output: Output | null = null,
    mixer: AudioRenderer | null = null,
    finalized = false;
  try {
    const items = project.tracks
      .filter((t) => !t.hidden)
      .flatMap((t) => t.items)
      .filter((it): it is VideoItem => it.type !== 'text' && it.type !== 'audio');
    for (const item of items) {
      signal.throwIfAborted();
      const asset = project.assets.find((a) => a.id === item.assetId);
      if (!asset) throw Error('專案有素材遺失');
      if (item.type === 'image') {
        if (images.has(asset.id) || gifs.has(asset.id)) continue;
        const file = await getMedia(project.id, asset.id, asset.mime);
        if (asset.mime === 'image/gif') gifs.set(item.id, await AnimatedGif.load(file));
        else {
          const img = new Image(),
            url = URL.createObjectURL(file);
          imageUrls.push(url);
          img.src = url;
          await img.decode();
          images.set(asset.id, img);
        }
      } else {
        const input = new Input({
          source: new BlobSource(await getMedia(project.id, asset.id, asset.mime)),
          formats: ALL_FORMATS,
        });
        inputs.set(item.id, input);
        const track = await input.getPrimaryVideoTrack();
        if (!track || !(await track.canDecode()))
          throw Error(`無法逐格解碼「${asset.name}」，請選擇相容即時匯出`);
        const height = Math.max(2, Math.round(Math.min(asset.height, size.height * 2) / 2) * 2);
        sinks.set(item.id, new CanvasSink(track, { height, poolSize: 2 }));
      }
    }
    if (hasAudio) mixer = await AudioRenderer.create(project, signal);
    signal.throwIfAborted();
    comp = await Compositor.create(size);
    const target = new BufferTarget();
    output = new Output({
      format: mp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
      target,
    });
    const video = new CanvasSource(comp.canvas, {
      codec,
      bitrate: Math.max(750_000, size.width * size.height * options.fps * 0.12),
      keyFrameInterval: 2,
    });
    output.addVideoTrack(video, { frameRate: options.fps });
    const audio = audioCodec ? new AudioBufferSource({ codec: audioCodec, bitrate: 192000 }) : null;
    if (audio) output.addAudioTrack(audio);
    await output.start();
    const count = Math.ceil(duration * options.fps);
    for (let frame = 0; frame < count; frame++) {
      signal.throwIfAborted();
      const t = frame / options.fps;
      prepared.clear();
      for (const { item } of visibleLayers(project, t)) {
        if (item.type === 'text' || item.type === 'audio' || (item.cell && cellMediaTime(item, t) === null))
          continue;
        const asset = project.assets.find((a) => a.id === item.assetId)!;
        const gif = gifs.get(item.id),
          img = images.get(asset.id);
        if (gif) {
          const value = gif.frame(sourceTimeAt(item, t));
          prepared.set(item.id, {
            source: value.canvas,
            ready: true,
            srcW: value.canvas.width,
            srcH: value.canvas.height,
            stamp: value.stamp,
          });
        } else if (img)
          prepared.set(item.id, {
            source: img,
            ready: true,
            srcW: img.naturalWidth,
            srcH: img.naturalHeight,
          });
        else {
          const wrapped = await sinks
            .get(item.id)!
            .getCanvas(Math.max(0, Math.min(asset.duration - 0.001, sourceTimeAt(item, t))));
          if (!wrapped) throw Error(`讀不到「${asset.name}」的影格`);
          prepared.set(item.id, {
            source: wrapped.canvas,
            ready: true,
            srcW: wrapped.canvas.width,
            srcH: wrapped.canvas.height,
            stamp: t,
          });
        }
      }
      comp.render(
        buildScene(project, t, size.width, size.height, (item) => prepared.get(item.id) ?? null),
        project.background ?? '#000000',
      );
      await video.add(t, Math.min(1 / options.fps, duration - t));
      if (frame % 3 === 0) {
        progress(
          0.08 + (0.68 * (frame + 1)) / count,
          `正在合成影片 ${Math.round(((frame + 1) / count) * 100)}%`,
        );
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    if (audio && mixer)
      for (let start = 0; start < duration; start += 10) {
        signal.throwIfAborted();
        const end = Math.min(duration, start + 10);
        progress(0.76 + (0.19 * start) / duration, '正在混合原音與背景音樂…');
        await audio.add(await mixer.chunk(start, end, signal));
      }
    signal.throwIfAborted();
    progress(0.97, '正在完成影片檔案…');
    await output.finalize();
    finalized = true;
    if (!target.buffer) throw Error('沒有產生影片檔案');
    progress(1, '影片匯出完成');
    return {
      blob: new Blob([target.buffer], { type: mp4 ? 'video/mp4' : 'video/webm' }),
      extension: mp4 ? 'mp4' : 'webm',
      method: 'offline',
      ...size,
    };
  } finally {
    if (output && !finalized) await output.cancel().catch(() => {});
    comp?.destroy();
    mixer?.destroy();
    for (const input of inputs.values()) input.dispose();
    for (const gif of gifs.values()) gif.destroy();
    for (const url of imageUrls) URL.revokeObjectURL(url);
  }
}
