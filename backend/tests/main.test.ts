import { afterEach, it, expect, vi } from 'vitest';

vi.mock('../src/core/lifespan.ts', () => ({ start: vi.fn() }));

afterEach(() => {
  vi.resetModules();
  process.exitCode = undefined;
});

it('records a startup failure', async () => {
  const lifespan = await import('../src/core/lifespan.ts');
  vi.mocked(lifespan.start).mockRejectedValue(new Error('db down'));
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  await import('../src/main.ts');
  await vi.waitFor(() => expect(process.exitCode).toBe(1));
  expect(error).toHaveBeenCalledWith('Cannot start Taskly App Node API:', expect.any(Error));
});
