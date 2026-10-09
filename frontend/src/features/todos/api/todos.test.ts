import { beforeEach, expect, it, vi } from 'vitest'
import { request } from '../../../lib/http'
import { todoFixture } from '../../../test/todoFixture'
import { todosApi } from './todos'

vi.mock('../../../lib/http', () => ({ request: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('passes the abort signal when fetching tasks', async () => {
  const signal = new AbortController().signal
  vi.mocked(request).mockResolvedValue([todoFixture])
  await expect(todosApi.list(signal)).resolves.toEqual([todoFixture])
  expect(request).toHaveBeenCalledWith('/todos', { signal })
})

it('encodes a trimmed search term into the query string', async () => {
  const signal = new AbortController().signal
  vi.mocked(request).mockResolvedValue([todoFixture])
  await expect(todosApi.list(signal, '  Plan a demo  ')).resolves.toEqual([
    todoFixture,
  ])
  expect(request).toHaveBeenCalledWith('/todos?q=Plan+a+demo', { signal })
})

it('omits the query string when the search term is blank', async () => {
  const signal = new AbortController().signal
  vi.mocked(request).mockResolvedValue([todoFixture])
  await expect(todosApi.list(signal, '   ')).resolves.toEqual([todoFixture])
  expect(request).toHaveBeenCalledWith('/todos', { signal })
})

it('sends only writable task fields on creation', async () => {
  vi.mocked(request).mockResolvedValue(todoFixture)
  await expect(todosApi.create(todoFixture)).resolves.toEqual(todoFixture)
  expect(request).toHaveBeenCalledWith('/todos', {
    method: 'POST',
    body: JSON.stringify({
      title: todoFixture.title,
      description: '',
      priority: 'medium',
      due_date: null,
      completed: false,
    }),
  })
})

it('patches and deletes a task by id', async () => {
  vi.mocked(request).mockResolvedValue(todoFixture)
  await expect(
    todosApi.update(todoFixture.id, { title: 'Renamed' }),
  ).resolves.toEqual(todoFixture)
  expect(request).toHaveBeenCalledWith(`/todos/${todoFixture.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: 'Renamed',
      description: undefined,
      priority: undefined,
      due_date: undefined,
      completed: undefined,
    }),
  })
  vi.mocked(request).mockResolvedValue(undefined)
  await expect(todosApi.remove(todoFixture.id)).resolves.toBeUndefined()
  expect(request).toHaveBeenCalledWith(`/todos/${todoFixture.id}`, {
    method: 'DELETE',
  })
})
