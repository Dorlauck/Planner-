import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'
import { shortDate } from '../lib/date'

const COLORS = ['#F6A55C', '#EE7B6B', '#7C6F9E', '#5BA5A0', '#E0A93B', '#C77DBA']

export default function Goals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', target_date: '', color: COLORS[0] })

  useEffect(() => {
    supabase
      .from('goals')
      .select('*')
      .neq('status', 'archived')
      .order('position')
      .then(({ data }) => {
        setGoals(data ?? [])
        setLoading(false)
      })
  }, [])

  async function addGoal(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    const { data } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        target_date: form.target_date || null,
        color: form.color,
        position: goals.length,
      })
      .select()
      .single()
    if (data) setGoals((g) => [...g, data])
    setForm({ title: '', description: '', target_date: '', color: COLORS[0] })
    setAdding(false)
  }

  async function toggleComplete(goal) {
    const status = goal.status === 'completed' ? 'active' : 'completed'
    setGoals((g) => g.map((x) => (x.id === goal.id ? { ...x, status } : x)))
    await supabase.from('goals').update({ status }).eq('id', goal.id)
  }

  async function removeGoal(id) {
    setGoals((g) => g.filter((x) => x.id !== id))
    await supabase.from('goals').update({ status: 'archived' }).eq('id', id)
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-peach-500 font-medium text-sm uppercase tracking-wide">Vision</p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-dusk-900">Mes objectifs</h1>
        </div>
        <button
          onClick={() => setAdding((a) => !a)}
          className="px-4 py-2 rounded-full bg-sunrise-warm text-white text-sm font-medium shadow-soft hover:opacity-95"
        >
          {adding ? 'Annuler' : '+ Nouvel objectif'}
        </button>
      </div>

      {adding && (
        <form onSubmit={addGoal} className="bg-white/90 rounded-2xl shadow-card p-5 mb-6 space-y-3 animate-fade-up">
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Quel est ton objectif ?"
            className="w-full text-lg font-serif px-3 py-2 rounded-xl bg-cream focus:outline-none focus:ring-2 focus:ring-peach-300"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Pourquoi est-ce important ? (optionnel)"
            rows={2}
            className="w-full text-sm px-3 py-2 rounded-xl bg-cream focus:outline-none focus:ring-2 focus:ring-peach-300 resize-none"
          />
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm text-dusk-500">
              Échéance{' '}
              <input
                type="date"
                value={form.target_date}
                onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                className="ml-1 px-2 py-1 rounded-lg bg-cream focus:outline-none"
              />
            </label>
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
            <button
              type="submit"
              className="ml-auto px-4 py-2 rounded-full bg-dusk-900 text-white text-sm font-medium"
            >
              Créer
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner />
      ) : goals.length === 0 ? (
        <p className="text-center text-dusk-400 py-16">
          Aucun objectif pour l'instant. Quelle est ta prochaine grande étape ? 🎯
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="group relative bg-white/90 rounded-2xl shadow-card p-5 overflow-hidden"
            >
              <span
                className="absolute top-0 left-0 h-full w-1.5"
                style={{ backgroundColor: goal.color }}
              />
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleComplete(goal)}
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs transition ${
                    goal.status === 'completed'
                      ? 'bg-peach-400 border-peach-400 text-white'
                      : 'border-peach-200'
                  }`}
                >
                  {goal.status === 'completed' && '✓'}
                </button>
                <div className="flex-1 min-w-0">
                  <h3
                    className={`font-serif text-lg font-semibold ${
                      goal.status === 'completed' ? 'line-through text-dusk-400' : 'text-dusk-900'
                    }`}
                  >
                    {goal.title}
                  </h3>
                  {goal.description && (
                    <p className="text-sm text-dusk-500 mt-1">{goal.description}</p>
                  )}
                  {goal.target_date && (
                    <span className="inline-block mt-3 text-xs px-2 py-1 rounded-full bg-peach-50 text-peach-600">
                      🗓 {shortDate(goal.target_date)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeGoal(goal.id)}
                  className="opacity-0 group-hover:opacity-100 text-dusk-300 hover:text-coral-500 transition"
                  aria-label="Archiver"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
