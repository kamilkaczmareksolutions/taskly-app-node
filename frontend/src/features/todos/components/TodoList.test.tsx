import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { TodoList } from './TodoList'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('./TodoEmptyState', () => ({
  TodoEmptyState: () => <p>Empty task list</p>,
}))
vi.mock('./TodoItem', () => ({
  TodoItem: ({
    todo,
    onToggle,
    onEdit,
    onDelete,
  }: {
    todo: { title: string }
    onToggle: () => void
    onEdit: () => void
    onDelete: () => void
  }) => (
    <li>
      Task
      <button type="button" onClick={onToggle}>
        Toggle {todo.title}
      </button>
      <button type="button" onClick={onEdit}>
        Edit {todo.title}
      </button>
      <button type="button" onClick={onDelete}>
        Delete {todo.title}
      </button>
    </li>
  ),
}))

it('shows loading feedback before showing an empty list', () => {
  const props = {
    todos: [],
    hasTodos: false,
    failed: false,
    busy: false,
    onCreate: vi.fn(),
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
  const { rerender } = render(<TodoList {...props} loading />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading your tasks…')
  expect(screen.queryByText('Empty task list')).not.toBeInTheDocument()
  rerender(<TodoList {...props} loading={false} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('Empty task list')).toBeVisible()
})

it('shows a failure and the tasks that did load', async () => {
  const props = {
    todos: [],
    hasTodos: false,
    loading: false,
    failed: true,
    busy: false,
    onCreate: vi.fn(),
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
  const { rerender } = render(<TodoList {...props} />)
  expect(
    screen.getByRole('heading', {
      name: 'The task list is temporarily unavailable',
    }),
  ).toBeVisible()
  rerender(
    <TodoList
      {...props}
      failed={false}
      hasTodos
      todos={[todoFixture, { ...todoFixture, id: 2, title: 'Second task' }]}
    />,
  )
  expect(screen.getAllByText('Task')).toHaveLength(2)
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: `Toggle ${todoFixture.title}` }),
  )
  await user.click(
    screen.getByRole('button', { name: `Edit ${todoFixture.title}` }),
  )
  await user.click(
    screen.getByRole('button', { name: `Delete ${todoFixture.title}` }),
  )
  expect(props.onToggle).toHaveBeenCalledWith(todoFixture)
  expect(props.onEdit).toHaveBeenCalledWith(todoFixture)
  expect(props.onDelete).toHaveBeenCalledWith(todoFixture)
})
