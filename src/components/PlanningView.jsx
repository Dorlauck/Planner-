import { useMemo, useState } from 'react'
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  startOfQuarter,
  addQuarters,
  getQuarter,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { TASK_COLORS } from '../lib/palette'

const iso = (d) => format(d, 'yyyy-MM-dd')
const monday = (d) => startOfWeek(d, { weekStartsOn: 1 })
const firstOfMonth = (d) => startOfMonth(d)

const VIEWS = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
]

// A draggable task chip.
function Chip({ task, onOpen }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onOpen?.(task.id)}
      className="group flex items-center gap-2 bg-white rounded-lg shadow-card px-2.5 py-1.5 cursor-grab active:cursor-grabbing hover:shadow-soft transition"
      title={task.title}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/5"
        style={{ backgroundColor: task.color || '#E7E0D8' }}
      />
      <span
        className={`text-[13px] truncate ${task.status === 'done' ? 'line-through text-dusk-400' : 'text-dusk-800'}`}
      >
        {task.title}
      </span>
    </div>
  )
}

// A drop zone (day / week / month bucket, or the backlog pool).
function Drop({ onDropTask, className, children }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!over) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDropTask(id)
      }}
      className={`${className} ${over ? 'ring-2 ring-peach-300 bg-peach-50/60' : ''} transition`}
    >
      {children}
    </div>
  )
}

