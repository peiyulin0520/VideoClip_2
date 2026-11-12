import { create } from 'zustand';
import { DEFAULT_APP_STATE, loadAppState, saveAppState, type AppState } from '../storage/appState';
import { listProjects } from '../storage/projects';
import { getDB } from '../storage/db';

type Store = {
  loaded: boolean;
  state: AppState;
  init: () => Promise<void>;
  update: (patch: Partial<AppState>) => Promise<void>;
};

/** 測試用：localStorage 的 lm2-skip-onboarding 設成 1 就不顯示首次使用精靈（見 CLAUDE.md） */
function skipFlag(): boolean {
  try {
    return localStorage.getItem('lm2-skip-onboarding') === '1';
  } catch {
    return false;
  }
}

let initializing: Promise<void> | null = null;
let updates: Promise<void> = Promise.resolve();

export const useApp = create<Store>((set, get) => ({
  loaded: false,
  state: DEFAULT_APP_STATE,
  init: async () => {
    if (get().loaded) return;
    if (initializing) return initializing;
    initializing = (async () => {
      let st = await loadAppState();
      if (!st) {
        // 這台裝置已經有專案（精靈上線前就在用）：視為不是第一次，不跳精靈
        const db = await getDB();
        const hasData =
          (await listProjects()).length > 0 ||
          (await db.count('userFonts')) > 0 ||
          (await db.count('library')) > 0;
        st = { ...DEFAULT_APP_STATE, onboarded: hasData || skipFlag() };
        if (st.onboarded && !skipFlag()) await saveAppState(st);
      }
      set({ loaded: true, state: st });
    })();
    try {
      await initializing;
    } finally {
      initializing = null;
    }
  },
  update: (patch) => {
    const pending = updates.then(async () => {
      await get().init();
      const next = { ...get().state, ...patch };
      await saveAppState(next);
      set({ state: next }); // A completed screen must also be durable before reload/navigation.
    });
    updates = pending.catch(() => {});
    return pending;
  },
}));
