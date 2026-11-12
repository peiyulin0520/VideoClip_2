import { useState, type PointerEvent } from 'react';
import { hexRgb, rgbHex, rgbHsv, hsvHex } from '../engine/colors';
import { Sheet } from './Sheet';

export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const hsv = rgbHsv(hexRgb(draft));
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - box.left) / box.width) * 2 - 1,
      y = ((e.clientY - box.top) / box.height) * 2 - 1;
    setDraft(
      hsvHex(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, Math.min(1, Math.hypot(x, y)), hsv.v || 1),
    );
  };
  return (
    <div className="custom-color">
      <button
        className="color-custom-button"
        aria-label={`${label}自訂`}
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
      >
        <span className="color-sample" style={{ background: value }} />
        {label}・自訂顏色
      </button>
      <Sheet open={open} title={`${label}自訂顏色`} onClose={() => setOpen(false)}>
        <div
          className="color-wheel"
          data-testid="color-wheel"
          role="slider"
          tabIndex={0}
          aria-label="色相與飽和度"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hsv.h)}

          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons) pick(e);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              setDraft(hsvHex((hsv.h + (e.key === 'ArrowRight' ? 2 : 358)) % 360, hsv.s, hsv.v));
            }
          }}
        >
          <i
            style={{
              left: `${50 + Math.cos((hsv.h * Math.PI) / 180) * hsv.s * 50}%`,
              top: `${50 + Math.sin((hsv.h * Math.PI) / 180) * hsv.s * 50}%`,
            }}
          />
        </div>
        <label className="field">
          亮度
          <input
            type="range"
            aria-label="色彩亮度"
            min={0}
            max={100}
            value={Math.round(hsv.v * 100)}
            onChange={(e) => setDraft(hsvHex(hsv.h, hsv.s, Number(e.target.value) / 100))}
          />
        </label>
        <div className="rgb-controls">
          {['R', 'G', 'B'].map((name, i) => (
            <label key={name}>
              {name}
              <input
                type="number"
                aria-label={`色彩 ${name}`}
                min={0}
                max={255}
                value={hexRgb(draft)[i]}
                onChange={(e) => {
                  const rgb = hexRgb(draft);
                  rgb[i] = Number(e.target.value);
                  setDraft(rgbHex(rgb));
                }}
              />
            </label>
          ))}
        </div>
        <div className="color-preview" style={{ background: draft }} aria-label="所選顏色預覽" />
        <div className="sheet-row">
          <button className="btn" onClick={() => setOpen(false)}>
            取消
          </button>
          <button
            className="btn primary"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            套用顏色
          </button>
        </div>
      </Sheet>
    </div>
  );
}
