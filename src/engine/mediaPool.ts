/**
 * 一組隱藏的 <video>，給所有「現在或即將播放」的影片物件輪流使用。
 * 同一個物件盡量一直用同一個元素（不重設 src）；沒人用的元素讓出去。
 */
export class VideoPool {
  readonly els: HTMLVideoElement[] = [];
  private tick = 0;
  private destroyed = false;
  private retries = new Map<HTMLVideoElement, number>();

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
      for (const name of ['seeked', 'loadeddata', 'canplay', 'resize', 'loadedmetadata'])
        v.addEventListener(name, this.onFrame);
      v.addEventListener('loadedmetadata', () => {
        // Safari can expose metadata before a paused video has decoded a drawable
        // frame. A tiny seek plus muted priming unlocks that first frame.
        if (v.dataset.previewIntent === 'play') return;
        const assetId = v.dataset.assetId;
        v.dataset.priming = '1';
        v.muted = true;
        try {
          if (v.currentTime === 0) v.currentTime = Math.min(0.001, v.duration / 2);
        } catch {
          /* metadata pending */
        }
        const finish = () => {
          if (this.destroyed || v.dataset.assetId !== assetId) return;
          delete v.dataset.priming;
          if (v.dataset.previewIntent !== 'play') v.pause();
          this.onFrame();
        };
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(finish);
        void v.play().then(() => {
          if (!v.requestVideoFrameCallback) finish();
        }, finish);
      });
      host.appendChild(v);
      this.els.push(v);
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
      el.dataset.itemId = itemId;
      delete el.dataset.primed;
    }
    if (el.dataset.assetId !== assetId) {
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
        if (++frames < 120 && (el!.readyState < 2 || el!.seeking || !el!.videoWidth))
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
    for (const v of this.els) if (!keep.has(v) && !v.paused) v.pause();
  }

  /** iOS Safari：要在使用者點擊當下對每個元素 play() 一下，之後才能由程式啟動播放 */
  unlock() {
    for (const v of this.els) {
      if (!v.paused || v.dataset.unlocked) continue;
      v.muted = true;
      void v.play().then(
        () => {
          v.dataset.unlocked = '1';
          v.pause();
        },
        () => {},
      );
    }
  }

  destroy() {
    this.destroyed = true;
    for (const raf of this.retries.values()) cancelAnimationFrame(raf);
    this.retries.clear();
    for (const v of this.els) {
      v.pause();
      v.removeAttribute('src');
      v.load();
      v.remove();
    }
    this.els.length = 0;
  }
}