export default function PlanningView({ tasks, legend = {}, onClose, onSchedule, onOpenTask }) {
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => new Date())

  const active = tasks.filter((t) => t.status !== 'done' || t.task_date || t.week_start || t.plan_month)

  // ----- Backlog pool (what's left to refine at this level) --------------
  const pool = useMemo(() => {
    if (view === 'quarter') return tasks.filter((t) => !t.plan_month && t.status !== 'done')
    if (view === 'month') {
      const m = iso(firstOfMonth(cursor))
      return tasks.filter((t) => t.plan_month === m && !t.week_start && t.status !== 'done')
    }
    const w = iso(monday(cursor))
    return tasks.filter((t) => t.week_start === w && !t.task_date && t.status !== 'done')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, view, cursor])

  const poolGroups = useMemo(() => {
    const order = [...TASK_COLORS, null]
    return order
      .map((c) => ({ color: c, items: pool.filter((t) => (t.color ?? null) === c) }))
      .filter((g) => g.items.length)
  }, [pool])

  // ----- Drop handlers ---------------------------------------------------
  const dropOnDay = (day) => (id) =>
    onSchedule(id, { task_date: iso(day), week_start: iso(monday(day)), plan_month: iso(firstOfMonth(day)) })
  const dropOnWeek = (mon) => (id) =>
    onSchedule(id, { week_start: iso(mon), plan_month: iso(firstOfMonth(mon)), task_date: null })
  const dropOnMonth = (mth) => (id) =>
    onSchedule(id, { plan_month: iso(mth), week_start: null, task_date: null })

  const dropOnPool = (id) => {
    if (view === 'quarter') onSchedule(id, { plan_month: null, week_start: null, task_date: null })
    else if (view === 'month') onSchedule(id, { week_start: null, task_date: null })
    else onSchedule(id, { task_date: null })
  }

  // ----- Period label + navigation --------------------------------------
  const step = (dir) =>
    setCursor((c) => (view === 'week' ? addWeeks(c, dir) : view === 'month' ? addMonths(c, dir) : addQuarters(c, dir)))

  const periodLabel =
    view === 'week'
      ? `Semaine du ${format(monday(cursor), 'd MMM', { locale: fr })}`
      : view === 'month'
        ? format(cursor, 'MMMM yyyy', { locale: fr })
        : `T${getQuarter(cursor)} ${format(cursor, 'yyyy')}`

  // ----- Calendar buckets -----------------------------------------------
  let calendar = null

  if (view === 'week') {
    const days = eachDayOfInterval({ start: monday(cursor), end: endOfWeek(cursor, { weekStartsOn: 1 }) })
    calendar = (
      <div className="grid grid-cols-7 gap-2 h-full">
        {days.map((day) => {
          const items = tasks.filter((t) => t.task_date === iso(day))
          return (
            <Drop
              key={iso(day)}
              onDropTask={dropOnDay(day)}
              className="flex flex-col bg-white/60 rounded-xl border border-peach-100 p-2 min-h-0"
            >
              <p className="text-[11px] font-semibold text-dusk-500 mb-2 capitalize">
                {format(day, 'EEE d', { locale: fr })}
              </p>
              <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5">
                {items.map((t) => (
                  <Chip key={t.id} task={t} onOpen={onOpenTask} />
                ))}
              </div>
            </Drop>
          )
        })}
      </div>
    )
  } else if (view === 'month') {
    const weeks = eachWeekOfInterval(
      { start: startOfMonth(cursor), end: endOfMonth(cursor) },
      { weekStartsOn: 1 },
    )
    calendar = (
      <div className="flex flex-col gap-2 h-full overflow-y-auto scrollbar-thin">
        {weeks.map((mon) => {
          const items = tasks.filter((t) => t.week_start === iso(mon))
          return (
            <Drop
              key={iso(mon)}
              onDropTask={dropOnWeek(mon)}
              className="bg-white/60 rounded-xl border border-peach-100 p-3"
            >
              <p className="text-[11px] font-semibold text-dusk-500 mb-2">
                Semaine du {format(mon, 'd MMM', { locale: fr })}
              </p>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {items.map((t) => (
                  <Chip key={t.id} task={t} onOpen={onOpenTask} />
                ))}
              </div>
            </Drop>
          )
        })}
      </div>
    )
  } else {
    const months = [0, 1, 2].map((i) => addMonths(startOfQuarter(cursor), i))
    calendar = (
      <div className="grid grid-cols-3 gap-3 h-full">
        {months.map((mth) => {
          const items = tasks.filter((t) => t.plan_month === iso(mth))
          return (
            <Drop
              key={iso(mth)}
              onDropTask={dropOnMonth(mth)}
              className="flex flex-col bg-white/60 rounded-xl border border-peach-100 p-3 min-h-0"
            >
              <p className="text-xs font-semibold text-dusk-600 mb-2 capitalize">
                {format(mth, 'MMMM', { locale: fr })}
              </p>
              <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5">
                {items.map((t) => (
                  <Chip key={t.id} task={t} onOpen={onOpenTask} />
                ))}
              </div>
            </Drop>
          )
        })}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-30 bg-sunrise flex flex-col animate-overlay-in">
      {/* Header */}
      <header className="shrink-0 px-6 py-4 bg-white/70 backdrop-blur border-b border-peach-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="font-serif text-xl font-semibold text-dusk-900">📅 Planning</h2>
          <div className="flex gap-1 p-1 bg-cream rounded-xl">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition active:scale-95 ${
                  view === v.id ? 'bg-sunrise-warm text-white shadow-soft' : 'text-dusk-500 hover:bg-peach-50'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => step(-1)} className="w-8 h-8 rounded-lg text-dusk-500 hover:bg-peach-50 transition">
            ‹
          </button>
          <span className="text-sm font-medium text-dusk-700 capitalize min-w-[150px] text-center">
            {periodLabel}
          </span>
          <button onClick={() => step(1)} className="w-8 h-8 rounded-lg text-dusk-500 hover:bg-peach-50 transition">
            ›
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="ml-1 px-3 py-1.5 rounded-lg text-xs text-dusk-500 hover:bg-peach-50 transition"
          >
            Aujourd'hui
          </button>
          <button
            onClick={onClose}
            className="ml-2 px-4 py-2 rounded-full bg-dusk-900 text-white text-sm font-medium active:scale-95 transition"
          >
            Fermer
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Pool */}
        <Drop
          onDropTask={dropOnPool}
          className="w-72 shrink-0 border-r border-peach-100 bg-white/40 p-4 overflow-y-auto scrollbar-thin"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-dusk-400 mb-3">
            {view === 'quarter'
              ? 'À planifier'
              : view === 'month'
                ? 'À répartir dans les semaines'
                : 'À répartir dans les jours'}
          </p>
          {pool.length === 0 ? (
            <p className="text-sm text-dusk-400">
              Rien à placer ici. {view !== 'quarter' && 'Reviens à la vue précédente pour en amener.'}
            </p>
          ) : (
            <div className="space-y-4">
              {poolGroups.map((g) => (
                <div key={g.color ?? 'none'}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/5"
                      style={{ backgroundColor: g.color || '#E7E0D8' }}
                    />
                    <span className="text-[11px] font-medium text-dusk-500">
                      {(g.color && legend[g.color]) || (g.color ? 'Sans nom' : 'Sans couleur')}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {g.items.map((t) => (
                      <Chip key={t.id} task={t} onOpen={onOpenTask} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Drop>

        {/* Calendar */}
        <div className="flex-1 p-4 overflow-hidden">{calendar}</div>
      </div>
    </div>
  )
}
