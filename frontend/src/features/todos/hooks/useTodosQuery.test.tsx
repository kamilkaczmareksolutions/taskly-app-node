import { waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  createQueryWrapper,
  createTestQueryClient,
} from '../../../test/queryWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todosApi } from '../api/todos'
import { useTodosQuery } from './useTodosQuery'

vi.mock('../api/todos', () => ({
  todosApi: { list: vi.fn() },
}))

it('loads tasks with the request abort signal', async () => {
  vi.mocked(todosApi.list).mockResolvedValue([todoFixture])
  const client = createTestQueryClient()
  const { result } = renderHook(() => useTodosQuery(), {
    wrapper: createQueryWrapper(client),
  })
  await waitFor(() => expect(result.current.data).toEqual([todoFixture]))
  expect(todosApi.list).toHaveBeenCalledWith(expect.any(AbortSignal))
})
