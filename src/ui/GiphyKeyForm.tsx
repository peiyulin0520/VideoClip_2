import { useEffect, useState } from 'react';
import { readGiphyKey, writeGiphyKey } from '../storage/library';
import { toast } from '../store/uiStore';

export function GiphyKeyForm({
  onSaved,
  settings = false,
}: {
  onSaved?: (key: string) => void;
  settings?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void readGiphyKey().then((key) => setSaved(!!key));
  }, []);
  return (
    <div className="giphy-key-settings">
      {settings && saved && <p className="hint">已在這台裝置設定。輸入新 Key 可變更。</p>}
      <label className="field">
        GIPHY API Key
        <input
          type="password"
          aria-label="GIPHY API Key"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <div className="chips">
        <button
          className="btn"
          disabled={!draft.trim()}
          onClick={async () => {
            const key = draft.trim();
            await writeGiphyKey(key);
            setSaved(true);
            setDraft('');
            onSaved?.(key);
            toast('已儲存在這台裝置');
          }}
        >
          儲存 Key
        </button>
        {settings && saved && (
          <button
            className="btn"
            onClick={async () => {
              await writeGiphyKey('');
              setSaved(false);
              setDraft('');
              toast('已移除這台裝置的 Key');
            }}
          >
            移除 Key
          </button>
        )}
      </div>
      <details>
        <summary>如何申請免費 API Key？</summary>
        <p className="hint">
          前往{' '}
          <a href="https://developers.giphy.com/" target="_blank" rel="noreferrer">
            GIPHY Developers
          </a>{' '}
          → Dashboard → Create an API Key → API；應用名稱 LittleMoments、平台 Web。Key
          只存在這台裝置，可在首頁「設定」變更。
        </p>
      </details>
    </div>
  );
}
