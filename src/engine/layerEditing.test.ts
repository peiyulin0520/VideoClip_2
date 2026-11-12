import { describe, expect, it } from 'vitest';
import { createClip, createProject, createTextItem, createTrack } from '../model/defaults';
import type { Asset } from '../model/types';
import { editableProject, moveLayerItem, insertVisualClip } from './layerEditing';
import { buildScene } from './scene';
import { hitLayers } from './geometry';
import { visibleLayers } from './timeline';
import { useProjectStore } from '../store/projectStore';
import { dropLayerItem } from '../store/actions';

const asset = (id: string, kind: Asset['kind'] = 'video'): Asset => ({
  id,
  kind,
  name: id,
  mime: kind === 'audio' ? 'audio/wav' : 'video/webm',
  size: 10,
  duration: 8,
  width: 100,
  height: 100,
  hasAudio: kind !== 'image',
  thumbs: [],
});
function fixture() {
  const p = editableProject(createProject('layers'));
  p.assets = [asset('a'), asset('b'), asset('sound', 'audio')];
  const a = { ...createClip(p.assets[0]!), duration: 2 };
  const b = { ...createClip(p.assets[1]!), start: 4, duration: 2 };
  p.tracks[0]!.items = [a, b];
  const visual = createTrack('overlay', p.tracks),
    text = createTrack('text', p.tracks),
    audio = createTrack('audio', p.tracks);
  text.items = [createTextItem(0)];
  audio.items = [createClip(p.assets[2]!)];
  p.tracks.push(visual, text, audio);
  return { p, a, b, visual, text, audio };
}

