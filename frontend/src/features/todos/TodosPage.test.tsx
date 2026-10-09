import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { useNotice } from '../../hooks/useNotice'
import { todoFixture } from '../../test/todoFixture'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import type { Todo } from './types'
import { TodosPage } from './TodosPage'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: ({ onCreate }: { onCreate: () => void }) => (
    <h1>
      Tasks
      <button type="button" onClick={onCreate}>
        Add task
      </button>
    </h1>
  ),
}))
vi.mock('./components/TodoFilters', () => ({ TodoFilters: () => null }))
vi.mock('./components/TodoList', () => ({
  TodoList: ({
    todos,
    onToggle,
    onEdit,
    onDelete,
    onCreate,
  }: {
    todos: Todo[]
    onToggle: (todo: Todo) => void
    onEdit: (todo: Todo) => void
    onDelete: (todo: Todo) => void
    onCreate: () => void
  }) => (
    <div>
      <p>Task list</p>
      <button type="button" onClick={() => todos[0] && onToggle(todos[0])}>
        Toggle first
      </button>
      <button type="button" onClick={() => todos[0] && onEdit(todos[0])}>
        Edit first
      </button>
      <button type="button" onClick={() => todos[0] && onDelete(todos[0])}>
        Delete first
      </button>
      <button type="button" onClick={onCreate}>
        Create from list
      </button>
    </div>
  ),
}))
vi.mock('./components/TodoEditor', () => ({
  TodoEditor: ({
    onSaved,
    onClose,
  }: {
    onSaved: (message: string) => void
    onClose: () => void
  }) => (
    <div role="dialog" aria-label="Editor">
      <button type="button" onClick={() => onSaved('New task added.')}>
        Save editor
      </button>
      <button type="button" onClick={onClose}>
        Close editor
      </button>
    </div>
  ),
}))
vi.mock('./components/DeleteTodoDialog', () => ({
  DeleteTodoDialog: ({
    onDeleted,
    onClose,
  }: {
    onDeleted: () => void
    onClose: () => void
  }) => (
    <div role="dialog" aria-label="Delete">
      <button type="button" onClick={onDeleted}>
        Confirm delete
      </button>
      <button type="button" onClick={onClose}>
        Close delete
      </button>
    </div>
  ),
}))
vi.mock('../../components/SuccessNotice', () => ({
  SuccessNotice: ({ message }: { message: string }) => <p>{message}</p>,
}))

it('displays a query failure and resets mutation errors before retrying', async () => {
  const user = userEvent.setup()
  const refetch = vi.fn().mockResolvedValue(undefined)
  const reset = vi.fn()
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [],
    isPending: false,
    isFetching: false,
    isError: true,
    error: new Error('The server is unavailable.'),
    refetch,
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: null,
    reset,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(false)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify: vi.fn() })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'The server is unavailable.',
  )
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
  expect(reset).toHaveBeenCalledTimes(1)
  expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
    refetch.mock.invocationCallOrder[0],
  )
})

function pageMocks(options?: {
  busy?: boolean
  completed?: boolean
  failToggle?: boolean
  mutationError?: string
}) {
  const notify = vi.fn()
  const mutateAsync = options?.failToggle
    ? vi.fn().mockRejectedValue(new Error('nope'))
    : vi.fn().mockResolvedValue({
        ...todoFixture,
        completed: options?.completed ?? true,
      })
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [todoFixture],
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: options?.mutationError ? new Error(options.mutationError) : null,
    reset: vi.fn(),
    mutateAsync,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(options?.busy ?? false)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [todoFixture],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  return { notify, mutateAsync }
}

it('celebrates a completed task and reopens an active one', async () => {
  const user = userEvent.setup()
  const completed = pageMocks({ completed: true })
  const { rerender } = render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Toggle first' }))
  await waitFor(() =>
    expect(completed.notify).toHaveBeenCalledWith(
      'Another task complete. Well done!',
    ),
  )
  const active = pageMocks({ completed: false })
  rerender(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Toggle first' }))
  await waitFor(() =>
    expect(active.notify).toHaveBeenCalledWith('Task marked as active.'),
  )
})

it('keeps the page usable when a toggle fails or the list is busy', async () => {
  const user = userEvent.setup()
  const failed = pageMocks({
    failToggle: true,
    mutationError: 'Could not update.',
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent('Could not update.')
  await user.click(screen.getByRole('button', { name: 'Toggle first' }))
  expect(failed.mutateAsync).toHaveBeenCalledWith({
    id: todoFixture.id,
    input: { completed: true },
  })
  const busy = pageMocks({ busy: true })
  render(<TodosPage />)
  await user.click(screen.getAllByRole('button', { name: 'Toggle first' })[1])
  expect(busy.mutateAsync).not.toHaveBeenCalled()
})

it('drives the task query from the search-by-title input', async () => {
  const user = userEvent.setup()
  pageMocks()
  render(<TodosPage />)
  const search = screen.getByLabelText('Search by title')
  await user.type(search, 'Plan')
  expect(search).toHaveValue('Plan')
  await waitFor(() => expect(useTodosQuery).toHaveBeenLastCalledWith('Plan'))
})

it('opens the editor and the delete dialog', async () => {
  const user = userEvent.setup()
  const { notify } = pageMocks()
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Add task' }))
  await user.click(screen.getByRole('button', { name: 'Close editor' }))
  await user.click(screen.getByRole('button', { name: 'Create from list' }))
  expect(screen.getByRole('dialog', { name: 'Editor' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Save editor' }))
  expect(notify).toHaveBeenCalledWith('New task added.')
  expect(
    screen.queryByRole('dialog', { name: 'Editor' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Edit first' }))
  await user.click(screen.getByRole('button', { name: 'Close editor' }))
  await user.click(screen.getByRole('button', { name: 'Delete first' }))
  expect(screen.getByRole('dialog', { name: 'Delete' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Close delete' }))
  expect(
    screen.queryByRole('dialog', { name: 'Delete' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Delete first' }))
  await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
  expect(notify).toHaveBeenCalledWith('Task deleted.')
})
