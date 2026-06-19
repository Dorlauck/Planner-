import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { compressImage } from '../lib/image'
import { TASK_IMAGES_BUCKET as BUCKET } from '../lib/tasks'
import RichEditor from './RichEditor'

export default function TaskModal({ task, onClose, onUpdate }) {
  const { user } = useAuth()
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [attachments, setAttachments] = useState([]) // { id, storage_path, url }
  const [goals, setGoals] = useState([])
  const [goalId, setGoalId] = useState(task.goal_id ?? '')
  const [status, setStatus] = useState('idle') // idle | saving | saved
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const saveTimer = useRef(null)
  const fileInput = useRef(null)

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Load goals for the linker
  useEffect(() => {
    supabase
      .from('goals')
      .select('id,title,color')
      .neq('status', 'archived')
      .order('position')
      .then(({ data }) => setGoals(data ?? []))
  }, [])

  // Load attachments + signed URLs
  useEffect(() => {
    let active = true
    supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at')
      .then(async ({ data }) => {
        if (!active || !data) return
        const withUrls = await Promise.all(
          data.map(async (a) => {
            const { data: signed } = await supabase.storage
              .from(BUCKET)
              .createSignedUrl(a.storage_path, 3600)
            return { ...a, url: signed?.signedUrl }
          })
        )
        if (active) setAttachments(withUrls)
      })
    return () => { active = false }
  }, [task.id])

  const persist = useCallback(
    async (patch) => {
      setStatus('saving')
      await supabase.from('tasks').update(patch).eq('id', task.id)
      onUpdate?.(patch)
      setStatus('saved')
    },
    [task.id, onUpdate]
  )

  function scheduleSave(patch) {
    setStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(patch), 600)
  }

  function onTitle(v) {
    setTitle(v)
    scheduleSave({ title: v.trim() || 'Sans titre' })
  }
  function onNotes(v) {
    setNotes(v)
    scheduleSave({ notes: v })
  }
  function onGoal(v) {
    setGoalId(v)
    persist({ goal_id: v || null })
  }

  async function handleFiles(files) {
    const images = [...files].filter((f) => f.type.startsWith('image/'))
    if (!images.length) return
    setUploading(true)
    setError(null)
    try {
      for (const file of images) {
        const { blob, width, height } = await compressImage(file)
        const path = `${user.id}/${task.id}/${crypto.randomUUID()}.jpg`
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg' })
        if (upErr) throw upErr

        const { data: row, error: rowErr } = await supabase
          .from('task_attachments')
          .insert({ user_id: user.id, task_id: task.id, storage_path: path, width, height })
          .select()
          .single()
        if (rowErr) throw rowErr

        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600)
        setAttachments((a) => [...a, { ...row, url: signed?.signedUrl }])
      }
    } catch (err) {
      setError("Échec de l'ajout d'image : " + (err.message ?? ''))
    } finally {
      setUploading(false)
    }
  }

  async function deleteAttachment(att) {
    setAttachments((a) => a.filter((x) => x.id !== att.id))
    await supabase.storage.from(BUCKET).remove([att.storage_path])
    await supabase.from('task_attachments').delete().eq('id', att.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dusk-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin bg-cream rounded-3xl shadow-soft p-6 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl mt-1">📝</span>
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            className="flex-1 text-xl font-serif font-semibold bg-transparent focus:outline-none text-dusk-900"
          />
          <button
            onClick={onClose}
            className="text-dusk-400 hover:text-dusk-700 text-lg shrink-0"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Goal linker */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-dusk-500">🎯 Objectif</span>
          <select
            value={goalId}
            onChange={(e) => onGoal(e.target.value)}
            className="flex-1 text-sm bg-white/70 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-peach-300"
          >
            <option value="">— Aucun —</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </div>

        {/* Notes — rich text */}
        <RichEditor
          initialHtml={notes}
          onChange={onNotes}
          onPasteImage={handleFiles}
          placeholder="Tes notes… (gras, listes… et colle une image avec Ctrl/Cmd+V)"
        />

        {/* Attachments */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-dusk-700">
              Images <span className="text-dusk-400">({attachments.length})</span>
            </p>
            <button
              onClick={() => fileInput.current?.click()}
              className="text-xs px-3 py-1.5 rounded-full bg-white shadow-card text-peach-600 hover:bg-peach-50"
            >
              + Ajouter
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
            />
          </div>

          {uploading && <p className="text-xs text-peach-600 mb-2">Compression et envoi…</p>}
          {error && <p className="text-xs text-coral-600 mb-2">{error}</p>}

          {attachments.length === 0 && !uploading ? (
            <p className="text-xs text-dusk-400 bg-white/50 rounded-xl p-4 text-center">
              Colle une image (Ctrl/Cmd+V) ou clique sur « Ajouter ». Elles sont
              compressées automatiquement.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {attachments.map((att) => (
                <div key={att.id} className="group relative aspect-square rounded-xl overflow-hidden bg-peach-50">
                  {att.url && (
                    <img
                      src={att.url}
                      alt=""
                      loading="lazy"
                      onClick={() => setLightbox(att.url)}
                      className="w-full h-full object-cover cursor-zoom-in"
                    />
                  )}
                  <button
                    onClick={() => deleteAttachment(att)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-dusk-900/60 text-white text-xs opacity-0 group-hover:opacity-100 transition"
                    aria-label="Supprimer l'image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t border-peach-100">
          <span className="text-xs text-dusk-400">
            {status === 'saving' ? 'Enregistrement…' : status === 'saved' ? '✓ Enregistré' : ''}
          </span>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-dusk-900/80 flex items-center justify-center p-6"
          onClick={(e) => { e.stopPropagation(); setLightbox(null) }}
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-2xl shadow-soft" />
        </div>
      )}
    </div>
  )
}
