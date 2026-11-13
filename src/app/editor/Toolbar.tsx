import { evaluatedItem } from '../../engine/keyframes';
import { Sheet } from '../../ui/Sheet';
import { EffectsPanel } from './EffectsPanel';
import { groupTransform } from '../../engine/templateGeometry';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Gauge,
  Film,
  Layers,
  Lock,
  Maximize,
  Minimize,
  Plus,
  Pencil,
  Scissors,
  Trash2,
  Type,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { BLEND_LABELS } from '../../engine/geometry';
import {
  findItem,
  isVideoItem,
  itemAt,
  layersAt,
  mainItems,
  moveItem,
  setSpeed,
} from '../../engine/timeline';
import { MAX_SPEED, MIN_SPEED } from '../../model/defaults';
import type { BlendMode, Item, VideoItem } from '../../model/types';
import {
  addText,
  duplicateAny,
  editItem,
  patchTrack,
  placeItem,
  removeAnyItem,
  shiftTrackLayer,
  splitAny,
  setMainOffset,
  setTransform,
} from '../../store/actions';
import { setMainItems, setTrackItems, useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';
import { Slider } from '../../ui/Slider';
import { ColorPicker } from '../../ui/ColorPicker';
import { TemplatePanel } from './TemplatePanel';
import { TextPanel } from './TextPanel';
import { AssetsPanel } from './AssetsPanel';
import { AudioPanel } from './AudioPanel';
import { BlankPanel } from './BlankPanel';
import { TrimEditor } from './TrimEditor';
import { CropEditor } from './CropEditor';

export type Tab = 'edit' | 'overlay' | 'text' | 'layers' | 'layout' | 'assets' | 'audio' | 'effects';
type Panel = 'speed' | 'volume' | 'opening' | null;

const TABS: { id: Tab; label: string }[] = [
  { id: 'edit', label: '剪輯' },
  { id: 'overlay', label: '影像' },
  { id: 'text', label: '文字' },
  { id: 'layers', label: '圖層' },
  { id: 'layout', label: '版型' },
  { id: 'assets', label: '素材' },
  { id: 'audio', label: '音訊' },
  { id: 'effects', label: '特效' },
];

function ToolButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button className={`tool${active ? ' active' : ''}`} onClick={onClick} aria-label={label}>
      <Icon size={22} />
      <span>{label}</span>
    </button>
  );
}

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3, 4];
const COLORS = ['#ffffff', '#111111', '#ff4d8d', '#ffd23f', '#4dd0ff', '#7CFC6A', '#b388ff', '#ff7a45'];
const BLENDS = Object.keys(BLEND_LABELS) as BlendMode[];

export function BottomBar({
  onImportMain,
  onImportOverlay,
}: {
  onImportMain: () => void;
  onImportOverlay: () => void;
}) {
  const project = useProjectStore((s) => s.project)!;
  const selectedId = useProjectStore((s) => s.selectedId);
  const [tab, setTab] = useState<Tab>('edit');
  const [panel, setPanel] = useState<Panel>(null);
  const [collapsed, setCollapsed] = useState(false);

  const found = findItem(project, selectedId);
  const items = mainItems(project);

  // 點目前的分頁＝收合/展開下面的面板（讓出空間給預覽畫面）
  const switchTab = (t: Tab) => {
    setPanel(null);
    if (t === tab) setCollapsed((c) => !c);
    else {
      setTab(t);
      setCollapsed(false);
    }
  };

  return (
    <div className="bottombar">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-expanded={tab === t.id ? !collapsed : undefined}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {!collapsed && tab === 'edit' && (
        <EditTab panel={panel} setPanel={setPanel} onImport={onImportMain} found={found} items={items} />
      )}
      {!collapsed && tab === 'overlay' && <OverlayTab onImportOverlay={onImportOverlay} />}
      {!collapsed && tab === 'text' && <TextTab found={found} />}
      {!collapsed && tab === 'layers' && <LayersTab />}
      {!collapsed && tab === 'layout' && <TemplatePanel />}
      {!collapsed && tab === 'effects' && <EffectsPanel />}
      {!collapsed && tab === 'assets' && <AssetsPanel />}
      {!collapsed && tab === 'audio' && <AudioPanel />}
    </div>
  );
}

