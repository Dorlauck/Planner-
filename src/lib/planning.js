import { getISODay, parseISO } from 'date-fns'

// ISO weekday: Monday = 1 … Sunday = 7
export const WEEKDAYS = [
  { day: 1, label: 'Lun' },
  { day: 2, label: 'Mar' },
  { day: 3, label: 'Mer' },
  { day: 4, label: 'Jeu' },
  { day: 5, label: 'Ven' },
  { day: 6, label: 'Sam' },
  { day: 7, label: 'Dim' },
]

export function recurLabel(recur) {
  if (!recur) return null
  if (recur.type === 'daily') return 'Chaque jour'
  if (recur.type === 'weekly') return `Chaque ${WEEKDAYS.find((w) => w.day === recur.weekday)?.label ?? '?'}`
  return null
}

function matchesRecur(recur, dateObj) {
  if (!recur) return false
  if (recur.type === 'daily') return true
  if (recur.type === 'weekly') return getISODay(dateObj) === recur.weekday
  return false
}

// Flatten the project into plannable items = actionable subtasks of *unblocked*
// tasks (or the task itself if it has none). Milestones are excluded.
export function buildItems(tasks, states) {
  const out = []
  for (const t of tasks) {
    if (t.is_milestone) continue
    const blocked = states?.get(t.id)?.blocked ?? false
    const list = Array.isArray(t.checklist) ? t.checklist : []
    if (list.length) {
      for (const c of list) {
        out.push({
          key: `s:${t.id}:${c.id}`,
          kind: 'sub',
          taskId: t.id,
          subId: c.id,
          text: c.text,
          color: t.color,
          taskTitle: t.title,
          recur: c.recur || null,
          date: c.date || null,
          done: !!c.done,
          doneDates: Array.isArray(c.done_dates) ? c.done_dates : [],
          blocked,
        })
      }
    } else {
      out.push({
        key: `t:${t.id}`,
        kind: 'task',
        taskId: t.id,
        text: t.title,
        color: t.color,
        taskTitle: null,
        recur: null,
        date: t.task_date || null,
        done: t.status === 'done',
        doneDates: [],
        blocked,
      })
    }
  }
  return out
}

// Undated, not-done, unblocked, non-recurring items (the backlog).
export const poolItems = (items) => items.filter((i) => !i.recur && !i.date && !i.done && !i.blocked)

// Dated in the past and not done (non-recurring only).
export const overdueItems = (items, today) =>
  items.filter((i) => !i.recur && i.date && i.date < today && !i.done)

// Everything that lands on a given day: one-off items with that date, plus
// recurring items whose rule matches — materialised with per-day completion.
export function dayItems(items, dayISO) {
  const d = parseISO(dayISO)
  const res = []
  for (const item of items) {
    if (item.recur) {
      if (matchesRecur(item.recur, d)) {
        res.push({ ...item, date: dayISO, done: item.doneDates.includes(dayISO), instanceDate: dayISO })
      }
    } else if (item.date === dayISO) {
      res.push({ ...item, instanceDate: dayISO })
    }
  }
  return res
}

// ---- Checklist mutations (return a new checklist array) -----------------
const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

export function setSubDate(checklist, subId, dateISO) {
  return checklist.map((c) => (c.id === subId ? { ...c, date: dateISO } : c))
}

export function toggleSub(checklist, subId, dayISO) {
  return checklist.map((c) => {
    if (c.id !== subId) return c
    if (c.recur) return { ...c, done_dates: toggleIn(Array.isArray(c.done_dates) ? c.done_dates : [], dayISO) }
    return { ...c, done: !c.done }
  })
}

export function setSubRecur(checklist, subId, recur) {
  return checklist.map((c) => (c.id === subId ? { ...c, recur, done_dates: recur ? c.done_dates || [] : [] } : c))
}
