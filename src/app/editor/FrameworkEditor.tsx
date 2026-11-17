/* eslint-disable react-hooks/refs -- Refs are accessed only by pointer handlers and effects; the compiler misclassifies the stored drag snapshot as a render read. */
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Project, Track, VideoItem } from '../../model/types';
import {
  upgradeFramework,
  setFrameBox,
  resizeCellBoundary,
  templateCells,
  addTemplateAsset,
} from '../../engine/templateModel';
import { dragArea } from '../../engine/resizeArea';
import { groupFrame, groupTransform } from '../../engine/templateGeometry';
import { useProjectStore } from '../../store/projectStore';
import { useUI } from '../../store/uiStore';
import { itemName } from '../../engine/itemName';
import { updateTemplateChild } from '../../engine/templatePlayback';
import { Sheet } from '../../ui/Sheet';
import { ProjectPreview } from './ProjectPreview';
import { TemplateCellEditor } from './TemplateCellEditor';

export function FrameworkEditor({
  track,
  mode,
  onClose,
}: {
  track: Track;
  mode: 'frame' | 'cells';
  onClose: () => void;
}) {
  const project = useProjectStore((s) => s.project)!;
  const player = useUI((s) => s.player);
  const [draft, setDraft] = useState<Project>(() => {
    const d = structuredClone(project);
    upgradeFramework(
      d,
      d.tracks.find((t) => t.id === track.id)!,
    );
    return d;
  });
  const group = draft.tracks.find((t) => t.id === track.id)!,
    time = player?.time ?? group.layout!.start;
  const frame = groupFrame(group, draft.width, draft.height, time),
    tf = groupTransform(group, time);
  const stage = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<{ x: number; y: number; draft: Project; edge: string; cell?: number } | null>(null);
  const [focus, setFocus] = useState(0);
  useEffect(() => {
    player?.pause();
    player?.setPreviewProject(draft);
    return () => player?.setPreviewProject(null);
  }, [player, draft]);
  const down = (e: PointerEvent, edge: string, cell?: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { x: e.clientX, y: e.clientY, draft, edge, cell };
  };
  const move = (e: PointerEvent) => {
    const g = gesture.current,
      r = stage.current?.getBoundingClientRect();
    if (!g || !r) return;
    const next = structuredClone(g.draft),
      tr = next.tracks.find((t) => t.id === track.id)!,
      f = groupFrame(tr, next.width, next.height, time),
      s = groupTransform(tr, time).scale;
    const dx = ((e.clientX - g.x) / r.width) * next.width,
      dy = ((e.clientY - g.y) / r.height) * next.height;
    if (g.cell === undefined) {
      const box = dragArea(
        {
          id: tr.id,
          x: f.cx / next.width,
          y: f.cy / next.height,
          w: f.w / next.width / s,
          h: f.h / next.height / s,
        },
        g.edge as Parameters<typeof dragArea>[1],
        dx,
        dy,
        next.width,
        next.height,
        s,
        0,
      );
      setFrameBox(next, tr, box, { x: f.cx / next.width, y: f.cy / next.height });
    } else {
      const c = tr.layout!.cells![g.cell]!,
        edge = g.edge as 'l' | 'r' | 't' | 'b';
      const v =
        edge === 'l'
          ? c.x + dx / f.w
          : edge === 'r'
            ? c.x + c.w + dx / f.w
            : edge === 't'
              ? c.y + dy / f.h
              : c.y + c.h + dy / f.h;
      resizeCellBoundary(tr, g.cell, edge, v);
    }
    setDraft(next);
  };
  const stop = () => {
    gesture.current = null;
  };
  const cells = templateCells(group);
  return (
    <Sheet
      open
      title={mode === 'frame' ? '調整外框大小' : '調整格子分界'}
      onClose={onClose}
      className="framework-editor"
    >
      <div className="framework-editor-bar">
        <ProjectPreview start={group.layout!.start} duration={group.layout!.duration} targetCanvas={canvas} />
        <button
          className="btn primary"
          onClick={() => {
            useProjectStore.getState().apply((d) => {
              const tr = d.tracks.find((t) => t.id === track.id)!;
              tr.layout = structuredClone(group.layout);
              tr.items = structuredClone(group.items);
            });
            onClose();
          }}
        >
          套用框架調整
        </button>
      </div>
      <p className="hint">
        {mode === 'frame'
          ? '拖外框四邊或四角，調整整組框架的範圍。'
          : '選擇格子後，拖它與相鄰格子之間的分界；外框大小維持不變。'}
      </p>
      {mode === 'cells' && (
        <div className="chips">
          {cells.map((_, i) => (
            <button key={i} className={`chip${focus === i ? ' active' : ''}`} onClick={() => setFocus(i)}>
              第 {i + 1} 格
            </button>
          ))}
        </div>
      )}
      <div
        ref={stage}
        className="framework-resize-stage"
        style={{
          aspectRatio: `${draft.width}/${draft.height}`,
          width: `min(100%, ${Math.min(340, (window.innerHeight * 0.5 * draft.width) / draft.height)}px)`,
        }}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        <canvas
          ref={canvas}
          width={540}
          height={Math.round((540 * draft.height) / draft.width)}
          aria-label="框架調整畫面"
        />
        <div
          className="framework-resize-box"
          style={{
            left: `${((frame.cx - frame.w / 2) / draft.width) * 100}%`,
            top: `${((frame.cy - frame.h / 2) / draft.height) * 100}%`,
            width: `${(frame.w / draft.width) * 100}%`,
            height: `${(frame.h / draft.height) * 100}%`,
          }}
        >
          {mode === 'frame'
            ? (['l', 'r', 't', 'b', 'tl', 'tr', 'bl', 'br'] as const).map((edge) => (
                <button
                  key={edge}
                  aria-label={`外框${edge}把手`}
                  className={`framework-handle ${edge}`}
                  onPointerDown={(e) => down(e, edge)}
                />
              ))
            : cells.map(
                (c, i) =>
                  i === focus && (
                    <div
                      key={i}
                      className="framework-cell-bounds"
                      style={{
                        left: `${c.x * 100}%`,
                        top: `${c.y * 100}%`,
                        width: `${c.w * 100}%`,
                        height: `${c.h * 100}%`,
                      }}
                    >
                      {(['l', 'r', 't', 'b'] as const)
                        .filter((edge) => {
                          const raw = group.layout!.cells![i]!;
                          return edge === 'l'
                            ? raw.x > 0.001
                            : edge === 'r'
                              ? raw.x + raw.w < 0.999
                              : edge === 't'
                                ? raw.y > 0.001
                                : raw.y + raw.h < 0.999;
                        })
                        .map((edge) => (
                          <button
                            key={edge}
                            className={`framework-handle ${edge}`}
                            aria-label={`第${i + 1}格${edge}分界`}
                            onPointerDown={(e) => down(e, edge, i)}
                          />
                        ))}
                    </div>
                  ),
              )}
        </div>
      </div>
      <p className="hint">
        外框 {Math.round((frame.w / draft.width) * 100)}% × {Math.round((frame.h / draft.height) * 100)}% ·
        縮放 {Math.round(tf.scale * 100)}%
      </p>
    </Sheet>
  );
}

