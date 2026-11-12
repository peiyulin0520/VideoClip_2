import { expect, it, vi } from 'vitest';
import { createProject } from '../model/defaults';
import { useProjectStore } from './projectStore';
import { startAutosave } from './autosave';
import { saveProject } from '../storage/projects';
vi.mock('../storage/projects', () => ({ saveProject: vi.fn() }));
it('第一筆修改立即儲存，寫入期間的連續修改合併至最後版本，flush 等到全部完成', async () => {
  let release!: () => void;
  vi.mocked(saveProject)
    .mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    )
    .mockResolvedValue(undefined);
  useProjectStore.getState().load(createProject('舊資料'));
  const auto = startAutosave();
  useProjectStore.getState().apply((p) => {
    p.name = '1';
  });
  expect(saveProject).toHaveBeenCalledTimes(1);
  useProjectStore.getState().apply((p) => {
    p.name = '2';
  });
  useProjectStore.getState().apply((p) => {
    p.name = '3';
  });
  const settled = auto.flush();
  release();
  await settled;
  expect(saveProject).toHaveBeenCalledTimes(2);
  expect(vi.mocked(saveProject).mock.calls[1]![0].name).toBe('3');
  await auto.stop();
  vi.clearAllMocks();
});

it('離開時的儲存迴圈不會讀取接下來新開的專案', async () => {
  let release!: () => void;
  vi.mocked(saveProject)
    .mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    )
    .mockResolvedValue(undefined);
  const old = createProject('舊專案');
  useProjectStore.getState().load(old);
  const auto = startAutosave();
  useProjectStore.getState().apply((p) => {
    p.name = '舊專案最後一筆';
  });
  const stopping = auto.stop();
  useProjectStore.getState().load(createProject('另一個專案'));
  release();
  await stopping;
  expect(saveProject).toHaveBeenCalledTimes(1);
  expect(vi.mocked(saveProject).mock.calls[0]![0].id).toBe(old.id);
  vi.clearAllMocks();
});
