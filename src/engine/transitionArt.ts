let film: HTMLCanvasElement | undefined;
/** Original perforated film border, shared by the A/B demo and actual transitions. */
export function filmBorderCanvas() {
  if (film) return film;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 96;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#19181b';
  c.fillRect(0, 0, 8, 96);
  c.fillRect(152, 0, 8, 96);
  c.fillRect(0, 0, 160, 2);
  c.fillRect(0, 94, 160, 2);
  c.fillStyle = '#eee4d0';
  for (let y = 4; y < 92; y += 12)
    for (const x of [2, 154]) {
      c.beginPath();
      c.roundRect(x, y, 4, 7, 1);
      c.fill();
    }
  film = canvas;
  return canvas;
}
