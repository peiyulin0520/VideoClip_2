/** A rejected ESM import is cached by the document; recreating a player cannot retry it. */
export function isModuleLoadError(error: unknown): boolean {
  return /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|unable to preload css|loading (?:chunk|css chunk) .+ failed/i.test(
    String(error),
  );
}
export function recoveryUrl(href: string, stamp = Date.now()) {
  const url = new URL(href);
  url.searchParams.set('lm2-code-reload', String(stamp));
  return url.href;
}
function workerState(
  worker: ServiceWorker,
  done: (state: ServiceWorkerState) => boolean,
  start?: () => void,
) {
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      if (worker.state === 'redundant') return clean(Error('新版程式下載未完成，請確認連線後再試。'));
      if (done(worker.state)) clean();
    };
    const clean = (error?: Error) => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', finish);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => clean(Error('更新程式暫時沒有完成，請確認連線後再試。')), 10000);
    worker.addEventListener('statechange', finish);
    try {
      start?.();
      finish();
    } catch (error) {
      clean(error instanceof Error ? error : Error(String(error)));
    }
  });
}
async function checkUpdate(registration: ServiceWorkerRegistration) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      registration.update().catch(() => {}),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 8000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
/** Update only this app's code worker. Never clear IndexedDB, OPFS, fonts or other apps' caches. */
export async function reloadAppCode({
  href = location.href,
  serviceWorker = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
  replace = (url: string) => location.replace(url),
}: {
  href?: string;
  serviceWorker?: Pick<ServiceWorkerContainer, 'getRegistration'>;
  replace?: (url: string) => void;
} = {}) {
  if (serviceWorker) {
    const scope = new URL(import.meta.env.BASE_URL, href).href;
    const registration = await serviceWorker.getRegistration(scope).catch(() => undefined);
    if (registration?.scope === scope) {
      await checkUpdate(registration);
      const worker = registration.waiting ?? registration.installing;
      if (worker) {
        await workerState(worker, (state) => state === 'installed' || state === 'activated');
        if (worker.state !== 'activated') {
          await workerState(
            worker,
            (state) => state === 'activated',
            () => worker.postMessage({ type: 'SKIP_WAITING' }),
          );
        }
      }
    }
  }
  replace(recoveryUrl(href));
}
/** Keep a running document on its code version. A waiting update is applied explicitly. */
export function registerAppWorker(onUpdate: () => void) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const start = async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: 'none',
      });
      const waiting = () => {
        if (registration.waiting) onUpdate();
      };
      waiting();
      const watch = () => {
        const worker = registration.installing;
        const ready = () => {
          if (worker?.state === 'installed' && navigator.serviceWorker.controller) onUpdate();
        };
        worker?.addEventListener('statechange', ready);
        ready();
      };
      watch();
      registration.addEventListener('updatefound', watch);
    } catch {
      /* Opening cached projects remains possible offline. */
    }
  };
  if (document.readyState === 'complete') void start();
  else window.addEventListener('load', () => void start(), { once: true });
}
