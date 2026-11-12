import { createClip, createTrack, newId } from '../model/defaults';
import type { Asset, VideoItem } from '../model/types';
import { useProjectStore } from '../store/projectStore';
import { addOverlayClips, editItem } from '../store/actions';
import { importFiles } from './importMedia';
import { ensureUrls } from './assetUrls';
import { relayout, findFreeStart, sourceTimeAt } from './timeline';
import { putMedia } from '../storage/media';

export async function addMaterialFiles(files: File[], t: number, origin: Asset['origin'] = 'upload') {
  const p = useProjectStore.getState().project!;
  const result = await importFiles(p.id, files);
  if (useProjectStore.getState().project?.id !== p.id) throw Error('專案已切換');
  result.assets.forEach((a) => {
    a.origin = origin;
  });
  await ensureUrls(p.id, result.assets);
  useProjectStore.getState().apply((d) => {
    d.assets.push(...result.assets);
  });
  for (const a of result.assets.filter((a) => a.kind === 'audio')) {
    const clip = { ...createClip(a), start: t };
    useProjectStore.getState().apply(
      (d) => {
        const tr = createTrack('audio', d.tracks);
        tr.items = [clip];
        d.tracks.push(tr);
      },
      { select: clip.id },
    );
  }
  const id = addOverlayClips(
    result.assets.filter((a) => a.kind !== 'audio'),
    t,
  );
  if (result.failed.length) throw Error(result.failed.map((f) => `${f.name}：${f.reason}`).join('、'));
  return { id, assets: result.assets };
}

async function solidAsset(pid: string, color: string): Promise<Asset> {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  c.getContext('2d')!.fillStyle = color;
  c.getContext('2d')!.fillRect(0, 0, 32, 32);
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(Error('色塊製作失敗'))), 'image/png'),
  );
  const asset: Asset = {
    id: newId('a_'),
    kind: 'image',
    name: '留白色塊',
    mime: 'image/png',
    size: blob.size,
    duration: 0,
    width: 32,
    height: 32,
    hasAudio: false,
    thumbs: [c.toDataURL()],
    generated: { color },
  };
  await putMedia(pid, asset.id, blob);
  return asset;
}

export async function addSolid(color: string, t: number, layer = false) {
  const p = useProjectStore.getState().project!;
  const asset = await solidAsset(p.id, color);
  const legacy =
    !layer && !p.freeMain && (p.mainOffset ?? 0) > 0
      ? await solidAsset(p.id, p.background ?? '#000000')
      : null;
  await ensureUrls(p.id, [asset, ...(legacy ? [legacy] : [])]);
  if (useProjectStore.getState().project?.id !== p.id) return;
  const clip = createClip(asset);
  useProjectStore.getState().apply(
    (d) => {
      d.assets.push(asset);
      if (layer) {
        clip.start = Math.max(0, t);
        const track = createTrack('overlay', d.tracks);
        track.name = '留白色塊';
        track.items = [clip];
        d.tracks.push(track);
      } else {
        const tr = d.tracks.find((x) => x.kind === 'main')!;
        let list = [...tr.items] as VideoItem[];
        if (legacy) {
          d.assets.push(legacy);
          list = [{ ...createClip(legacy), duration: d.mainOffset! }, ...list];
          d.mainOffset = 0;
          list = relayout(list);
        }
        if (d.freeMain) {
          clip.start = findFreeStart(list, t, clip.duration);
          tr.items = [...list, clip].sort((a, b) => a.start - b.start);
        } else {
          const at = list.findIndex((it) => t < it.start + it.duration - 0.001);
          if (at < 0) list.push(clip);
          else {
            const it = list[at]!,
              local = t - it.start;
            if (local >= 0.2 && it.duration - local >= 0.2)
              list.splice(at, 1, { ...it, duration: local }, clip, {
                ...it,
                id: newId('i_'),
                start: t,
                duration: it.duration - local,
                trimIn: it.type === 'image' ? 0 : sourceTimeAt(it, t),
              });
            else list.splice(local < 0.2 ? at : at + 1, 0, clip);
          }
          tr.items = relayout(list, d.mainOffset ?? 0);
        }
      }
    },
    { select: clip.id },
  );
  return clip.id;
}

export function separateAudio(id: string) {
  const p = useProjectStore.getState().project!,
    tr = p.tracks.find((t) => t.items.some((it) => it.id === id));
  const item = tr?.items.find((it) => it.id === id);
  if (!item || item.type !== 'video') throw Error('請選擇有原音的影片');
  const asset = p.assets.find((a) => a.id === item.assetId);
  if (!asset?.hasAudio) throw Error('這個素材沒有音訊');
  const audio: VideoItem = { ...item, type: 'audio', id: newId('i_'), audioEnabled: true };
  useProjectStore.getState().apply(
    (d) => {
      const target = d.tracks.flatMap((t) => t.items).find((x) => x.id === id)!;
      if (target.type !== 'text') target.audioEnabled = false;
      const track = createTrack('audio', d.tracks);
      track.items = [audio];
      d.tracks.push(track);
    },
    { select: audio.id },
  );
}

export function setAudioEnabled(id: string, enabled: boolean) {
  editItem(id, (it) => {
    if (it.type !== 'text') it.audioEnabled = enabled;
  });
}
