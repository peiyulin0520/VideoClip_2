import { decompressFrames, parseGIF, type ParsedFrame } from 'gifuct-js';

/** GIF frames are driven by project time, including seeking and export. */
export class AnimatedGif {
  readonly canvas: HTMLCanvasElement;
  readonly duration: number;
  private ctx: CanvasRenderingContext2D;
  private patch = document.createElement('canvas');
  private index = -1;
  private saved: ImageData | null = null;
  private ends: number[] = [];
  private constructor(
    private frames: ParsedFrame[],
    width: number,
    height: number,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
    let time = 0;
    for (const frame of frames) {
      time += Math.max(20, frame.delay || 100) / 1000;
      this.ends.push(time);
    }
    this.duration = time;
  }
  static async load(blob: Blob) {
    const parsed = parseGIF(await blob.arrayBuffer());
    const pixels = parsed.frames.reduce(
      (n, f) => n + ('image' in f ? f.image.descriptor.width * f.image.descriptor.height : 0),
      0,
    );
    if (pixels > 16_000_000 || parsed.frames.length > 500 || parsed.lsd.width * parsed.lsd.height > 4_000_000)
      throw Error('GIF 太大，請使用較小的動態貼圖');
    const frames = decompressFrames(parsed, true);
    if (!frames.length) throw Error('GIF 沒有影格');
    return new AnimatedGif(frames, parsed.lsd.width, parsed.lsd.height);
  }
  frame(time: number) {
    const local = ((time % this.duration) + this.duration) % this.duration;
    const target = Math.max(
      0,
      this.ends.findIndex((end) => end > local),
    );
    if (target < this.index) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.index = -1;
      this.saved = null;
    }
    for (let i = this.index + 1; i <= target; i++) {
      if (this.index >= 0) {
        const prev = this.frames[this.index]!;
        if (prev.disposalType === 2)
          this.ctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
        else if (prev.disposalType === 3 && this.saved) this.ctx.putImageData(this.saved, 0, 0);
      }
      const frame = this.frames[i]!;
      this.saved =
        frame.disposalType === 3 ? this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height) : null;
      this.patch.width = frame.dims.width;
      this.patch.height = frame.dims.height;
      const ctx = this.patch.getContext('2d')!,
        data = ctx.createImageData(frame.dims.width, frame.dims.height);
      data.data.set(frame.patch);
      ctx.putImageData(data, 0, 0);
      this.ctx.drawImage(this.patch, frame.dims.left, frame.dims.top);
      this.index = i;
    }
    return { canvas: this.canvas, stamp: target };
  }
  destroy() {
    this.canvas.width = this.patch.width = 0;
    this.frames = [];
  }
}
