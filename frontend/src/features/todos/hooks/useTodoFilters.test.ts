import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { useTodoFilters } from './useTodoFilters'

it('filters and sorts the tasks it is given', () => {
  const completed = { ...todoFixture, id: 8, title: 'Done', completed: true }
  const { result } = renderHook(() => useTodoFilters([todoFixture, completed]))
  expect(result.current.visible.map((todo) => todo.id)).toEqual([
    completed.id,
    todoFixture.id,
  ])
  act(() => result.current.setFilter('completed'))
  expect(result.current.visible).toEqual([completed])
  act(() => {
    result.current.setFilter('all')
    result.current.setSearch('done')
    result.current.setSort('priority')
  })
  expect(result.current.visible).toEqual([completed])
  expect(result.current.search).toBe('done')
  expect(result.current.sort).toBe('priority')
})
