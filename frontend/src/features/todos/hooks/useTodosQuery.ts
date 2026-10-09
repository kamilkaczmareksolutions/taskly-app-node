import { useQuery } from '@tanstack/react-query'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'

export function useTodosQuery(q?: string) {
  const term = q?.trim() ?? ''
  return useQuery({
    queryKey: term ? [...todoKeys.list, term] : todoKeys.list,
    queryFn: ({ signal }) =>
      term ? todosApi.list(signal, term) : todosApi.list(signal),
  })
}
