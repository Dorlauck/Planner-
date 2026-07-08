import { useMemo } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CloseIcon, RepeatIcon } from './icons'
import { buildItems, overdueItems, dayItems, toggleSub, setSubDate } from '../lib/planning'

function Row({ item, onToggle, onOpen }) {
  return (
    <div className="group flex items-center gap-2.5 py-1.5">
      <button
        onClick={() => onToggle(item)}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
          item.done ? 'bg-accent border-accent text-accent-fg' : 'border-faint'
        }`}
      >
        {item.done && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4 4 10-10" />
          </svg>
        )}
      </button>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color || 'rgb(var(--faint))' }} />
      <button
        onClick={() => onOpen?.(item.taskId)}
        className={`flex-1 min-w-0 text-left text-sm truncate ${item.done ? 'line-through text-faint' : 'text-fg'}`}
      >
        {item.text}
        {item.taskTitle && <span className="text-faint"> · {item.taskTitle}</span>}
      </button>
      {item.recur && <RepeatIcon size={13} className="text-faint shrink-0" />}
    </div>
  )
}

export default function TodayView({ tasks, states, onClose, onSchedule, onOpenTask }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const { overdue, todayList, doneCount } = useMemo(() => {
    const items = buildItems(tasks, states)
    const overdue = overdueItems(items, today)
    const todayList = dayItems(items, today)
    return { overdue, todayList, doneCount: todayList.filter((i) => i.done).length }
  }, [tasks, states, today])

  function toggle(item) {
    const t = tasksById.get(item.taskId)
    if (!t) return
    if (item.kind === 'sub') {
      onSchedule(item.taskId, { checklist: toggleSub(t.checklist || [], item.subId, item.instanceDate || today) })
    } else {
      onSchedule(item.taskId, { status: item.done ? 'todo' : 'done' })
    }
  }

  function rollover() {
    for (const item of overdue) {
      const t = tasksById.get(item.taskId)
      if (!t) continue
      if (item.kind === 'sub') onSchedule(item.taskId, { checklist: setSubDate(t.checklist || [], item.subId, today) })
      else onSchedule(item.taskId, { task_date: today })
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 animate-overlay-in" onClick={onClose} />
      <aside className="fixed top-0 right-0 z-40 h-full w-full max-w-md bg-surface border-l border-line flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Check-in</span>
            <h2 className="text-lg font-semibold tracking-tight text-fg capitalize">
              {format(new Date(), 'EEEE d MMMM', { locale: fr })}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition" aria-label="Fermer">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-7">
          {overdue.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-red-500">En retard · {overdue.length}</p>
                <button onClick={rollover} className="text-xs text-red-500 underline hover:no-underline">
                  Passer à aujourd'hui
                </button>
              </div>
              <div className="divide-y divide-line">
                {overdue.map((i) => (
                  <Row key={i.key} item={i} onToggle={toggle} onOpen={onOpenTask} />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
              Aujourd'hui{todayList.length > 0 && ` · ${doneCount}/${todayList.length}`}
            </p>
            {todayList.length === 0 ? (
              <p className="text-sm text-muted py-2">
                Rien de prévu aujourd'hui. Ouvre le Planning pour répartir tes sous-tâches, ou profite de la journée.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {todayList.map((i) => (
                  <Row key={i.key} item={i} onToggle={toggle} onOpen={onOpenTask} />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
