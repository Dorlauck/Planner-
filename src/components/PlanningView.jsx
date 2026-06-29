import { useMemo, useState } from 'react'
import {
  endOfWeek,
  addWeeks,
  startOfWeek,
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
import { ChevronLeft, ChevronRight } from './icons'

const iso = (d) => format(d, 'yyyy-MM-dd')
const monday = (d) => startOfWeek(d, { weekStartsOn: 1 })
const firstOfMonth = (d) => startOfMonth(d)

const VIEWS = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
]

function Chip({ task, onOpen }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onOpen?.(task.id)}
      className="flex items-center gap-2 bg-surface border border-line rounded-lg px-2.5 py-1.5 cursor-grab active:cursor-grabbing hover:border-faint transition"
      title={task.title}
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: task.color || 'rgb(var(--faint))' }} />
      <span className={`text-[13px] truncate ${task.status === 'done' ? 'line-through text-faint' : 'text-fg'}`}>
        {task.title}
      </span>
    </div>
  )
}

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
      className={`${className} ${over ? 'ring-2 ring-accent/40 bg-surface2' : ''} transition`}
    >
      {children}
    </div>
  )
}

export default function PlanningView({ tasks, legend = {}, onClose, onSchedule, onOpenTask }) {
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => new Date())

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

  const dropOnDay = (day) => (id) =>
    onSchedule(id, { task_date: iso(day), week_start: iso(monday(day)), plan_month: iso(firstOfMonth(day)) })
  const dropOnWeek = (mon) => (id) =>
    onSchedule(id, { week_start: iso(mon), plan_month: iso(firstOfMonth(mon)), task_date: null })
  const dropOnMonth = (mth) => (id) => onSchedule(id, { plan_month: iso(mth), week_start: null, task_date: null })

  const dropOnPool = (id) => {
    if (view === 'quarter') onSchedule(id, { plan_month: null, week_start: null, task_date: null })
    else if (view === 'month') onSchedule(id, { week_start: null, task_date: null })
    else onSchedule(id, { task_date: null })
  }

  const step = (dir) =>
    setCursor((c) => (view === 'week' ? addWeeks(c, dir) : view === 'month' ? addMonths(c, dir) : addQuarters(c, dir)))

  const periodLabel =
    view === 'week'
      ? `Semaine du ${format(monday(cursor), 'd MMM', { locale: fr })}`
      : view === 'month'
        ? format(cursor, 'MMMM yyyy', { locale: fr })
        : `T${getQuarter(cursor)} ${format(cursor, 'yyyy')}`

  const bucketCls = 'bg-surface2/60 rounded-xl border border-line p-3'

  let calendar = null
  if (view === 'week') {
    const days = eachDayOfInterval({ start: monday(cursor), end: endOfWeek(cursor, { weekStartsOn: 1 }) })
    calendar = (
      <div className="grid grid-cols-7 gap-2 h-full">
        {days.map((day) => (
          <Drop key={iso(day)} onDropTask={dropOnDay(day)} className={`flex flex-col min-h-0 ${bucketCls}`}>
            <p className="text-[11px] font-semibold text-muted mb-2 capitalize">{format(day, 'EEE d', { locale: fr })}</p>
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5">
              {tasks.filter((t) => t.task_date === iso(day)).map((t) => (
                <Chip key={t.id} task={t} onOpen={onOpenTask} />
              ))}
            </div>
          </Drop>
        ))}
      </div>
    )
  } else if (view === 'month') {
    const weeks = eachWeekOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) }, { weekStartsOn: 1 })
    calendar = (
      <div className="flex flex-col gap-2 h-full overflow-y-auto scrollbar-thin">
        {weeks.map((mon) => (
          <Drop key={iso(mon)} onDropTask={dropOnWeek(mon)} className={bucketCls}>
            <p className="text-[11px] font-semibold text-muted mb-2">Semaine du {format(mon, 'd MMM', { locale: fr })}</p>
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {tasks.filter((t) => t.week_start === iso(mon)).map((t) => (
                <Chip key={t.id} task={t} onOpen={onOpenTask} />
              ))}
            </div>
          </Drop>
        ))}
      </div>
    )
  } else {
    const months = [0, 1, 2].map((i) => addMonths(startOfQuarter(cursor), i))
    calendar = (
      <div className="grid grid-cols-3 gap-3 h-full">
        {months.map((mth) => (
          <Drop key={iso(mth)} onDropTask={dropOnMonth(mth)} className={`flex flex-col min-h-0 ${bucketCls}`}>
            <p className="text-xs font-semibold text-fg mb-2 capitalize">{format(mth, 'MMMM', { locale: fr })}</p>
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5">
              {tasks.filter((t) => t.plan_month === iso(mth)).map((t) => (
                <Chip key={t.id} task={t} onOpen={onOpenTask} />
              ))}
            </div>
          </Drop>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-30 bg-app flex flex-col animate-overlay-in">
      <header className="shrink-0 px-6 py-4 bg-surface/80 backdrop-blur border-b border-line flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-fg">Planning</h2>
          <div className="flex gap-1 p-1 bg-surface2 rounded-lg">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition active:scale-95 ${
                  view === v.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => step(-1)} className="w-8 h-8 rounded-lg text-muted hover:bg-surface2 hover:text-fg flex items-center justify-center transition">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-fg capitalize min-w-[150px] text-center">{periodLabel}</span>
          <button onClick={() => step(1)} className="w-8 h-8 rounded-lg text-muted hover:bg-surface2 hover:text-fg flex items-center justify-center transition">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setCursor(new Date())} className="ml-1 px-3 py-1.5 rounded-lg text-xs text-muted hover:bg-surface2 hover:text-fg transition">
            Aujourd'hui
          </button>
          <button onClick={onClose} className="ml-2 px-4 py-2 rounded-lg bg-accent text-accent-fg text-sm font-medium active:scale-95 transition">
            Fermer
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Drop onDropTask={dropOnPool} className="w-72 shrink-0 border-r border-line bg-surface/40 p-4 overflow-y-auto scrollbar-thin">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-3">
            {view === 'quarter' ? 'À planifier' : view === 'month' ? 'À répartir dans les semaines' : 'À répartir dans les jours'}
          </p>
          {pool.length === 0 ? (
            <p className="text-sm text-muted">
              Rien à placer ici. {view !== 'quarter' && 'Reviens à la vue précédente pour en amener.'}
            </p>
          ) : (
            <div className="space-y-4">
              {poolGroups.map((g) => (
                <div key={g.color ?? 'none'}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: g.color || 'rgb(var(--faint))' }} />
                    <span className="text-[11px] font-medium text-muted">
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

        <div className="flex-1 p-4 overflow-hidden">{calendar}</div>
      </div>
    </div>
  )
}
