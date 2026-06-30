import { useEffect, useRef, useState } from 'react'
import { TASK_COLORS } from '../lib/palette'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { compressImage } from '../lib/image'
import { CloseIcon, PlusIcon, TrashIcon, ImageIcon } from './icons'

const STATUSES = [
  { id: 'todo', label: 'À faire' },
  { id: 'doing', label: 'En cours' },
  { id: 'done', label: 'Fait' },
]

const labelCls = 'text-[11px] font-semibold uppercase tracking-wider text-muted mb-2'
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2))

export default function TaskDrawer({ task, tasks, deps, legend = {}, onClose, onSave, onDelete, onRemoveDep, onAttachmentsChange }) {
  const { user } = useAuth()
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [newItem, setNewItem] = useState('')
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef(null)

  const checklist = Array.isArray(task.checklist) ? task.checklist : []
  const isMilestone = !!task.is_milestone

  useEffect(() => {
    setTitle(task.title)
    setNotes(task.notes ?? '')
  }, [task.id])

  // Load this task's images (signed URLs, since the bucket is private).
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('task_attachments')
        .select('id, storage_path, width, height')
        .eq('task_id', task.id)
        .order('created_at')
      const rows = data ?? []
      let urls = []
      if (rows.length) {
        const { data: signed } = await supabase.storage
          .from('task-images')
          .createSignedUrls(rows.map((r) => r.storage_path), 3600)
        urls = signed ?? []
      }
      if (!active) return
      setAttachments(rows.map((r, i) => ({ ...r, url: urls[i]?.signedUrl })))
    })()
    return () => {
      active = false
    }
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

  // ---- Checklist --------------------------------------------------------
  const saveChecklist = (next) => onSave({ checklist: next })
  function addItem() {
    const v = newItem.trim()
    if (!v) return
    saveChecklist([...checklist, { id: uid(), text: v, done: false }])
    setNewItem('')
  }
  const toggleItem = (id) => saveChecklist(checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)))
  const removeItem = (id) => saveChecklist(checklist.filter((c) => c.id !== id))

  // ---- Images -----------------------------------------------------------
  async function uploadFiles(files) {
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!images.length) return
    setUploading(true)
    try {
      const added = []
      for (const file of images) {
        const { blob, width, height } = await compressImage(file)
        const path = `${user.id}/${task.id}/${uid()}.jpg`
        const { error: upErr } = await supabase.storage.from('task-images').upload(path, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        })
        if (upErr) {
          console.error(upErr)
          continue
        }
        const { data: row } = await supabase
          .from('task_attachments')
          .insert({ user_id: user.id, task_id: task.id, storage_path: path, width, height })
          .select('id, storage_path, width, height')
          .single()
        const { data: signed } = await supabase.storage.from('task-images').createSignedUrl(path, 3600)
        if (row) added.push({ ...row, url: signed?.signedUrl })
      }
      if (added.length) {
        setAttachments((a) => {
          const next = [...a, ...added]
          onAttachmentsChange?.(task.id, next.length)
          return next
        })
      }
    } finally {
      setUploading(false)
    }
  }

  async function removeAttachment(att) {
    setAttachments((a) => {
      const next = a.filter((x) => x.id !== att.id)
      onAttachmentsChange?.(task.id, next.length)
      return next
    })
    await supabase.storage.from('task-images').remove([att.storage_path])
    await supabase.from('task_attachments').delete().eq('id', att.id)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 animate-overlay-in" onClick={onClose} />
      <aside
        className="fixed top-0 right-0 z-40 h-full w-full max-w-md bg-surface border-l border-line flex flex-col animate-slide-in-right"
        onPaste={(e) => e.clipboardData?.files?.length && uploadFiles(e.clipboardData.files)}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {isMilestone ? 'Jalon' : 'Tâche'}
          </span>
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
            placeholder={isMilestone ? 'Nom du jalon' : 'Titre de la tâche'}
          />

          {/* Type */}
          <div>
            <p className={labelCls}>Type</p>
            <div className="flex gap-1 p-1 bg-surface2 rounded-lg w-fit">
              {[
                { id: false, label: 'Tâche' },
                { id: true, label: 'Jalon' },
              ].map((o) => (
                <button
                  key={String(o.id)}
                  onClick={() => onSave({ is_milestone: o.id })}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                    isMilestone === o.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {!isMilestone && (
            <>
              {/* Status */}
              <div>
                <p className={labelCls}>Statut</p>
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
                <p className={labelCls}>Échéance</p>
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

              {/* Colour */}
              <div>
                <p className={labelCls}>Couleur</p>
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

              {/* Checklist */}
              <div>
                <p className={labelCls}>
                  Sous-tâches{checklist.length > 0 && ` · ${checklist.filter((c) => c.done).length}/${checklist.length}`}
                </p>
                <ul className="space-y-1">
                  {checklist.map((item) => (
                    <li key={item.id} className="group flex items-center gap-2.5">
                      <button
                        onClick={() => toggleItem(item.id)}
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
                      <span className={`flex-1 text-sm ${item.done ? 'line-through text-faint' : 'text-fg'}`}>{item.text}</span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-faint hover:text-red-500 transition"
                      >
                        <CloseIcon size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2 mt-2">
                  <PlusIcon size={14} />
                  <input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addItem()}
                    placeholder="Ajouter une sous-tâche…"
                    className="flex-1 text-sm bg-transparent text-fg focus:outline-none placeholder:text-faint"
                  />
                </div>
              </div>
            </>
          )}

          {/* Images */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              uploadFiles(e.dataTransfer.files)
            }}
          >
            <p className={labelCls}>Images</p>
            {attachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {attachments.map((att) => (
                  <div key={att.id} className="group relative aspect-square rounded-lg overflow-hidden bg-surface2 border border-line">
                    {att.url && (
                      <img
                        src={att.url}
                        alt=""
                        onClick={() => setLightbox(att.url)}
                        className="w-full h-full object-cover cursor-zoom-in"
                      />
                    )}
                    <button
                      onClick={() => removeAttachment(att)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/55 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-line text-sm text-muted hover:text-fg hover:border-faint transition disabled:opacity-50"
            >
              <ImageIcon size={16} />
              {uploading ? 'Envoi…' : 'Ajouter des images (ou glisser / coller)'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                uploadFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {/* Notes */}
          <div>
            <p className={labelCls}>Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={commitNotes}
              rows={6}
              placeholder="Détails, idées, liens…"
              className="w-full text-sm text-fg bg-surface2 rounded-lg p-4 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-faint"
            />
          </div>

          {/* Dependencies */}
          <div>
            <p className={labelCls}>Bloqué par</p>
            {prereqs.length === 0 ? (
              <p className="text-sm text-muted">Aucune dépendance. Relie une tâche à celle-ci sur le graphe.</p>
            ) : (
              <ul className="space-y-1.5">
                {prereqs.map(({ dep, task: p }) => (
                  <li key={dep.id} className="group flex items-center gap-2 bg-surface2 rounded-lg px-3 py-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.status === 'done' ? '#5FA86A' : 'rgb(var(--faint))' }} />
                    <span className={`flex-1 text-sm truncate ${p.status === 'done' ? 'text-muted line-through' : 'text-fg'}`}>{p.title}</span>
                    <button
                      onClick={() => onRemoveDep(dep.id)}
                      className="opacity-0 group-hover:opacity-100 text-faint hover:text-red-500 transition"
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
            Supprimer {isMilestone ? 'le jalon' : 'la tâche'}
          </button>
        </div>
      </aside>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 animate-overlay-in cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </>
  )
}
