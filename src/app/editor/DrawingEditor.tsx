import { useRef, useState, type PointerEvent } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUI } from '../../store/uiStore';
import { Sheet } from '../../ui/Sheet';
import { ColorPicker } from '../../ui/ColorPicker';
import { Slider } from '../../ui/Slider';

type Stroke = { points: [number, number][]; brush: string; color: string; size: number; opacity: number };
export function DrawingEditor({
  onClose,
  onSave,
  background,
}: {
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
  background: string;
}) {
  const project = useProjectStore((s) => s.project)!;
  const canvas = useRef<HTMLCanvasElement>(null),
    strokes = useRef<Stroke[]>([]),
    active = useRef<Stroke | null>(null);
  const [brush, setBrush] = useState('pen'),
    [color, setColor] = useState('#ff4d8d'),
    [size, setSize] = useState(15),
    [opacity, setOpacity] = useState(100);
  const [count, setCount] = useState(0),
    [saving, setSaving] = useState(false),
    [name, setName] = useState('我的手繪');
  const k = Math.min(1, 1280 / Math.max(project.width, project.height)),
    w = Math.round(project.width * k),
    h = Math.round(project.height * k);
  const paint = () => {
    const c = canvas.current!,
      ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    for (const s of [...strokes.current, ...(active.current ? [active.current] : [])]) {
      ctx.save();
      ctx.globalCompositeOperation = s.brush === 'eraser' ? 'destination-out' : 'source-over';
      ctx.globalAlpha = s.opacity * (s.brush === 'marker' ? 0.45 : 1);
      ctx.strokeStyle = ctx.fillStyle = s.color;
      ctx.lineWidth = s.size * k;
      ctx.lineCap = ctx.lineJoin = 'round';
      if (s.brush === 'dots') ctx.setLineDash([0.1, s.size * k * 1.8]);
      if (s.points.length === 1) {
        ctx.beginPath();
        ctx.arc(s.points[0]![0] * w, s.points[0]![1] * h, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
        ctx.stroke();
      }
      ctx.restore();
    }
  };
  const point = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const b = e.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
      Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)),
    ];
  };
  return (
    <Sheet open title="在影片上畫畫" onClose={onClose}>
      <div
        className="drawing-stage"
        style={{ aspectRatio: `${w}/${h}`, backgroundImage: background ? `url(${background})` : undefined }}
      >
        <canvas
          width={w}
          height={h}
          ref={canvas}
          data-testid="drawing-canvas"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            active.current = { points: [point(e)], brush, color, size, opacity: opacity / 100 };
            paint();
          }}
          onPointerMove={(e) => {
            if (!active.current) return;
            active.current.points.push(point(e));
            paint();
          }}
          onPointerUp={() => {
            if (active.current) strokes.current.push(active.current);
            active.current = null;
            setCount(strokes.current.length);
          }}
          onPointerCancel={() => {
            active.current = null;
            paint();
          }}
        />
      </div>
      <div className="chips">
        {[
          ['pen', '圓筆'],
          ['marker', '螢光筆'],
          ['dots', '點點筆'],
          ['eraser', '橡皮擦'],
        ].map(([id, label]) => (
          <button className={`chip${brush === id ? ' active' : ''}`} key={id} onClick={() => setBrush(id!)}>
            {label}
          </button>
        ))}
        <button
          className="chip"
          disabled={!count}
          onClick={() => {
            strokes.current.pop();
            setCount(strokes.current.length);
            paint();
          }}
        >
          復原筆畫
        </button>
      </div>
      <ColorPicker label="筆刷顏色" value={color} onChange={setColor} />
      <Slider label="筆刷粗細" value={size} min={1} max={160} step={1} onChange={setSize} />
      <Slider
        label="筆刷透明度"
        value={opacity}
        min={0}
        max={100}
        step={1}
        format={(v) => `${v}%`}
        onChange={setOpacity}
      />
      <label className="field">
        畫作名稱
        <input aria-label="畫作名稱" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="sheet-row">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn primary"
          disabled={!count || saving}
          onClick={() => {
            setSaving(true);
            const c = canvas.current!;
            c.toBlob((blob) => {
              if (!blob) {
                setSaving(false);
                return;
              }
              void onSave(new File([blob], `${name || '我的手繪'}.png`, { type: 'image/png' })).finally(
                () => {
                  setSaving(false);
                  useUI.getState().setBusy(null);
                },
              );
            }, 'image/png');
          }}
        >
          加入畫作
        </button>
      </div>
    </Sheet>
  );
}
