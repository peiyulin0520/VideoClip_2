/**
 * 一組隱藏的 <video>，給所有「現在或即將播放」的影片物件輪流使用。
 * 同一個物件盡量一直用同一個元素（不重設 src）；沒人用的元素讓出去。
 */
export class VideoPool {
  readonly els: HTMLVideoElement[] = [];
  private tick = 0;
  private destroyed = false;
  private retries = new Map<HTMLVideoElement, number>();
  private primeTimers = new Map<HTMLVideoElement, ReturnType<typeof setTimeout>>();
  private frameCallbacks = new Map<HTMLVideoElement, number>();

  constructor(
    host: HTMLElement,
    size: number,
    private onFrame: () => void,
  ) {
    for (let i = 0; i < size; i++) {
      const v = document.createElement('video');
      v.playsInline = true;
      v.muted = true;
      v.preload = 'auto';
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      const changed = () => {
        v.dataset.frameStamp = String(Number(v.dataset.frameStamp ?? 0) + 1);
        this.onFrame();
      };
      for (const name of ['seeked', 'loadeddata', 'canplay', 'resize', 'loadedmetadata'])
        v.addEventListener(name, changed);
      v.addEventListener('loadedmetadata', () => {
        // Safari can expose metadata before a paused video has decoded a drawable
        // frame. A tiny seek plus muted priming unlocks that first frame.
        if (v.dataset.previewIntent === 'play') return;
        const assetId = v.dataset.assetId,
          itemId = v.dataset.itemId;
        v.dataset.priming = '1';
        v.muted = true;
        try {
          if (v.currentTime === 0) v.currentTime = Math.min(0.001, v.duration / 2);
        } catch {
          /* metadata pending */
        }
        const finish = () => {
          if (this.destroyed || v.dataset.assetId !== assetId || v.dataset.itemId !== itemId) return;
          delete v.dataset.priming;
          const timer = this.primeTimers.get(v);
          if (timer) clearTimeout(timer);
          this.primeTimers.delete(v);
          if (v.dataset.previewIntent !== 'play') {
            v.pause();
            const target = Number(v.dataset.seekTarget ?? 0);
            if (Math.abs(v.currentTime - target) > 0.02 && !v.seeking) v.currentTime = target;
          }
          changed();
        };
        this.primeTimers.set(v, setTimeout(finish, 350));
        const audio = v.dataset.mediaKind === 'audio';
        if (!audio && v.requestVideoFrameCallback) v.requestVideoFrameCallback(finish);
        void v.play().then(() => {
          if (audio || !v.requestVideoFrameCallback) finish();
        }, finish);
      });
      v.addEventListener('playing', () => {
        if (v.dataset.previewIntent !== 'play' && !v.dataset.priming) v.pause();
      });
      host.appendChild(v);
      this.els.push(v);
      if (v.requestVideoFrameCallback) {
        const frame = () => {
          if (this.destroyed) return;
          changed();
          this.frameCallbacks.set(v, v.requestVideoFrameCallback(frame));
        };
        this.frameCallbacks.set(v, v.requestVideoFrameCallback(frame));
      }
    }
  }

  find(itemId: string): HTMLVideoElement | undefined {
    return this.els.find((v) => v.dataset.itemId === itemId);
  }

  /** 給 itemId 一個元素（已有就沿用）。protect 裡的是這一格正在用的，不能搶。 */
  acquire(
    itemId: string,
    assetId: string,
    url: string,
    protect: Set<HTMLVideoElement>,
    audio = false,
  ): HTMLVideoElement | null {
    let el = this.find(itemId);
    if (!el) {
      const free = this.els.filter((v) => !protect.has(v));
      if (free.length === 0) return null;
      // 優先用沒綁物件的，其次最久沒用的
      free.sort(
        (a, b) =>
          Number(!!a.dataset.itemId) - Number(!!b.dataset.itemId) ||
          Number(a.dataset.used) - Number(b.dataset.used),
      );
      el = free[0]!;
      el.pause();
      el.dataset.previewIntent = 'pause';
      delete el.dataset.seekTarget;
      delete el.dataset.playPending;
      const primeTimer = this.primeTimers.get(el);
      if (primeTimer) clearTimeout(primeTimer);
      this.primeTimers.delete(el);
      el.dataset.itemId = itemId;
      delete el.dataset.primed;
      delete el.dataset.priming;
    }
    el.dataset.mediaKind = audio ? 'audio' : 'video';
    if (el.dataset.assetId !== assetId || el.dataset.url !== url) {
      delete el.dataset.priming;
      el.dataset.url = url;
      el.src = url;
      el.dataset.assetId = assetId;
      delete el.dataset.primed;
      el.load();
      const old = this.retries.get(el);
      if (old) cancelAnimationFrame(old);
      let frames = 0;
      const poll = () => {
        if (this.destroyed) return;
        onChangeForPool();
        if (++frames < 120 && (el!.readyState < 2 || el!.seeking || (!audio && !el!.videoWidth)))
          this.retries.set(el!, requestAnimationFrame(poll));
        else this.retries.delete(el!);
      };
      const onChangeForPool = this.onFrame;
      this.retries.set(el, requestAnimationFrame(poll));
    }
    el.dataset.used = String(++this.tick);
    return el;
  }

  pauseAllExcept(keep: Set<HTMLVideoElement>) {
    for (const v of this.els)
      if (!keep.has(v)) {
        v.dataset.previewIntent = 'pause';
        if (!v.paused) v.pause();
      }
  }

  /** VideoClip's synchronous unlock: queued elements are paused before any promise can race playback. */
  unlock() {
    for (const v of this.els) {
      if (!v.paused || v.dataset.previewIntent === 'play' || v.dataset.unlocked || !v.getAttribute('src'))
        continue;
      v.dataset.unlocked = '1';
      v.muted = true;
      void v.play().catch(() => {});
      v.pause();
    }
  }

  destroy() {
    this.destroyed = true;
    for (const timer of this.primeTimers.values()) clearTimeout(timer);
    this.primeTimers.clear();
    for (const raf of this.retries.values()) cancelAnimationFrame(raf);
    this.retries.clear();
    for (const [el, id] of this.frameCallbacks) el.cancelVideoFrameCallback?.(id);
    this.frameCallbacks.clear();
    for (const v of this.els) {
      v.pause();
      v.removeAttribute('src');
      v.load();
      v.remove();
    }
    this.els.length = 0;
  }
}
