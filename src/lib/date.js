import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
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

export { addDays, isSameDay, differenceInCalendarDays, parseISO }
