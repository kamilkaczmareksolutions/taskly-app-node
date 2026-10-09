---
name: frontend-unit-tests
description: Write Vitest and Testing Library tests for React components and hooks, with fetch mocked and a fresh QueryClient. Use for frontend source changes.
---

# Frontend unit tests

Match the existing files under `frontend/src`. Colocate `*.test.ts` or `*.test.tsx`. One source file per step. Run it before the next file. Do not finish while that file is failing.

Render the component or hook under test with React Testing Library. Assert the text, the accessible name, or the value the callback receives. Mock `fetch` or the API module at the boundary. Mock the design system only the way the neighboring test already does. Do not replace the screen under test with a stub component.

## Steps

1. Read the component or hook and its current test. Add a case for the branch the diff touched. Do not add a snapshot.
2. Query by role or label. `getByRole('button', { name: 'Save task' })`, `getByLabelText(/Task title/)`.
3. Drive the UI with `@testing-library/user-event`. Assert the text or the callback result the user sees.
4. For data hooks, render with a fresh `QueryClient` whose queries and mutations have `retry: false`. Use `frontend/src/test/queryWrapper.tsx` when it exists.
5. Mock HTTP at `fetch` with `vi.spyOn(globalThis, 'fetch')` in `http` tests. Existing `todosApi` tests mock `request`. Keep that file's style when you extend it. Do not mock the function you are trying to observe.
6. Design-system components are mocked with `vi.mock('../../../design-system', () => import('../../../design-system/mocks'))` in component tests. Count the `../` from the test file.
7. Run `node scripts/agent/bounded-test.mjs test frontend src/path/to/file.test.tsx`. Record the command in `evidence`.

## Example

A hook that prepends a saved task:

```ts
const client = createTestQueryClient();
client.setQueryData(todoKeys.list, [todoFixture]);
vi.mocked(todosApi.create).mockResolvedValue({ ...todoFixture, id: 9, title: 'New' });
const { result } = renderHook(() => useCreateTodoMutation(), { wrapper: createQueryWrapper(client) });
await result.current.mutateAsync({ title: 'New', description: '', priority: 'medium', due_date: null, completed: false });
expect(client.getQueryData(todoKeys.list)?.[0].title).toBe('New');
```

Skip a file when the diff is a CSS class, a type alias, or a story. Write the reason in the plan.
