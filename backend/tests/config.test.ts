import { afterEach, it, expect } from 'vitest';
import { resolveDatabaseUrl } from '../src/core/config.ts';

const NAMES = ['DATABASE_URL', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_HOST', 'DB_PORT', 'POSTGRES_DB'] as const;
const saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

function clearEnv() {
  for (const name of NAMES) delete process.env[name];
}

it('uses an explicit URL and rewrites the SQLAlchemy scheme', () => {
  clearEnv();
  process.env.DATABASE_URL = 'postgresql://ignored:ignored@ignored:5432/ignored';
  expect(resolveDatabaseUrl('postgresql+psycopg://taskly:secret@db:5432/taskly')).toBe('postgresql://taskly:secret@db:5432/taskly');
});

it('reads DATABASE_URL when no override is provided', () => {
  clearEnv();
  process.env.DATABASE_URL = 'postgresql+psycopg://taskly:secret@db:5432/taskly';
  expect(resolveDatabaseUrl()).toBe('postgresql://taskly:secret@db:5432/taskly');
  expect(resolveDatabaseUrl('')).toBe('postgresql://taskly:secret@db:5432/taskly');
});

it('builds a URL from the postgres environment variables', () => {
  clearEnv();
  process.env.POSTGRES_USER = 'taskly';
  process.env.POSTGRES_PASSWORD = 'secret';
  process.env.POSTGRES_HOST = 'db';
  process.env.DB_PORT = '5432';
  process.env.POSTGRES_DB = 'taskly';
  expect(resolveDatabaseUrl()).toBe('postgresql://taskly:secret@db:5432/taskly');
});

it('names the first missing postgres variable', () => {
  clearEnv();
  process.env.POSTGRES_USER = 'taskly';
  expect(() => resolveDatabaseUrl()).toThrow('Missing environment variable: POSTGRES_PASSWORD');
});
