import { useEffect, useState } from 'react'
import { Alert, Button } from '../../design-system'
import { SuccessNotice } from '../../components/SuccessNotice'
import { useNotice } from '../../hooks/useNotice'
import { DeleteTodoDialog } from './components/DeleteTodoDialog'
import { TodoEditor } from './components/TodoEditor'
import { TodoFilters } from './components/TodoFilters'
import { TodoList } from './components/TodoList'
import { TodosHeader } from './components/TodosHeader'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import type { Todo } from './types'
import { selectTodos } from './utils/todos'

export function TodosPage() {
  const [search, setSearch] = useState('')
  const [serverQuery, setServerQuery] = useState('')
  useEffect(() => {
    const timeout = window.setTimeout(() => setServerQuery(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])
  const todosQuery = useTodosQuery(serverQuery)
  const todos = todosQuery.data ?? []
  const filters = useTodoFilters(todos)
  const toggleTodo = useUpdateTodoMutation()
  const busy = useTodosBusy()
  const { message, notify } = useNotice()
  const [editor, setEditor] = useState<Todo | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Todo | null>(null)
  const error = toggleTodo.error ?? todosQuery.error

  async function toggle(todo: Todo) {
    if (busy) return
    try {
      const saved = await toggleTodo.mutateAsync({
        id: todo.id,
        input: { completed: !todo.completed },
      })
      notify(
        saved.completed
          ? 'Another task complete. Well done!'
          : 'Task marked as active.',
      )
    } catch {
      // Display the mutation error in the page alert.
    }
  }
  async function retry() {
    toggleTodo.reset()
    await todosQuery.refetch()
  }

  return (
    <>
      <main id="main" className="page-layout">
        <TodosHeader
          disabled={todosQuery.isPending || busy}
          onCreate={() => setEditor('new')}
        />
        <TodoFilters
          filter={filters.filter}
          search={search}
          sort={filters.sort}
          onFilterChange={filters.setFilter}
          onSearchChange={setSearch}
          onSortChange={filters.setSort}
        />
        {error && (
          <Alert variant="warning">
            {error.message}
            <Button
              variant="secondary"
              disabled={todosQuery.isFetching || busy}
              onClick={() => void retry()}
            >
              Try again
            </Button>
          </Alert>
        )}
        <TodoList
          todos={selectTodos(todos, filters.filter, search, filters.sort)}
          hasTodos={todos.length > 0}
          loading={todosQuery.isPending}
          failed={todosQuery.isError}
          busy={busy}
          onCreate={() => setEditor('new')}
          onToggle={(todo) => void toggle(todo)}
          onEdit={setEditor}
          onDelete={setDeleting}
        />
      </main>
      <SuccessNotice message={message} />
      {editor && (
        <TodoEditor
          todo={editor}
          busy={busy}
          onClose={() => setEditor(null)}
          onSaved={(notice) => {
            setEditor(null)
            notify(notice)
          }}
        />
      )}
      {deleting && (
        <DeleteTodoDialog
          todo={deleting}
          busy={busy}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            notify('Task deleted.')
          }}
        />
      )}
    </>
  )
}
