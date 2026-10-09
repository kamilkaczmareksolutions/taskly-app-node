import { afterEach, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createDatabase } from '../src/core/database.ts';
import { createApp } from '../src/factory.ts';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  vi.spyOn(database.todo, 'findMany').mockResolvedValue([]);
  vi.spyOn(database.todo, 'findFirst').mockResolvedValue(null);
  return { app: createApp(database), database };
}

it('reports health when the database answers', async () => {
  const { app, database } = setup();
  const findFirst = vi.spyOn(database.todo, 'findFirst').mockResolvedValue(null);
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ok' });
  expect(findFirst).toHaveBeenCalledWith({ select: { id: true } });
  expect(response.headers['x-powered-by']).toBeUndefined();
});

it('serves the OpenAPI document and hides unknown routes', async () => {
  const { app } = setup();
  const spec = await request(app).get('/openapi.json');
  expect(spec.status).toBe(200);
  expect(spec.body.info.title).toBe('Taskly App Node API');
  const missing = await request(app).get('/missing');
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual({ detail: 'Not Found' });
});

it('serves the API docs page', async () => {
  const { app } = setup();
  const docs = await request(app).get('/docs/');
  expect(docs.status).toBe(200);
  expect(docs.headers['content-type']).toMatch(/html/);
});

it('rejects invalid JSON and oversized bodies', async () => {
  const { app } = setup();
  const invalid = await request(app).post('/api/todos').set('Content-Type', 'application/json').send('{"title":');
  expect(invalid.status).toBe(422);
  expect(invalid.body).toEqual({ detail: 'Invalid JSON.' });
  const oversized = await request(app).post('/api/todos').set('Content-Type', 'application/json').send(`{"title":"${'x'.repeat(200_000)}"}`);
  expect(oversized.status).toBe(413);
  expect(oversized.body).toEqual({ detail: 'Request body too large.' });
});

it('returns 500 when a route throws', async () => {
  const { app, database } = setup();
  vi.spyOn(database.todo, 'findMany').mockRejectedValue(new Error('Database unavailable'));
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
  expect(error).toHaveBeenCalled();
});
