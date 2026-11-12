import { beforeEach, expect, it, vi } from 'vitest';
import { useApp } from './appStore';
import { DEFAULT_APP_STATE, loadAppState, saveAppState } from '../storage/appState';
vi.mock('../storage/appState', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../storage/appState')>()),
  loadAppState: vi.fn(),
  saveAppState: vi.fn(),
}));
vi.mock('../storage/projects', () => ({ listProjects: vi.fn().mockResolvedValue([]) }));
vi.mock('../storage/db', () => ({
  getDB: vi.fn().mockResolvedValue({ count: vi.fn().mockResolvedValue(0) }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  useApp.setState({ loaded: false, state: structuredClone(DEFAULT_APP_STATE) });
  vi.mocked(saveAppState).mockResolvedValue(undefined);
});
it('重複掛載只做一次載入，晚回來的初始化不會蓋掉續用設定', async () => {
  let release!: (value: typeof DEFAULT_APP_STATE) => void;
  vi.mocked(loadAppState).mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const first = useApp.getState().init(),
    second = useApp.getState().init();
  expect(loadAppState).toHaveBeenCalledTimes(1);
  release({ ...DEFAULT_APP_STATE, onboarded: true });
  await Promise.all([first, second]);
  expect(useApp.getState().state.onboarded).toBe(true);
});
it('儲存完成後才隱藏歡迎頁，連續更新排隊合併最新已存狀態', async () => {
  useApp.setState({ loaded: true });
  let release!: () => void;
  vi.mocked(saveAppState)
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const first = useApp.getState().update({ onboarded: true }),
    second = useApp.getState().update({ fontsBannerDismissed: true });
  await vi.waitFor(() => expect(saveAppState).toHaveBeenCalledTimes(1));
  expect(useApp.getState().state.onboarded).toBe(false);
  release();
  await Promise.all([first, second]);
  expect(useApp.getState().state).toMatchObject({ onboarded: true, fontsBannerDismissed: true });
  expect(vi.mocked(saveAppState).mock.calls[1]![0]).toMatchObject({
    onboarded: true,
    fontsBannerDismissed: true,
  });
});
