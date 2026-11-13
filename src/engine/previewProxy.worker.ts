import { makePreview } from './previewProxy';
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<{ file: Blob; side: number }>) => void) | null;
  postMessage: (message: unknown) => void;
};
scope.onmessage = (event) => {
  void makePreview(event.data.file, event.data.side, (f) =>
    scope.postMessage({ type: 'progress', value: f }),
  ).then(
    (result) => scope.postMessage({ type: 'done', result }),
    (error) => scope.postMessage({ type: 'error', message: String(error) }),
  );
};
