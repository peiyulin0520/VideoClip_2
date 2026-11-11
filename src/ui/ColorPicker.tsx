/** Native full-spectrum picker plus a precise, pasteable hex field. */
export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const normalize = (text: string) => {
    const s = text.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(s)) return '#' + s.toLowerCase();
    if (/^[0-9a-f]{3}$/i.test(s))
      return (
        '#' +
        [...s]
          .map((c) => c + c)
          .join('')
          .toLowerCase()
      );
    return null;
  };
  return (
    <div className="custom-color">
      <label>
        {label}
        <input
          type="color"
          aria-label={`${label}自訂`}
          value={normalize(value) ?? '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <input
        key={value}
        aria-label={`${label}色碼`}
        defaultValue={value}
        maxLength={7}
        spellCheck={false}
        onChange={(e) => {
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase());
        }}
        onBlur={(e) => {
          const color = normalize(e.target.value);
          if (color) onChange(color);
          else e.target.value = value;
        }}
      />
    </div>
  );
}
