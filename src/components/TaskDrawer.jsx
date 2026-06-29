import { useEffect, useState } from 'react'
import { TASK_COLORS } from '../lib/palette'
import { CloseIcon } from './icons'

const STATUSES = [
  { id: 'todo', label: 'À faire' },
  { id: 'doing', label: 'En cours' },
  { id: 'done', label: 'Fait' },
]

// Side panel to edit a single task. Saving is handled by the parent through
// the `onSave` callback so the board stays the single source of truth.
export default function TaskDrawer({ task, tasks, deps, legend = {}, onClose, onSave, onDelete, onRemoveDep }) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')

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

  const label = 'text-[11px] font-semibold uppercase tracking-wider text-muted mb-2'

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 animate-overlay-in" onClick={onClose} />
      <aside className="fixed top-0 right-0 z-40 h-full w-full max-w-md bg-surface border-l border-line flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Tâche</span>
          <button onClick={onClose} className="text-muted hover:text-fg transition" aria-label="Fermer">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6">
          {/* Title */}
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            rows={2}
            className="w-full text-xl font-semibold tracking-tight text-fg bg-transparent resize-none focus:outline-none placeholder:text-faint"
            placeholder="Titre de la tâche"
          />

          {/* Status */}
          <div>
            <p className={label}>Statut</p>
            <div className="flex gap-1 p-1 bg-surface2 rounded-lg">
              {STATUSES.map((st) => (
                <button
                  key={st.id}
                  onClick={() => onSave({ status: st.id })}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium transition ${
                    task.status === st.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div>
            <p className={label}>Échéance</p>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={task.task_date ?? ''}
                onChange={(e) => onSave({ task_date: e.target.value || null })}
                className="text-sm text-fg bg-surface2 rounded-lg px-3 py-2 border border-line focus:outline-none focus:ring-2 focus:ring-accent/30 [color-scheme:light] dark:[color-scheme:dark]"
              />
              {task.task_date && (
                <button onClick={() => onSave({ task_date: null })} className="text-xs text-faint hover:text-fg transition">
                  retirer
                </button>
              )}
            </div>
          </div>

          {/* Colour / category */}
          <div>
            <p className={label}>Couleur</p>
            <div className="flex flex-wrap items-center gap-2">
              {TASK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onSave({ color: c })}
                  title={legend[c] || 'Sans signification'}
                  className={`w-7 h-7 rounded-full border border-black/10 transition ${
                    task.color === c ? 'ring-2 ring-offset-2 ring-offset-surface ring-accent/60' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <button
                onClick={() => onSave({ color: null })}
                title="Aucune couleur"
                className={`w-7 h-7 rounded-full border-2 border-dashed border-faint text-faint text-xs flex items-center justify-center ${
                  !task.color ? 'ring-2 ring-offset-2 ring-offset-surface ring-accent/60' : ''
                }`}
              >
                ∅
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className={label}>Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={commitNotes}
              rows={8}
              placeholder="Détails, idées, liens, ce que tu ne veux pas oublier…"
              className="w-full text-sm text-fg bg-surface2 rounded-lg p-4 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-faint"
            />
          </div>

          {/* Dependencies */}
          <div>
            <p className={label}>Bloquée par</p>
            {prereqs.length === 0 ? (
              <p className="text-sm text-muted">
                Aucune dépendance. Relie une tâche à celle-ci sur le graphe pour en ajouter.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {prereqs.map(({ dep, task: p }) => (
                  <li key={dep.id} className="group flex items-center gap-2 bg-surface2 rounded-lg px-3 py-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: p.status === 'done' ? '#5FA86A' : 'rgb(var(--faint))' }}
                    />
                    <span className={`flex-1 text-sm truncate ${p.status === 'done' ? 'text-muted line-through' : 'text-fg'}`}>
                      {p.title}
                    </span>
                    <button
                      onClick={() => onRemoveDep(dep.id)}
                      className="opacity-0 group-hover:opacity-100 text-faint hover:text-red-500 transition"
                      aria-label="Retirer la dépendance"
                    >
                      <CloseIcon size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-line">
          <button onClick={() => onDelete(task.id)} className="text-sm text-faint hover:text-red-500 transition">
            Supprimer la tâche
          </button>
        </div>
      </aside>
    </>
  )
}
