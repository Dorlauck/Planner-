export const PEN_COLORS = ['#2C2740', '#EE7B6B', '#F6A55C', '#7C6F9E', '#5BA5A0']

const MODES = [
  { id: 'select', icon: '⬚', label: 'Sélection (glisser pour sélectionner une zone)' },
  { id: 'text', icon: 'T', label: 'Texte libre (clique pour poser)' },
  { id: 'draw', icon: '✏️', label: 'Dessin libre' },
]

// Floating toolbar: interaction mode, a global undo, and (when drawing) the pen
// controls.
export default function BoardToolbar({ mode, setMode, penColor, setPenColor, onUndo, canUndo, onClear, hasDrawings }) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 items-start">
      <div className="flex gap-2 items-center">
        <div className="flex gap-1 p-1 bg-white/90 backdrop-blur rounded-xl shadow-card">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              title={m.label}
              className={`w-9 h-9 rounded-lg text-sm font-semibold flex items-center justify-center transition active:scale-90 ${
                mode === m.id ? 'bg-sunrise-warm text-white shadow-soft scale-105' : 'text-dusk-500 hover:bg-peach-50'
              }`}
            >
              {m.icon}
            </button>
          ))}
        </div>

        <div className="flex p-1 bg-white/90 backdrop-blur rounded-xl shadow-card">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Annuler la dernière action (Ctrl+Z)"
            className="w-9 h-9 rounded-lg text-base flex items-center justify-center text-dusk-500 hover:bg-peach-50 disabled:opacity-30 transition"
          >
            ↶
          </button>
        </div>
      </div>

      {mode === 'draw' && (
        <div className="flex items-center gap-2 p-2 bg-white/90 backdrop-blur rounded-xl shadow-card animate-fade-up">
          <div className="flex gap-1.5">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setPenColor(c)}
                className={`w-6 h-6 rounded-full transition ${
                  penColor === c ? 'ring-2 ring-offset-2 ring-dusk-400' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <span className="w-px h-5 bg-peach-100" />
          <button
            onClick={onClear}
            disabled={!hasDrawings}
            className="px-2 py-1 rounded-lg text-xs text-dusk-500 hover:bg-coral-400 hover:text-white disabled:opacity-30 transition"
          >
            Effacer
          </button>
        </div>
      )}
    </div>
  )
}
