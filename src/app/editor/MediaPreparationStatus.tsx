import { useUI } from '../../store/uiStore';
export function MediaPreparationStatus() {
  const status = useUI((s) => s.mediaPreparation);
  if (!status) return null;
  return (
    <p className="hint media-preparation-status" role="status" data-testid="media-preparation">
      {status.paused ? status.message : `${status.message} · ${status.progress}%（可先編輯）`}
    </p>
  );
}
