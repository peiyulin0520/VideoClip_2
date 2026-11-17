import { afterEach, expect, it, vi } from 'vitest';
import { PausedMediaQueue } from './pausedMediaQueue';
afterEach(() => vi.useRealTimers());
function setup() {
  vi.useFakeTimers();
  let busy = true;
  let notify = () => {};
  const signals: AbortSignal[] = [];
  const work = vi.fn((_item: string, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<void>((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      finishes.push(resolve);
    });
  });
  const finishes: (() => void)[] = [];
  const pending = ['video'];
  const status = vi.fn();
  const unsubscribe = vi.fn();
  const queue = new PausedMediaQueue({
    busy: () => busy,
    subscribe: (update) => {
      notify = update;
      return unsubscribe;
    },
    pending: () => pending,
    key: (item) => item,
    work,
    status,
  });
  return {
    queue,
    work,
    signals,
    finishes,
    pending,
    status,
    unsubscribe,
    setBusy: (value: boolean) => {
      busy = value;
      notify();
    },
  };
}
it('does no decoding during playback, aborts immediately on play, and resumes the unfinished job after pause', async () => {
  const s = setup();
  await vi.advanceTimersByTimeAsync(2000);
  expect(s.work).not.toHaveBeenCalled();
  s.setBusy(false);
  await vi.advanceTimersByTimeAsync(500);
  expect(s.work).toHaveBeenCalledTimes(1);
  s.setBusy(true);
  expect(s.signals[0]!.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(s.work).toHaveBeenCalledTimes(1);
  s.setBusy(false);
  await vi.advanceTimersByTimeAsync(500);
  expect(s.work).toHaveBeenCalledTimes(2);
  s.finishes[1]!();
  await vi.advanceTimersByTimeAsync(500);
  expect(s.status).toHaveBeenLastCalledWith(null);
  s.queue.destroy();
});
it('handles pause before aborted decoder teardown completes, and destroy never starts a late job', async () => {
  const s = setup();
  s.setBusy(false);
  await vi.advanceTimersByTimeAsync(500);
  s.setBusy(true);
  s.setBusy(false);
  await vi.advanceTimersByTimeAsync(500);
  expect(s.work).toHaveBeenCalledTimes(2);
  s.queue.destroy();
  expect(s.signals[1]!.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(5000);
  expect(s.work).toHaveBeenCalledTimes(2);
  expect(s.unsubscribe).toHaveBeenCalledOnce();
});
it('optional decoder failures are attempted once per visit, avoiding a retry spin', async () => {
  vi.useFakeTimers();
  const work = vi.fn(async () => {
    throw Error('unsupported codec');
  });
  const queue = new PausedMediaQueue({
    busy: () => false,
    subscribe: () => () => {},
    pending: () => ['v'],
    key: (x) => x,
    work,
    status: vi.fn(),
  });
  await vi.advanceTimersByTimeAsync(10000);
  expect(work).toHaveBeenCalledOnce();
  queue.destroy();
});
