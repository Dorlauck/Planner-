import { CursorIcon, PenIcon } from './icons'

export const PEN_COLORS = ['#2B2B2B', '#EE7B6B', '#F6A55C', '#7DA7DB', '#6CBF6B']

const MODES = [
  { id: 'select', node: <CursorIcon size={16} />, label: 'Sélection (glisser pour sélectionner une zone)' },
  { id: 'text', node: <span className="text-sm font-semibold">T</span>, label: 'Texte libre (clique pour poser)' },
  { id: 'draw', node: <PenIcon size={16} />, label: 'Dessin libre' },
]

export default function BoardToolbar({ mode, setMode, penColor, setPenColor, onUndo, canUndo, onClear, hasDrawings }) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 items-start">
      <div className="flex gap-2 items-center">
        <div className="flex gap-1 p-1 bg-surface/90 backdrop-blur rounded-xl shadow-card border border-line">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              title={m.label}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-90 ${
                mode === m.id ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-surface2 hover:text-fg'
              }`}
            >
              {m.node}
            </button>
          ))}
        </div>

        <div className="flex p-1 bg-surface/90 backdrop-blur rounded-xl shadow-card border border-line">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Annuler la dernière action (Ctrl+Z)"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:bg-surface2 hover:text-fg disabled:opacity-30 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 7L4 12l5 5" />
              <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
            </svg>
          </button>
        </div>
      </div>

      {mode === 'draw' && (
        <div className="flex items-center gap-2 p-2 bg-surface/90 backdrop-blur rounded-xl shadow-card border border-line animate-fade-up">
          <div className="flex gap-1.5">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setPenColor(c)}
                className={`w-6 h-6 rounded-full border border-black/5 transition ${
                  penColor === c ? 'ring-2 ring-offset-1 ring-accent/50' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <span className="w-px h-5 bg-line" />
          <button
            onClick={onClear}
            disabled={!hasDrawings}
            className="px-2 py-1 rounded-lg text-xs text-muted hover:bg-surface2 hover:text-fg disabled:opacity-30 transition"
          >
            Effacer
          </button>
        </div>
      )}
    </div>
  )
}
