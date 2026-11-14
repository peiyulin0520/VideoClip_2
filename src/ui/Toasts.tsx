import { Link } from 'react-router-dom';
import { useUI } from '../store/uiStore';

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const loading = useUI((s) => s.previewLoad);
  const busy = useUI((s) => s.busy);
  return (
    <>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
      {loading && (
        <div className="preview-loading-backdrop" role="dialog" aria-modal="true" aria-label="正在載入專案">
          <div className="preview-loading-card">
            <h2>{loading.error ? '預覽尚未準備完成' : '正在載入專案'}</h2>
            <progress aria-label="專案載入進度" max={100} value={loading.progress} />
            <p>
              {loading.progress}% · {loading.message}
            </p>
            {loading.error && (
              <>
                <p className="hint">{loading.error}</p>
                <button className="btn primary" onClick={loading.retry}>
                  重試載入
                </button>
                {loading.canSkip && (
                  <button className="btn" onClick={() => useUI.setState({ previewLoad: null })}>
                    略過無法載入的素材
                  </button>
                )}
              </>
            )}
            <Link className="btn" to="/">
              返回專案列表
            </Link>
          </div>
        </div>
      )}
      {busy && (
        <div className="busy" role="status">
          <div className="spinner" />
          <div>{busy}</div>
        </div>
      )}
    </>
  );
}
