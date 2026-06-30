import { Handle, Position } from '@xyflow/react'
import { shortDate, todayISO, parseISO, differenceInCalendarDays } from '../lib/date'
import { useTheme } from '../contexts/ThemeContext'
import { NoteIcon, ImageIcon, CheckIcon } from './icons'

// Per-colour themes — the whole block is tinted. Two sets so the boxes read
// well (and pop) on both light and dark backgrounds.
const LIGHT = {
  '#6CBF6B': { bg: '#ECF6EC', border: '#C2E3C0', text: '#243024', muted: '#6E8A6C' },
  '#FFD21E': { bg: '#FFF7DC', border: '#F0DC97', text: '#3A3416', muted: '#9A8C4C' },
  '#EFA9CB': { bg: '#FCEEF5', border: '#F0C6DC', text: '#3A2733', muted: '#9C7E8E' },
  '#7DA7DB': { bg: '#EEF4FC', border: '#C4D8F1', text: '#23303F', muted: '#6E84A0' },
  '#FFFFFF': { bg: '#FFFFFF', border: '#E6E6E3', text: '#262624', muted: '#8E8E8A' },
  '#222222': { bg: '#26262B', border: '#3A3A40', text: '#F2F2F3', muted: '#A6A6AC' },
}
const DARK = {
  '#6CBF6B': { bg: 'rgba(108,191,107,0.20)', border: 'rgba(108,191,107,0.60)', text: '#DCEFDB', muted: '#9EC79C' },
  '#FFD21E': { bg: 'rgba(255,210,30,0.18)', border: 'rgba(255,210,30,0.55)', text: '#F2E6AE', muted: '#C9B568' },
  '#EFA9CB': { bg: 'rgba(239,169,203,0.18)', border: 'rgba(239,169,203,0.55)', text: '#F3D6E5', muted: '#C99CB4' },
  '#7DA7DB': { bg: 'rgba(125,167,219,0.20)', border: 'rgba(125,167,219,0.60)', text: '#D3E2F4', muted: '#94AAC9' },
  '#FFFFFF': { bg: 'rgba(255,255,255,0.12)', border: 'rgba(255,255,255,0.40)', text: '#F2F2F3', muted: '#B6B6BC' },
  '#222222': { bg: '#0F0F11', border: '#3C3C42', text: '#E6E6E9', muted: '#9A9AA0' },
}
const NEUTRAL_LIGHT = { bg: '#FFFFFF', border: '#E6E6E3', text: '#262624', muted: '#8E8E8A' }
const NEUTRAL_DARK = { bg: '#232325', border: '#343438', text: '#ECECEE', muted: '#8C8C92' }

const STATUS = {
  blocked: { label: 'Bloqué', dot: '#9B9BA2' },
  ready: { label: 'Prêt', dot: '#E1933F' },
  doing: { label: 'En cours', dot: '#5B8DD0' },
  done: { label: 'Fait', dot: '#5FA86A' },
}

export default function TaskNode({ data, selected }) {
  const { dark } = useTheme()
  const { task, state, imgCount = 0 } = data
  const checklist = Array.isArray(task.checklist) ? task.checklist : []
  const checkDone = checklist.filter((c) => c.done).length
  const statusKey =
    task.status === 'done' ? 'done' : task.status === 'doing' ? 'doing' : state.ready ? 'ready' : 'blocked'
  const st = STATUS[statusKey]
  const themes = dark ? DARK : LIGHT
  const neutral = dark ? NEUTRAL_DARK : NEUTRAL_LIGHT
  const t = (task.color && themes[task.color]) || neutral
  const done = task.status === 'done'

  let dueColor = t.muted
  let dueLabel = null
  if (task.task_date) {
    const diff = differenceInCalendarDays(parseISO(task.task_date), parseISO(todayISO()))
    dueLabel = shortDate(task.task_date)
    if (!done && diff < 0) {
      dueColor = '#E0604E'
      dueLabel = `${dueLabel} · en retard`
    } else if (!done && diff === 0) {
      dueColor = '#E1933F'
      dueLabel = "aujourd'hui"
    }
  }

  return (
    <div
      className={`animate-node-in relative w-60 rounded-xl border px-3.5 py-2.5 shadow-card transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-soft ${
        done ? 'opacity-55' : ''
      } ${selected ? 'ring-2 ring-offset-1 ring-accent/40' : ''}`}
      style={{ background: t.bg, borderColor: t.border, color: t.text }}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-app !border !border-faint" />

      <div className="flex items-center justify-between mb-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: t.muted }}>
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusKey === 'ready' ? 'animate-pulse-soft' : ''}`}
            style={{ background: st.dot }}
          />
          {st.label}
          {statusKey === 'blocked' && state.remaining.length > 0 && <span>· {state.remaining.length}</span>}
        </span>
        <span className="inline-flex items-center gap-2" style={{ color: t.muted }}>
          {checklist.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px]">
              <CheckIcon size={12} />
              {checkDone}/{checklist.length}
            </span>
          )}
          {imgCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px]">
              <ImageIcon size={12} />
              {imgCount}
            </span>
          )}
          {task.notes?.trim() && <NoteIcon size={13} />}
        </span>
      </div>

      <p className="text-[15px] font-medium leading-snug" style={{ textDecoration: done ? 'line-through' : 'none' }}>
        {task.title}
      </p>

      {dueLabel && (
        <div className="mt-1.5 text-[11px] font-medium" style={{ color: dueColor }}>
          {dueLabel}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-app !border !border-faint" />
    </div>
  )
}
