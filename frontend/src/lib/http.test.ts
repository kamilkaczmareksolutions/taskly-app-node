import { afterEach, expect, it, vi } from 'vitest'
import { request } from './http'

afterEach(() => vi.restoreAllMocks())

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

it('returns JSON from a successful response', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    jsonResponse(200, [{ id: 1 }]),
  )
  await expect(request<unknown[]>('/todos')).resolves.toEqual([{ id: 1 }])
  expect(globalThis.fetch).toHaveBeenCalledWith('/api/todos', {
    headers: { 'Content-Type': 'application/json' },
  })
})

it('returns undefined for an empty success response', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, null))
  await expect(
    request<void>('/todos/1', { method: 'DELETE' }),
  ).resolves.toBeUndefined()
})

it('explains a validation failure', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    jsonResponse(422, { detail: [] }),
  )
  await expect(request('/todos', { method: 'POST' })).rejects.toThrow(
    'Check the task details: title up to 120 characters, description up to 2000 characters, and a valid due date.',
  )
})

it('uses the server message when one is present', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    jsonResponse(404, { detail: 'Task not found.' }),
  )
  await expect(request('/todos/9')).rejects.toThrow('Task not found.')
})

it('uses a generic message when the body has no string detail', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    jsonResponse(500, { detail: { code: 1 } }),
  )
  await expect(request('/todos')).rejects.toThrow(
    'The operation failed. Please try again.',
  )
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => {
      throw new Error('not json')
    },
  } as unknown as Response)
  await expect(request('/todos')).rejects.toThrow(
    'The operation failed. Please try again.',
  )
})

it('reports a connection failure and rethrows an abort', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
  await expect(request('/todos')).rejects.toThrow(
    'Cannot connect to the server. Please try again.',
  )
  const controller = new AbortController()
  controller.abort()
  const abortError = new DOMException('aborted', 'AbortError')
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortError)
  await expect(request('/todos', { signal: controller.signal })).rejects.toBe(
    abortError,
  )
})
