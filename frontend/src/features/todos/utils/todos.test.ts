import { describe, expect, it } from 'vitest'
import { formatDate, isOverdue, selectTodos, validateTodo } from './todos'
import type { Todo, TodoInput } from '../types'

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })

  it('sorts undated tasks after dated ones and keeps completed tasks', () => {
    const dated = { ...base, id: 2, due_date: '2026-10-01' }
    const later = { ...base, id: 3, due_date: '2026-12-01' }
    expect(
      selectTodos([base, later, dated], 'all', '', 'due').map(
        (todo) => todo.id,
      ),
    ).toEqual([2, 3, 1])
    expect(
      selectTodos(
        [base, { ...base, id: 4, completed: true }],
        'completed',
        '',
        'newest',
      ),
    ).toEqual([{ ...base, id: 4, completed: true }])
    const tied = {
      ...base,
      id: 5,
      priority: 'high' as const,
      due_date: '2026-10-01',
    }
    const tiedLaterId = { ...tied, id: 6 }
    expect(
      selectTodos([tied, tiedLaterId], 'all', '', 'priority').map(
        (todo) => todo.id,
      ),
    ).toEqual([6, 5])
    expect(
      selectTodos([tied, tiedLaterId], 'all', '', 'due').map((todo) => todo.id),
    ).toEqual([6, 5])
  })
})

const input: TodoInput = {
  title: 'Task',
  description: '',
  priority: 'medium',
  due_date: null,
  completed: false,
}

describe('validateTodo', () => {
  it('requires a title and limits the text lengths', () => {
    expect(validateTodo({ ...input, title: '   ' })).toEqual({
      title: 'Enter a task title.',
    })
    expect(validateTodo({ ...input, title: 'x'.repeat(121) }).title).toBe(
      'The title must be at most 120 characters.',
    )
    expect(
      validateTodo({ ...input, description: 'x'.repeat(2001) }).description,
    ).toBe('The description must be at most 2000 characters.')
  })

  it('checks calendar dates and accepts a valid task', () => {
    expect(validateTodo({ ...input, due_date: '2026-02-30' })).toEqual({
      due_date: 'Enter a valid date.',
    })
    expect(validateTodo({ ...input, due_date: '15 Oct 2026' }).due_date).toBe(
      'Enter a valid date.',
    )
    expect(validateTodo({ ...input, due_date: '2024-02-29' })).toEqual({})
  })
})

describe('dates', () => {
  it('marks an incomplete past due date as overdue', () => {
    expect(isOverdue({ ...base, due_date: '2000-01-01' })).toBe(true)
    expect(isOverdue({ ...base, due_date: '2999-01-01' })).toBe(false)
    expect(
      isOverdue({ ...base, due_date: '2000-01-01', completed: true }),
    ).toBe(false)
    expect(isOverdue(base)).toBe(false)
  })

  it('formats a calendar date for display', () => {
    expect(formatDate('2026-10-15')).toBe('15 Oct 2026')
  })
})
