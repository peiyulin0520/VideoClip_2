import { aspectLabel } from '../../engine/itemName';
import { usePreferences } from '../../store/preferences';
import { KeyframeControl } from '../editor/KeyframeControl';
import { ensureFont } from '../../fonts/fontStore';
import { ArrowUp, PanelBottom, ChevronLeft, Pause, Play, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ensureUrls, releaseProjectUrls } from '../../engine/assetUrls';
import { importFiles } from '../../engine/importMedia';
import { addOverlayClips } from '../../store/actions';
import { relayout, totalDuration, formatTime } from '../../engine/timeline';
import { getProject } from '../../storage/projects';
import { editableProject } from '../../engine/layerEditing';
import { startAutosave } from '../../store/autosave';
import { useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';
import { ASPECTS, assignAspect, pickAspect } from '../../model/defaults';
import type { Aspect } from '../../model/types';
import { setProjectAspect } from '../../store/actions';
import { Sheet } from '../../ui/Sheet';
import { Preview } from '../editor/Preview';
import { Timeline, MAX_PPS, MIN_PPS } from '../editor/Timeline';
import { BottomBar } from '../editor/Toolbar';
import { ExportPanel } from '../editor/ExportPanel';

export function Editor() {
  const { projectId = '' } = useParams();
  // key：換專案時整個重新載入
  return <EditorLoader key={projectId} projectId={projectId} />;
}

function EditorLoader({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<'loading' | 'missing' | 'ready'>('loading');

  useEffect(() => {
    let cancelled = false;
    useUI.setState({ previewLoad: { progress: 0, message: '讀取專案資料' } });
    let autosave: ReturnType<typeof startAutosave> | null = null;
    (async () => {
      const p = await getProject(projectId);
      if (cancelled) return;
      if (!p) {
        useUI.setState({ previewLoad: null });
        return setStatus('missing');
      }
      useUI.setState({ previewLoad: { progress: 10, message: '讀取裝置中的素材' } });
      const missing = await ensureUrls(p.id, p.assets, (done, total) => {
        if (!cancelled)
          useUI.setState({
            previewLoad: {
              progress: 10 + Math.round((60 * done) / Math.max(1, total)),
              message: '讀取裝置中的素材',
            },
          });
      });
      if (cancelled) return;
      for (const id of new Set(p.tracks.flatMap((tr) => tr.layout?.story?.fontIds ?? [])))
        if (id !== 'system') await ensureFont(id);
      useUI.setState({ previewLoad: { progress: 80, message: '準備預覽畫面' } });
      useUI.setState({ effectsJoin: null, effectsSingle: null });
      useProjectStore.getState().load(editableProject(p));
      autosave = startAutosave();
      setStatus('ready');
      if (missing.length) toast(`找不到素材檔：${missing.join('、')}`);
    })().catch((error) => {
      if (!cancelled)
        useUI.setState({
          previewLoad: {
            progress: 0,
            message: '讀取專案失敗',
            error: String(error),
            retry: () => location.reload(),
          },
        });
    });
    return () => {
      cancelled = true;
      useUI.setState({ previewLoad: null });
      void autosave?.stop(); // 先同步抓目前內容存檔，再關閉
      useProjectStore.getState().close();
      releaseProjectUrls(projectId);
    };
  }, [projectId]);

  if (status === 'loading')
    return (
      <main className="page">
        <p className="empty-note">載入中…</p>
      </main>
    );
  if (status === 'missing')
    return (
      <main className="page">
        <header className="topbar">
          <Link className="icon-btn" to="/" aria-label="回首頁">
            <ChevronLeft />
          </Link>
          <h1>找不到這個專案</h1>
        </header>
        <p className="empty-note">專案只存在建立它的那台裝置上；換裝置或清除瀏覽器資料後就不會有了。</p>
      </main>
    );
  return <EditorBody />;
}

function EditorBody() {
  const project = useProjectStore((s) => s.project)!;
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const player = useUI((s) => s.player);
  const previewLoad = useUI((s) => s.previewLoad);
  const [buffering, setBuffering] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pps, setPps] = useState(60);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const previewQuality = usePreferences((s) => s.preview);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [ratioOpen, setRatioOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showTop, setShowTop] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(() => {
    try {
      return sessionStorage.getItem(`lm2-timeline:${project.id}`) === '1';
    } catch {
      return false;
    }
  });
  const editorRef = useRef<HTMLElement>(null);
  const total = totalDuration(project);
  useEffect(() => {
    const el = editorRef.current;
    if (el) el.inert = !!previewLoad;
  }, [previewLoad]);
  useEffect(() => {
    const updateViewport = () => {
      const viewport = window.visualViewport;
      const el = editorRef.current;
      if (!el) return;
      el.style.setProperty('--app-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      el.style.setProperty(
        '--visible-bottom-inset',
        `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`,
      );
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!player) return;
    return player.subscribe((t, p) => {
      setTime(t);
      setPlaying(p);
      setBuffering(player.isBuffering);
    });
  }, [player]);

  const importTrack = useRef<string | undefined>(undefined);
  const importMode = useRef<'main' | 'overlay'>('main');
  const pick = (mode: 'main' | 'overlay', trackId?: string) => {
    importTrack.current = trackId;
    importMode.current = mode;
    fileInput.current?.click();
  };

  const onFiles = useCallback(async (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (fileInput.current) fileInput.current.value = '';
    if (files.length === 0) return;
    const { setBusy } = useUI.getState();
    const pid = useProjectStore.getState().project!.id;
    setBusy(`匯入中… 0/${files.length}`);
    try {
      const res = await importFiles(pid, files, (d, n) => setBusy(`匯入中… ${d}/${n}`));
      if (res.assets.length) {
        await ensureUrls(pid, res.assets);
        const player = useUI.getState().player;
        if (importMode.current === 'overlay') {
          // 疊加：放在播放頭這一秒，同一秒疊多個就各佔一條軌道
          useProjectStore.getState().apply((d) => void d.assets.push(...res.assets));
          addOverlayClips(res.assets, player?.time ?? 0);
        } else {
          const current = useProjectStore.getState().project!;
          const destination =
            current.tracks.find((t) => t.id === importTrack.current) ??
            current.tracks.find((t) => t.kind === 'main')!;
          const startOfNew = Math.max(0, ...destination.items.map((it) => it.start + it.duration));
          // 匯入後先不選取；使用者可直接在預覽或時間軸點選。
          useProjectStore.getState().apply((d) => {
            d.assets.push(...res.assets);
            const tr = d.tracks.find((t) => t.id === destination.id)!;
            // 比例設成「自動」、而且主軌還是空的：第一次匯入時照第一個素材的形狀決定專案比例
            const first = res.assets[0];
            if (
              d.aspectAuto &&
              !d.tracks.some((t) => t.items.some((it) => it.type === 'video' || it.type === 'image')) &&
              first
            )
              assignAspect(d, pickAspect(first.width, first.height), true);
            tr.items = d.freeMain
              ? [
                  ...tr.items,
                  ...res.clips.map((it, i) => ({
                    ...it,
                    start: startOfNew + res.clips.slice(0, i).reduce((n, x) => n + x.duration, 0),
                  })),
                ]
              : relayout([...(tr.items as typeof res.clips), ...res.clips], d.mainOffset ?? 0);
          });
          player?.seek(startOfNew);
        }
      }
      if (res.failed.length)
        toast(`無法匯入：${res.failed.map((f) => `${f.name}（${f.reason}）`).join('、')}`);
      else if (res.assets.length) toast(`已匯入 ${res.assets.length} 個素材`);
    } finally {
      setBusy(null);
    }
  }, []);

  const empty = project.tracks.every((t) => t.items.length === 0);

  return (
    <main
      className="editor"
      ref={editorRef}
      onScroll={() => {
        const editor = editorRef.current!,
          preview = editor.querySelector('.stage-wrap'),
          header = editor.querySelector('.ed-top');
        if (preview && header)
          setShowTop(preview.getBoundingClientRect().top < header.getBoundingClientRect().bottom - 2);
      }}
    >
      {showTop && (
        <button
          className="back-to-preview"
          aria-label="回到最上方預覽"
          onClick={() => editorRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ArrowUp size={24} />
        </button>
      )}
      <Sheet open={qualityOpen} title="預覽畫質" onClose={() => setQualityOpen(false)}>
        <p className="hint">只影響預覽；影片比例與匯出畫質不變。低畫質較省運算，適合多圖層播放。</p>
        <div className="chips">
          {[
            [540, '低畫質・順暢'],
            [720, '標準'],
            [1080, '平衡'],
            [1920, '精細'],
          ].map(([value, label]) => (
            <button
              className={`chip${previewQuality === value ? ' active' : ''}`}
              key={value}
              aria-pressed={previewQuality === value}
              onClick={() => {
                usePreferences.getState().set({ preview: Number(value) });
                setQualityOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Sheet>
      <header className="ed-top">
        <Link className="icon-btn" to="/" aria-label="回首頁">
          <ChevronLeft />
        </Link>
        <button
          className="name-btn"
          aria-label="專案名稱"
          onClick={() => {
            setNameDraft(project.name);
            setRenaming(true);
          }}
        >
          {project.name}
        </button>
        <button className="ratio-btn" aria-label="畫面比例" onClick={() => setRatioOpen(true)}>
          {aspectLabel(project)}
        </button>
        <button className="quality-button" aria-label="預覽畫質" onClick={() => setQualityOpen(true)}>
          {previewQuality <= 540
            ? '順暢'
            : previewQuality <= 720
              ? '標準'
              : previewQuality <= 1080
                ? '平衡'
                : '精細'}
        </button>
        <button
          className="icon-btn"
          aria-label="復原"
          aria-disabled={!canUndo}
          onClick={() => {
            if (!useProjectStore.getState().undo()) toast('沒有可復原的動作');
          }}
        >
          <Undo2 size={22} />
        </button>
        <button
          className="icon-btn"
          aria-label="重做"
          aria-disabled={!canRedo}
          onClick={() => {
            if (!useProjectStore.getState().redo()) toast('沒有可重做的動作');
          }}
        >
          <Redo2 size={22} />
        </button>
        <button className="export-button" aria-label="匯出影片" onClick={() => setExportOpen(true)}>
          匯出
        </button>
      </header>
      {exportOpen && <ExportPanel onClose={() => setExportOpen(false)} />}

      <Preview projectId={project.id} width={project.width} height={project.height} />
      {empty && (
        <button className="empty-import" onClick={() => pick('main')}>
          ＋ 匯入影片或照片
        </button>
      )}

      {buffering && (
        <p className="hint playback-buffering" role="status">
          正在準備播放畫面…
        </p>
      )}
      <div className="playbar">
        <button
          className="icon-btn"
          aria-label={playing ? '暫停' : '播放'}
          aria-pressed={playing}
          data-playing={playing}
          onClick={() => {
            if (total <= 0) return toast('先匯入影片或照片');
            player?.toggle();
          }}
        >
          {playing ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <span className="time" data-testid="time">
          <span>{formatTime(time)}</span> <span>/ {formatTime(total)}</span>
        </span>
        <span className="spacer" />
        <KeyframeControl />
        <button
          className="icon-btn"
          aria-label="回到預覽"
          title="回到預覽"
          onClick={(e) => e.currentTarget.closest('.editor')!.scrollTo({ top: 0 })}
        >
          <ArrowUp size={20} />
          <span>預覽</span>
        </button>
        <button
          className="icon-btn"
          aria-label="編輯工具"
          title="編輯工具"
          onClick={(e) =>
            e.currentTarget
              .closest('.editor')!
              .querySelector('.bottombar')!
              .scrollIntoView({ block: 'start' })
          }
        >
          <PanelBottom size={20} />
          <span>工具</span>
        </button>
        <button
          className="icon-btn"
          aria-label="縮小時間軸"
          onClick={() => setPps(Math.max(pps / 1.5, MIN_PPS))}
        >
          <ZoomOut size={22} />
          <span>縮小</span>
        </button>
        <button
          className="icon-btn"
          aria-label="放大時間軸"
          onClick={() => setPps(Math.min(pps * 1.5, MAX_PPS))}
        >
          <ZoomIn size={22} />
          <span>放大</span>
        </button>
      </div>

      <button
        className="timeline-toggle"
        aria-expanded={timelineOpen}
        aria-controls="editor-timeline"
        onClick={() =>
          setTimelineOpen((open) => {
            const next = !open;
            try {
              sessionStorage.setItem(`lm2-timeline:${project.id}`, next ? '1' : '0');
            } catch {
              /* UI preference only */
            }
            return next;
          })
        }
      >
        {timelineOpen ? '收合時間軸' : '展開時間軸'} · {project.tracks.length} 個圖層
      </button>
      <div id="editor-timeline" hidden={!timelineOpen}>
        <Timeline
          key={timelineOpen ? 'expanded' : 'collapsed'}
          pps={pps}
          setPps={setPps}
          onAdd={(trackId) => pick('main', trackId)}
        />
      </div>
      <BottomBar onImportMain={() => pick('main')} onImportOverlay={() => pick('overlay')} />

      <input
        ref={fileInput}
        type="file"
        accept="video/*,image/*"
        multiple
        hidden
        data-testid="file-input"
        onChange={(e) => void onFiles(e.target.files)}
      />

      <Sheet open={ratioOpen} title="畫面比例" onClose={() => setRatioOpen(false)}>
        <p className="hint">只調整框內影片輸出範圍，預覽基地大小固定；版型維持自身比例。</p>
        <button
          className="btn primary"
          onClick={() => {
            setRatioOpen(false);
            useUI.getState().player?.pause();
            useUI.setState({ aspectEditing: true });
          }}
        >
          在預覽自訂比例
        </button>
        <div className="chips" role="radiogroup" aria-label="選擇畫面比例">
          <button
            role="radio"
            aria-checked={!!project.aspectAuto}
            className={`chip${project.aspectAuto ? ' active' : ''}`}
            onClick={() => {
              const a = setProjectAspect('auto');
              if (a) toast(`已設成自動（目前是 ${a}）`);
              setRatioOpen(false);
            }}
          >
            自動（跟第一支影片）
          </button>
          {(Object.keys(ASPECTS) as Aspect[]).map((a) => (
            <button
              key={a}
              role="radio"
              aria-checked={!project.aspectAuto && !project.customAspect && project.aspect === a}
              className={`chip${!project.aspectAuto && !project.customAspect && project.aspect === a ? ' active' : ''}`}
              onClick={() => {
                setProjectAspect(a);
                setRatioOpen(false);
              }}
            >
              {ASPECTS[a].label}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={renaming} title="專案名稱" onClose={() => setRenaming(false)}>
        <input
          className="text-input"
          aria-label="專案名稱輸入"
          value={nameDraft}
          maxLength={40}
          onChange={(e) => setNameDraft(e.target.value)}
          autoFocus
        />
        <div className="sheet-row">
          <button
            className="btn primary"
            onClick={() => {
              const n = nameDraft.trim();
              if (n)
                useProjectStore.getState().apply((d) => {
                  d.name = n;
                });
              setRenaming(false);
            }}
          >
            確定
          </button>
        </div>
      </Sheet>
    </main>
  );
}
