import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'
import {
  toISODate,
  monthStart,
  monthLabel,
  weeksOfMonth,
  shortDate,
  dayLabel,
  dayNumber,
  addMonths,
  isSameMonth,
  isSameDay,
} from '../lib/date'

export default function Planning() {
  const { user } = useAuth()
  const [month, setMonth] = useState(monthStart(new Date()))
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTask, setNewTask] = useState('')
  const [draggingId, setDraggingId] = useState(null)
  const [overKey, setOverKey] = useState(null)

  const monthIso = toISODate(month)
  const weeks = weeksOfMonth(month)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('plan_month', monthIso)
      .order('position')
    setTasks(data ?? [])
    setLoading(false)
  }, [monthIso])

  useEffect(() => { load() }, [load])

  // --- Buckets -----------------------------------------------------------
  const backlog = tasks.filter((t) => !t.week_start && !t.task_date)
  const weekTasks = (weekIso) =>
    tasks.filter((t) => t.week_start === weekIso && !t.task_date)
  const dayTasks = (dayIso) => tasks.filter((t) => t.task_date === dayIso)

  // --- Mutations ---------------------------------------------------------
  async function addTask(e) {
    e.preventDefault()
    const title = newTask.trim()
    if (!title) return
    setNewTask('')
    const { data } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title,
        plan_month: monthIso,
        position: tasks.length,
      })
      .select()
      .single()
    if (data) setTasks((t) => [...t, data])
  }

  // target: { type: 'backlog' } | { type: 'week', week } | { type: 'day', day, week }
  async function moveTask(id, target) {
    const patch =
      target.type === 'backlog'
        ? { week_start: null, task_date: null }
        : target.type === 'week'
        ? { week_start: target.week, task_date: null }
        : { week_start: target.week, task_date: target.day }

    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    await supabase.from('tasks').update(patch).eq('id', id)
  }

  async function toggle(task) {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)))
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
  }

  async function remove(id) {
    setTasks((ts) => ts.filter((t) => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  // --- Drag & drop -------------------------------------------------------
  function onDrop(target, key) {
    setOverKey(null)
    if (draggingId) moveTask(draggingId, target)
    setDraggingId(null)
  }
  const dragProps = (target, key) => ({
    onDragOver: (e) => { e.preventDefault(); setOverKey(key) },
    onDragLeave: () => setOverKey((k) => (k === key ? null : k)),
    onDrop: () => onDrop(target, key),
    'data-over': overKey === key,
  })

  function TaskCard({ task }) {
    return (
      <div
        draggable
        onDragStart={() => setDraggingId(task.id)}
        onDragEnd={() => { setDraggingId(null); setOverKey(null) }}
        className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white shadow-card border border-peach-50 cursor-grab active:cursor-grabbing ${
          draggingId === task.id ? 'opacity-40' : ''
        }`}
      >
        <button
          onClick={() => toggle(task)}
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-[10px] ${
            task.completed ? 'bg-peach-400 border-peach-400 text-white' : 'border-peach-200'
          }`}
        >
          {task.completed && '✓'}
        </button>
        <span className={`flex-1 text-xs leading-snug ${task.completed ? 'line-through text-dusk-400' : 'text-dusk-900'}`}>
          {task.title}
        </span>
        <button
          onClick={() => remove(task.id)}
          className="opacity-0 group-hover:opacity-100 text-dusk-300 hover:text-coral-500 text-xs shrink-0"
          aria-label="Supprimer"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-peach-500 font-medium text-sm uppercase tracking-wide">Planning</p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-dusk-900 capitalize">
            {monthLabel(month)}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => monthStart(addMonths(m, -1)))}
            className="w-9 h-9 rounded-full bg-white/80 shadow-card text-dusk-500 hover:text-peach-500"
            aria-label="Mois précédent"
          >‹</button>
          <button
            onClick={() => setMonth(monthStart(new Date()))}
            className="px-3 h-9 rounded-full bg-white/80 shadow-card text-xs text-peach-600"
          >
            Ce mois
          </button>
          <button
            onClick={() => setMonth((m) => monthStart(addMonths(m, 1)))}
            className="w-9 h-9 rounded-full bg-white/80 shadow-card text-dusk-500 hover:text-peach-500"
            aria-label="Mois suivant"
          >›</button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          {/* Backlog — monthly pool of undated tasks */}
          <section
            {...dragProps({ type: 'backlog' }, 'backlog')}
            className={`rounded-2xl p-4 border-2 border-dashed transition ${
              overKey === 'backlog' ? 'border-peach-400 bg-peach-50' : 'border-peach-100 bg-white/60'
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📥</span>
              <h2 className="text-lg font-semibold text-dusk-900">À planifier ce mois</h2>
              <span className="text-xs text-dusk-400">{backlog.length}</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {backlog.length === 0 && (
                <p className="text-xs text-dusk-400 py-2">
                  Ajoute ici toutes tes tâches du mois, puis glisse-les dans les semaines et les jours. 👇
                </p>
              )}
              {backlog.map((task) => (
                <div key={task.id} className="w-full sm:w-auto sm:min-w-[200px] sm:max-w-[240px]">
                  <TaskCard task={task} />
                </div>
              ))}
            </div>

            <form onSubmit={addTask} className="flex items-center gap-2">
              <span className="text-peach-300 text-lg">+</span>
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Ajouter une tâche au stock du mois…"
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-dusk-300 py-1"
              />
            </form>
          </section>

          {/* Weeks */}
          {weeks.map((week) => {
            const weekIso = toISODate(week.start)
            const wKey = `w-${weekIso}`
            return (
              <section key={weekIso} className="bg-white/70 rounded-2xl shadow-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-dusk-700">
                    Semaine du {shortDate(week.start)}
                  </h3>
                  {/* Week tray: assigned to the week but no day yet */}
                  <span className="text-xs text-dusk-400">À répartir</span>
                </div>

                <div
                  {...dragProps({ type: 'week', week: weekIso }, wKey)}
                  className={`flex flex-wrap gap-2 min-h-[2.25rem] rounded-xl p-2 mb-3 border border-dashed transition ${
                    overKey === wKey ? 'border-peach-400 bg-peach-50' : 'border-peach-100 bg-cream/50'
                  }`}
                >
                  {weekTasks(weekIso).length === 0 ? (
                    <span className="text-[11px] text-dusk-300 px-1 py-1">
                      Dépose ici les tâches de la semaine
                    </span>
                  ) : (
                    weekTasks(weekIso).map((task) => (
                      <div key={task.id} className="min-w-[160px] max-w-[220px]">
                        <TaskCard task={task} />
                      </div>
                    ))
                  )}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 gap-1.5">
                  {week.days.map((day) => {
                    const dIso = toISODate(day)
                    const dKey = `d-${dIso}`
                    const inMonth = isSameMonth(day, month)
                    const today = isSameDay(day, new Date())
                    return (
                      <div
                        key={dIso}
                        {...dragProps({ type: 'day', day: dIso, week: weekIso }, dKey)}
                        className={`rounded-xl p-1.5 min-h-[5.5rem] flex flex-col gap-1 border transition ${
                          overKey === dKey
                            ? 'border-peach-400 bg-peach-50'
                            : inMonth
                            ? 'border-peach-50 bg-cream/40'
                            : 'border-transparent bg-transparent opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between px-0.5">
                          <span className="text-[10px] uppercase text-dusk-400">{dayLabel(day)}</span>
                          <span
                            className={`text-[11px] font-semibold ${
                              today ? 'text-white bg-peach-400 rounded-full w-4 h-4 flex items-center justify-center' : 'text-dusk-500'
                            }`}
                          >
                            {dayNumber(day)}
                          </span>
                        </div>
                        {dayTasks(dIso).map((task) => (
                          <TaskCard key={task.id} task={task} />
                        ))}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
