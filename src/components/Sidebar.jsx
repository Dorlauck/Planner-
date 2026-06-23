import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Sidebar({ projects, currentId, onSelect, onCreate, onDelete }) {
  const { user, signOut } = useAuth()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  function submit(e) {
    e.preventDefault()
    const v = name.trim()
    if (!v) return
    onCreate(v)
    setName('')
    setAdding(false)
  }

  const list = (
    <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin">
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
  )

  return (
    <aside className="flex md:flex-col w-full md:w-64 shrink-0 bg-white/70 backdrop-blur border-b md:border-b-0 md:border-r border-peach-100 md:h-screen md:sticky md:top-0 p-4 md:p-5">
      <div className="hidden md:flex items-center gap-2 px-2 mb-6">
        <span className="text-2xl">🗺️</span>
        <span className="font-serif text-xl font-semibold text-dusk-900">Planner</span>
      </div>

      <div className="flex-1 min-h-0 hidden md:flex md:flex-col">{list}</div>

      {/* Mobile: horizontal scroll of projects */}
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
        <button onClick={() => onCreate('Nouveau projet')} className="shrink-0 px-3 py-2 rounded-xl bg-peach-50 text-dusk-500">
          ＋
        </button>
      </div>

      <div className="hidden md:block border-t border-peach-100 pt-4 mt-4">
        <p className="text-xs text-dusk-400 px-2 mb-2 truncate">{user?.email}</p>
        <button
          onClick={signOut}
          className="w-full text-left px-3 py-2 rounded-xl text-sm text-dusk-500 hover:bg-peach-50 transition"
        >
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}
