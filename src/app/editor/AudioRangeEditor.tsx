import { Undo2 } from 'lucide-react';
import { useDraftHistory } from '../../ui/useDraftHistory';
import { SelectionAddButton } from '../../ui/SelectionAddButton';
import { useEffect, useRef, useState } from 'react';
import type { Asset, VideoItem } from '../../model/types';
import { Sheet } from '../../ui/Sheet';
import { SourceRanges } from '../../ui/SourceRanges';
import { urlFor } from '../../engine/assetUrls';
import { excludeAudio, includeAudio, inverseRanges } from '../../engine/audioRanges';
import { editItem } from '../../store/actions';
import { useProjectStore } from '../../store/projectStore';
import { toast, useUI } from '../../store/uiStore';

export function AudioRangeEditor({
  item,
  asset,
  onClose,
}: {
  item: VideoItem;
  asset: Asset;
  onClose: () => void;
}) {
  const project = useProjectStore((s) => s.project)!;
  const history = useDraftHistory<[number, number][]>(
    item.audioRanges ?? [[item.trimIn, Math.min(asset.duration, item.trimIn + item.duration * item.speed)]],
  );
  const ranges = history.value,
    setRanges = history.set;
  const [cursor, setCursor] = useState(item.trimIn),
    [playing, setPlaying] = useState(false);
  const [markStart, setMarkStart] = useState<number | null>(null),
    [markerMode, setMarkerMode] = useState<'keep' | 'mute'>('keep');
  const muted = inverseRanges(ranges, asset.duration);
  const sceneCanvas = useRef<HTMLCanvasElement>(null);
  const media = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      if (media.current) {
        const t = media.current.currentTime;
        media.current.muted = !ranges.some(([a, b]) => t >= a && t < b);
        setCursor(t);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, ranges]);
  useEffect(() => {
    if (asset.kind !== 'audio') return;
    const player = useUI.getState().player,
      before = player?.time ?? 0;
    return () => player?.seek(before);
  }, [asset.kind]);
  useEffect(() => {
    if (asset.kind !== 'audio') return;
    const player = useUI.getState().player;
    player?.seek(Math.max(0, item.start + (cursor - item.trimIn) / item.speed));
    let frame = 0;
    const copy = () => {
      if (sceneCanvas.current && player) {
        const c = sceneCanvas.current;
        c.getContext('2d')?.drawImage(player.compositor.canvas, 0, 0, c.width, c.height);
      }
      frame = requestAnimationFrame(copy);
    };
    frame = requestAnimationFrame(copy);
    return () => cancelAnimationFrame(frame);
  }, [asset.kind, cursor, item.start, item.trimIn, item.speed]);
  const seek = (t: number) => {
    setCursor(t);
    if (media.current) media.current.currentTime = Math.min(t, asset.duration - 0.001);
  };
  const props = {
    src: urlFor(project.id, asset.id),
    onTimeUpdate: () => {
      if (media.current) {
        setCursor(media.current.currentTime);
        media.current.muted = !ranges.some(
          ([a, b]) => media.current!.currentTime >= a && media.current!.currentTime < b,
        );
      }
    },
    onEnded: () => setPlaying(false),
    onLoadedMetadata: () => seek(cursor),
  };
  return (
    <Sheet
      open
      title="選擇保留的聲音片段"
      onClose={onClose}
      titleAction={
        <button
          className="icon-btn"
          aria-label="復原上一步選段"
          disabled={!history.canUndo}
          onClick={history.undo}
        >
          <Undo2 />
        </button>
      }
    >
      <p className="audio-source-name">{asset.name}</p>
      {asset.kind === 'video' ? (
        <video
          {...props}
          ref={(el) => {
            media.current = el;
          }}
          playsInline
          className="range-preview"
          aria-label="音訊對應影片"
        />
      ) : (
        <>
          <audio
            {...props}
            ref={(el) => {
              media.current = el;
            }}
          />
          <canvas
            ref={sceneCanvas}
            className="range-preview"
            width={360}
            height={Math.round((360 * project.height) / project.width)}
            aria-label="配樂對應專案畫面"
          />
          <div className="audio-preview-icon">
            ♫<p>背景音樂：{asset.name}</p>
          </div>
        </>
      )}
      <button
        className="btn"
        aria-label={playing ? '暫停選段試聽' : '播放選段試聽'}
        onClick={() => {
          if (playing) {
            media.current?.pause();
            setPlaying(false);
          } else {
            useUI.getState().player?.pause();
            if (media.current) {
              media.current.muted = !ranges.some(([a, b]) => cursor >= a && cursor < b);
              void media.current
                .play()
                .then(() => setPlaying(true))
                .catch(() => toast('此音訊暫時無法試聽，請重新點選播放或使用相容的音檔。'));
            }
          }
        }}
      >
        {playing ? '暫停試聽' : '播放試聽（含畫面）'}
      </button>
      <p className="source-now">
        目前：{cursor.toFixed(2)} 秒 {markStart !== null && `· 靜音起點 ${markStart.toFixed(2)} 秒`}
      </p>
      <div className="chips" aria-label="多組聲音起迄標記">
        <button
          className="chip"
          onClick={() => {
            media.current?.pause();
            setPlaying(false);
            setMarkStart(cursor);
          }}
        >
          標記靜音起點
        </button>
        <button
          className="chip"
          disabled={markStart === null}
          onClick={() => {
            if (markStart === null) return;
            if (cursor <= markStart + 0.009) return toast('請選擇起點之後的秒數作為終點');
            setRanges((r) => excludeAudio(r, markStart, cursor));
            setMarkStart(null);
            setMarkerMode('mute');
          }}
        >
          標記靜音終點並新增
        </button>
        {markStart !== null && (
          <button className="chip" onClick={() => setMarkStart(null)}>
            取消此組標記
          </button>
        )}
      </div>
      <div className="chips">
        <button
          className={`chip${markerMode === 'keep' ? ' active' : ''}`}
          onClick={() => setMarkerMode('keep')}
        >
          調整保留聲音標記
        </button>
        <button
          className={`chip${markerMode === 'mute' ? ' active' : ''}`}
          onClick={() => setMarkerMode('mute')}
        >
          調整靜音標記（{muted.length} 組）
        </button>
      </div>
      <SelectionAddButton
        ranges={ranges}
        cursor={cursor}
        duration={asset.duration}
        onChange={(r) => {
          setRanges(r);
          setMarkerMode('keep');
        }}
      />
      <SourceRanges
        onEditStart={history.begin}
        onEditEnd={history.end}
        markerRanges={markerMode === 'mute' ? muted : undefined}
        markerLabel={markerMode === 'mute' ? '靜音' : undefined}
        onMarkerChange={
          markerMode === 'mute' ? (r) => setRanges(inverseRanges(r, asset.duration)) : undefined
        }
        duration={asset.duration}
        ranges={ranges}
        thumbs={asset.thumbs}
        cursor={cursor}
        onChange={setRanges}
        onSeek={seek}
      />
      <p className="hint">
        拖曳秒數上方的小倒三角調整各段起點與終點。原色是保留的聲音，反灰處靜音；畫面與時間位置保持連續。點縮圖定位，再加入靜音區段；拖動兩旁倒三角可改變靜音長度。
      </p>
      <div className="chips">
        <button
          className="chip"
          onClick={() =>
            setRanges((r) =>
              excludeAudio(r, Math.max(0, cursor - 0.25), Math.min(asset.duration, cursor + 0.25)),
            )
          }
        >
          將目前前後 0.25 秒靜音
        </button>
        <button className="chip" onClick={() => setRanges([[0, asset.duration]])}>
          還原完整聲音
        </button>
      </div>
      {markerMode === 'mute' && (
        <div className="muted-intervals">
          {muted.map(([a, b], i) => (
            <p key={i}>
              靜音 {i + 1}：{a.toFixed(2)}–{b.toFixed(2)} 秒{' '}
              <button className="chip" onClick={() => setRanges((r) => includeAudio(r, a, b))}>
                移除第 {i + 1} 組靜音
              </button>
            </p>
          ))}
        </div>
      )}
      <div className="audio-intervals">
        {ranges.map(([a, b], i) => (
          <p key={i}>
            第 {i + 1} 段：{a.toFixed(2)} → {b.toFixed(2)} 秒{' '}
            <button
              className="chip sm"
              aria-label={`移除第${i + 1}段聲音`}
              onClick={() => setRanges((r) => r.filter((_, j) => i !== j))}
            >
              移除這段
            </button>
          </p>
        ))}
        {!ranges.length && <p>目前全部靜音；可還原完整聲音再調整。</p>}
      </div>
      <div className="sheet-row">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn primary"
          onClick={() => {
            editItem(item.id, (it) => {
              if (it.type !== 'text') it.audioRanges = ranges;
            });
            onClose();
          }}
        >
          套用聲音選段
        </button>
      </div>
    </Sheet>
  );
}
