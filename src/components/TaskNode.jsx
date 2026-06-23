import { Handle, Position } from '@xyflow/react'

// Visual style per task state. Kept deliberately calm and high-contrast so the
// board stays readable even with many nodes.
const STYLES = {
  done: {
    ring: 'border-emerald-200 bg-emerald-50',
    dot: 'bg-emerald-400',
    label: 'Fait',
    labelCls: 'text-emerald-600',
  },
  doing: {
    ring: 'border-coral-400 bg-white shadow-soft',
    dot: 'bg-coral-500',
    label: 'En cours',
    labelCls: 'text-coral-600',
  },
  ready: {
    ring: 'border-peach-300 bg-white shadow-card',
    dot: 'bg-peach-400',
    label: 'Prêt',
    labelCls: 'text-peach-600',
  },
  blocked: {
    ring: 'border-dusk-400/20 bg-cream',
    dot: 'bg-dusk-400/40',
    label: 'Bloqué',
    labelCls: 'text-dusk-400',
  },
}

export default function TaskNode({ data }) {
  const { task, state } = data
  const key = task.status === 'done'
    ? 'done'
    : task.status === 'doing'
      ? 'doing'
      : state.ready
        ? 'ready'
        : 'blocked'
  const s = STYLES[key]

  return (
    <div
      className={`w-60 rounded-2xl border-2 px-4 py-3 transition ${s.ring} ${
        key === 'done' ? 'opacity-70' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-peach-300 !border-2 !border-white"
      />

      <div className="flex items-center justify-between mb-1.5">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${s.labelCls}`}>
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
          {s.label}
          {key === 'blocked' && state.remaining.length > 0 && (
            <span className="text-dusk-400">· {state.remaining.length}</span>
          )}
        </span>
        {task.notes?.trim() && <span className="text-dusk-300 text-xs">📝</span>}
      </div>

      <p
        className={`font-medium leading-snug ${
          key === 'done' ? 'line-through text-dusk-400' : 'text-dusk-900'
        }`}
      >
        {task.title}
      </p>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-peach-400 !border-2 !border-white"
      />
    </div>
  )
}
