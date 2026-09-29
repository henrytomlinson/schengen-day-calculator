export const DAY_MS = 86_400_000
export const MAX_STAY_DAYS = 90
export const WINDOW_DAYS = 180

export interface Stay {
  entry: number
  exit: number
}

export interface Assessment {
  usedBeforeEntry: number
  availableOnEntry: number
  plannedDays: number
  usedOnDeparture: number
  isCompliant: boolean
  firstInvalidDay: number | null
  maxContinuousDays: number
  maxContinuousExit: number | null
  earliestOneDayEntry: number | null
  earliestFullTripEntry: number | null
}

/** Converts YYYY-MM-DD into an integer UTC day, avoiding local timezone/DST errors. */
export function parseDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const date = Number(match[3])
  const utc = Date.UTC(year, month - 1, date)
  const parsed = new Date(utc)

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== date
  ) {
    return null
  }

  return Math.floor(utc / DAY_MS)
}

export function toInputDate(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export function todayUtcDay(): number {
  const now = new Date()
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS)
}

export function formatDay(day: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(day * DAY_MS))
}

export function inclusiveDays(start: number, end: number): number {
  return end - start + 1
}

/** Merging prevents overlapping stays from being counted twice. */
export function mergeStays(stays: Stay[]): Stay[] {
  const sorted = stays
    .filter((stay) => stay.entry <= stay.exit)
    .map((stay) => ({ ...stay }))
    .sort((a, b) => a.entry - b.entry || a.exit - b.exit)

  const merged: Stay[] = []
  for (const stay of sorted) {
    const previous = merged.at(-1)
    if (!previous || stay.entry > previous.exit + 1) {
      merged.push(stay)
    } else {
      previous.exit = Math.max(previous.exit, stay.exit)
    }
  }
  return merged
}

export function countDaysInWindow(stays: Stay[], windowStart: number, windowEnd: number): number {
  if (windowStart > windowEnd) return 0

  return mergeStays(stays).reduce((total, stay) => {
    const start = Math.max(stay.entry, windowStart)
    const end = Math.min(stay.exit, windowEnd)
    return total + (start <= end ? inclusiveDays(start, end) : 0)
  }, 0)
}

export function usedOnDay(stays: Stay[], day: number): number {
  return countDaysInWindow(stays, day - (WINDOW_DAYS - 1), day)
}

export function isPlannedStayCompliant(
  history: Stay[],
  entry: number,
  exit: number,
): { compliant: boolean; firstInvalidDay: number | null } {
  if (entry > exit) return { compliant: false, firstInvalidDay: entry }

  for (let day = entry; day <= exit; day += 1) {
    const occupancy = [...history, { entry, exit: day }]
    if (usedOnDay(occupancy, day) > MAX_STAY_DAYS) {
      return { compliant: false, firstInvalidDay: day }
    }
  }

  return { compliant: true, firstInvalidDay: null }
}

export function maxContinuousStay(history: Stay[], entry: number): number {
  let allowed = 0
  for (let length = 1; length <= MAX_STAY_DAYS; length += 1) {
    if (!isPlannedStayCompliant(history, entry, entry + length - 1).compliant) break
    allowed = length
  }
  return allowed
}

export function findEarliestEntry(
  history: Stay[],
  from: number,
  length = 1,
  searchHorizonDays = 3 * 366,
): number | null {
  for (let candidate = from; candidate <= from + searchHorizonDays; candidate += 1) {
    if (isPlannedStayCompliant(history, candidate, candidate + length - 1).compliant) {
      return candidate
    }
  }
  return null
}

export function assessTrip(history: Stay[], entry: number, exit: number): Assessment {
  const plannedDays = inclusiveDays(entry, exit)
  // The entry day itself will be day one, so only the preceding 179 days are already used.
  const usedBeforeEntry = countDaysInWindow(
    history,
    entry - (WINDOW_DAYS - 1),
    entry - 1,
  )
  const compliance = isPlannedStayCompliant(history, entry, exit)
  const maxDays = maxContinuousStay(history, entry)

  return {
    usedBeforeEntry,
    availableOnEntry: Math.max(0, MAX_STAY_DAYS - usedBeforeEntry),
    plannedDays,
    usedOnDeparture: usedOnDay([...history, { entry, exit }], exit),
    isCompliant: compliance.compliant,
    firstInvalidDay: compliance.firstInvalidDay,
    maxContinuousDays: maxDays,
    maxContinuousExit: maxDays > 0 ? entry + maxDays - 1 : null,
    earliestOneDayEntry: findEarliestEntry(history, entry, 1),
    earliestFullTripEntry: findEarliestEntry(history, entry, plannedDays),
  }
}
