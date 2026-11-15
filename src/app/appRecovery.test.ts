import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isModuleLoadError, recoveryUrl, reloadAppCode } from './appRecovery';
const href = 'https://example.test/VideoClip_2/?existing=1#/p/keep-project';
const scope = 'https://example.test/VideoClip_2/';
beforeEach(() => vi.stubEnv('BASE_URL', '/VideoClip_2/'));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it.each([
  'TypeError: Importing a module script failed.',
  'TypeError: Failed to fetch dynamically imported module: /assets/old.js',
  'TypeError: error loading dynamically imported module',
  'Error: Unable to preload CSS for /assets/old.css',
])('recognizes code failures separately from damaged media: %s', (error) => {
  expect(isModuleLoadError(error)).toBe(true);
});
it('does not treat media readiness or decoding failures as a code update', () => {
  expect(isModuleLoadError('預覽素材尚未準備完成')).toBe(false);
  expect(isModuleLoadError('NotSupportedError: The element has no supported sources')).toBe(false);
});
it('retains the app path, query and exact project route when clearing the document module map', () => {
  const url = new URL(recoveryUrl(href, 123));
  expect(url.pathname).toBe('/VideoClip_2/');
  expect(url.hash).toBe('#/p/keep-project');
  expect(url.searchParams.get('existing')).toBe('1');
  expect(url.searchParams.get('lm2-code-reload')).toBe('123');
});
function registration(partial: Partial<ServiceWorkerRegistration> = {}) {
  return {
    scope,
    update: vi.fn(async () => {}),
    waiting: null,
    installing: null,
    ...partial,
  } as unknown as ServiceWorkerRegistration;
}
function worker(state: ServiceWorkerState = 'installed') {
  const worker = new EventTarget() as ServiceWorker;
  Object.defineProperty(worker, 'state', { value: state, writable: true });
  worker.postMessage = vi.fn(() => {
    Object.defineProperty(worker, 'state', { value: 'activated', writable: true });
    worker.dispatchEvent(new Event('statechange'));
  });
  return worker;
}
it('activates only the waiting code worker before reloading the same project', async () => {
  const waiting = worker(),
    reg = registration({ waiting }),
    replace = vi.fn();
  const getRegistration = vi.fn(async () => reg);
  await reloadAppCode({ href, serviceWorker: { getRegistration }, replace });
  expect(getRegistration).toHaveBeenCalledWith(scope);
  expect(reg.update).toHaveBeenCalledOnce();
  expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  expect(new URL(replace.mock.calls[0]![0]).hash).toBe('#/p/keep-project');
});
it('does not update a parent worker belonging to a different app', async () => {
  const reg = registration({ scope: 'https://example.test/' }),
    replace = vi.fn();
  await reloadAppCode({ href, serviceWorker: { getRegistration: vi.fn(async () => reg) }, replace });
  expect(reg.update).not.toHaveBeenCalled();
  expect(replace).toHaveBeenCalledOnce();
});
it('can reopen cached code if an offline update check fails', async () => {
  const reg = registration({
      update: vi.fn(async () => {
        throw Error('Offline');
      }),
    }),
    replace = vi.fn();
  await reloadAppCode({ href, serviceWorker: { getRegistration: vi.fn(async () => reg) }, replace });
  expect(replace).toHaveBeenCalledOnce();
});
it('still reloads when the browser restricts service worker access', async () => {
  const replace = vi.fn();
  await reloadAppCode({
    href,
    serviceWorker: {
      getRegistration: vi.fn(async () => {
        throw Error('SecurityError');
      }),
    },
    replace,
  });
  expect(replace).toHaveBeenCalledOnce();
});
it('does not reload into a failed new worker', async () => {
  const replace = vi.fn();
  await expect(
    reloadAppCode({
      href,
      serviceWorker: { getRegistration: vi.fn(async () => registration({ waiting: worker('redundant') })) },
      replace,
    }),
  ).rejects.toThrow('新版程式下載未完成');
  expect(replace).not.toHaveBeenCalled();
});
it('bounds a hanging update check instead of trapping the retry button forever', async () => {
  vi.useFakeTimers();
  const replace = vi.fn();
  const reg = registration({ update: vi.fn(() => new Promise<ServiceWorkerRegistration>(() => {})) });
  const result = reloadAppCode({ href, serviceWorker: { getRegistration: vi.fn(async () => reg) }, replace });
  await vi.advanceTimersByTimeAsync(8001);
  await result;
  expect(replace).toHaveBeenCalledOnce();
});
