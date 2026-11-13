import { useRef, useState } from 'react';

/** Local sheet history: cancelling never changes the project undo stack. */
export function useDraftHistory<T>(initial: T) {
  const [value, render] = useState(initial);
  const current = useRef(initial),
    past = useRef<T[]>([]),
    gesture = useRef<T | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const different = (a: T, b: T) => JSON.stringify(a) !== JSON.stringify(b);
  const set = (next: T | ((before: T) => T)) => {
    const result = typeof next === 'function' ? (next as (before: T) => T)(current.current) : next;
    if (!different(current.current, result)) return;
    if (gesture.current === null) past.current.push(structuredClone(current.current));
    setCanUndo(past.current.length > 0);
    current.current = result;
    render(result);
  };
  const begin = () => {
    gesture.current ??= structuredClone(current.current);
  };
  const end = () => {
    if (gesture.current !== null && different(gesture.current, current.current))
      past.current.push(gesture.current);
    gesture.current = null;
    setCanUndo(past.current.length > 0);
  };
  return {
    value,
    set,
    begin,
    end,
    canUndo,
    undo: () => {
      end();
      const previous = past.current.pop();
      if (previous !== undefined) {
        current.current = previous;
        render(previous);
        setCanUndo(past.current.length > 0);
      }
    },
  };
}
