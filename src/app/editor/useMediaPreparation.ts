import { useEffect } from 'react';
import type { Player } from '../../engine/player';
import { PausedMediaQueue } from '../../engine/pausedMediaQueue';
import { hasFilmstrip } from '../../engine/filmstrip';
import { preparePreviews } from '../../engine/preparePreviews';
import { prepareFilmstrips } from '../../engine/prepareFilmstrips';
import {
  setAssetPreview,
  setAssetFilmstrip,
  setAssetThumbs,
  useProjectStore,
} from '../../store/projectStore';
import { useUI } from '../../store/uiStore';

/** Original media is immediately usable; optional decoders only run while all previews are paused. */
export function useMediaPreparation(
  projectId: string,
  side: number,
  player: Player | null,
  assetsKey: string,
  loading: boolean,
) {
  useEffect(() => {
    if (!player || loading) return;
    let interaction = false;
    const assets = () =>
      useProjectStore.getState().project?.id === projectId ? useProjectStore.getState().project!.assets : [];
    const externalPlaying = () =>
      [...document.querySelectorAll<HTMLMediaElement>('video,audio')].some(
        (el) => !el.closest('.pool') && !el.paused && !el.ended,
      );
    const progress = (fraction: number, message: string) => {
      const value = Math.round(fraction * 100),
        old = useUI.getState().mediaPreparation;
      if (!old || old.progress !== value || old.message !== message || old.paused)
        useUI.setState({ mediaPreparation: { progress: value, message, paused: false } });
    };
    const queue = new PausedMediaQueue({
      busy: () => player.isPlaying || interaction || externalPlaying(),
      subscribe: (sync) => player.subscribe(sync),
      pending: () =>
        assets().filter(
          (asset) => asset.kind === 'video' && (!asset.previewFiles?.[String(side)] || !hasFilmstrip(asset)),
        ),
      key: (asset) => asset.id,
      status: (paused) => {
        if (paused === null) useUI.setState({ mediaPreparation: null });
        else if (paused)
          useUI.setState({
            mediaPreparation: {
              progress: useUI.getState().mediaPreparation?.progress ?? 0,
              message: '播放優先，輕量預覽與縮圖稍後準備',
              paused: true,
            },
          });
      },
      work: async (asset, signal) => {
        await preparePreviews(projectId, [asset], side, signal, progress, (id, metadata) => {
          if (!signal.aborted) setAssetPreview(id, side, metadata);
        });
        signal.throwIfAborted();
        const current = assets().find((a) => a.id === asset.id);
        if (!current) return;
        player.refresh(); // Pool swaps completed preview URLs only when playback is paused.
        await prepareFilmstrips(projectId, [current], signal, progress, (id, strip) => {
          if (!signal.aborted) setAssetFilmstrip(id, strip);
        });
        signal.throwIfAborted();
        const strip = assets().find((a) => a.id === asset.id)?.filmstrip;
        if (strip?.frames.length && hasFilmstrip(assets().find((a) => a.id === asset.id)!)) {
          const count = Math.min(8, strip.frames.length);
          const thumbs = Array.from(
            { length: count },
            (_, i) =>
              strip.frames[Math.round((i * (strip.frames.length - 1)) / Math.max(1, count - 1))]!.src!,
          );
          setAssetThumbs(asset.id, thumbs);
        }
      },
    });
    const onMedia = (event: Event) => {
      if (!(event.target instanceof HTMLMediaElement) || !event.target.closest('.pool')) queue.sync();
    };
    const down = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('.stage-wrap,.crop-viewport,.source-range,.tl-scroll')
      ) {
        interaction = true;
        queue.sync();
      }
    };
    const up = () => {
      if (interaction) {
        interaction = false;
        queue.sync();
      }
    };
    for (const name of ['play', 'pause', 'ended']) document.addEventListener(name, onMedia, true);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    return () => {
      queue.destroy();
      for (const name of ['play', 'pause', 'ended']) document.removeEventListener(name, onMedia, true);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      useUI.setState({ mediaPreparation: null });
    };
  }, [projectId, side, player, assetsKey, loading]);
}
