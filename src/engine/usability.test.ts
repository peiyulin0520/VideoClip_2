import { describe, it, expect, afterEach, vi } from 'vitest';
import { createProject, createClip, createTextItem } from '../model/defaults';
import type { Asset } from '../model/types';
import { collagePlan, layoutMotion, layoutSlots } from './layouts';
import { decorationOps, opsBounds } from './decorations';
import { shapePath } from './shapes';
import { visibleLayers, relayout, totalDuration } from './timeline';
import { useProjectStore, setMainItems } from '../store/projectStore';
import { setMainOffset, splitAny, duplicateAny, removeAnyItem } from '../store/actions';
import { VideoPool } from './mediaPool';

const asset = (id: string, duration = 4): Asset => ({
  id,
  kind: 'video',
  name: id,
  mime: 'video/webm',
  size: 30,
  duration,
  width: 1080,
  height: 1920,
  hasAudio: true,
  thumbs: [],
});
afterEach(() => vi.unstubAllGlobals());
describe('開場留白與既有主軌編輯', () => {
  it('開場沒有提早偷畫第一支影片；分割/複製/移除後仍保留起點，可復原', () => {
    const p = createProject('開場');
    const a = asset('a');
    p.assets = [a];
    p.tracks[0]!.items = [createClip(a)];
    useProjectStore.getState().load(p);
    setMainOffset(2.5);
    let now = useProjectStore.getState().project!;
    expect(visibleLayers(now, 2.49)).toHaveLength(0);
    expect(visibleLayers(now, 2.5)[0]!.item.start).toBe(2.5);
    expect(totalDuration(now)).toBe(6.5);
    const id = now.tracks[0]!.items[0]!.id;
    splitAny(id, 4.5);
    now = useProjectStore.getState().project!;
    expect(now.tracks[0]!.items.map((x) => x.start)).toEqual([2.5, 4.5]);
    duplicateAny(id);
    now = useProjectStore.getState().project!;
    expect(now.tracks[0]!.items.map((x) => x.start)).toEqual([2.5, 4.5, 6.5]);
    removeAnyItem(id);
    now = useProjectStore.getState().project!;
    expect(now.tracks[0]!.items[0]!.start).toBe(2.5);
    setMainItems(relayout(now.tracks[0]!.items as ReturnType<typeof createClip>[]));
    expect(useProjectStore.getState().project!.tracks[0]!.items[0]!.start).toBe(2.5);
    setMainOffset(0);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project!.mainOffset).toBe(2.5);
  });
});
describe('多格影片版型', () => {
  it('每格保留獨立素材與相同時鐘；來源不足補色、只第一格有聲音', () => {
    const p = createProject('多格');
    p.assets = [asset('a', 4), asset('b', 7), asset('c', 5), asset('d', 8)];
    const plan = collagePlan(
      p,
      p.assets.map((a) => a.id),
      'polaroid',
      'slide',
      2,
      6,
    );
    expect(plan.layout.duration).toBe(6);
    expect(plan.tracks[0]!.items.map((it) => (it as ReturnType<typeof createClip>).assetId)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(plan.tracks).toHaveLength(1);
    expect(plan.tracks[0]!.items.map((it) => (it as ReturnType<typeof createClip>).audioEnabled)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(plan.tracks.every((t) => t.items[0]!.start === 2 && t.items[0]!.duration === 6)).toBe(true);
    const slots = layoutSlots('polaroid');
    for (const s of slots) {
      expect(s.x + s.w).toBeLessThanOrEqual(1);
      expect(s.y + s.h).toBeLessThanOrEqual(1);
    }
    expect(layoutMotion(plan.layout, 2).x).toBe(1);
    expect(layoutMotion(plan.layout, 3).x).toBe(0);
    expect(layoutMotion(plan.layout, 7.9).x).toBeLessThan(0);
    expect(() => collagePlan(p, ['missing'], 'filmstrip', 'none', 0, 3)).toThrow();
  });
});
describe('可調字卡幾何', () => {
  it('裝飾間距移動路徑而不改粗細/寬度，排版尺寸可據新路徑預留空間', () => {
    const ink = { x: 10, y: 20, w: 300, h: 80 },
      base = { kind: 'wave-underline' as const, color: '#ff4488', width: 0.1 };
    const a = decorationOps(base, ink),
      b = decorationOps({ ...base, offset: 0.75 }, ink),
      aa = opsBounds(a)!,
      bb = opsBounds(b)!;
    expect(bb.t - aa.t).toBeCloseTo(60);
    expect(bb.b - aa.b).toBeCloseTo(60);
    expect(bb.r - bb.l).toBeCloseTo(aa.r - aa.l);
    expect(a[0]!.width).toBe(b[0]!.width);
  });
  it('圓滑/深度選項會改變星形輪廓，產生有限且閉合的幾何；舊樣式保留', () => {
    const a = shapePath('star5', 300, 160),
      b = shapePath('star5', 300, 160, { softness: 0.8, depth: 0.25 });
    expect(b).not.toEqual(a);
    expect(b.at(-1)).toEqual(['Z']);
    expect(b.some((c) => c[0] === 'C')).toBe(true);
    for (const c of b) for (const value of c.slice(1)) expect(Number.isFinite(value)).toBe(true);
    expect(shapePath('star5', 300, 160, { softness: 0, depth: 1 })).toEqual(a);
    expect(createTextItem(0).card.runs[0]!.shadow).toBeUndefined();
  });
});
describe('Safari 首格解碼補強', () => {
  it('沒有 loadeddata 也會在 metadata 時以靜音啟動解碼，首格回來後停住並通知重畫', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
      frames.push(fn);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {}),
      play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(),
      pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const changed = vi.fn(),
      host = document.createElement('div'),
      pool = new VideoPool(host, 1, changed);
    let decoded: (() => void) | undefined;
    const video = pool.acquire('item', 'asset', 'blob:video', new Set())!;
    video.requestVideoFrameCallback = (fn) => {
      decoded = () => fn(0, {} as VideoFrameCallbackMetadata);
      return 1;
    };
    video.dataset.previewIntent = 'pause';
    video.dispatchEvent(new Event('loadedmetadata'));
    await Promise.resolve();
    expect(load).toHaveBeenCalled();
    expect(play).toHaveBeenCalled();
    expect(video.muted).toBe(true);
    expect(video.dataset.priming).toBe('1');
    decoded!();
    expect(pause).toHaveBeenCalled();
    expect(changed).toHaveBeenCalled();
    expect(video.dataset.priming).toBeUndefined();
    pool.destroy();
    vi.restoreAllMocks();
  });
});
