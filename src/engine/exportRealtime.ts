import type { Project } from '../model/types';
import { Player } from './player';
import { ensureUrls, urlFor } from './assetUrls';
import { totalDuration } from './timeline';
import { exportSize, prepareFonts, type ExportOptions, type VideoResult } from './exportVideo';
import { audioEntries } from './exportAudio';

export function unlockExportAudio(): AudioContext | undefined {
  if (typeof AudioContext === 'undefined') return;
  try {
    const ctx = new AudioContext();
    void ctx.resume();
    return ctx;
  } catch {
    return;
  }
}
export async function exportRealtime(
  project: Project,
  options: ExportOptions,
  context: AudioContext | undefined,
  mount: HTMLElement,
): Promise<VideoResult> {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream)
    throw Error('此瀏覽器不支援相容匯出，請使用更新的 Safari 或 Chrome');
  const { signal, progress } = options,
    size = exportSize(project, options.maxSize),
    duration = totalDuration(project);
  if (duration <= 0) throw Error('請先加入素材');
  progress(0, '正在準備相容模式…');
  await prepareFonts(project);
  signal.throwIfAborted();
  const missing = await ensureUrls(project.id, project.assets);
  if (missing.length) throw Error('找不到專案的部分素材，請先重新匯入');
  const hasAudio = options.audio && audioEntries(project).length > 0;
  const type = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ].find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw Error('此瀏覽器沒有可用的影片錄製格式');
  const host = document.createElement('div'),
    canvas = document.createElement('canvas');
  host.className = 'video-pool';
  mount.append(canvas, host);
  canvas.style.width = '100%';
  canvas.style.maxHeight = '28dvh';
  canvas.style.objectFit = 'contain';
  let player: Player | null = null,
    stream: MediaStream | null = null,
    recorder: MediaRecorder | null = null;
  try {
    const snapshot = structuredClone(project);
    if (!options.audio) for (const track of snapshot.tracks) track.muted = true;
    player = await Player.create({
      host,
      canvas,
      getProject: () => snapshot,
      urlFor: (id) => urlFor(project.id, id),
      maxSize: options.maxSize,
      audioContext: context,
    });
    player.seek(0);
    const deadline = performance.now() + 15000;
    while (!player.frameReady) {
      signal.throwIfAborted();
      if (performance.now() > deadline) throw Error('素材尚未解碼，請先在預覽播放一次再匯出');
      await new Promise<void>((r) => setTimeout(r, 30));
    }
    stream = canvas.captureStream(options.fps);
    if (hasAudio) {
      const audio = player.captureAudio();
      if (!audio) throw Error('此瀏覽器無法擷取音訊，請更新瀏覽器');
      for (const track of audio.getAudioTracks()) stream.addTrack(track);
    }
    recorder = new MediaRecorder(stream, {
      mimeType: type,
      videoBitsPerSecond: Math.max(750000, size.width * size.height * options.fps * 0.12),
    });
    const parts: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) parts.push(e.data);
    };
    const completed = new Promise<void>((resolve, reject) => {
      recorder!.onstop = () => resolve();
      recorder!.onerror = () => reject(Error('影片錄製失敗'));
    });
    recorder.start(1000);
    player.play();
    const playing = player;
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        cleanup();
        reject(new DOMException('已取消', 'AbortError'));
      };
      const off = playing.subscribe((t, active) => {
        progress(
          Math.min(0.97, t / duration),
          `相容匯出 ${Math.round((t / duration) * 100)}%・請保持頁面開啟`,
        );
        if (!active && t >= duration - 0.01) {
          cleanup();
          resolve();
        }
      });
      const cleanup = () => {
        off();
        signal.removeEventListener('abort', abort);
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    if (recorder.state !== 'inactive') recorder.stop();
    await completed;
    signal.throwIfAborted();
    const blob = new Blob(parts, { type: recorder.mimeType || type });
    if (blob.size < 100) throw Error('沒有產生可用的影片');
    progress(1, '相容影片匯出完成');
    return { blob, extension: blob.type.includes('mp4') ? 'mp4' : 'webm', method: 'realtime', ...size };
  } finally {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    player?.destroy();
    for (const track of stream?.getTracks() ?? []) track.stop();
    canvas.remove();
    host.remove();
  }
}
