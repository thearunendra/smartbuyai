// chatGroup boundaries and both formatChatDate branches, at a fixed time.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { chatGroup, formatChatDate } from './dates'

const NOW = new Date(2026, 9, 3, 12, 0)

function daysAgo(days, hour = 9) {
  return new Date(2026, 9, 3 - days, hour, 30)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('chatGroup', () => {
  test.each([
    [0, 'Today'],
    [1, 'Yesterday'],
    [2, 'Previous 7 days'],
    [6, 'Previous 7 days'],
    [7, 'Previous 30 days'],
    [29, 'Previous 30 days'],
    [30, 'Older'],
    [400, 'Older']
  ])('%i days ago -> %s', (days, group) => {
    expect(chatGroup(daysAgo(days))).toBe(group)
  })

  test('counts calendar days, not 24-hour periods', () => {
    // 23:59 yesterday is less than a day ago but still "Yesterday".
    expect(chatGroup(daysAgo(1, 23))).toBe('Yesterday')
  })

  test('future dates count as today', () => {
    expect(chatGroup(new Date(2026, 9, 5))).toBe('Today')
  })

  test('accepts date strings', () => {
    expect(chatGroup(daysAgo(1).toISOString())).toBe('Yesterday')
  })
})

describe('formatChatDate', () => {
  test("today's chats show the time", () => {
    expect(formatChatDate(daysAgo(0))).toMatch(/09:30/)
  })

  test('older chats show the day and month', () => {
    expect(formatChatDate(daysAgo(2))).toBe('1 Oct')
  })
})
