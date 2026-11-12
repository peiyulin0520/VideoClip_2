import { saveProject } from '../storage/projects';
import { useProjectStore } from './projectStore';
import { toast } from './uiStore';

let activeFlush: (() => Promise<void>) | null = null;
export function flushAutosave(): Promise<void> {
  return activeFlush?.() ?? Promise.resolve();
}

/** Save immediately; while a write is running, coalesce to the latest immutable snapshot. */
export function startAutosave(): { flush: () => Promise<void>; stop: () => Promise<void> } {
  const projectId = useProjectStore.getState().project?.id;
  let savedRevision = useProjectStore.getState().revision;
  let reportedError = false;
  const report = (e: unknown) => {
    console.error('自動儲存失敗', e);
    if (!reportedError) toast('無法儲存目前修改，請檢查瀏覽器儲存空間');
    reportedError = true;
  };
  let saving = false;
  let inflight: Promise<void> = Promise.resolve();
  const flush = (): Promise<void> => {
    if (saving) return inflight;
    const state = useProjectStore.getState();
    if (!state.project || state.project.id !== projectId || state.revision === savedRevision) return inflight;
    saving = true;
    inflight = (async () => {
      while (true) {
        const { project, revision } = useProjectStore.getState();
        if (!project || project.id !== projectId || revision === savedRevision) return;
        await saveProject(project);
        savedRevision = revision;
        reportedError = false;
      }
    })().finally(() => {
      saving = false;
    });
    return inflight;
  };
  activeFlush = flush;
  const unsub = useProjectStore.subscribe((s, prev) => {
    if (s.revision !== prev.revision) void flush().catch(report);
  });
  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush().catch(report);
  };
  document.addEventListener('visibilitychange', onHide);
  const onPageHide = () => {
    void flush().catch(report);
  };
  window.addEventListener('pagehide', onPageHide);
  return {
    flush,
    stop: async () => {
      unsub();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      await flush().catch(report);
      if (activeFlush === flush) activeFlush = null;
    },
  };
}
