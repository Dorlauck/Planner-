import { useEffect, useState } from 'react'

function LegendRow({ entry, onUpdate, onRemove }) {
  const [label, setLabel] = useState(entry.label)
  useEffect(() => setLabel(entry.label), [entry.label])

  return (
    <div className="group flex items-center gap-2">
      <input
        type="color"
        value={entry.color}
        onChange={(e) => onUpdate(entry.id, { color: e.target.value })}
        className="w-5 h-5 rounded cursor-pointer border border-peach-100 bg-transparent p-0 shrink-0"
        title="Changer la couleur"
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label !== entry.label && onUpdate(entry.id, { label })}
        placeholder="Signification…"
        className="flex-1 min-w-0 text-sm text-dusk-700 bg-transparent focus:outline-none placeholder:text-dusk-300"
      />
      <button
        onClick={() => onRemove(entry.id)}
        className="opacity-0 group-hover:opacity-100 text-dusk-300 hover:text-coral-500 transition text-xs shrink-0"
        aria-label="Supprimer"
      >
        ✕
      </button>
    </div>
  )
}

// Bottom-left legend: defines, per project, what each task colour means.
export default function LegendPanel({ legend, onAdd, onUpdate, onRemove }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="absolute bottom-4 left-4 z-10 w-60 bg-white/90 backdrop-blur rounded-xl shadow-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-peach-500">Légende</span>
        <span className="text-dusk-400 text-xs">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {legend.length === 0 ? (
            <p className="text-xs text-dusk-400">
              Ajoute des couleurs et leur signification, puis assigne-les aux tâches.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin pr-1">
              {legend.map((e) => (
                <LegendRow key={e.id} entry={e} onUpdate={onUpdate} onRemove={onRemove} />
              ))}
            </div>
          )}

          <button
            onClick={onAdd}
            className="w-full text-left text-xs text-dusk-400 hover:text-dusk-700 transition pt-1"
          >
            ＋ Couleur
          </button>
        </div>
      )}
    </div>
  )
}
