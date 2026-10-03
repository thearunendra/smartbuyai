// TestingPanel: the temporary coverage split on the admin dashboard, and the
// button that reads the last test run. Delete with TestingPanel.jsx.

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import TestingPanel from './TestingPanel'
import { api } from '../api'

vi.mock('../api', () => ({ api: vi.fn() }))

// One suite above the threshold and one below, so both marks are covered.
vi.mock('../data/testing', () => ({
  TESTING_SNAPSHOT_DATE: '1 Jan 2026',
  SAFE_PERCENT: 90,
  TEST_SUITES: [
    { name: 'Backend', statements: 98.6 },
    { name: 'Frontend', statements: 84.2 }
  ]
}))

beforeEach(() => {
  api.mockReset()
})

test('starts from the snapshot, one part per suite', () => {
  const { container } = render(<TestingPanel />)

  const parts = container.querySelectorAll('.testing-part')

  expect(parts).toHaveLength(2)
  expect(screen.getByText('Backend')).toBeInTheDocument()
  expect(screen.getByText('98.6%')).toBeInTheDocument()
  expect(screen.getByText('84.2%')).toBeInTheDocument()
  expect(screen.getAllByText('1 Jan 2026')).toHaveLength(2)
})

test('a suite at or above the threshold is safe, one below is not', () => {
  const { container } = render(<TestingPanel />)

  const [backend, frontend] = container.querySelectorAll('.testing-part')

  expect(backend.className).toContain('is-safe')
  expect(backend.title).toBe('At or above the 90% threshold')
  expect(frontend.className).toContain('is-low')
  expect(frontend.title).toBe('Below the 90% threshold')
})

test('the button replaces the snapshot with the last run', async () => {
  api.mockResolvedValue({
    backend: { available: true, statements: 99.1, ranAt: '2026-10-03T10:00:00.000Z' },
    frontend: { available: true, statements: 91.4, ranAt: '2026-10-03T10:00:00.000Z' }
  })

  render(<TestingPanel />)
  fireEvent.click(screen.getByRole('button', { name: /run test cases/i }))

  expect(await screen.findByText('99.1%')).toBeInTheDocument()
  expect(screen.getByText('91.4%')).toBeInTheDocument()
  // 84.2 was below the threshold; the real figure is above it.
  expect(screen.queryByText('84.2%')).not.toBeInTheDocument()
  expect(document.querySelectorAll('.testing-part.is-safe')).toHaveLength(2)
})

test('the button is disabled while it reads', async () => {
  let release
  api.mockReturnValue(new Promise((resolve) => { release = resolve }))

  render(<TestingPanel />)

  const button = screen.getByRole('button', { name: /run test cases/i })
  fireEvent.click(button)

  expect(await screen.findByRole('button', { name: /reading results/i })).toBeDisabled()

  release({ backend: { available: true, statements: 99 }, frontend: { available: true, statements: 95 } })

  await waitFor(() => expect(button).not.toBeDisabled())
})

test('says so when the server has no report, keeping the snapshot', async () => {
  api.mockResolvedValue({
    backend: { available: false },
    frontend: { available: false }
  })

  render(<TestingPanel />)
  fireEvent.click(screen.getByRole('button', { name: /run test cases/i }))

  expect(await screen.findByText(/No report on the server/i)).toBeInTheDocument()
  expect(screen.getByText('98.6%')).toBeInTheDocument()
})

test('shows the error when the request fails', async () => {
  api.mockRejectedValue(new Error('Admin access required.'))

  render(<TestingPanel />)
  fireEvent.click(screen.getByRole('button', { name: /run test cases/i }))

  expect(await screen.findByText('Admin access required.')).toBeInTheDocument()
})

test('the committed snapshot is itself in the safe range', async () => {
  const actual = await vi.importActual('../data/testing')

  for (const suite of actual.TEST_SUITES) {
    expect(suite.statements).toBeGreaterThanOrEqual(actual.SAFE_PERCENT)
  }
})
