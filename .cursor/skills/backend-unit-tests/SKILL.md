---
name: backend-unit-tests
description: Write Vitest and Supertest tests for the Express app with Prisma delegates mocked by vi.spyOn. Use for backend source changes.
---

# Backend unit tests

Match `backend/tests/repository.test.ts` and `backend/tests/router.test.ts`. One source file per step. Run the new test file before starting another.

## Steps

1. Read the source and the existing test file named by `analyze-pr-diff`. Extend that file when it exists.
2. Build the app the way callers do. Routes go through `createTodosRouter` or `createApp`. Do not call a repository method when the behavior under test is the HTTP response.
3. Mock Prisma on the real delegate. `createDatabase('postgresql://test:test@localhost:5432/test')`, then `vi.spyOn(database.todo, 'findMany')` (or `create`, `findUnique`, `updateManyAndReturn`, `deleteMany`, `findFirst`). Restore mocks in `afterEach`. No Postgres.
4. Assert the status and the JSON body. For validation, send the bad payload and expect `422` plus no write. For a missing row, expect `404` and `{ detail: 'Task not found.' }`.
5. Cover the new branch and the failure next to it. A list filter needs both an empty query and a rejected query.
6. Run `npm test --prefix backend -- tests/<file>.test.ts`. Record the command in `evidence`.

## Example

```ts
const database = createDatabase('postgresql://test:test@localhost:5432/test');
vi.spyOn(database.todo, 'findFirst').mockResolvedValue(null);
const response = await request(createApp(database)).get('/api/health');
expect(response.status).toBe(200);
expect(response.body).toEqual({ status: 'ok' });
```

Zod failures stay at `422`. Invalid JSON is `{ detail: 'Invalid JSON.' }`. A thrown delegate becomes `{ detail: 'Internal Server Error' }` with status `500`.