describe('typed independent layer editing', () => {
  it('inserts a blank at the playhead, splits source accurately and keeps later gaps', () => {
    const { p, a, b } = fixture();
    const original = { ...a, speed: 2, trimIn: 1, duration: 4 };
    const later = { ...b, start: 8 };
    const blank = { ...createClip({ ...p.assets[0]!, kind: 'image' }), duration: 3 };
    const out = insertVisualClip([original, later], blank, 2);
    expect(out.map((it) => [it.start, it.duration])).toEqual([
      [0, 2],
      [2, 3],
      [5, 2],
      [11, 2],
    ]);
    expect(out[2]!.trimIn).toBe(5);
    expect(out[2]!.id).not.toBe(original.id);
    expect(original.duration).toBe(4);
    expect(later.start).toBe(8);
  });
  it('inserting inside a gap shifts later items without removing the gap', () => {
    const { p, a, b } = fixture();
    const blank = { ...createClip({ ...p.assets[0]!, kind: 'image' }), duration: 1 };
    const out = insertVisualClip([a, { ...b, start: 7 }], blank, 4);
    expect(out.map((it) => [it.start, it.duration])).toEqual([
      [0, 2],
      [4, 1],
      [8, 2],
    ]);
  });

  it('opens legacy projects freely without changing timing, IDs or stack', () => {
    const { p } = fixture();
    p.tracks[0]!.name = '主軌';
    p.mainOffset = 2.3;
    p.freeMain = false;
    p.tracks[0]!.items[0]!.start = 2.3;
    const original = structuredClone(p),
      edited = editableProject(p);
    expect(edited.freeMain).toBe(true);
    expect(edited.flexibleLayers).toBe(true);
    expect(edited.tracks.map((t) => [t.id, t.items])).toEqual(p.tracks.map((t) => [t.id, t.items]));
    expect(edited.tracks[0]!.name).toBe('影像 1');
    expect(p).toEqual(original);
    expect(visibleLayers(edited, 2)).toHaveLength(2); // Only the text and audio lanes are active.
  });
  it('moves one clip across lanes and time, preserves siblings and supports one-step undo', () => {
    const { p, a, b, visual } = fixture();
    useProjectStore.getState().load(p);
    dropLayerItem(a.id, 1.25, { trackId: visual.id });
    const now = useProjectStore.getState().project!;
    expect(now.tracks[0]!.items).toEqual([b]);
    expect(now.tracks[1]!.items).toEqual([{ ...a, start: 1.25 }]);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project!.tracks).toEqual(p.tracks);
  });
  it('can create a visual lane below the former main lane', () => {
    const { p, a } = fixture();
    const original = p.tracks[0]!.id;
    moveLayerItem(p, a.id, 3, { insertAt: 0 });
    expect(p.tracks[0]!.kind).toBe('overlay');
    expect(p.tracks[0]!.items[0]!.id).toBe(a.id);
    expect(p.tracks[1]!.id).toBe(original);
    expect(p.tracks[0]!.items[0]!.start).toBe(3);
  });
  it.each(['image into audio', 'text into image', 'audio into text'])(
    'rejects %s without partial changes',
    (scenario) => {
      const { p, a, visual, text, audio } = fixture();
      const original = structuredClone(p);
      const id =
        scenario === 'image into audio'
          ? a.id
          : scenario === 'text into image'
            ? text.items[0]!.id
            : audio.items[0]!.id;
      const target = scenario === 'image into audio' ? audio : scenario === 'text into image' ? visual : text;
      expect(() => moveLayerItem(p, id, 10, { trackId: target.id })).toThrow('各自類型');
      expect(p).toEqual(original);
    },
  );
  it.each(['source locked', 'target locked', 'occupied'])(
    'rejects %s without moving other material',
    (scenario) => {
      const { p, a, visual } = fixture();
      if (scenario === 'source locked') p.tracks[0]!.locked = true;
      if (scenario === 'target locked') visual.locked = true;
      if (scenario === 'occupied') visual.items.push({ ...createClip(p.assets[1]!), duration: 2 });
      const original = structuredClone(p);
      expect(() => moveLayerItem(p, a.id, 0, { trackId: visual.id })).toThrow();
      expect(p).toEqual(original);
    },
  );
  it('moves audio only to audio, keeping source trim, gain and timing', () => {
    const { p, audio } = fixture();
    const target = createTrack('audio', p.tracks);
    p.tracks.push(target);
    const clip = audio.items[0]!;
    if (clip.type === 'text') throw Error('fixture');
    clip.trimIn = 1;
    clip.volume = 0.3;
    clip.duration = 2;
    const before = structuredClone(clip);
    moveLayerItem(p, clip.id, 5, { trackId: target.id });
    expect(audio.items).toHaveLength(0);
    expect(target.items).toEqual([{ ...before, start: 5 }]);
  });
  it('moves a template as one group, keeping its independent cells and frame time', () => {
    const { p, a, b, visual } = fixture();
    visual.template = true;
    visual.items = [
      { ...a, start: 1 },
      { ...b, start: 1 },
    ];
    p.tracks[0]!.items = [];
    visual.layout = { style: 'photobooth', motion: 'slide', start: 1, duration: 2 };
    moveLayerItem(p, a.id, 3, { insertAt: p.tracks.length });
    expect(p.tracks.at(-1)!.id).toBe(visual.id);
    expect(visual.items.map((it) => it.start)).toEqual([3, 3]);
    expect(visual.layout.start).toBe(3);
  });
  it('does not ungroup a template into a normal lane by accident', () => {
    const { p, a, visual } = fixture();
    p.tracks[0]!.template = true;
    const before = structuredClone(p);
    expect(() => moveLayerItem(p, a.id, 0, { trackId: visual.id })).toThrow('保持整組獨立');
    expect(p).toEqual(before);
  });
  it('preview lift changes only the requested scene order; default/export stays unchanged', () => {
    const { p, a, visual } = fixture();
    const upper = { ...createClip(p.assets[1]!), duration: 2 };
    visual.items = [upper];
    p.tracks = p.tracks.slice(0, 2);
    const before = structuredClone(p);
    const provide = () => ({ source: document.createElement('canvas'), ready: true, srcW: 100, srcH: 100 });
    expect(buildScene(p, 0, 100, 100, provide).map((l) => l.id)).toEqual([a.id, upper.id]);
    expect(buildScene(p, 0, 100, 100, provide, a.id).map((l) => l.id)).toEqual([upper.id, a.id]);
    expect(buildScene(p, 0, 100, 100, provide).map((l) => l.id)).toEqual([a.id, upper.id]);
    expect(p).toEqual(before);
  });
  it('hit testing lists covered layers and lets exposed areas through a manual mask', () => {
    const { p, a, visual } = fixture();
    const upper = {
      ...createClip(p.assets[1]!),
      duration: 2,
      mask: {
        points: [
          [0, 0],
          [0.5, 0],
          [0.5, 1],
          [0, 1],
        ] as [number, number][],
      },
    };
    visual.items = [upper];
    p.tracks = p.tracks.slice(0, 2);
    const ctx = { canvasW: 100, canvasH: 100, assets: p.assets, textSize: () => ({ w: 20, h: 20 }) };
    expect(hitLayers(visibleLayers(p, 0), ctx, 25, 50).map((l) => l.item.id)).toEqual([upper.id, a.id]);
    expect(hitLayers(visibleLayers(p, 0), ctx, 75, 50).map((l) => l.item.id)).toEqual([a.id]);
  });
});
