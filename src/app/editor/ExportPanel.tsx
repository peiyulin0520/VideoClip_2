import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { useProjectStore } from '../../store/projectStore';
import { useUI, toast } from '../../store/uiStore';
import { exportSize, exportVideo, type VideoResult } from '../../engine/exportVideo';
import { exportRealtime, unlockExportAudio } from '../../engine/exportRealtime';

export function ExportPanel({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const [size, setSize] = useState(1920),
    [fps, setFps] = useState(30),
    [audio, setAudio] = useState(true),
    [method, setMethod] = useState('offline');
  const [running, setRunning] = useState(false),
    [progress, setProgress] = useState(0),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [result, setResult] = useState<(VideoResult & { url: string; name: string }) | null>(null);
  const controller = useRef<AbortController | null>(null),
    lastUrl = useRef(''),
    preview = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    },
    [],
  );
  const start = async () => {
    const audioContext = method === 'realtime' ? unlockExportAudio() : undefined;
    const cancel = new AbortController();
    controller.current = cancel;
    useUI.getState().player?.pause();
    setRunning(true);
    setError('');
    setResult(null);
    setProgress(0);
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    const snapshot = structuredClone(useProjectStore.getState().project!);
    const options = {
      maxSize: size,
      fps,
      audio,
      signal: cancel.signal,
      progress: (p: number, text: string) => {
        setProgress(p);
        setMessage(text);
      },
    };
    try {
      const value =
        method === 'realtime'
          ? await exportRealtime(snapshot, options, audioContext, preview.current!)
          : await exportVideo(snapshot, options);
      const url = URL.createObjectURL(value.blob);
      lastUrl.current = url;
      setResult({ ...value, url, name: `${snapshot.name.replace(/[\\/:*?"<>|]/g, '_')}.${value.extension}` });
    } catch (e) {
      if (cancel.signal.aborted) setMessage('已取消匯出');
      else {
        setError((e as Error).message);
        setMessage('匯出未完成');
      }
    } finally {
      setRunning(false);
      if (audioContext && audioContext.state !== 'closed') void audioContext.close().catch(() => {});
    }
  };
  return (
    <Sheet
      open
      title="匯出完整影片"
      onClose={() => {
        controller.current?.abort();
        onClose();
      }}
    >
      {!running && (
        <>
          <label className="field">
            解析度
            <select aria-label="匯出解析度" value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {[360, 720, 1080, 1920].map((limit) => {
                const actual = exportSize(project, limit);
                return (
                  <option key={limit} value={limit}>
                    {limit === 1920
                      ? '高畫質'
                      : limit === 1080
                        ? '輕量'
                        : limit === 720
                          ? '快速分享'
                          : '小檔案'}
                    ・{actual.width} × {actual.height}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="field">
            每秒影格
            <select aria-label="匯出影格率" value={fps} onChange={(e) => setFps(Number(e.target.value))}>
              <option value={24}>24 fps</option>
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </label>
          <label className="field">
            匯出方式
            <select aria-label="匯出方式" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="offline">標準逐格合成</option>
              <option value="realtime">相容即時匯出</option>
            </select>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              aria-label="包含原音與背景音樂"
              checked={audio}
              onChange={(e) => setAudio(e.target.checked)}
            />
            包含原音與背景音樂
          </label>
          <p className="hint">
            可用時輸出 MP4；其他編碼環境輸出
            WebM，完成後會標明格式。相容模式約需影片本身的長度，請保持頁面開啟。
          </p>
        </>
      )}
      {(running || message) && (
        <>
          <progress aria-label="影片匯出進度" value={progress} max={1} />
          <p role="status">{message}</p>
        </>
      )}
      {error && (
        <p className="warn" role="alert">
          {error}
        </p>
      )}
      <div ref={preview} className="export-preview" />
      {result && (
        <div className="export-result">
          <p>
            {result.extension.toUpperCase()} · {result.width} × {result.height} ·{' '}
            {(result.blob.size / 1024 / 1024).toFixed(1)} MB
          </p>
          <video src={result.url} controls playsInline aria-label="匯出影片預覽" />
          <div className="chips">
            <a className="btn primary" href={result.url} download={result.name}>
              下載影片
            </a>
            {!!navigator.share && (
              <button
                className="btn"
                onClick={() => {
                  const file = new File([result.blob], result.name, { type: result.blob.type });
                  void navigator.share({ files: [file], title: project.name }).catch((e: Error) => {
                    if (e.name !== 'AbortError') toast('分享未完成，仍可點下載影片');
                  });
                }}
              >
                分享影片
              </button>
            )}
          </div>
        </div>
      )}
      <div className="sheet-row">
        <button
          className="btn"
          onClick={() => {
            if (running) controller.current?.abort();
            else onClose();
          }}
        >
          {running ? '取消匯出' : '關閉'}
        </button>
        {!running && (
          <button className="btn primary" onClick={() => void start()}>
            開始匯出
          </button>
        )}
      </div>
    </Sheet>
  );
}
