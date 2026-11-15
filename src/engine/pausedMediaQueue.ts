/** Optional decoder work yields immediately to playback or a media editing gesture. */
export class PausedMediaQueue<T> {
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private job: AbortController | null = null;
  private complete = new Set<string>();
  private unsubscribe: () => void;
  constructor(
    private deps: {
      busy: () => boolean;
      subscribe: (update: () => void) => () => void;
      pending: () => T[];
      key: (item: T) => string;
      work: (item: T, signal: AbortSignal) => Promise<void>;
      status: (paused: boolean | null) => void;
      delay?: number;
    },
  ) {
    this.unsubscribe = deps.subscribe(() => this.sync());
    this.sync();
  }
  sync() {
    if (this.closed) return;
    if (this.deps.busy()) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.job?.abort();
      if (this.deps.pending().some((item) => !this.complete.has(this.deps.key(item)))) this.deps.status(true);
    } else if (!this.job && !this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.drain();
      }, this.deps.delay ?? 500);
    }
  }
  private async drain() {
    if (this.closed || this.deps.busy() || this.job) return;
    const item = this.deps.pending().find((item) => !this.complete.has(this.deps.key(item)));
    if (!item) {
      this.deps.status(null);
      return;
    }
    const controller = new AbortController();
    this.job = controller;
    this.deps.status(false);
    try {
      await this.deps.work(item, controller.signal);
      if (!controller.signal.aborted) this.complete.add(this.deps.key(item));
    } catch {
      // Failed optional work uses the original source; retry next project visit, never in a tight loop.
      if (!controller.signal.aborted) this.complete.add(this.deps.key(item));
    } finally {
      this.job = null;
      if (!this.closed && !this.deps.busy()) this.sync();
    }
  }
  destroy() {
    this.closed = true;
    this.unsubscribe();
    if (this.timer) clearTimeout(this.timer);
    this.job?.abort();
  }
}
