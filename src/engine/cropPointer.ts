export type CropBounds = { left: number; top: number; width: number; height: number };
export function cropPointer(x: number, y: number, bounds: CropBounds, offset: number) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return {
    contact: [clamp((x - bounds.left) / bounds.width), clamp((y - bounds.top) / bounds.height)] as [
      number,
      number,
    ],
    target: [clamp((x - bounds.left) / bounds.width), clamp((y - bounds.top - offset) / bounds.height)] as [
      number,
      number,
    ],
  };
}
