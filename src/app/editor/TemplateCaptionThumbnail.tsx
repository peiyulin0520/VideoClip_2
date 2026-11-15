import { useEffect, useRef, useMemo } from 'react';
import type { ColorAdjustment, TextItem } from '../../model/types';
import { renderText } from '../../engine/textRender';
import { gradeRGB, gradeKey, resolveAdjustment } from '../../engine/grade';
import { useFonts } from '../../fonts/fontStore';
/** Tiny static text raster at its real proportion in the template; no playback-clock subscription. */
export function TemplateCaptionThumbnail({
  text,
  width,
  height,
  adjustment,
}: {
  text: TextItem;
  width: number;
  height: number;
  adjustment?: ColorAdjustment;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    epoch = useFonts((s) => s.epoch);
  const value = useMemo(() => {
    void epoch;
    return renderText(text.card, 0.1, 2);
  }, [text.card, epoch]);
  const key = gradeKey(resolveAdjustment(adjustment));
  useEffect(() => {
    const c = canvas.current!;
    c.width = value.canvas.width;
    c.height = value.canvas.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(value.canvas, 0, 0);
    if (adjustment) {
      const image = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < image.data.length; i += 4) {
        const color = gradeRGB(
          [image.data[i]! / 255, image.data[i + 1]! / 255, image.data[i + 2]! / 255],
          adjustment,
        );
        for (let j = 0; j < 3; j++) image.data[i + j] = color[j]! * 255;
      }
      ctx.putImageData(image, 0, 0);
    }
  }, [value, key, adjustment]);
  return (
    <span
      className="template-caption-mini"
      role="img"
      aria-label="版型文字比例示意"
      data-caption-size={text.card.runs[0]?.size}
      style={{
        left: `${text.transform.x * 100}%`,
        top: `${text.transform.y * 100}%`,
        width: `${(value.w / (width * 0.1)) * 100}%`,
        height: `${(value.h / (height * 0.1)) * 100}%`,
        transform: `translate(-50%,-50%) rotate(${text.transform.rotation}deg) scale(${text.transform.scale})`,
        opacity: text.transform.opacity,
      }}
    >
      <canvas ref={canvas} />
    </span>
  );
}
