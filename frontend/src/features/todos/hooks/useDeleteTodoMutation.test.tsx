import { renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  createQueryWrapper,
  createTestQueryClient,
} from '../../../test/queryWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useDeleteTodoMutation } from './useDeleteTodoMutation'

vi.mock('../api/todos', () => ({
  todosApi: { remove: vi.fn() },
}))

it('removes the deleted task from the cache', async () => {
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const client = createTestQueryClient()
  const other = { ...todoFixture, id: 8 }
  client.setQueryData(todoKeys.list, [todoFixture, other])
  const { result } = renderHook(() => useDeleteTodoMutation(), {
    wrapper: createQueryWrapper(client),
  })
  await result.current.mutateAsync(todoFixture.id)
  await waitFor(() =>
    expect(client.getQueryData(todoKeys.list)).toEqual([other]),
  )
})

it('does nothing when the cache has no list', async () => {
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const client = createTestQueryClient()
  const { result } = renderHook(() => useDeleteTodoMutation(), {
    wrapper: createQueryWrapper(client),
  })
  await result.current.mutateAsync(todoFixture.id)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(client.getQueryData(todoKeys.list)).toBeUndefined()
})