type Found = ReturnType<typeof findItem>;

function EditTab({
  panel,
  setPanel,
  onImport,
  found,
  items,
}: {
  panel: Panel;
  setPanel: (p: Panel) => void;
  onImport: () => void;
  found: Found;
  items: VideoItem[];
}) {
  const project = useProjectStore((s) => s.project)!;
  const player = useUI((s) => s.player);
  const selected = found?.item;
  const [cropping, setCropping] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const isMain = found?.track.kind === 'main';

  const need = (): Item | undefined => {
    if (!selected) toast('請先點選一個片段');
    return selected;
  };

  const split = () => {
    if (!player) return;
    const t = player.time;
    // 有選取就切選取的那個；沒選取就切主軌上播放頭所在的片段
    const target = selected ?? itemAt(items, t)?.item;
    if (!target) return toast('還沒有片段');
    if (!splitAny(target.id, t)) toast('播放頭要在片段中間才能分割（離邊緣至少 0.2 秒）');
  };

  const remove = () => {
    const s = need();
    if (!s) return;
    const idx = found!.index;
    const wasMain = isMain;
    const nextId = wasMain
      ? items[Math.min(idx + 1, items.length - 1)]?.id !== s.id
        ? items[Math.min(idx + 1, items.length - 1)]?.id
        : items[idx - 1]?.id
      : null;
    removeAnyItem(s.id);
    if (nextId) useProjectStore.getState().select(nextId);
    setPanel(null);
  };

  const move = (dir: -1 | 1) => {
    const s = need();
    if (!s) return;
    if (!isMain || project.freeMain) {
      const before = s.start;
      placeItem(s.id, Math.max(0, s.start + dir));
      if (findItem(useProjectStore.getState().project!, s.id)?.item.start === before)
        toast('這個方向沒有足夠空位，可長按片段移到其他位置');
      return;
    }
    const idx = found!.index;
    if (idx + dir < 0 || idx + dir >= items.length) return toast(dir < 0 ? '已經是第一個' : '已經是最後一個');
    setMainItems(moveItem(items, s.id, idx + dir));
  };

  const toggleFit = () => {
    const s = need();
    if (!s) return;
    if (!isVideoItem(s)) return toast('文字沒有填滿/完整');
    editItem(s.id, (it) => {
      if (it.type !== 'text') it.fit = it.fit === 'cover' ? 'contain' : 'cover';
    });
    toast(s.fit === 'cover' ? '完整顯示（上下或左右留黑邊）' : '填滿畫面（裁掉多餘部分）');
  };

  const openPanel = (p: Exclude<Panel, null>) => {
    const s = need();
    if (!s) return;
    if (!isVideoItem(s)) return toast('文字不能變速或調音量');
    if (p === 'speed' && s.type === 'image') return toast('照片不能變速');
    if (p === 'volume' && s.type === 'image') return toast('照片沒有聲音');
    setPanel(p);
  };

  if (panel === 'opening')
    return (
      <div className="panel" role="group" aria-label="開場留白">
        <label className="number-control">
          第一支影片開始（秒）
          <input
            aria-label="第一支影片開始秒數"
            type="number"
            min={0}
            max={600}
            step={0.1}
            value={
              project.freeMain ? Math.min(...items.map((it) => it.start), 600) : (project.mainOffset ?? 0)
            }
            onChange={(e) => setMainOffset(Number(e.target.value))}
          />
        </label>
        <BlankPanel />
        <p className="hint">舊版開場秒數仍保留相容；建議新增留白素材，可直接在時間軸移動與修剪。</p>
        <div className="chips">
          <button
            className="chip"
            onClick={() =>
              useProjectStore.getState().apply((d) => {
                d.background = '#000000';
              })
            }
          >
            黑底
          </button>
          <button
            className="chip"
            onClick={() =>
              useProjectStore.getState().apply((d) => {
                d.background = '#ffffff';
              })
            }
          >
            白底
          </button>
        </div>
        <ColorPicker
          label="畫布底色"
          value={project.background ?? '#000000'}
          onChange={(color) =>
            useProjectStore.getState().apply((d) => {
              d.background = color;
            })
          }
        />
        <button className="btn primary done" onClick={() => setPanel(null)}>
          完成
        </button>
      </div>
    );
  if (panel && selected && isVideoItem(selected)) {
    const asset = project.assets.find((a) => a.id === selected.assetId);
    const setVideo = (patch: Partial<VideoItem>, coalesce?: string) =>
      editItem(selected.id, (it) => void Object.assign(it, patch), coalesce ? { coalesce } : undefined);
    const applySpeed = (v: number, coalesce?: string) => {
      const f = findItem(project, selected.id)!;
      if (f.track.kind === 'main' && !project.freeMain)
        setMainItems(
          setSpeed(f.track.items as VideoItem[], selected.id, v),
          coalesce ? { coalesce } : undefined,
        );
      else {
        // 疊加軌：改速度時長度跟著變，但不能壓到後面的物件
        const span = selected.duration * selected.speed;
        const want = Math.max(span / v, 0.2);
        const next = (f.track.items as Item[]).map((x) =>
          x.id === selected.id ? { ...x, speed: v, duration: want } : x,
        );
        const nextStart = (f.track.items as Item[])
          .filter((x) => x.id !== selected.id && x.start >= selected.start + 1e-6)
          .reduce((m, x) => Math.min(m, x.start), Infinity);
        if (selected.start + want > nextStart + 1e-6) return toast('後面有別的物件，這個速度會讓它們重疊');
        setTrackItems(f.track.id, next, coalesce ? { coalesce } : undefined);
      }
    };
    return (
      <div className="panel" role="group" aria-label={panel === 'speed' ? '變速' : '音量'}>
        {panel === 'speed' ? (
          <>
            <div className="panel-head">
              <span>播放速度</span>
              <b data-testid="speed-value">{selected.speed}x</b>
            </div>
            <input
              type="range"
              aria-label="播放速度"
              min={Math.log2(MIN_SPEED)}
              max={Math.log2(MAX_SPEED)}
              step={0.01}
              value={Math.log2(selected.speed)}
              onChange={(e) =>
                applySpeed(Math.round(2 ** Number(e.target.value) * 100) / 100, `speed:${selected.id}`)
              }
            />
            <div className="chips">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  className={`chip${selected.speed === s ? ' active' : ''}`}
                  onClick={() => applySpeed(s)}
                >
                  {s}x
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="panel-head">
              <span>音量{asset && !asset.hasAudio ? '（這支影片沒有聲音）' : ''}</span>
              <b data-testid="volume-value">{Math.round(selected.volume * 100)}%</b>
            </div>
            <input
              type="range"
              aria-label="音量"
              min={0}
              max={1}
              step={0.01}
              value={selected.volume}
              onChange={(e) => setVideo({ volume: Number(e.target.value) }, `vol:${selected.id}`)}
            />
            <div className="chips">
              {[0, 0.5, 1].map((v) => (
                <button
                  key={v}
                  className={`chip${selected.volume === v ? ' active' : ''}`}
                  onClick={() => setVideo({ volume: v })}
                >
                  {v === 0 ? '靜音' : `${v * 100}%`}
                </button>
              ))}
            </div>
          </>
        )}
        <button className="btn primary done" onClick={() => setPanel(null)}>
          完成
        </button>
      </div>
    );
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="剪輯工具">
      <ToolButton icon={Plus} label="匯入" onClick={onImport} />
      <ToolButton
        icon={Pencil}
        label="命名"
        onClick={() => {
          if (!selected) return toast('請先選取素材');
          setNameDraft(
            selected.name ??
              (selected.type === 'text'
                ? (selected.card.runs[0]?.text ?? '')
                : (project.assets.find((a) => a.id === selected.assetId)?.name ?? '')),
          );
          setNaming(true);
        }}
      />
      {naming && selected && (
        <Sheet open title="素材命名" onClose={() => setNaming(false)}>
          <label className="field">
            素材名稱
            <input
              autoFocus
              aria-label="素材名稱"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
            />
          </label>
          <div className="sheet-row">
            <button className="btn" onClick={() => setNaming(false)}>
              取消
            </button>
            <button
              className="btn primary"
              disabled={!nameDraft.trim()}
              onClick={() => {
                editItem(selected.id, (it) => {
                  it.name = nameDraft.trim();
                });
                setNaming(false);
              }}
            >
              儲存名稱
            </button>
          </div>
        </Sheet>
      )}

      <ToolButton
        icon={Scissors}
        label="片段範圍"
        onClick={() => {
          if (!selected || selected.type === 'text' || selected.type === 'image')
            return toast('請先選擇影片或音訊');
          player?.pause();
          setTrimming(true);
        }}
      />
      {trimming && selected && selected.type !== 'text' && selected.type !== 'image' && (
        <TrimEditor item={selected} onClose={() => setTrimming(false)} />
      )}
      <ToolButton
        icon={Maximize}
        label="裁切"
        onClick={() => {
          if (!selected || selected.type === 'text' || selected.type === 'audio')
            return toast('請先選擇影片或圖片');
          useUI.getState().player?.pause();
          setCropping(true);
        }}
      />
      {cropping && selected && selected.type !== 'text' && selected.type !== 'audio' && (
        <CropEditor item={selected} onClose={() => setCropping(false)} />
      )}
      <ToolButton icon={Film} label="開場留白" onClick={() => setPanel('opening')} />
      <ToolButton icon={Scissors} label="分割" onClick={split} />
      <ToolButton icon={Trash2} label="刪除" onClick={remove} />
      <ToolButton icon={Copy} label="複製" onClick={() => need() && duplicateAny(selected!.id)} />
      <ToolButton icon={ArrowLeft} label="前移" onClick={() => move(-1)} />
      <ToolButton icon={ArrowRight} label="後移" onClick={() => move(1)} />
      <ToolButton icon={Gauge} label="變速" onClick={() => openPanel('speed')} />
      <ToolButton icon={Volume2} label="音量" onClick={() => openPanel('volume')} />
      <ToolButton
        icon={selected && isVideoItem(selected) && selected.fit === 'contain' ? Minimize : Maximize}
        label={selected && isVideoItem(selected) && selected.fit === 'contain' ? '填滿' : '完整'}
        onClick={toggleFit}
      />
    </div>
  );
}

