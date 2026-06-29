import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { TASK_COLORS } from '../lib/palette'
import { SunIcon, MoonIcon, PlusIcon, ChevronLeft, ChevronRight } from './icons'

function LegendRow({ color, label, onChange }) {
  const [val, setVal] = useState(label)
  useEffect(() => setVal(label), [label])

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: color }} />
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => val !== label && onChange(color, val.trim())}
        placeholder="…"
        className="flex-1 min-w-0 text-sm text-fg bg-transparent focus:outline-none placeholder:text-faint"
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
  const { dark, toggle } = useTheme()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [collapsed, setCollapsed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('sidebarCollapsed') === '1',
  )

  function toggleCollapse() {
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

  const themeBtn = (
    <button
      onClick={toggle}
      title={dark ? 'Passer en clair' : 'Passer en sombre'}
      className="w-8 h-8 rounded-lg text-muted hover:bg-surface2 hover:text-fg flex items-center justify-center transition"
    >
      {dark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
    </button>
  )

  return (
    <aside
      className={`flex md:flex-col w-full shrink-0 bg-surface border-b md:border-b-0 md:border-r border-line md:h-screen md:sticky md:top-0 p-4 md:p-5 transition-[width] duration-300 ease-out ${
        collapsed ? 'md:w-16' : 'md:w-72'
      }`}
    >
      {/* Desktop, collapsed: thin rail */}
      {collapsed && (
        <div className="hidden md:flex flex-col items-center gap-3 flex-1">
          <button
            onClick={toggleCollapse}
            className="w-9 h-9 rounded-xl text-muted hover:bg-surface2 hover:text-fg flex items-center justify-center transition"
            title="Déplier le menu"
          >
            <ChevronRight size={16} />
          </button>
          <div className="w-8 border-t border-line" />
          <div className="flex-1 flex flex-col gap-2 items-center overflow-y-auto scrollbar-thin">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                title={p.name}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                  currentId === p.id ? 'bg-accent' : 'hover:bg-surface2'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: currentId === p.id ? 'rgb(var(--accent-fg))' : p.color }}
                />
              </button>
            ))}
          </div>
          {themeBtn}
        </div>
      )}

      {/* Desktop, expanded */}
      {!collapsed && (
        <div className="hidden md:flex md:flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-6">
            <span className="text-lg font-semibold tracking-tight text-fg px-1">Planner</span>
            <button
              onClick={toggleCollapse}
              className="w-8 h-8 rounded-lg text-muted hover:bg-surface2 hover:text-fg flex items-center justify-center transition"
              title="Replier le menu"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted px-1 mb-2">Projets</p>
          <nav className="space-y-0.5 overflow-y-auto scrollbar-thin">
            {projects.map((p) => (
              <div key={p.id} className="group relative">
                <button
                  onClick={() => onSelect(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                    currentId === p.id ? 'bg-surface2 text-fg' : 'text-muted hover:bg-surface2 hover:text-fg'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="font-medium text-sm truncate">{p.name}</span>
                </button>
                <button
                  onClick={() => onDelete(p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition text-faint hover:text-red-500"
                  aria-label="Supprimer le projet"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
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
                  className="w-full text-sm px-3 py-2 rounded-lg bg-surface2 text-fg focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-faint"
                />
              </form>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-muted hover:bg-surface2 hover:text-fg transition"
              >
                <PlusIcon size={15} />
                <span className="font-medium text-sm">Nouveau projet</span>
              </button>
            )}
          </nav>

          {hasProject && (
            <div className="mt-6 pt-4 border-t border-line">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted px-1 mb-3">Légende</p>
              <div className="space-y-2.5 px-1">
                {TASK_COLORS.map((c) => (
                  <LegendRow key={c} color={c} label={legend[c] ?? ''} onChange={onLegendChange} />
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-line pt-4 mt-auto flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted truncate">{user?.email}</p>
              <button onClick={signOut} className="text-xs text-faint hover:text-fg transition mt-0.5">
                Se déconnecter
              </button>
            </div>
            {themeBtn}
          </div>
        </div>
      )}

      {/* Mobile: horizontal project bar */}
      <div className="md:hidden flex-1 overflow-x-auto flex gap-2 items-center">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium ${
              currentId === p.id ? 'bg-accent text-accent-fg' : 'bg-surface2 text-muted'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => onCreate('Nouveau projet')}
          className="shrink-0 w-9 h-9 rounded-lg bg-surface2 text-muted flex items-center justify-center"
        >
          <PlusIcon size={16} />
        </button>
        {themeBtn}
      </div>
    </aside>
  )
}
