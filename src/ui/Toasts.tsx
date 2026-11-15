import { useState } from 'react';
import { isModuleLoadError, reloadAppCode } from '../app/appRecovery';
import { useProjectStore } from '../store/projectStore';
import { saveProject } from '../storage/projects';
import { Link, useLocation } from 'react-router-dom';
import { useUI } from '../store/uiStore';

export function Toasts() {
  const location = useLocation();
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const updateReady = useUI((s) => s.appUpdateReady);
  const toasts = useUI((s) => s.toasts);
  const loading = useUI((s) => s.previewLoad);
  const busy = useUI((s) => s.busy);
  const moduleError = isModuleLoadError(loading?.error);
  const recover = async () => {
    setRecovering(true);
    setRecoveryError('');
    try {
      useUI.getState().player?.pause();
      const project = useProjectStore.getState().project;
      if (project && location.pathname === `/p/${project.id}`) await saveProject(project);
      await reloadAppCode();
    } catch (error) {
      setRecoveryError(String(error));
      setRecovering(false);
    }
  };
  return (
    <>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
      {updateReady && location.pathname === '/' && !loading && (
        <div className="app-update-notice" role="status">
          <span>新版程式已準備好</span>
          <button className="chip primary" disabled={recovering} onClick={() => void recover()}>
            {recovering ? '正在更新程式…' : '更新程式'}
          </button>
          {recoveryError && <p className="hint">{recoveryError}</p>}
        </div>
      )}
      {loading && (
        <div className="preview-loading-backdrop" role="dialog" aria-modal="true" aria-label="正在載入專案">
          <div className="preview-loading-card">
            <h2>{moduleError ? '程式需要重新載入' : loading.error ? '預覽尚未準備完成' : '正在載入專案'}</h2>
            <progress aria-label="專案載入進度" max={100} value={loading.progress} />
            <p>
              {loading.progress}% · {moduleError ? '程式元件載入失敗' : loading.message}
            </p>
            {loading.error && (
              <>
                <p className="hint">
                  {moduleError ? '更新網頁程式後，會重新開啟這個專案。專案與素材會保留。' : loading.error}
                </p>
                {recoveryError && (
                  <p className="hint" role="alert">
                    {recoveryError}
                  </p>
                )}
                <button
                  className="btn primary"
                  disabled={recovering}
                  onClick={moduleError ? () => void recover() : loading.retry}
                >
                  {moduleError ? (recovering ? '正在更新程式…' : '更新程式並重新開啟') : '重試載入'}
                </button>
                {!moduleError && loading.canSkip && (
                  <button className="btn" onClick={() => useUI.setState({ previewLoad: null })}>
                    略過無法載入的素材
                  </button>
                )}
              </>
            )}
            <Link className="btn" to="/" onClick={() => useUI.setState({ previewLoad: null })}>
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
