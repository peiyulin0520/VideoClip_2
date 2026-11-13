import { useEffect, useRef, type ComponentProps } from 'react';
export function HoldButton({ onHold, onClick, ...props }: ComponentProps<'button'> & { onHold: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    held = useRef(false),
    origin = useRef([0, 0]);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <button
      {...props}
      onPointerDown={(e) => {
        held.current = false;
        origin.current = [e.clientX, e.clientY];
        timer.current = setTimeout(() => {
          held.current = true;
          onHold();
          navigator.vibrate?.(15);
        }, 500);
      }}
      onPointerMove={(e) => {
        if (Math.hypot(e.clientX - origin.current[0]!, e.clientY - origin.current[1]!) > 8) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (held.current) {
          held.current = false;
          return;
        }
        onClick?.(e);
      }}
    />
  );
}
