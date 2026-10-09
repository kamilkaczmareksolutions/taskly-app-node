import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  createQueryWrapper,
  createTestQueryClient,
} from '../../../test/queryWrapper'
import { todosApi } from '../api/todos'
import { useCreateTodoMutation } from './useCreateTodoMutation'
import { useTodosBusy } from './useTodosBusy'

vi.mock('../api/todos', () => ({
  todosApi: { create: vi.fn() },
}))

it('is busy while a task mutation is in flight', async () => {
  vi.mocked(todosApi.create).mockImplementation(() => new Promise(() => {}))
  const client = createTestQueryClient()
  const { result } = renderHook(
    () => ({ busy: useTodosBusy(), create: useCreateTodoMutation() }),
    { wrapper: createQueryWrapper(client) },
  )
  expect(result.current.busy).toBe(false)
  act(() => {
    result.current.create.mutate({
      title: 'New',
      description: '',
      priority: 'medium',
      due_date: null,
      completed: false,
    })
  })
  await waitFor(() => expect(result.current.busy).toBe(true))
})