function OverlayTab({ onImportOverlay }: { onImportOverlay: () => void }) {
  return (
    <div className="panel">
      <p className="hint">
        加入的影片或照片會放在播放頭這一秒，同一秒可以放在多條影像軌。長按單一片段可拖到其他影像軌的空位，或拖到圖層之間新增一層。加好後在預覽畫面上拖移、用兩指縮放旋轉，細節到「圖層」調整。
      </p>
      <button className="btn primary done" onClick={onImportOverlay}>
        ＋ 加入影片或照片（疊在目前這一秒）
      </button>
    </div>
  );
}

function TextTab({ found }: { found: Found }) {
  const player = useUI((s) => s.player);
  const item = found?.item.type === 'text' ? found.item : null;
  const add = () => addText(player?.time ?? 0);
  return (
    <div className="panel tall">
      {item ? (
        <TextPanel item={item} onAdd={add} onAddShape={() => addText(player?.time ?? 0, true)} />
      ) : (
        <>
          <button className="btn primary done" onClick={add}>
            ＋ 新增文字（放在目前這一秒）
          </button>
          <button className="btn done" onClick={() => addText(player?.time ?? 0, true)}>
            ＋ 新增圖形（星形、對話框、雲朵…）
          </button>
          <p className="hint">新增或點選一個文字後，可以在這裡改內容、字體、字塊和描邊。</p>
        </>
      )}
    </div>
  );
}

