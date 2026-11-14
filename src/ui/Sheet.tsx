import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { createPortal } from 'react-dom';

/** 從底部滑出的面板；點背景關閉。 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  titleAction,
  className = '',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  titleAction?: ReactNode;
  className?: string;
}) {
  const snapshot = useRef<ReturnType<typeof useProjectStore.getState> | null>(null);
  // Capture only at opening. Applying uses the owner's onClose; only X/backdrop discards.
  useEffect(() => {
    if (open) snapshot.current = useProjectStore.getState();
    else snapshot.current = null;
  }, [open]);
  const discard = () => {
    const before = snapshot.current,
      now = useProjectStore.getState();
    if (before?.project && before.project.id === now.project?.id && before.project !== now.project) {
      useProjectStore.setState({
        project: before.project,
        past: before.past,
        future: before.future,
        selectedId: before.selectedId,
        lastEdit: before.lastEdit,
        revision: now.revision + 1,
      });
    }
    onClose();
  };
  if (!open) return null;
  return createPortal(
    <div className="sheet-backdrop" onClick={discard}>
      <div
        className={`sheet${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-label={title}
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-heading">
          <div className="sheet-title">{title}</div>
          {titleAction}
          <button className="icon-btn sheet-close" aria-label="關閉且不儲存" onClick={discard}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmSheet({
  open,
  title,
  message,
  confirmText,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <p className="sheet-msg">{message}</p>
      <div className="sheet-row">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn danger"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmText}
        </button>
      </div>
    </Sheet>
  );
}
