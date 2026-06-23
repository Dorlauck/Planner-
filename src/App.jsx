import { useEffect, useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabase'
import AuthScreen from './components/AuthScreen'
import Sidebar from './components/Sidebar'
import ProjectBoard from './pages/ProjectBoard'

const PROJECT_COLORS = ['#F6A55C', '#EE7B6B', '#7C6F9E', '#5BA5A0', '#E0A93B', '#C77DBA']

export default function App() {
  const { session, user, loading } = useAuth()
  const [projects, setProjects] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!session) return
    supabase
      .from('projects')
      .select('*')
      .order('position')
      .then(({ data }) => {
        const list = data ?? []
        setProjects(list)
        setCurrentId((id) => id ?? list[0]?.id ?? null)
        setReady(true)
      })
  }, [session])

  async function createProject(name) {
    const { data } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name,
        color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
        position: projects.length,
      })
      .select()
      .single()
    if (data) {
      setProjects((p) => [...p, data])
      setCurrentId(data.id)
    }
  }

  async function deleteProject(project) {
    if (!confirm(`Supprimer le projet « ${project.name} » et toutes ses tâches ?`)) return
    setProjects((p) => {
      const next = p.filter((x) => x.id !== project.id)
      setCurrentId((id) => (id === project.id ? next[0]?.id ?? null : id))
      return next
    })
    await supabase.from('projects').delete().eq('id', project.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-sunrise flex items-center justify-center">
        <span className="text-4xl animate-pulse">🗺️</span>
      </div>
    )
  }

  if (!session) return <AuthScreen />

  const currentProject = projects.find((p) => p.id === currentId) || null

  return (
    <div className="min-h-screen bg-sunrise flex flex-col md:flex-row">
      <Sidebar
        projects={projects}
        currentId={currentId}
        onSelect={setCurrentId}
        onCreate={createProject}
        onDelete={deleteProject}
      />
      <main className="flex-1 min-w-0 overflow-hidden">
        {currentProject ? (
          <ProjectBoard key={currentProject.id} project={currentProject} />
        ) : (
          <div className="h-full min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
            <span className="text-5xl mb-4">🗺️</span>
            <h1 className="text-2xl font-semibold text-dusk-900 mb-2">
              {ready ? 'Crée ton premier projet' : 'Chargement…'}
            </h1>
            <p className="text-dusk-400 max-w-sm">
              Un projet = un espace pour déposer toutes tes tâches, les relier
              par dépendances, et garder tes notes. Les dates viendront après.
            </p>
            {ready && (
              <button
                onClick={() => createProject('Mon projet')}
                className="mt-6 px-5 py-2.5 rounded-full bg-sunrise-warm text-white text-sm font-medium shadow-soft"
              >
                + Nouveau projet
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
