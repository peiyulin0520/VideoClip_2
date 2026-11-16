export function Slider({
  label,
  displayLabel,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  displayLabel?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider-row">
      <span className="slider-label">{displayLabel ?? label}</span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <b className="slider-val">{format ? format(value) : value}</b>
    </label>
  );
}
