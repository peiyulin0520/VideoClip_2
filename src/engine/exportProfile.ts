import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import type { Asset, Project } from '../model/types';
import { getMedia } from '../storage/media';
export function originalProfile(project: Project, metadata: Asset[] = project.assets) {
  const ids = new Set(
    project.tracks.flatMap((t) =>
      t.items.flatMap((i) => (i.type !== 'text' && i.type !== 'audio' ? [i.assetId] : [])),
    ),
  );
  const sources = metadata.filter((a) => ids.has(a.id) && a.kind !== 'audio');
  const longest = sources.length
    ? Math.max(...sources.map((a) => Math.max(a.width, a.height)))
    : Math.max(project.width, project.height);
  const scale = longest / Math.max(project.width, project.height);
  const videos = sources.filter((a) => a.kind === 'video');
  const fps = videos.length
    ? Math.max(
        ...videos.map((a) =>
          Number.isFinite(a.frameRate) && a.frameRate! > 0 ? Math.min(240, a.frameRate!) : project.fps,
        ),
      )
    : project.fps;
  return {
    width: Math.max(2, Math.round((project.width * scale) / 2) * 2),
    height: Math.max(2, Math.round((project.height * scale) / 2) * 2),
    fps,
    bitrate: Math.max(750000, ...videos.map((a) => a.videoBitrate ?? 0)),
  };
}
/** Old projects also read native container metadata; never inspect a low-resolution preview proxy. */
export async function loadOriginalProfile(project: Project, signal: AbortSignal) {
  const ids = new Set(
    project.tracks.flatMap((t) => t.items.flatMap((i) => (i.type === 'video' ? [i.assetId] : []))),
  );
  const assets = project.assets.map((a) => ({ ...a }));
  for (const asset of assets) {
    signal.throwIfAborted();
    if (!ids.has(asset.id) || asset.frameRate) continue;
    const file = await getMedia(project.id, asset.id, asset.mime);
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const abort = () => input.dispose();
    signal.addEventListener('abort', abort, { once: true });
    try {
      const video = await input.getPrimaryVideoTrack();
      if (video) {
        const stats = await video.computePacketStats(60);
        asset.frameRate = stats.averagePacketRate;
        asset.videoBitrate = stats.averageBitrate;
      }
    } finally {
      signal.removeEventListener('abort', abort);
      input.dispose();
    }
  }
  signal.throwIfAborted();
  return originalProfile(project, assets);
}
