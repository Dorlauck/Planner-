import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { id: 'today', label: 'Ma journée', icon: '☀️' },
  { id: 'goals', label: 'Objectifs', icon: '🎯' },
  { id: 'habits', label: 'Habitudes', icon: '🔁' },
  { id: 'journal', label: 'Journal', icon: '📖' },
]

export default function Sidebar({ page, setPage }) {
  const { user, signOut } = useAuth()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white/70 backdrop-blur border-r border-peach-100 h-screen sticky top-0 p-5">
        <div className="flex items-center gap-2 px-2 mb-8">
          <span className="text-2xl">🌅</span>
          <span className="font-serif text-xl font-semibold text-dusk-900">Sunrise</span>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                page === item.id
                  ? 'bg-sunrise-warm text-white shadow-card'
                  : 'text-dusk-700 hover:bg-peach-50'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-peach-100 pt-4 mt-4">
          <p className="text-xs text-dusk-400 px-2 mb-2 truncate">{user?.email}</p>
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 rounded-xl text-sm text-dusk-500 hover:bg-peach-50 transition"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white/90 backdrop-blur border-t border-peach-100 flex">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`flex-1 flex flex-col items-center py-2.5 text-[11px] ${
              page === item.id ? 'text-peach-600' : 'text-dusk-400'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </>
  )
}
