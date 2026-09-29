import { describe, expect, it } from 'vitest'
import {
  assessTrip,
  buildOutlook,
  countDaysInWindow,
  entryBalance,
  findAllowanceDate,
  findEarliestEntry,
  inclusiveDays,
  isPlannedStayCompliant,
  mergeStays,
  parseDate,
  toInputDate,
} from './schengen'

const day = (value: string) => {
  const result = parseDate(value)
  if (result === null) throw new Error(`Invalid test date: ${value}`)
  return result
}

describe('Schengen rolling-window calculations', () => {
  it('counts entry and exit dates inclusively', () => {
    expect(inclusiveDays(day('2026-01-01'), day('2026-01-10'))).toBe(10)
  })

  it('does not double-count overlapping stays', () => {
    const stays = mergeStays([
      { entry: day('2026-01-01'), exit: day('2026-01-10') },
      { entry: day('2026-01-05'), exit: day('2026-01-15') },
    ])
    expect(countDaysInWindow(stays, day('2026-01-01'), day('2026-01-31'))).toBe(15)
  })

  it('excludes days outside the rolling 180-day window', () => {
    const history = [{ entry: day('2025-01-01'), exit: day('2025-01-10') }]
    expect(countDaysInWindow(history, day('2026-01-01') - 179, day('2026-01-01'))).toBe(0)
  })

  it('rejects a 91st occupied day', () => {
    const result = isPlannedStayCompliant([], day('2026-01-01'), day('2026-04-01'))
    expect(result.compliant).toBe(false)
    expect(toInputDate(result.firstInvalidDay!)).toBe('2026-04-01')
  })

  it('allows re-entry once one old day leaves the window', () => {
    const history = [{ entry: day('2026-01-01'), exit: day('2026-03-31') }]
    const earliest = findEarliestEntry(history, day('2026-04-01'), 1)
    expect(toInputDate(earliest!)).toBe('2026-06-30')
  })

  it('finds the same earliest date for a new compliant 90-day stay', () => {
    const history = [{ entry: day('2026-01-01'), exit: day('2026-03-31') }]
    const earliest = findEarliestEntry(history, day('2026-04-01'), 90)
    expect(toInputDate(earliest!)).toBe('2026-06-30')
  })

  it('reports the selected plan and departure usage', () => {
    const history = [{ entry: day('2026-01-01'), exit: day('2026-01-30') }]
    const result = assessTrip(history, day('2026-03-01'), day('2026-03-14'))
    expect(result.usedBeforeEntry).toBe(30)
    expect(result.availableOnEntry).toBe(60)
    expect(result.plannedDays).toBe(14)
    expect(result.usedOnDeparture).toBe(44)
    expect(result.isCompliant).toBe(true)
  })

  it('projects the entry balance after a committed 14-day trip', () => {
    const committed = [{ entry: day('2026-09-29'), exit: day('2026-10-12') }]
    expect(entryBalance(committed, day('2026-10-13'))).toBe(76)
    expect(buildOutlook(committed, day('2026-10-13'), 1)[0].maxContinuousDays).toBe(76)
  })

  it('finds future allowance milestones across a full-year outlook', () => {
    const committed = [{ entry: day('2026-01-01'), exit: day('2026-03-31') }]
    const outlook = buildOutlook(committed, day('2026-04-01'), 366)
    expect(outlook).toHaveLength(366)
    expect(toInputDate(findAllowanceDate(outlook, 1)!)).toBe('2026-06-30')
    expect(toInputDate(findAllowanceDate(outlook, 90)!)).toBe('2026-06-30')
  })
})
