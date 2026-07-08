import { useMemo, useState } from 'react'
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from './icons'

const iso = (d) => format(d, 'yyyy-MM-dd')
const monday = (d) => startOfWeek(d, { weekStartsOn: 1 })

function Chip({ item, compact, onToggle, onOpen }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ kind: item.kind, taskId: item.taskId, subId: item.subId }))
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`group flex items-center gap-1.5 bg-surface border border-line rounded-md cursor-grab active:cursor-grabbing hover:border-faint transition ${
        compact ? 'px-1.5 py-0.5' : 'px-2 py-1.5'
      }`}
      title={item.taskTitle ? `${item.taskTitle} — ${item.text}` : item.text}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle(item)
        }}
        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition ${
          item.done ? 'bg-accent border-accent text-accent-fg' : 'border-faint'
        }`}
      >
        {item.done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4 4 10-10" />
          </svg>
        )}
      </button>
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: item.color || 'rgb(var(--faint))' }}
      />
      <span
        onClick={() => onOpen?.(item.taskId)}
        className={`flex-1 min-w-0 truncate ${compact ? 'text-[11px]' : 'text-[13px]'} ${
          item.done ? 'line-through text-faint' : 'text-fg'
        }`}
      >
        {item.text}
      </span>
    </div>
  )
}

function Drop({ onDropItem, className, children }) {
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
        const raw = e.dataTransfer.getData('text/plain')
        if (!raw) return
        try {
          onDropItem(JSON.parse(raw))
        } catch {
          /* ignore */
        }
      }}
      className={`${className} ${over ? 'ring-2 ring-accent/40 bg-surface2' : ''} transition`}
    >
      {children}
    </div>
  )
}

export default function PlanningView({ tasks, states, onClose, onSchedule, onOpenTask }) {
  const [view, setView] = useState('week')
  const [cursor, setCursor] = useState(() => new Date())
  const today = iso(new Date())

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  // Build the plannable items = actionable subtasks of *unblocked* tasks (or the
  // task itself if it has no subtasks). Milestones are excluded.
  const items = useMemo(() => {
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
            date: c.date || null,
            done: !!c.done,
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
          date: t.task_date || null,
          done: t.status === 'done',
          blocked,
        })
      }
    }
    return out
  }, [tasks, states])

  const pool = items.filter((i) => !i.date && !i.done && !i.blocked)
  const overdue = items.filter((i) => i.date && i.date < today && !i.done)
  const itemsByDay = useMemo(() => {
    const m = new Map()
    for (const i of items) {
      if (!i.date) continue
      if (!m.has(i.date)) m.set(i.date, [])
      m.get(i.date).push(i)
    }
    return m
  }, [items])

  // Backlog grouped by parent task.
  const poolGroups = useMemo(() => {
    const groups = []
    const byTask = new Map()
    for (const i of pool) {
      if (!byTask.has(i.taskId)) {
        const g = { taskId: i.taskId, title: tasksById.get(i.taskId)?.title, color: i.color, items: [] }
        byTask.set(i.taskId, g)
        groups.push(g)
      }
      byTask.get(i.taskId).items.push(i)
    }
    return groups
  }, [pool, tasksById])

  // ---- Scheduling -------------------------------------------------------
  function schedule(payload, dateISO) {
    const t = tasksById.get(payload.taskId)
    if (!t) return
    if (payload.kind === 'sub') {
      const list = (Array.isArray(t.checklist) ? t.checklist : []).map((c) =>
        c.id === payload.subId ? { ...c, date: dateISO } : c,
      )
      onSchedule(payload.taskId, { checklist: list })
    } else {
      onSchedule(payload.taskId, { task_date: dateISO })
    }
  }

  function toggleDone(item) {
    const t = tasksById.get(item.taskId)
    if (!t) return
    if (item.kind === 'sub') {
      const list = (Array.isArray(t.checklist) ? t.checklist : []).map((c) =>
        c.id === item.subId ? { ...c, done: !c.done } : c,
      )
      onSchedule(item.taskId, { checklist: list })
    } else {
      onSchedule(item.taskId, { status: item.done ? 'todo' : 'done' })
    }
  }

  function rolloverOverdue() {
    for (const i of overdue) schedule({ kind: i.kind, taskId: i.taskId, subId: i.subId }, today)
  }

  // ---- Period label + nav ----------------------------------------------
  const step = (dir) => setCursor((c) => (view === 'week' ? addWeeks(c, dir) : addMonths(c, dir)))
  const periodLabel =
    view === 'week'
      ? `Semaine du ${format(monday(cursor), 'd MMM', { locale: fr })}`
      : format(cursor, 'MMMM yyyy', { locale: fr })

  // ---- Calendar ---------------------------------------------------------
  let calendar
  if (view === 'week') {
    const days = eachDayOfInterval({ start: monday(cursor), end: endOfWeek(cursor, { weekStartsOn: 1 }) })
    calendar = (
      <div className="grid grid-cols-7 gap-2 h-full">
        {days.map((day) => {
          const key = iso(day)
          const dayItems = itemsByDay.get(key) ?? []
          const isToday = key === today
          return (
            <Drop
              key={key}
              onDropItem={(p) => schedule(p, key)}
              className={`flex flex-col min-h-0 rounded-xl border p-2 ${
                isToday ? 'border-accent/50 bg-surface' : 'border-line bg-surface2/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-semibold capitalize ${isToday ? 'text-fg' : 'text-muted'}`}>
                  {format(day, 'EEE d', { locale: fr })}
                </span>
                {dayItems.length > 0 && (
                  <span className={`text-[10px] ${dayItems.length > 6 ? 'text-amber-500' : 'text-faint'}`}>
                    {dayItems.length}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1">
                {dayItems.map((i) => (
                  <Chip key={i.key} item={i} onToggle={toggleDone} onOpen={onOpenTask} />
                ))}
              </div>
            </Drop>
          )
        })}
      </div>
    )
  } else {
    const gridStart = monday(startOfMonth(cursor))
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
    calendar = (
      <div className="flex flex-col h-full">
        <div className="grid grid-cols-7 gap-2 mb-1">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
            <div key={d} className="text-[10px] font-semibold uppercase tracking-wider text-faint text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 flex-1 min-h-0" style={{ gridAutoRows: '1fr' }}>
          {days.map((day) => {
            const key = iso(day)
            const dayItems = itemsByDay.get(key) ?? []
            const inMonth = isSameMonth(day, cursor)
            const isToday = key === today
            return (
              <Drop
                key={key}
                onDropItem={(p) => schedule(p, key)}
                className={`flex flex-col min-h-0 rounded-lg border p-1.5 ${
                  isToday ? 'border-accent/50 bg-surface' : 'border-line'
                } ${inMonth ? 'bg-surface2/40' : 'bg-transparent opacity-50'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-medium ${isToday ? 'text-fg font-semibold' : 'text-muted'}`}>
                    {format(day, 'd')}
                  </span>
                  {dayItems.length > 0 && (
                    <span className={`text-[9px] ${dayItems.length > 6 ? 'text-amber-500' : 'text-faint'}`}>
                      {dayItems.length}
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin space-y-0.5">
                  {dayItems.map((i) => (
                    <Chip key={i.key} item={i} compact onToggle={toggleDone} onOpen={onOpenTask} />
                  ))}
                </div>
              </Drop>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-30 bg-app flex flex-col animate-overlay-in">
      <header className="shrink-0 px-6 py-4 bg-surface/80 backdrop-blur border-b border-line flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-fg">Planning</h2>
          <div className="flex gap-1 p-1 bg-surface2 rounded-lg">
            {[
              { id: 'week', label: 'Semaine' },
              { id: 'month', label: 'Mois' },
            ].map((v) => (
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
        {/* Backlog */}
        <Drop onDropItem={(p) => schedule(p, null)} className="w-72 shrink-0 border-r border-line bg-surface/40 p-4 overflow-y-auto scrollbar-thin">
          {overdue.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-500 font-medium mb-1.5">{overdue.length} en retard</p>
              <button onClick={rolloverOverdue} className="text-xs text-red-500 underline hover:no-underline">
                Tout passer à aujourd'hui
              </button>
            </div>
          )}

          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-3">À planifier</p>
          {pool.length === 0 ? (
            <p className="text-sm text-muted">
              Rien à planifier. Seules les sous-tâches des tâches <strong>débloquées</strong> apparaissent ici.
            </p>
          ) : (
            <div className="space-y-4">
              {poolGroups.map((g) => (
                <div key={g.taskId}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: g.color || 'rgb(var(--faint))' }} />
                    <span className="text-[11px] font-medium text-muted truncate">{g.title}</span>
                  </div>
                  <div className="space-y-1">
                    {g.items.map((i) => (
                      <Chip key={i.key} item={i} onToggle={toggleDone} onOpen={onOpenTask} />
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
