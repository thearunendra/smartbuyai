// TestingPanel: the temporary white-box test summary on the admin dashboard.
// Delete with TestingPanel.jsx.

import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import TestingPanel from './TestingPanel'
import {
  BUGS_FOUND,
  COVERAGE_THRESHOLDS,
  TESTING_SNAPSHOT_DATE,
  TEST_SUITES
} from '../data/testing'

test('the header totals every suite', () => {
  const { container } = render(<TestingPanel />)

  const total = TEST_SUITES.reduce((sum, suite) => sum + suite.tests, 0)

  // The total appears in the header and again in the intro paragraph.
  expect(container.querySelector('.panel-meta').textContent).toContain(
    `${total} tests`
  )
  expect(container.querySelector('.panel-meta').textContent).toContain(
    TESTING_SNAPSHOT_DATE
  )
  expect(screen.getByText(new RegExp(`${total} tests across`))).toBeInTheDocument()
})

test('every suite shows its stack and test count', () => {
  render(<TestingPanel />)

  for (const suite of TEST_SUITES) {
    expect(
      screen.getByRole('heading', { name: suite.name, level: 3 })
    ).toBeInTheDocument()
    expect(screen.getByText(suite.stack)).toBeInTheDocument()
    expect(
      screen.getByText(`${suite.tests} tests in ${suite.files} files`)
    ).toBeInTheDocument()
  }
})

test('each metric bar is filled to its percentage and names its threshold', () => {
  const { container } = render(<TestingPanel />)

  const fills = [...container.querySelectorAll('.bar-fill')]
  const expected = TEST_SUITES.flatMap((suite) =>
    ['statements', 'branches', 'functions', 'lines'].map(
      (key) => `${suite.coverage[key].percent}%`
    )
  )

  expect(fills.map((fill) => fill.style.width)).toEqual(expected)

  const tracks = [...container.querySelectorAll('.bar-track')]
  expect(tracks[0].title).toContain(`${COVERAGE_THRESHOLDS.statements}% required`)
})

test('covered/total counts are shown for each metric', () => {
  render(<TestingPanel />)

  const { statements } = TEST_SUITES[0].coverage
  expect(
    screen.getByText(`${statements.covered}/${statements.total}`)
  ).toBeInTheDocument()
})

test('every defect the tests found is listed', () => {
  render(<TestingPanel />)

  expect(
    screen.getByRole('heading', { name: /defects these tests found/i })
  ).toBeInTheDocument()

  for (const bug of BUGS_FOUND) {
    expect(screen.getByText(bug.title)).toBeInTheDocument()
  }
})

test('says how to reproduce the run', () => {
  render(<TestingPanel />)

  expect(screen.getByText('npm run test:coverage')).toBeInTheDocument()
  expect(screen.getByText('coverage/index.html')).toBeInTheDocument()
})