function LayersTab() {
  const project = useProjectStore((s) => s.project)!;
  const selectedId = useProjectStore((s) => s.selectedId);
  const player = useUI((s) => s.player);
  const t = player?.time ?? 0;
  // 目前這一秒有哪些圖層（最上層在最上面）
  const layers = layersAt(project, t, true).slice().reverse();
  const found = findItem(project, selectedId);
  const it = found?.item;

  return (
    <div className="panel scroll">
      <div className="panel-head">
        <span>這一秒的圖層（上面的會蓋住下面的）</span>
      </div>
      <ul className="layer-list" data-testid="layer-list">
        {layers.map(({ item, track, trackIndex }) => {
          const asset = isVideoItem(item) ? project.assets.find((a) => a.id === item.assetId) : undefined;
          const label =
            item.type === 'text'
              ? item.card.runs[0]?.text === ''
                ? '圖形'
                : `文字：${item.card.runs[0]?.text.slice(0, 8) ?? ''}`
              : (item.name ?? asset?.name ?? '素材');
          return (
            <li
              key={item.id}
              className={`layer-row${item.id === selectedId ? ' selected' : ''}`}
              data-testid="layer-row"
              data-item-id={item.id}
            >
              <button className="layer-name" onClick={() => useProjectStore.getState().select(item.id)}>
                <span className="layer-ico">
                  {item.type === 'text' ? <Type size={16} /> : <Layers size={16} />}
                </span>
                <span className="layer-text">
                  {`${track.name} · `}
                  {label}
                </span>
              </button>
              <button
                className="icon-btn sm"
                aria-label={`${track.name} ${track.hidden ? '顯示' : '隱藏'}`}
                onClick={() => patchTrack(track.id, { hidden: !track.hidden })}
              >
                {track.hidden ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button
                className={`icon-btn sm${track.locked ? ' on' : ''}`}
                aria-label={`${track.name} ${track.locked ? '解鎖' : '鎖定'}`}
                onClick={() => patchTrack(track.id, { locked: !track.locked })}
              >
                <Lock size={18} />
              </button>
              <button
                className="icon-btn sm"
                aria-label={`${track.name} 往上一層`}
                onClick={() =>
                  trackIndex >= project.tracks.length - 1
                    ? toast('已經在最上層')
                    : shiftTrackLayer(track.id, 1)
                }
              >
                <ArrowUp size={18} />
              </button>
              <button
                className="icon-btn sm"
                aria-label={`${track.name} 往下一層`}
                onClick={() => (trackIndex <= 0 ? toast('已經在最下層') : shiftTrackLayer(track.id, -1))}
              >
                <ArrowDown size={18} />
              </button>
            </li>
          );
        })}
        {layers.length === 0 && <li className="hint">這一秒沒有任何圖層</li>}
      </ul>

      {it ? (
        <div className="props" data-testid="layer-props">
          <div className="panel-head">
            <span>選取的圖層</span>
          </div>
          <Slider
            label="圖層大小"
            value={Math.round(
              (findItem(project, it.id)?.track.template
                ? groupTransform(findItem(project, it.id)!.track, player?.time).scale
                : evaluatedItem(it, player?.time ?? it.start).transform.scale) * 100,
            )}
            min={5}
            max={500}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) => setTransform(it.id, { scale: v / 100 }, `size:${it.id}`)}
          />
          {!found?.track.template && (
            <Slider
              label="圖層旋轉"
              value={evaluatedItem(it, player?.time ?? it.start).transform.rotation}
              min={-180}
              max={180}
              step={1}
              format={(v) => `${Math.round(v)}°`}
              onChange={(v) => setTransform(it.id, { rotation: v }, `rot:${it.id}`)}
            />
          )}
          <button className="btn" onClick={() => removeAnyItem(it.id)}>
            刪除選取圖層
          </button>
          <Slider
            label="透明度"
            value={Math.round(evaluatedItem(it, player?.time ?? it.start).transform.opacity * 100)}
            min={0}
            max={100}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) => setTransform(it.id, { opacity: v / 100 }, `op:${it.id}`)}
          />
          <div className="slider-label">與下方畫面如何疊色</div>
          <div className="chips">
            {BLENDS.map((b) => (
              <button
                key={b}
                className={`chip${(it.blend ?? 'normal') === b ? ' active' : ''}`}
                onClick={() => editItem(it.id, (x) => void (x.blend = b))}
              >
                {BLEND_LABELS[b]}
              </button>
            ))}
          </div>
          <p className="hint" data-testid="blend-help">
            {
              {
                normal: '正常：直接顯示這個素材；一般剪輯選這個即可。',
                multiply: '色彩加深：與下方畫面相乘，白色變透明、其他顏色變暗，適合紙張或陰影。',
                screen: '濾色：與下方畫面混合變亮，黑色會消失，適合光效。',
                overlay: '覆蓋：同時加強明暗對比，適合材質與色調。',
                add: '加亮：把亮度相加，容易變白，適合發光特效。',
              }[it.blend ?? 'normal']
            }
          </p>
          <Slider
            label="圓角"
            value={Math.round((it.cornerRadius ?? 0) * 100)}
            min={0}
            max={50}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) =>
              editItem(it.id, (x) => void (x.cornerRadius = v / 100), { coalesce: `cr:${it.id}` })
            }
          />
          <Slider
            label="外框粗細"
            value={it.outline?.width ?? 0}
            min={0}
            max={40}
            step={1}
            format={(v) => `${v}`}
            onChange={(v) =>
              editItem(it.id, (x) => void (x.outline = { color: x.outline?.color ?? '#ffffff', width: v }), {
                coalesce: `ow:${it.id}`,
              })
            }
          />
          <div className="chips">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`swatch${it.outline?.color === c ? ' active' : ''}`}
                style={{ background: c }}
                aria-label={`外框顏色 ${c}`}
                onClick={() =>
                  editItem(it.id, (x) => void (x.outline = { width: x.outline?.width || 8, color: c }))
                }
              />
            ))}
          </div>
          {isVideoItem(it) && (
            <>
              <div className="slider-label">裁切（切掉各邊的比例）</div>
              {(
                [
                  ['l', '左'],
                  ['r', '右'],
                  ['t', '上'],
                  ['b', '下'],
                ] as const
              ).map(([k, name]) => (
                <Slider
                  key={k}
                  label={`裁切${name}`}
                  value={Math.round((it.crop?.[k] ?? 0) * 100)}
                  min={0}
                  max={80}
                  step={1}
                  format={(v) => `${v}%`}
                  onChange={(v) =>
                    editItem(
                      it.id,
                      (x) => {
                        const c = (x.crop ??= { l: 0, t: 0, r: 0, b: 0 });
                        c[k] = v / 100;
                        // 左右、上下加起來不能超過 90%
                        const other = k === 'l' ? 'r' : k === 'r' ? 'l' : k === 't' ? 'b' : 't';
                        if (c[k] + c[other] > 0.9) c[other] = Math.max(0.9 - c[k], 0);
                      },
                      { coalesce: `crop${k}:${it.id}` },
                    )
                  }
                />
              ))}
            </>
          )}
          <button
            className="btn"
            onClick={() =>
              setTransform(
                it.id,
                {
                  x: 0.5,
                  y: 0.5,
                  scale: found?.track.template || it.type === 'text' || it.fit === 'cover' ? 1 : 0.5,
                  rotation: 0,
                },
                `reset:${it.id}`,
              )
            }
          >
            位置、大小、旋轉歸位
          </button>
        </div>
      ) : (
        <p className="hint">點一個圖層（或預覽畫面上的物件）後，可以調透明度、混合模式、圓角、外框和裁切。</p>
      )}
    </div>
  );
}
