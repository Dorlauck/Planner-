import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import AuthScreen from './components/AuthScreen'
import Sidebar from './components/Sidebar'
import Today from './pages/Today'
import Planning from './pages/Planning'
import Goals from './pages/Goals'
import Habits from './pages/Habits'
import Journal from './pages/Journal'

export default function App() {
  const { session, loading } = useAuth()
  const [page, setPage] = useState('today')

  if (loading) {
    return (
      <div className="min-h-screen bg-sunrise flex items-center justify-center">
        <span className="text-4xl animate-pulse">🌅</span>
      </div>
    )
  }

  if (!session) return <AuthScreen />

  const pages = {
    today: <Today />,
    planning: <Planning />,
    goals: <Goals />,
    habits: <Habits />,
    journal: <Journal />,
  }

  return (
    <div className="min-h-screen bg-sunrise flex flex-col md:flex-row">
      <Sidebar page={page} setPage={setPage} />
      <main className="flex-1 overflow-y-auto scrollbar-thin h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 pb-28 md:pb-8">
          {pages[page]}
        </div>
      </main>
    </div>
  )
}
