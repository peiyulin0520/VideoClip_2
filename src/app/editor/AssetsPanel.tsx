import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUI, toast } from '../../store/uiStore';
import { addMaterialFiles } from '../../engine/materials';
import { listLibrary, saveLibrary, removeLibrary, readGiphyKey, writeGiphyKey } from '../../storage/library';
import type { LibraryRecord } from '../../storage/db';
import { getMedia } from '../../storage/media';
import { findItem } from '../../engine/timeline';
import { editItem } from '../../store/actions';
import { searchGiphy, type GiphySticker } from '../../engine/giphy';
import { DrawingEditor } from './DrawingEditor';
import { BlankPanel } from './BlankPanel';

function SavedPreview({ record }: { record: LibraryRecord }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(record.file);
    let alive = true;
    queueMicrotask(() => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
      URL.revokeObjectURL(u);
    };
  }, [record]);
  return <img src={url || undefined} alt={record.name} />;
}
export function AssetsPanel() {
  const project = useProjectStore((s) => s.project)!;
  const selectedId = useProjectStore((s) => s.selectedId);
  const [section, setSection] = useState<'own' | 'giphy' | 'blank'>('own');
  const [records, setRecords] = useState<LibraryRecord[]>([]),
    [remember, setRemember] = useState(false),
    [drawing, setDrawing] = useState(false),
    [backdrop, setBackdrop] = useState('');
  const [key, setKey] = useState(''),
    [query, setQuery] = useState(''),
    [results, setResults] = useState<GiphySticker[]>([]),
    [searching, setSearching] = useState(false),
    [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null),
    abort = useRef<AbortController | null>(null),
    lastQuery = useRef('');
  const selected = findItem(project, selectedId)?.item;
  const selectedAsset =
    selected?.type !== 'text' ? project.assets.find((a) => a.id === selected?.assetId) : undefined;
  const refresh = () => listLibrary().then(setRecords);
  useEffect(() => {
    void refresh();
    void readGiphyKey().then(setKey);
    return () => abort.current?.abort();
  }, []);
  const upload = async (files: File[], origin: 'upload' | 'drawing' = 'upload') => {
    useUI.getState().setBusy('正在加入素材…');
    try {
      const result = await addMaterialFiles(files, useUI.getState().player?.time ?? 0, origin);
      if (origin === 'drawing' && result.id)
        editItem(result.id, (it) => {
          it.transform.scale = 1;
        });
      if (remember) {
        for (const file of files) await saveLibrary(file, file.name, origin);
        await refresh();
      }
      setDrawing(false);
      toast(remember ? '已加入專案並收藏在這台裝置' : '已加入這個專案');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      useUI.getState().setBusy(null);
    }
  };
  const search = async (more = false) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setSearching(true);
    setError('');
    try {
      const q = more ? lastQuery.current : query;
      const entries = await searchGiphy(key, q, controller.signal, more ? results.length : 0);
      if (controller.signal.aborted) return;
      lastQuery.current = q;
      setResults((previous) => (more ? [...previous, ...entries] : entries));
      if (!entries.length) setError('沒有更多貼圖，換個關鍵字試試');
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof TypeError ? '連線失敗，請稍後再試' : (e as Error).message);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  };
  const addGiphy = async (entry: GiphySticker) => {
    useUI.getState().setBusy('正在加入動態貼圖…');
    try {
      const response = await fetch(entry.gif, {
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw Error('貼圖無法下載，請換一張或稍後再試');
      const blob = await response.blob();
      if (blob.size > 15_000_000) throw Error('這張貼圖太大，請選擇較小的貼圖');
      const result = await addMaterialFiles(
        [new File([blob], `${entry.id}.gif`, { type: 'image/gif' })],
        useUI.getState().player?.time ?? 0,
        'giphy',
      );
      useProjectStore.getState().apply((d) => {
        const asset = d.assets.find((a) => a.id === result.assets[0]?.id);
        if (asset) asset.attribution = { title: entry.title, url: entry.url };
      });
      toast('已加入專案；不會收藏到共用素材庫');
    } catch (e) {
      toast(e instanceof TypeError ? '貼圖連線失敗，請稍後再試' : (e as Error).message);
    } finally {
      useUI.getState().setBusy(null);
    }
  };
  return (
    <div className="panel scroll" aria-label="素材與貼圖">
      <div className="chips">
        {[
          ['own', '我的素材'],
          ['giphy', 'GIPHY 貼圖'],
          ['blank', '留白色塊'],
        ].map(([id, name]) => (
          <button
            key={id}
            className={`chip${section === id ? ' active' : ''}`}
            onClick={() => setSection(id as typeof section)}
          >
            {name}
          </button>
        ))}
      </div>
      {section === 'blank' && <BlankPanel />}
      {section === 'own' && (
        <>
          <label className="check-row">
            <input
              type="checkbox"
              aria-label="同時存到我的素材庫"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            同時存到我的素材庫（跨專案使用）
          </label>
          <div className="chips">
            <button className="btn" onClick={() => input.current?.click()}>
              ＋ 匯入自己的貼圖
            </button>
            <button
              className="btn"
              onClick={() => {
                try {
                  setBackdrop(useUI.getState().player?.compositor.toCanvas().toDataURL() ?? '');
                } catch {
                  setBackdrop('');
                }
                setDrawing(true);
              }}
            >
              ＋ 畫畫
            </button>
          </div>
          <input
            hidden
            ref={input}
            type="file"
            multiple
            accept="image/*"
            data-testid="sticker-files"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              void upload(files);
            }}
          />
          {selected &&
            selected.type !== 'text' &&
            selected.type !== 'audio' &&
            selectedAsset &&
            selectedAsset.origin !== 'giphy' && (
              <button
                className="btn"
                onClick={() => {
                  void (async () => {
                    try {
                      const file = await getMedia(project.id, selectedAsset.id, selectedAsset.mime);
                      await saveLibrary(
                        file,
                        selectedAsset.name,
                        selectedAsset.origin === 'drawing' ? 'drawing' : 'upload',
                        {
                          crop: selected.crop,
                          mask: selected.mask,
                          fit: selected.fit,
                          transform: selected.transform,
                        },
                      );
                      await refresh();
                      toast('已收藏選取素材與裁切設定');
                    } catch {
                      toast('收藏失敗，請重試');
                    }
                  })();
                }}
              >
                收藏選取素材
              </button>
            )}
          <p className="hint">
            字體、收藏貼圖和畫作會留在同一個瀏覽器；下次開啟或換剪輯專案可直接使用。刪除收藏不會移除已放進專案的素材。
          </p>
          <div className="saved-grid">
            {records.map((record) => (
              <div key={record.id}>
                <button
                  className="saved-material"
                  aria-label={`使用素材 ${record.name}`}
                  onClick={() => {
                    void (async () => {
                      try {
                        const result = await addMaterialFiles(
                          [new File([record.file], record.name, { type: record.mime })],
                          useUI.getState().player?.time ?? 0,
                          record.origin,
                        );
                        if (record.settings && result.id)
                          editItem(result.id, (it) => {
                            if (it.type !== 'text') Object.assign(it, record.settings);
                          });
                      } catch (e) {
                        toast((e as Error).message);
                      }
                    })();
                  }}
                >
                  <SavedPreview record={record} />
                  <span>{record.name}</span>
                </button>
                <button
                  className="chip"
                  aria-label={`刪除收藏 ${record.name}`}
                  onClick={() => {
                    void removeLibrary(record.id).then(refresh);
                  }}
                >
                  移除收藏
                </button>
              </div>
            ))}
          </div>
          {!records.length && (
            <p className="hint">還沒有收藏。匯入或畫圖前勾選「同時存到我的素材庫」，或收藏選取素材。</p>
          )}
        </>
      )}
      {section === 'giphy' && (
        <>
          <p className="hint">
            <a href="https://giphy.com/" target="_blank" rel="noreferrer">
              Powered by GIPHY
            </a>{' '}
            · 搜尋結果每次重新取得；加入的貼圖只隨專案保存。
          </p>
          <label className="field">
            你這台裝置的 GIPHY API Key
            <input
              type="password"
              autoComplete="off"
              aria-label="GIPHY API Key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <div className="chips">
            <button
              className="btn"
              onClick={() => {
                void writeGiphyKey(key).then(() => toast('Key 已儲存在這台裝置'));
              }}
            >
              儲存 Key
            </button>
            <button
              className="btn"
              onClick={() => {
                setKey('');
                void writeGiphyKey('');
              }}
            >
              移除 Key
            </button>
          </div>
          <details>
            <summary>如何申請免費 API Key？</summary>
            <p className="hint">
              前往{' '}
              <a href="https://developers.giphy.com/" target="_blank" rel="noreferrer">
                GIPHY Developers
              </a>{' '}
              建立帳號 → Dashboard → Create an API Key → 選 API。應用名稱填 LittleMoments，平台選
              Web；說明可填「LittleMoments 網頁影片剪輯與貼圖搜尋」。建立後複製 API Key，貼在本頁儲存。Key
              僅存在這個瀏覽器，不會寫進公開 GitHub 或與別的裝置同步。
            </p>
          </details>
          <form
            className="giphy-search"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <input
              aria-label="搜尋 GIPHY 貼圖"
              placeholder="搜尋可愛、日常、愛心…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn primary" type="submit" disabled={searching}>
              {searching ? '搜尋中…' : '搜尋貼圖'}
            </button>
          </form>
          {error && (
            <p role="status" className="hint">
              {error}
            </p>
          )}
          <div className="giphy-grid">
            {results.map((entry) => (
              <div key={entry.id}>
                <button aria-label={`加入貼圖 ${entry.title}`} onClick={() => void addGiphy(entry)}>
                  <img src={entry.preview} alt={entry.title} loading="lazy" referrerPolicy="no-referrer" />
                </button>
                <a href={entry.url} target="_blank" rel="noreferrer">
                  GIPHY 原圖
                </a>
              </div>
            ))}
          </div>
          {!!results.length && (
            <button className="btn" disabled={searching} onClick={() => void search(true)}>
              更多貼圖
            </button>
          )}
        </>
      )}
      {drawing && (
        <DrawingEditor
          background={backdrop}
          onClose={() => setDrawing(false)}
          onSave={(file) => upload([file], 'drawing')}
        />
      )}
    </div>
  );
}
