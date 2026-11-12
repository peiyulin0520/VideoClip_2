import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClip, createProject, createTrack } from '../model/defaults';
import type { Asset } from '../model/types';
import { hexRgb, hsvHex, rgbHex, rgbHsv } from './colors';
import { audibleClips } from './audio';
import { decorationOps, opsBounds } from './decorations';
import { placeItem, removeAnyItem, splitAny, duplicateAny } from '../store/actions';
import { useProjectStore, setMainItems } from '../store/projectStore';
import { visibleLayers } from './timeline';
import { separateAudio } from './materials';
import { safeGiphyUrl, searchGiphy } from './giphy';
import { exportSize } from './exportVideo';

const video: Asset = {
  id: 'video',
  kind: 'video',
  name: '原片',
  mime: 'video/webm',
  duration: 4,
  width: 1080,
  height: 1920,
  size: 20,
  hasAudio: true,
  thumbs: [],
};
afterEach(() => vi.unstubAllGlobals());

describe('色輪與任意 RGB', () => {
  it('主色、灰階、近黑與精細色值都可往返，色碼不是操作必要輸入', () => {
    expect(hsvHex(0, 1, 1)).toBe('#ff0000');
    expect(hsvHex(120, 1, 1)).toBe('#00ff00');
    expect(hsvHex(240, 1, 1)).toBe('#0000ff');
    for (const color of ['#000000', '#ffffff', '#125acd', '#323232', '#f8a233', '#010204']) {
      const hsv = rgbHsv(hexRgb(color));
      expect(hsvHex(hsv.h, hsv.s, hsv.v)).toBe(color);
    }
    expect(rgbHex([-10, 300, 127.6])).toBe('#00ff80');
  });
});
describe('自由主軌與間隔', () => {
  it('拖出空隙，分割、複製、刪除與復原不把其他影片吸回 0 秒', () => {
    const p = createProject('自由');
    p.freeMain = true;
    p.assets = [video];
    const a = createClip(video),
      b = { ...createClip(video), start: 6 };
    p.tracks[0]!.items = [a, b];
    useProjectStore.getState().load(p);
    placeItem(a.id, 1);
    let now = useProjectStore.getState().project!;
    expect(visibleLayers(now, 0)).toHaveLength(0);
    expect(visibleLayers(now, 5.5)).toHaveLength(0);
    splitAny(a.id, 3);
    now = useProjectStore.getState().project!;
    expect(now.tracks[0]!.items.map((i) => i.start)).toEqual([1, 3, 6]);
    duplicateAny(b.id);
    removeAnyItem(a.id);
    now = useProjectStore.getState().project!;
    expect(now.tracks[0]!.items[0]!.start).toBe(3);
    setMainItems(now.tracks[0]!.items as ReturnType<typeof createClip>[]);
    expect(useProjectStore.getState().project!.tracks[0]!.items[0]!.start).toBe(3);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project!.tracks[0]!.items[0]!.id).toBe(a.id);
  });
});
describe('原音、分離音訊與混音規則', () => {
  it('關閉/隱藏/音量/時間範圍真正影響音訊，分離只留一份可播放原音', () => {
    const p = createProject('聲音');
    p.assets = [video];
    const clip = createClip(video);
    p.tracks[0]!.items = [clip];
    useProjectStore.getState().load(p);
    expect(audibleClips(p, 1)).toHaveLength(1);
    expect(audibleClips(p, 4)).toHaveLength(0);
    separateAudio(clip.id);
    const now = useProjectStore.getState().project!;
    expect(now.tracks[0]!.items[0]!.type).toBe('video');
    const list = audibleClips(now, 1);
    expect(list).toHaveLength(1);
    expect(list[0]!.item.type).toBe('audio');
    expect(list[0]!.gain).toBe(1);
    const muted = structuredClone(now);
    muted.tracks[1]!.muted = true;
    expect(audibleClips(muted, 1)).toHaveLength(0);
    muted.tracks[1]!.muted = false;
    muted.tracks[1]!.hidden = true;
    expect(audibleClips(muted, 1)).toHaveLength(0);
    useProjectStore.getState().undo();
    expect(audibleClips(useProjectStore.getState().project!, 1)[0]!.item.type).toBe('video');
  });
  it('版型期間原主軌靜音，版型以外恢復；背景音樂可獨立加入', () => {
    const p = createProject('版型');
    p.assets = [video];
    p.tracks[0]!.items = [createClip(video)];
    const template = createTrack('overlay', p.tracks);
    template.template = true;
    template.items = [{ ...createClip(video), start: 1, duration: 1 }];
    p.tracks.push(template);
    const music = createTrack('audio', p.tracks);
    music.items = [{ ...createClip(video), type: 'audio', volume: 0.4 }];
    p.tracks.push(music);
    expect(audibleClips(p, 0.5).map((x) => x.track.kind)).toEqual(['main', 'audio']);
    expect(audibleClips(p, 1.5).map((x) => x.track.kind)).toEqual(['overlay', 'audio']);
    expect(audibleClips(p, 2.5).map((x) => x.track.kind)).toEqual(['main', 'audio']);
  });
});
it('裝飾長度保持置中、透明度相乘，原有 marker 透明度保留', () => {
  const ink = { x: 0, y: 0, w: 400, h: 80 };
  const base = { kind: 'wave-underline' as const, color: '#fff', width: 0.1 };
  const full = opsBounds(decorationOps(base, ink))!,
    short = opsBounds(decorationOps({ ...base, length: 0.4, opacity: 0.25 }, ink))!;
  expect(short.r - short.l).toBeLessThan(full.r - full.l);
  expect((short.l + short.r) / 2).toBeCloseTo((full.l + full.r) / 2);
  expect(decorationOps({ ...base, opacity: 0.25 }, ink)[0]!.alpha).toBe(0.25);
  expect(decorationOps({ kind: 'marker', color: '#fff', width: 1, opacity: 0.5 }, ink)[0]!.alpha).toBe(0.325);
});
it('匯出尺寸維持比例、偶數，不放大來源，預覽品質不會改變輸出選項', () => {
  expect(exportSize({ width: 1080, height: 1920 }, 720)).toEqual({ width: 406, height: 720 });
  expect(exportSize({ width: 320, height: 240 }, 1920)).toEqual({ width: 320, height: 240 });
});
it('GIPHY 請求只帶裝置填入的 Key，拒絕第三方或非 HTTPS 貼圖網址', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        {
          id: 'good',
          title: '貼圖',
          url: 'https://giphy.com/stickers/good',
          images: { original: { url: 'https://media.giphy.com/media/good/giphy.gif' } },
        },
        { id: 'bad', url: 'javascript:alert(1)', images: { original: { url: 'https://example.com/a.gif' } } },
      ],
    }),
  });
  vi.stubGlobal('fetch', fetcher);
  const result = await searchGiphy('device-only-test-key', '愛心');
  expect(result).toHaveLength(1);
  const requested = new URL(fetcher.mock.calls[0]![0] as URL);
  expect(requested.origin).toBe('https://api.giphy.com');
  expect(requested.searchParams.get('api_key')).toBe('device-only-test-key');
  expect(requested.searchParams.get('q')).toBe('愛心');
  expect(safeGiphyUrl('http://media.giphy.com/a.gif')).toBeNull();
  expect(safeGiphyUrl('https://giphy.com.evil.example/a.gif')).toBeNull();
});
