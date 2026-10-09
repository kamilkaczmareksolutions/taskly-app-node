import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AppProviders } from './AppProviders'

it('renders children inside the application providers', () => {
  render(
    <AppProviders>
      <p>Ready</p>
    </AppProviders>,
  )
  expect(screen.getByText('Ready')).toBeVisible()
})
