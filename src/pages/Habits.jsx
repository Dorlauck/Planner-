import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'
import { weekDays, toISODate, dayLabel, isSameDay, weekdayIndex } from '../lib/date'

const EMOJIS = ['⭐', '💧', '🏃', '📚', '🧘', '🥗', '💤', '✍️', '🎸', '🙏', '💪', '🧹']
const COLORS = ['#F6A55C', '#EE7B6B', '#7C6F9E', '#5BA5A0', '#E0A93B', '#C77DBA']
const DAYS = [
  { i: 1, l: 'L' }, { i: 2, l: 'M' }, { i: 3, l: 'M' }, { i: 4, l: 'J' },
  { i: 5, l: 'V' }, { i: 6, l: 'S' }, { i: 0, l: 'D' },
]

export default function Habits() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', emoji: '⭐', color: COLORS[0], active_days: [] })

  const week = weekDays(new Date())
  const weekIsos = week.map(toISODate)

  const load = useCallback(async () => {
    setLoading(true)
    const [habitRes, logRes] = await Promise.all([
      supabase.from('habits').select('*').eq('archived', false).order('position'),
      supabase.from('habit_logs').select('*').in('log_date', weekIsos),
    ])
    setHabits(habitRes.data ?? [])
    setLogs(logRes.data ?? [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  function toggleFormDay(i) {
    setForm((f) => ({
      ...f,
      active_days: f.active_days.includes(i)
        ? f.active_days.filter((d) => d !== i)
        : [...f.active_days, i],
    }))
  }

  async function addHabit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    const { data } = await supabase
      .from('habits')
      .insert({
        user_id: user.id,
        title: form.title.trim(),
        emoji: form.emoji,
        color: form.color,
        active_days: form.active_days,
        position: habits.length,
      })
      .select()
      .single()
    if (data) setHabits((h) => [...h, data])
    setForm({ title: '', emoji: '⭐', color: COLORS[0], active_days: [] })
    setAdding(false)
  }

  async function archiveHabit(id) {
    setHabits((h) => h.filter((x) => x.id !== id))
    await supabase.from('habits').update({ archived: true }).eq('id', id)
  }

  async function toggleLog(habit, dayIso) {
    const existing = logs.find((l) => l.habit_id === habit.id && l.log_date === dayIso)
    if (existing) {
      setLogs((l) => l.filter((x) => x.id !== existing.id))
      await supabase.from('habit_logs').delete().eq('id', existing.id)
    } else {
      const { data } = await supabase
        .from('habit_logs')
        .insert({ user_id: user.id, habit_id: habit.id, log_date: dayIso, completed: true })
        .select()
        .single()
      if (data) setLogs((l) => [...l, data])
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-peach-500 font-medium text-sm uppercase tracking-wide">Constance</p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-dusk-900">Mes habitudes</h1>
        </div>
        <button
          onClick={() => setAdding((a) => !a)}
          className="px-4 py-2 rounded-full bg-sunrise-warm text-white text-sm font-medium shadow-soft hover:opacity-95"
        >
          {adding ? 'Annuler' : '+ Nouvelle habitude'}
        </button>
      </div>

      {adding && (
        <form onSubmit={addHabit} className="bg-white/90 rounded-2xl shadow-card p-5 mb-6 space-y-4 animate-fade-up">
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex : Boire 2L d'eau"
            className="w-full text-lg font-serif px-3 py-2 rounded-xl bg-cream focus:outline-none focus:ring-2 focus:ring-peach-300"
          />
          <div>
            <p className="text-xs text-dusk-400 mb-1.5">Icône</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setForm({ ...form, emoji: em })}
                  className={`w-9 h-9 rounded-xl text-lg transition ${
                    form.emoji === em ? 'bg-peach-100 ring-2 ring-peach-300' : 'bg-cream'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-6 h-6 rounded-full transition ${form.color === c ? 'ring-2 ring-offset-2 ring-dusk-400' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-dusk-400 mb-1.5">
              Jours actifs <span className="text-dusk-300">(aucun = tous les jours)</span>
            </p>
            <div className="flex gap-1.5">
              {DAYS.map((d) => (
                <button
                  key={d.i}
                  type="button"
                  onClick={() => toggleFormDay(d.i)}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition ${
                    form.active_days.includes(d.i)
                      ? 'bg-sunrise-warm text-white'
                      : 'bg-cream text-dusk-500'
                  }`}
                >
                  {d.l}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="px-4 py-2 rounded-full bg-dusk-900 text-white text-sm font-medium">
            Créer l'habitude
          </button>
        </form>
      )}

      {loading ? (
        <Spinner />
      ) : habits.length === 0 ? (
        <p className="text-center text-dusk-400 py-16">
          Aucune habitude. Commence petit, sois régulier 🔁
        </p>
      ) : (
        <div className="space-y-3">
          {/* Week header */}
          <div className="flex items-center pl-3 pr-2">
            <span className="flex-1" />
            <div className="grid grid-cols-7 gap-1 w-[15.5rem]">
              {week.map((d) => (
                <span
                  key={d.toISOString()}
                  className={`text-center text-[11px] uppercase ${
                    isSameDay(d, new Date()) ? 'text-peach-600 font-semibold' : 'text-dusk-400'
                  }`}
                >
                  {dayLabel(d)}
                </span>
              ))}
            </div>
          </div>

          {habits.map((habit) => {
            const dow = (d) => weekdayIndex(d)
            return (
              <div
                key={habit.id}
                className="group flex items-center bg-white/90 rounded-2xl shadow-card p-3"
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: (habit.color || '#F6A55C') + '33' }}
                >
                  {habit.emoji}
                </span>
                <span className="flex-1 px-3 text-sm font-medium text-dusk-900 truncate">
                  {habit.title}
                </span>

                <div className="grid grid-cols-7 gap-1 w-[15.5rem]">
                  {week.map((d) => {
                    const dIso = toISODate(d)
                    const scheduled = !habit.active_days?.length || habit.active_days.includes(dow(d))
                    const done = logs.some((l) => l.habit_id === habit.id && l.log_date === dIso)
                    return (
                      <button
                        key={dIso}
                        onClick={() => toggleLog(habit, dIso)}
                        disabled={!scheduled}
                        className={`h-8 rounded-lg flex items-center justify-center text-xs transition ${
                          !scheduled
                            ? 'bg-transparent text-dusk-200 cursor-default'
                            : done
                            ? 'text-white shadow-card'
                            : 'bg-cream hover:bg-peach-50 text-dusk-300'
                        }`}
                        style={done && scheduled ? { backgroundColor: habit.color } : undefined}
                      >
                        {scheduled ? (done ? '✓' : '·') : ''}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => archiveHabit(habit.id)}
                  className="ml-2 opacity-0 group-hover:opacity-100 text-dusk-300 hover:text-coral-500 transition shrink-0"
                  aria-label="Archiver"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
