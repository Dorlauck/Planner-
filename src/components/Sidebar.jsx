import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { TASK_COLORS } from '../lib/palette'

function LegendRow({ color, label, onChange }) {
  const [val, setVal] = useState(label)
  useEffect(() => setVal(label), [label])

  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-4 h-4 rounded-full shrink-0 border border-black/5"
        style={{ backgroundColor: color }}
      />
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => val !== label && onChange(color, val.trim())}
        placeholder="…"
        className="flex-1 min-w-0 text-sm text-dusk-700 bg-transparent focus:outline-none placeholder:text-dusk-300"
      />
    </div>
  )
}

export default function Sidebar({
  projects,
  currentId,
  onSelect,
  onCreate,
  onDelete,
  hasProject,
  legend,
  onLegendChange,
}) {
  const { user, signOut } = useAuth()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [collapsed, setCollapsed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('sidebarCollapsed') === '1',
  )

  function toggle() {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem('sidebarCollapsed', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  function submit(e) {
    e.preventDefault()
    const v = name.trim()
    if (!v) return
    onCreate(v)
    setName('')
    setAdding(false)
  }

  return (
    <aside
      className={`flex md:flex-col w-full shrink-0 bg-white/70 backdrop-blur border-b md:border-b-0 md:border-r border-peach-100 md:h-screen md:sticky md:top-0 p-4 md:p-5 ${
        collapsed ? 'md:w-16' : 'md:w-72'
      }`}
    >
      {/* ---- Desktop, collapsed: thin rail ---- */}
      {collapsed && (
        <div className="hidden md:flex flex-col items-center gap-3 flex-1">
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-xl text-dusk-500 hover:bg-peach-50 flex items-center justify-center transition"
            title="Déplier le menu"
          >
            »
          </button>
          <div className="w-8 border-t border-peach-100" />
          <div className="flex-1 flex flex-col gap-2 items-center overflow-y-auto scrollbar-thin">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                title={p.name}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                  currentId === p.id ? 'bg-sunrise-warm shadow-card' : 'hover:bg-peach-50'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: currentId === p.id ? '#fff' : p.color }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- Desktop, expanded ---- */}
      {!collapsed && (
        <div className="hidden md:flex md:flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 px-1">
              <span className="text-2xl">🗺️</span>
              <span className="font-serif text-xl font-semibold text-dusk-900">Planner</span>
            </div>
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg text-dusk-400 hover:bg-peach-50 flex items-center justify-center transition"
              title="Replier le menu"
            >
              «
            </button>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-dusk-400 px-1 mb-2">Projets</p>
          <nav className="space-y-1 overflow-y-auto scrollbar-thin">
            {projects.map((p) => (
              <div key={p.id} className="group relative">
                <button
                  onClick={() => onSelect(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                    currentId === p.id
                      ? 'bg-sunrise-warm text-white shadow-card'
                      : 'text-dusk-700 hover:bg-peach-50'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="font-medium text-sm truncate">{p.name}</span>
                </button>
                <button
                  onClick={() => onDelete(p)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition text-xs ${
                    currentId === p.id ? 'text-white/70 hover:text-white' : 'text-dusk-300 hover:text-coral-500'
                  }`}
                  aria-label="Supprimer le projet"
                >
                  ✕
                </button>
              </div>
            ))}

            {adding ? (
              <form onSubmit={submit} className="px-1 pt-1">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => !name.trim() && setAdding(false)}
                  placeholder="Nom du projet…"
                  className="w-full text-sm px-3 py-2 rounded-xl bg-cream focus:outline-none focus:ring-2 focus:ring-peach-300"
                />
              </form>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-dusk-400 hover:bg-peach-50 hover:text-dusk-700 transition"
              >
                <span className="text-lg leading-none">＋</span>
                <span className="font-medium text-sm">Nouveau projet</span>
              </button>
            )}
          </nav>

          {hasProject && (
            <div className="mt-6 pt-4 border-t border-peach-100">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-dusk-400 px-1 mb-3">
                Légende des couleurs
              </p>
              <div className="space-y-2.5 px-1">
                {TASK_COLORS.map((c) => (
                  <LegendRow key={c} color={c} label={legend[c] ?? ''} onChange={onLegendChange} />
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-peach-100 pt-4 mt-auto">
            <p className="text-xs text-dusk-400 px-2 mb-2 truncate">{user?.email}</p>
            <button
              onClick={signOut}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-dusk-500 hover:bg-peach-50 transition"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      )}

      {/* ---- Mobile: horizontal project bar (always) ---- */}
      <div className="md:hidden flex-1 overflow-x-auto flex gap-2 items-center">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-sm font-medium ${
              currentId === p.id ? 'bg-sunrise-warm text-white' : 'bg-peach-50 text-dusk-600'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => onCreate('Nouveau projet')}
          className="shrink-0 px-3 py-2 rounded-xl bg-peach-50 text-dusk-500"
        >
          ＋
        </button>
      </div>
    </aside>
  )
}
