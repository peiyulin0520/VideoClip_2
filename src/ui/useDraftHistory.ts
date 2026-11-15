import { useRef, useState } from 'react';

/** Local sheet history: cancelling never changes the project undo stack. */
export function useDraftHistory<T>(initial: T) {
  const [value, render] = useState(initial);
  const current = useRef(initial),
    past = useRef<T[]>([]),
    future = useRef<T[]>([]),
    gesture = useRef<T | null>(null),
    gestureFuture = useRef<T[] | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const different = (a: T, b: T) => JSON.stringify(a) !== JSON.stringify(b);
  const set = (next: T | ((before: T) => T)) => {
    const result = typeof next === 'function' ? (next as (before: T) => T)(current.current) : next;
    if (!different(current.current, result)) return;
    if (gesture.current === null) past.current.push(structuredClone(current.current));
    future.current = [];
    setCanRedo(false);
    setCanUndo(past.current.length > 0);
    current.current = result;
    render(result);
  };
  const begin = () => {
    if (gesture.current === null) {
      gesture.current = structuredClone(current.current);
      gestureFuture.current = [...future.current];
    }
  };
  const end = () => {
    if (gesture.current !== null && different(gesture.current, current.current))
      past.current.push(gesture.current);
    gesture.current = null;
    gestureFuture.current = null;
    setCanUndo(past.current.length > 0);
  };
  return {
    value,
    set,
    begin,
    end,
    canUndo,
    canRedo,
    cancel: () => {
      if (gesture.current !== null) {
        current.current = gesture.current;
        render(current.current);
        future.current = gestureFuture.current ?? future.current;
      }
      gesture.current = null;
      gestureFuture.current = null;
      setCanUndo(past.current.length > 0);
      setCanRedo(future.current.length > 0);
    },
    redo: () => {
      end();
      const next = future.current.pop();
      if (next !== undefined) {
        past.current.push(current.current);
        current.current = next;
        render(next);
        setCanUndo(true);
        setCanRedo(future.current.length > 0);
      }
    },
    undo: () => {
      end();
      const previous = past.current.pop();
      if (previous !== undefined) {
        future.current.push(current.current);
        setCanRedo(true);
        current.current = previous;
        render(previous);
        setCanUndo(past.current.length > 0);
      }
    },
  };
}
