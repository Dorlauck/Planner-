import { Handle, Position } from '@xyflow/react'
import { FlagIcon } from './icons'

// A milestone / goal node — a card (like a task) but with a distinct border,
// a flag and a reached/waiting status. Dependencies point into it; it's
// "reached" once all of them are done.
export default function MilestoneNode({ data, selected }) {
  const { task, state, cover } = data
  const ratio = data.coverRatio || 1.5
  const remaining = state.remaining.length
  const reached = remaining === 0

  return (
    <div
      className={`animate-node-in relative w-56 rounded-xl border-2 overflow-hidden shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-soft ${
        reached ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-accent/40 bg-surface'
      } ${selected ? 'ring-2 ring-offset-1 ring-accent/40' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-app !border !border-faint !z-10" />

      {cover && (
        <div className="relative" style={{ aspectRatio: String(ratio), maxHeight: 240 }}>
          <img src={cover} alt="" className="w-full h-full object-cover" draggable={false} />
        </div>
      )}

      <div className="px-3.5 py-2.5">
        <div
          className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold mb-1 ${
            reached ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted'
          }`}
        >
          <FlagIcon size={13} />
          {reached ? 'Atteint' : `En attente · ${remaining}`}
        </div>
        <p className="text-[15px] font-semibold leading-snug text-fg">{task.title}</p>
      </div>

      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-app !border !border-faint !z-10" />
    </div>
  )
}
