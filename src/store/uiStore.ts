import { create } from 'zustand';
import type { Player } from '../engine/player';

type Toast = { id: number; text: string };
let nextId = 1;

type UI = {
  toasts: Toast[];
  toast: (text: string) => void;
  busy: string | null;
  setBusy: (text: string | null) => void;
  previewLoad: {
    progress: number;
    message: string;
    error?: string;
    retry?: () => void;
    canSkip?: boolean;
  } | null;
  keyframePps: number;
  player: Player | null;
  liftedId: string | null;
  effectsSingle: {
    id: string;
    edge: 'enter' | 'exit';
    mode?: 'effect' | 'transition';
    effectId?: string;
    request: number;
  } | null;
  effectsJoin: { fromId: string; toId: string; request: number } | null;
};

export const useUI = create<UI>((set, get) => ({
  toasts: [],
  toast: (text) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-2), { id, text }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600);
  },
  busy: null,
  setBusy: (busy) => set({ busy }),
  previewLoad: null,
  keyframePps: 60,
  player: null,
  liftedId: null,
  effectsJoin: null,
  effectsSingle: null,
}));

export const toast = (text: string) => useUI.getState().toast(text);
