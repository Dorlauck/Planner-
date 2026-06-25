import { Handle, Position } from '@xyflow/react'

// Sober, Notion/Apple-like themes for the fixed task palette. The whole block is
// tinted (soft background + matching border), not just an accent.
const THEME = {
  '#6CBF6B': { bg: '#ECF6EC', border: '#BFE2BD', text: '#243024', muted: '#6E8A6C' },
  '#FFD21E': { bg: '#FFF7DC', border: '#F0DC97', text: '#3A3416', muted: '#9A8C4C' },
  '#EFA9CB': { bg: '#FCEEF5', border: '#F0C6DC', text: '#3A2733', muted: '#9C7E8E' },
  '#7DA7DB': { bg: '#EEF4FC', border: '#C4D8F1', text: '#23303F', muted: '#6E84A0' },
  '#FFFFFF': { bg: '#FFFFFF', border: '#E7E0D8', text: '#2C2740', muted: '#9A8FB8' },
  '#222222': { bg: '#2A2636', border: '#3C3752', text: '#F4F2EF', muted: '#A9A3BA' },
}
const NEUTRAL = { bg: '#FFFFFF', border: '#ECE4D9', text: '#2C2740', muted: '#9A8FB8' }

const STATUS = {
  blocked: { label: 'Bloqué', dot: '#BDB6C7' },
  ready: { label: 'Prêt', dot: '#E1933F' },
  doing: { label: 'En cours', dot: '#5B8DD0' },
  done: { label: 'Fait', dot: '#86B583' },
}

export default function TaskNode({ data, selected }) {
  const { task, state } = data
  const statusKey =
    task.status === 'done' ? 'done' : task.status === 'doing' ? 'doing' : state.ready ? 'ready' : 'blocked'
  const st = STATUS[statusKey]
  const t = (task.color && THEME[task.color]) || NEUTRAL
  const done = task.status === 'done'

  return (
    <div
      className={`relative w-60 rounded-xl border px-3.5 py-2.5 shadow-sm transition ${
        done ? 'opacity-60' : ''
      } ${selected ? 'ring-2 ring-dusk-300' : ''}`}
      style={{ background: t.bg, borderColor: t.border, color: t.text }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-white !border !border-dusk-300"
      />

      <div className="flex items-center justify-between mb-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: t.muted }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
          {st.label}
          {statusKey === 'blocked' && state.remaining.length > 0 && <span>· {state.remaining.length}</span>}
        </span>
        {task.notes?.trim() && (
          <span className="text-[11px] leading-none" style={{ color: t.muted }}>
            ✎
          </span>
        )}
      </div>

      <p
        className="text-[15px] font-medium leading-snug"
        style={{ textDecoration: done ? 'line-through' : 'none' }}
      >
        {task.title}
      </p>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-white !border !border-dusk-300"
      />
    </div>
  )
}
