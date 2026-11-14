/** Separated sound uses audio elements: it must not run another video decoder for the same movie. */
export class AudioPool {
  readonly els: HTMLAudioElement[] = [];
  private tick = 0;
  constructor(host: HTMLElement, size: number, onFrame: () => void) {
    for (let i = 0; i < size; i++) {
      const el = document.createElement('audio');
      el.preload = 'auto';
      for (const event of ['loadeddata', 'canplay', 'seeked', 'loadedmetadata'])
        el.addEventListener(event, onFrame);
      el.addEventListener('playing', () => {
        if (el.dataset.previewIntent !== 'play' && !el.dataset.audioFading) el.pause();
      });
      host.append(el);
      this.els.push(el);
    }
  }
  acquire(itemId: string, assetId: string, url: string, protect: Set<HTMLAudioElement>) {
    let el = this.els.find((el) => el.dataset.itemId === itemId);
    if (!el) {
      el = this.els
        .filter((el) => !protect.has(el))
        .sort(
          (a, b) =>
            Number(!!a.dataset.itemId) - Number(!!b.dataset.itemId) ||
            Number(a.dataset.used ?? 0) - Number(b.dataset.used ?? 0),
        )[0];
      if (!el) return null;
      el.pause();
      el.dataset.previewIntent = 'pause';
      el.dataset.itemId = itemId;
      delete el.dataset.seekTarget;
    }
    if (el.dataset.assetId !== assetId) {
      el.pause();
      el.dataset.assetId = assetId;
      el.src = url;
      el.load();
    }
    el.dataset.used = String(++this.tick);
    return el;
  }
  pauseAllExcept(keep: Set<HTMLAudioElement>, pause: (el: HTMLAudioElement) => void = (el) => el.pause()) {
    for (const el of this.els)
      if (!keep.has(el)) {
        el.dataset.previewIntent = 'pause';
        if (!el.paused) pause(el);
      }
  }
  destroy() {
    for (const el of this.els) {
      el.dataset.previewIntent = 'pause';
      el.pause();
      el.removeAttribute('src');
      el.load();
      el.remove();
    }
    this.els.length = 0;
  }
}