export function FrameworkSources({
  track,
  cell,
  onClose,
}: {
  track: Track;
  cell: number;
  onClose: () => void;
}) {
  const p = useProjectStore((s) => s.project)!;
  const current = p.tracks.find((t) => t.id === track.id)!;
  const [editing, setEditing] = useState<VideoItem | null>(null);
  const [asset, setAsset] = useState(p.assets.find((a) => a.kind !== 'audio')?.id ?? '');
  const members = current.items.filter((it, i) => (it.templateCell ?? i + 1) === cell);
  return (
    <Sheet open title={`第 ${cell} 格素材`} onClose={onClose}>
      <p className="hint">
        每次加入會建立獨立的一列，可同時疊加。影像保留原始內容，加入後可從圖層頁籤縮放與移動。
      </p>
      <label className="field">
        選擇素材
        <select aria-label="格子新增素材" value={asset} onChange={(e) => setAsset(e.target.value)}>
          {p.assets
            .filter((a) => a.kind !== 'audio')
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </label>
      <button
        className="chip"
        disabled={!asset}
        onClick={() => {
          useProjectStore.getState().apply((d) => {
            const tr = d.tracks.find((t) => t.id === track.id)!,
              a = d.assets.find((a) => a.id === asset)!;
            addTemplateAsset(d as never, tr as never, a, cell);
          });
        }}
      >
        加入此格的新影像列
      </button>
      <div className="framework-member-list">
        {members.map((it) => (
          <div key={it.id}>
            <span>{itemName(p, it)}</span>
            {it.type !== 'text' && it.type !== 'audio' && (
              <button className="chip" onClick={() => setEditing(it)}>
                片段範圍
              </button>
            )}
            <button
              className="chip"
              onClick={() => {
                useProjectStore.getState().select(it.id);
                useUI.setState({ templateCellId: it.id, templateDestination: { trackId: track.id, cell } });
                onClose();
              }}
            >
              選取素材
            </button>
          </div>
        ))}
      </div>
      <button className="btn primary" onClick={onClose}>
        完成
      </button>
      {editing && (
        <TemplateCellEditor
          item={editing}
          index={cell - 1}
          onApply={(draft) =>
            useProjectStore.getState().apply((d) => updateTemplateChild(d, editing.id, draft))
          }
          onClose={() => setEditing(null)}
        />
      )}
    </Sheet>
  );
}
