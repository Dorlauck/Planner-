import { useEffect, useState } from 'react'

const STATUSES = [
  { id: 'todo', label: 'À faire' },
  { id: 'doing', label: 'En cours' },
  { id: 'done', label: 'Fait' },
]

// Side panel to edit a single task. Saving is handled by the parent through
// the `onSave` callback so the board stays the single source of truth.
export default function TaskDrawer({ task, tasks, deps, legend = [], onClose, onSave, onDelete, onRemoveDep }) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')

  // Re-sync when a different task is opened.
  useEffect(() => {
    setTitle(task.title)
    setNotes(task.notes ?? '')
  }, [task.id])

  const byId = new Map(tasks.map((t) => [t.id, t]))
  const prereqs = deps
    .filter((d) => d.task_id === task.id)
    .map((d) => ({ dep: d, task: byId.get(d.depends_on_id) }))
    .filter((p) => p.task)

  function commitTitle() {
    const v = title.trim()
    if (v && v !== task.title) onSave({ title: v })
    else setTitle(task.title)
  }

  function commitNotes() {
    if ((notes ?? '') !== (task.notes ?? '')) onSave({ notes })
  }

  return (
    <>
      <div className="fixed inset-0 bg-dusk-900/10 z-30" onClick={onClose} />
      <aside className="fixed top-0 right-0 z-40 h-full w-full max-w-md bg-cream shadow-soft border-l border-peach-100 flex flex-col animate-fade-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-peach-100">
          <span className="text-xs font-medium uppercase tracking-wide text-peach-500">Tâche</span>
          <button
            onClick={onClose}
            className="text-dusk-400 hover:text-dusk-700 text-lg leading-none"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6">
          {/* Title */}
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            rows={2}
            className="w-full text-xl font-serif font-semibold text-dusk-900 bg-transparent resize-none focus:outline-none"
            placeholder="Titre de la tâche"
          />

          {/* Status */}
          <div>
            <p className="text-xs font-medium text-dusk-500 mb-2">Statut</p>
            <div className="flex gap-1.5 p-1 bg-white rounded-xl shadow-card">
              {STATUSES.map((st) => (
                <button
                  key={st.id}
                  onClick={() => onSave({ status: st.id })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    task.status === st.id
                      ? 'bg-sunrise-warm text-white shadow-soft'
                      : 'text-dusk-500 hover:bg-peach-50'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Colour / category */}
          <div>
            <p className="text-xs font-medium text-dusk-500 mb-2">Couleur</p>
            {legend.length === 0 ? (
              <p className="text-sm text-dusk-400">
                Définis des couleurs dans la légende (en bas à gauche du board) pour pouvoir les assigner.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {legend.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onSave({ color: l.color })}
                    title={l.label || 'Sans nom'}
                    className={`w-7 h-7 rounded-full transition ${
                      task.color === l.color ? 'ring-2 ring-offset-2 ring-dusk-400' : ''
                    }`}
                    style={{ backgroundColor: l.color }}
                  />
                ))}
                <button
                  onClick={() => onSave({ color: null })}
                  title="Aucune couleur"
                  className={`w-7 h-7 rounded-full border-2 border-dashed border-dusk-300 text-dusk-300 text-xs flex items-center justify-center ${
                    !task.color ? 'ring-2 ring-offset-2 ring-dusk-400' : ''
                  }`}
                >
                  ∅
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-medium text-dusk-500 mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={commitNotes}
              rows={8}
              placeholder="Détails, idées, liens, ce que tu ne veux pas oublier…"
              className="w-full text-sm text-dusk-700 bg-white rounded-xl shadow-card p-4 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-peach-300"
            />
          </div>

          {/* Dependencies */}
          <div>
            <p className="text-xs font-medium text-dusk-500 mb-2">Bloquée par</p>
            {prereqs.length === 0 ? (
              <p className="text-sm text-dusk-400">
                Aucune dépendance. Relie une tâche à celle-ci sur le graphe pour en ajouter.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {prereqs.map(({ dep, task: p }) => (
                  <li
                    key={dep.id}
                    className="group flex items-center gap-2 bg-white rounded-xl shadow-card px-3 py-2"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        p.status === 'done' ? 'bg-emerald-400' : 'bg-dusk-400/40'
                      }`}
                    />
                    <span
                      className={`flex-1 text-sm truncate ${
                        p.status === 'done' ? 'text-dusk-400 line-through' : 'text-dusk-700'
                      }`}
                    >
                      {p.title}
                    </span>
                    <button
                      onClick={() => onRemoveDep(dep.id)}
                      className="opacity-0 group-hover:opacity-100 text-dusk-300 hover:text-coral-500 transition"
                      aria-label="Retirer la dépendance"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-peach-100">
          <button
            onClick={() => onDelete(task.id)}
            className="text-sm text-dusk-400 hover:text-coral-500 transition"
          >
            Supprimer la tâche
          </button>
        </div>
      </aside>
    </>
  )
}
