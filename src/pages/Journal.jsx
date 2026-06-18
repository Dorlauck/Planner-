import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'
import { toISODate, prettyDate, addDays, isSameDay } from '../lib/date'

const MOODS = [
  { v: 'great', e: '😄', l: 'Au top' },
  { v: 'good', e: '🙂', l: 'Bien' },
  { v: 'okay', e: '😐', l: 'Bof' },
  { v: 'low', e: '😔', l: 'Triste' },
  { v: 'tired', e: '😴', l: 'Fatigué' },
]

export default function Journal() {
  const { user } = useAuth()
  const [selected, setSelected] = useState(new Date())
  const [entry, setEntry] = useState({ content: '', mood: null })
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('idle') // idle | saving | saved
  const saveTimer = useRef(null)
  const iso = toISODate(selected)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('entry_date', iso)
      .maybeSingle()
    setEntry({ content: data?.content ?? '', mood: data?.mood ?? null })
    setLoading(false)
    setStatus('idle')
  }, [iso])

  useEffect(() => { load() }, [load])

  const save = useCallback(
    async (next) => {
      setStatus('saving')
      await supabase
        .from('journal_entries')
        .upsert(
          { user_id: user.id, entry_date: iso, content: next.content, mood: next.mood },
          { onConflict: 'user_id,entry_date' }
        )
      setStatus('saved')
    },
    [user.id, iso]
  )

  function update(patch) {
    const next = { ...entry, ...patch }
    setEntry(next)
    setStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(next), 700)
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-peach-500 font-medium text-sm uppercase tracking-wide">Journal</p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-dusk-900 capitalize">
            {prettyDate(selected)}
          </h1>
        </div>
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={() => setSelected((d) => addDays(d, -1))}
            className="w-9 h-9 rounded-full bg-white/80 shadow-card text-dusk-500 hover:text-peach-500"
            aria-label="Jour précédent"
          >‹</button>
          {!isSameDay(selected, new Date()) && (
            <button
              onClick={() => setSelected(new Date())}
              className="px-3 h-9 rounded-full bg-white/80 shadow-card text-xs text-peach-600"
            >
              Aujourd'hui
            </button>
          )}
          <button
            onClick={() => setSelected((d) => addDays(d, 1))}
            disabled={isSameDay(selected, new Date())}
            className="w-9 h-9 rounded-full bg-white/80 shadow-card text-dusk-500 hover:text-peach-500 disabled:opacity-40"
            aria-label="Jour suivant"
          >›</button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="bg-white/90 rounded-3xl shadow-soft p-6 sm:p-8">
          {/* Mood */}
          <div className="mb-5">
            <p className="text-sm text-dusk-500 mb-2">Comment te sens-tu ?</p>
            <div className="flex gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.v}
                  onClick={() => update({ mood: entry.mood === m.v ? null : m.v })}
                  title={m.l}
                  className={`w-11 h-11 rounded-2xl text-xl transition ${
                    entry.mood === m.v
                      ? 'bg-peach-100 ring-2 ring-peach-300 scale-105'
                      : 'bg-cream hover:bg-peach-50'
                  }`}
                >
                  {m.e}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={entry.content}
            onChange={(e) => update({ content: e.target.value })}
            placeholder="Écris librement… Qu'est-ce qui a marqué ta journée ?"
            className="w-full min-h-[45vh] resize-none bg-transparent font-serif text-lg leading-relaxed text-dusk-900 placeholder:text-dusk-300 focus:outline-none"
          />

          <div className="flex justify-end pt-2 border-t border-peach-50 mt-2">
            <span className="text-xs text-dusk-400">
              {status === 'saving' ? 'Enregistrement…' : status === 'saved' ? '✓ Enregistré' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
