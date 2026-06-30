import { Handle, Position } from '@xyflow/react'
import { FlagIcon } from './icons'

// A milestone / goal node. Dependencies point into it; it's "reached" once all
// of them are done. Visually distinct (pill) so goals stand out from tasks.
export default function MilestoneNode({ data, selected }) {
  const { task, state } = data
  const remaining = state.remaining.length
  const reached = remaining === 0

  return (
    <div
      className={`animate-node-in flex items-center gap-2 rounded-full border-2 pl-3 pr-4 py-2 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-soft ${
        reached
          ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-600 dark:text-emerald-300'
          : 'bg-surface border-accent/40 text-fg'
      } ${selected ? 'ring-2 ring-offset-1 ring-accent/40' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-app !border !border-faint" />
      <FlagIcon size={15} />
      <div className="min-w-0">
        <p className="text-[14px] font-semibold leading-tight truncate max-w-[180px]">{task.title}</p>
        <p className="text-[10px] uppercase tracking-wider font-medium opacity-80">
          {reached ? 'Atteint' : `En attente · ${remaining}`}
        </p>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-app !border !border-faint" />
    </div>
  )
}
