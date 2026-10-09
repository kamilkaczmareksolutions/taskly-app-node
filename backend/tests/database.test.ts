import { afterEach, it, expect, vi } from 'vitest';
import { createDatabase, initialize } from '../src/core/database.ts';

afterEach(() => vi.restoreAllMocks());

it('creates the todos table when it is missing', async () => {
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  const execute = vi.spyOn(database, '$executeRaw').mockResolvedValue(0);
  await initialize(database);
  expect(execute).toHaveBeenCalledOnce();
  const statement = execute.mock.calls[0][0] as TemplateStringsArray;
  expect(statement.join(' ')).toContain('CREATE TABLE IF NOT EXISTS todos');
});
