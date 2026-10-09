import { renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  createQueryWrapper,
  createTestQueryClient,
} from '../../../test/queryWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import type { TodoInput } from '../types'
import { useCreateTodoMutation } from './useCreateTodoMutation'

vi.mock('../api/todos', () => ({
  todosApi: { create: vi.fn() },
}))

const input: TodoInput = {
  title: 'New',
  description: '',
  priority: 'medium',
  due_date: null,
  completed: false,
}

it('puts the saved task first and drops a stale copy', async () => {
  const saved = { ...todoFixture, id: 9, title: 'New' }
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const client = createTestQueryClient()
  client.setQueryData(todoKeys.list, [
    todoFixture,
    { ...todoFixture, id: 9, title: 'Old' },
  ])
  const { result } = renderHook(() => useCreateTodoMutation(), {
    wrapper: createQueryWrapper(client),
  })
  await result.current.mutateAsync(input)
  await waitFor(() =>
    expect(client.getQueryData(todoKeys.list)).toEqual([saved, todoFixture]),
  )
})

it('starts a list when the cache is empty', async () => {
  const saved = { ...todoFixture, title: 'New' }
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const client = createTestQueryClient()
  const { result } = renderHook(() => useCreateTodoMutation(), {
    wrapper: createQueryWrapper(client),
  })
  await result.current.mutateAsync(input)
  await waitFor(() =>
    expect(client.getQueryData(todoKeys.list)).toEqual([saved]),
  )
})
