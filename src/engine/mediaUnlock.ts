/** Authorize queued media during the click, then pause synchronously (never in a late promise). */
export function unlockPausedMedia(
  elements: HTMLMediaElement[],
  prepare?: (element: HTMLMediaElement) => boolean,
) {
  for (const element of elements) {
    if (
      !element.paused ||
      element.dataset.previewIntent === 'play' ||
      element.dataset.unlocked ||
      !element.getAttribute('src')
    )
      continue;
    element.dataset.unlocked = '1';
    const muted = element.muted;
    element.muted = false;
    const routed = prepare?.(element) ?? false;
    void element.play().catch(() => {});
    element.pause();
    if (!routed) element.muted = muted;
  }
}
