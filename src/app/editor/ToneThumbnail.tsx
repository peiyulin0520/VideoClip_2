import { useEffect, useRef } from 'react';
import type { ColorAdjustment } from '../../model/types';
import { gradeRGB, resolveAdjustment, gradeKey } from '../../engine/grade';
/** Static miniature only. Never reads a playing video or performs per-frame CPU grading. */
export function ToneThumbnail({
  src,
  adjustment,
  label,
  aspect = 1.5,
}: {
  src: string;
  adjustment?: ColorAdjustment;
  label: string;
  aspect?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    key = gradeKey(resolveAdjustment(adjustment));
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      const c = canvas.current;
      if (cancelled || !c) return;
      const ctx = c.getContext('2d')!;
      c.width = 96;
      c.height = Math.max(1, Math.round(96 / aspect));
      const scale = Math.max(c.width / image.naturalWidth, c.height / image.naturalHeight),
        w = image.naturalWidth * scale,
        h = image.naturalHeight * scale;
      ctx.drawImage(image, (c.width - w) / 2, (c.height - h) / 2, w, h);
      if (adjustment) {
        const pixels = ctx.getImageData(0, 0, c.width, c.height),
          rgb = [0, 0, 0];
        for (let i = 0; i < pixels.data.length; i += 4) {
          rgb[0] = pixels.data[i]! / 255;
          rgb[1] = pixels.data[i + 1]! / 255;
          rgb[2] = pixels.data[i + 2]! / 255;
          const color = gradeRGB(rgb, adjustment);
          for (let j = 0; j < 3; j++) pixels.data[i + j] = color[j]! * 255;
        }
        ctx.putImageData(pixels, 0, 0);
      }
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
    // key represents all adjustment fields; avoid re-rasterizing unrelated project edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, key, aspect]);
  return <canvas role="img" className="tone-thumbnail" ref={canvas} aria-label={label} />;
}
