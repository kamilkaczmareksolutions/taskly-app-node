import { afterEach, it, expect, vi } from 'vitest';

const savedUrl = process.env.DATABASE_URL;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  process.exitCode = undefined;
  if (savedUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedUrl;
});

async function boot(
  listen: (port: number, host: string, callback: () => void) => {
    address: () => { port: number };
    close: (done?: () => void) => unknown;
    once: (event: string, fn: (error: Error) => void) => unknown;
  },
) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  const database = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
  const databaseModule = await import('../src/core/database.ts');
  const factoryModule = await import('../src/factory.ts');
  vi.spyOn(databaseModule, 'createDatabase').mockReturnValue(database as never);
  vi.spyOn(databaseModule, 'initialize').mockResolvedValue(undefined);
  vi.spyOn(factoryModule, 'createApp').mockReturnValue({ listen } as never);
  const { start } = await import('../src/core/lifespan.ts');
  return { start, database };
}

function listeningServer() {
  return (_port: number, _host: string, callback: () => void) => {
    const server = {
      address: () => ({ port: 4321, address: '0.0.0.0', family: 'IPv4' }),
      close: (done?: () => void) => { queueMicrotask(() => done?.()); return server; },
      once: () => server,
    };
    queueMicrotask(callback);
    return server;
  };
}

it('listens and disconnects on SIGTERM', async () => {
  const { start, database } = await boot(listeningServer());
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  await start();
  expect(database.$connect).toHaveBeenCalledOnce();
  expect(log).toHaveBeenCalledWith('Taskly App Node API listening on port 4321');
  process.emit('SIGTERM');
  await vi.waitFor(() => expect(database.$disconnect).toHaveBeenCalledOnce());
});

it('disconnects on SIGINT', async () => {
  const { start, database } = await boot(listeningServer());
  vi.spyOn(console, 'log').mockImplementation(() => {});
  await start();
  process.emit('SIGINT');
  await vi.waitFor(() => expect(database.$disconnect).toHaveBeenCalledOnce());
});

it('disconnects when startup fails and when shutdown fails', async () => {
  const { start, database } = await boot(listeningServer());
  database.$connect.mockRejectedValueOnce(new Error('refused'));
  await expect(start()).rejects.toThrow('refused');
  expect(database.$disconnect).toHaveBeenCalledOnce();

  database.$connect.mockResolvedValue(undefined);
  database.$disconnect.mockReset();
  database.$disconnect.mockRejectedValueOnce(new Error('hang'));
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  await start();
  process.emit('SIGTERM');
  await vi.waitFor(() => expect(process.exitCode).toBe(1));
  expect(error).toHaveBeenCalled();
});

it('disconnects when the port is taken', async () => {
  const { start, database } = await boot(() => {
    const server = {
      address: () => ({ port: 1 }),
      once: (event: string, fn: (error: Error) => void) => {
        if (event === 'error') queueMicrotask(() => fn(new Error('EADDRINUSE')));
        return server;
      },
      close: (done?: () => void) => { done?.(); return server; },
    };
    return server;
  });
  await expect(start()).rejects.toThrow('EADDRINUSE');
  expect(database.$disconnect).toHaveBeenCalled();
});
