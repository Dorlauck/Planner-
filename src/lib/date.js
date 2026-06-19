import {
  format,
  addDays,
  addMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  isSameDay,
  isSameMonth,
  parseISO,
  differenceInCalendarDays,
} from 'date-fns'
import { fr } from 'date-fns/locale'

// Local ISO date (YYYY-MM-DD) without timezone shifting.
export function toISODate(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy-MM-dd')
}

export function todayISO() {
  return toISODate(new Date())
}

export function prettyDate(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'EEEE d MMMM', { locale: fr })
}

export function shortDate(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd MMM', { locale: fr })
}

// Returns the 7 days of the week containing `date` (Monday-first).
export function weekDays(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  const start = startOfWeek(d, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function dayLabel(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'EEEEEE', { locale: fr }) // 2-letter day
}

export function dayNumber(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd')
}

// JS getDay(): 0=Sun..6=Sat — matches our active_days storage.
export function weekdayIndex(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return d.getDay()
}

// --- Month helpers (for the planning board) ---------------------------

export function monthStart(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return startOfMonth(d)
}

export function monthLabel(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMMM yyyy', { locale: fr })
}

// All Monday-first weeks that intersect the given month.
// Returns an array of weeks; each week = { start: Date, days: Date[] }.
export function weeksOfMonth(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  const starts = eachWeekOfInterval(
    { start: startOfMonth(d), end: endOfMonth(d) },
    { weekStartsOn: 1 }
  )
  return starts.map((start) => ({
    start,
    days: Array.from({ length: 7 }, (_, i) => addDays(start, i)),
  }))
}

export {
  addDays,
  addMonths,
  isSameDay,
  isSameMonth,
  differenceInCalendarDays,
  parseISO,
}
