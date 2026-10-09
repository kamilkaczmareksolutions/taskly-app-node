import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useNotice } from './useNotice'

afterEach(() => vi.useRealTimers())

it('starts without a notice and exposes a notification callback', () => {
  const { result } = renderHook(() => useNotice())
  expect(result.current.message).toBe('')
  expect(result.current.notify).toEqual(expect.any(Function))
})

it('shows a notice and clears it', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useNotice())
  act(() => result.current.notify('Saved.'))
  expect(result.current.message).toBe('Saved.')
  act(() => vi.advanceTimersByTime(3999))
  act(() => result.current.notify('Saved again.'))
  act(() => vi.advanceTimersByTime(3999))
  expect(result.current.message).toBe('Saved again.')
  act(() => vi.advanceTimersByTime(1))
  expect(result.current.message).toBe('')
})
