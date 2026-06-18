import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'
import {
  toISODate,
  prettyDate,
  weekDays,
  dayLabel,
  dayNumber,
  weekdayIndex,
  isSameDay,
  addDays,
} from '../lib/date'

export default function Today() {
  const { user } = useAuth()
  const [selected, setSelected] = useState(new Date())
  const [tasks, setTasks] = useState([])
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([]) // habit_logs for selected day
  const [loading, setLoading] = useState(true)
  const [newTask, setNewTask] = useState('')

  const iso = toISODate(selected)

  const load = useCallback(async () => {
    setLoading(true)
    const [taskRes, habitRes, logRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('task_date', iso).order('position'),
      supabase.from('habits').select('*').eq('archived', false).order('position'),
      supabase.from('habit_logs').select('*').eq('log_date', iso),
    ])
    setTasks(taskRes.data ?? [])
    setHabits(habitRes.data ?? [])
    setLogs(logRes.data ?? [])
    setLoading(false)
  }, [iso])

  useEffect(() => { load() }, [load])

  async function addTask(e) {
    e.preventDefault()
    const title = newTask.trim()
    if (!title) return
    setNewTask('')
    const { data } = await supabase
      .from('tasks')
      .insert({ user_id: user.id, task_date: iso, title, position: tasks.length })
      .select()
      .single()
    if (data) setTasks((t) => [...t, data])
  }

  async function toggleTask(task) {
    setTasks((t) => t.map((x) => (x.id === task.id ? { ...x, completed: !x.completed } : x)))
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
  }

  async function deleteTask(id) {
    setTasks((t) => t.filter((x) => x.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  async function toggleHabit(habit) {
    const existing = logs.find((l) => l.habit_id === habit.id)
    if (existing) {
      setLogs((l) => l.filter((x) => x.id !== existing.id))
      await supabase.from('habit_logs').delete().eq('id', existing.id)
    } else {
      const { data } = await supabase
        .from('habit_logs')
        .insert({ user_id: user.id, habit_id: habit.id, log_date: iso, completed: true })
        .select()
        .single()
      if (data) setLogs((l) => [...l, data])
    }
  }

  // Habits scheduled for the selected weekday (empty active_days = every day)
  const dow = weekdayIndex(selected)
  const todaysHabits = habits.filter(
    (h) => !h.active_days?.length || h.active_days.includes(dow)
  )
  const doneCount = todaysHabits.filter((h) => logs.some((l) => l.habit_id === h.id)).length
  const taskDone = tasks.filter((t) => t.completed).length

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6">
        <p className="text-peach-500 font-medium text-sm uppercase tracking-wide">
          {isSameDay(selected, new Date()) ? "Aujourd'hui" : 'Ce jour-là'}
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold text-dusk-900 capitalize">
          {prettyDate(selected)}
        </h1>
      </div>

      {/* Week strip */}
      <div className="flex items-center gap-1 mb-8">
        <button
          onClick={() => setSelected((d) => addDays(d, -7))}
          className="px-2 py-1 text-dusk-400 hover:text-peach-500"
          aria-label="Semaine précédente"
        >‹</button>
        <div className="flex-1 grid grid-cols-7 gap-1">
          {weekDays(selected).map((d) => {
            const active = isSameDay(d, selected)
            const today = isSameDay(d, new Date())
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={`flex flex-col items-center py-2 rounded-2xl transition ${
                  active ? 'bg-sunrise-warm text-white shadow-card' : 'hover:bg-peach-50 text-dusk-500'
                }`}
              >
                <span className="text-[11px] uppercase">{dayLabel(d)}</span>
                <span className={`text-base font-semibold ${today && !active ? 'text-peach-500' : ''}`}>
                  {dayNumber(d)}
                </span>
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setSelected((d) => addDays(d, 7))}
          className="px-2 py-1 text-dusk-400 hover:text-peach-500"
          aria-label="Semaine suivante"
        >›</button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-8">
          {/* Tasks */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xl font-semibold text-dusk-900">Plan du jour</h2>
              <span className="text-sm text-dusk-400">
                {taskDone}/{tasks.length}
              </span>
            </div>

            <div className="bg-white/80 rounded-2xl shadow-card p-2">
              {tasks.length === 0 && (
                <p className="text-center text-dusk-400 text-sm py-6">
                  Rien de prévu. Ajoute ta première tâche ✨
                </p>
              )}
              <ul>
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-peach-50"
                  >
                    <button
                      onClick={() => toggleTask(task)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                        task.completed
                          ? 'bg-peach-400 border-peach-400 text-white'
                          : 'border-peach-200'
                      }`}
                    >
                      {task.completed && '✓'}
                    </button>
                    <span
                      className={`flex-1 text-sm ${
                        task.completed ? 'line-through text-dusk-400' : 'text-dusk-900'
                      }`}
                    >
                      {task.title}
                    </span>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-dusk-300 hover:text-coral-500 transition"
                      aria-label="Supprimer"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>

              <form onSubmit={addTask} className="flex items-center gap-2 px-3 py-2">
                <span className="text-peach-300 text-lg">+</span>
                <input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Ajouter une tâche…"
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-dusk-300 py-1"
                />
              </form>
            </div>
          </section>

          {/* Habits for the day */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xl font-semibold text-dusk-900">Habitudes</h2>
              <span className="text-sm text-dusk-400">
                {doneCount}/{todaysHabits.length}
              </span>
            </div>

            {todaysHabits.length === 0 ? (
              <p className="text-sm text-dusk-400 bg-white/60 rounded-2xl p-5">
                Aucune habitude prévue ce jour. Crée-en dans l'onglet Habitudes.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {todaysHabits.map((habit) => {
                  const done = logs.some((l) => l.habit_id === habit.id)
                  return (
                    <button
                      key={habit.id}
                      onClick={() => toggleHabit(habit)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition text-left ${
                        done
                          ? 'bg-peach-50 border-peach-300 shadow-card'
                          : 'bg-white/80 border-transparent hover:border-peach-200'
                      }`}
                    >
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ backgroundColor: (habit.color || '#F6A55C') + '33' }}
                      >
                        {habit.emoji}
                      </span>
                      <span className="flex-1 text-sm font-medium text-dusk-900">{habit.title}</span>
                      <span
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs transition ${
                          done ? 'bg-peach-400 border-peach-400 text-white' : 'border-peach-200'
                        }`}
                      >
                        {done && '✓'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
