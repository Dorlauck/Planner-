import { todayISO, shortDate, parseISO, differenceInCalendarDays, weekDays } from '../lib/date'

const STATUS_LABEL = { todo: 'À faire', doing: 'En cours', done: 'Fait' }

// Groups the project's dated tasks into time buckets so you can plan once the
// structure is in place. Done tasks are left out — this is about what's ahead.
export default function PlanningPanel({ tasks, onClose, onOpenTask }) {
  const today = todayISO()
  const weekEnd = weekDays(new Date())[6] // Sunday of the current week
  const weekEndDiff = differenceInCalendarDays(weekEnd, parseISO(today))

  const buckets = { overdue: [], today: [], week: [], later: [] }
  let undated = 0

  for (const t of tasks) {
    if (t.status === 'done') continue
    if (!t.task_date) {
      undated += 1
      continue
    }
    const diff = differenceInCalendarDays(parseISO(t.task_date), parseISO(today))
    if (diff < 0) buckets.overdue.push(t)
    else if (diff === 0) buckets.today.push(t)
    else if (diff <= weekEndDiff) buckets.week.push(t)
    else buckets.later.push(t)
  }

  const order = (a, b) => (a.task_date < b.task_date ? -1 : a.task_date > b.task_date ? 1 : 0)
  Object.values(buckets).forEach((arr) => arr.sort(order))

  const SECTIONS = [
    { key: 'overdue', label: 'En retard', tone: 'text-coral-600' },
    { key: 'today', label: "Aujourd'hui", tone: 'text-peach-600' },
    { key: 'week', label: 'Cette semaine', tone: 'text-dusk-700' },
    { key: 'later', label: 'À venir', tone: 'text-dusk-500' },
  ]

  const total = SECTIONS.reduce((n, s) => n + buckets[s.key].length, 0)

  return (
    <>
      <div className="fixed inset-0 bg-dusk-900/10 z-30 animate-overlay-in" onClick={onClose} />
      <aside className="fixed top-0 right-0 z-40 h-full w-full max-w-md bg-cream shadow-soft border-l border-peach-100 flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-6 py-4 border-b border-peach-100">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-peach-500">Planning</span>
            <h2 className="font-serif text-lg font-semibold text-dusk-900">Par échéance</h2>
          </div>
          <button
            onClick={onClose}
            className="text-dusk-400 hover:text-dusk-700 text-lg leading-none"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6">
          {total === 0 ? (
            <p className="text-sm text-dusk-400">
              Aucune tâche datée pour l'instant. Ouvre une tâche et donne-lui une échéance pour la
              voir apparaître ici.
            </p>
          ) : (
            SECTIONS.map((s) =>
              buckets[s.key].length === 0 ? null : (
                <div key={s.key}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${s.tone}`}>
                    {s.label} · {buckets[s.key].length}
                  </p>
                  <ul className="space-y-1.5">
                    {buckets[s.key].map((t) => (
                      <li key={t.id}>
                        <button
                          onClick={() => onOpenTask(t.id)}
                          className="w-full flex items-center gap-2.5 bg-white rounded-xl shadow-card px-3 py-2.5 text-left hover:shadow-soft active:scale-[0.99] transition"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/5"
                            style={{ backgroundColor: t.color || '#E7E0D8' }}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-dusk-800 truncate">{t.title}</span>
                            <span className="block text-[11px] text-dusk-400">{STATUS_LABEL[t.status]}</span>
                          </span>
                          <span className="text-xs text-dusk-500 shrink-0">🗓 {shortDate(t.task_date)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )
          )}

          {undated > 0 && (
            <p className="text-xs text-dusk-400 pt-2 border-t border-peach-100">
              {undated} tâche{undated > 1 ? 's' : ''} sans échéance — ouvre-les pour les planifier.
            </p>
          )}
        </div>
      </aside>
    </>
  )
}
