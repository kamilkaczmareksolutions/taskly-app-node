import { renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  createQueryWrapper,
  createTestQueryClient,
} from '../../../test/queryWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useUpdateTodoMutation } from './useUpdateTodoMutation'

vi.mock('../api/todos', () => ({
  todosApi: { update: vi.fn() },
}))

it('replaces the matching task in the cache', async () => {
  const saved = { ...todoFixture, completed: true }
  vi.mocked(todosApi.update).mockResolvedValue(saved)
  const client = createTestQueryClient()
  const other = { ...todoFixture, id: 8, title: 'Other' }
  client.setQueryData(todoKeys.list, [todoFixture, other])
  const { result } = renderHook(() => useUpdateTodoMutation(), {
    wrapper: createQueryWrapper(client),
  })
  await result.current.mutateAsync({
    id: todoFixture.id,
    input: { completed: true },
  })
  await waitFor(() =>
    expect(client.getQueryData(todoKeys.list)).toEqual([saved, other]),
  )
  expect(todosApi.update).toHaveBeenCalledWith(todoFixture.id, {
    completed: true,
  })
})

it('leaves an empty cache empty', async () => {
  vi.mocked(todosApi.update).mockResolvedValue({
    ...todoFixture,
    completed: true,
  })
  const client = createTestQueryClient()
  const { result } = renderHook(() => useUpdateTodoMutation(), {
    wrapper: createQueryWrapper(client),
  })
  await result.current.mutateAsync({
    id: todoFixture.id,
    input: { completed: true },
  })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(client.getQueryData(todoKeys.list)).toBeUndefined()
})
