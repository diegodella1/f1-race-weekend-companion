import { describe, expect, it, vi } from 'vitest';
import { MemoryCacheStore, RequestCoalescer } from '../cache';

describe('cache and request coalescing', () => {
  it('serves stale values only within stale allowance', async () => {
    let now = 1_000;
    const cache = new MemoryCacheStore(() => now);
    await cache.set('key', { value: 1 }, 100);
    now = 1_150;
    expect(await cache.get('key')).toBeNull();
    expect(await cache.get('key', 100)).toEqual({ value: 1 });
    now = 1_250;
    expect(await cache.get('key', 100)).toBeNull();
  });

  it('shares one promise for simultaneous work', async () => {
    const work = vi.fn(async () => 'result');
    const coalescer = new RequestCoalescer();
    const values = await Promise.all([
      coalescer.run('same', work),
      coalescer.run('same', work),
      coalescer.run('same', work)
    ]);
    expect(values).toEqual(['result', 'result', 'result']);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
