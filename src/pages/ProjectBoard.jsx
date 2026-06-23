import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'
import TaskNode from '../components/TaskNode'
import TaskDrawer from '../components/TaskDrawer'
import { computeTaskStates, wouldCreateCycle } from '../lib/graph'

const nodeTypes = { task: TaskNode }

// A loose grid so brand-new / never-positioned tasks don't stack on top of
// each other.
function fallbackPos(index) {
  const col = index % 4
  const row = Math.floor(index / 4)
  return { x: 80 + col * 300, y: 80 + row * 180 }
}

export default function ProjectBoard({ project }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [deps, setDeps] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Load tasks + dependencies for this project.
  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      const { data: t } = await supabase
        .from('tasks')
        .select('id, title, notes, status, pos_x, pos_y, position')
        .eq('project_id', project.id)
        .order('position')
      const taskList = t ?? []
      const ids = taskList.map((x) => x.id)
      let depList = []
      if (ids.length) {
        const { data: d } = await supabase
          .from('task_dependencies')
          .select('id, task_id, depends_on_id')
          .in('task_id', ids)
        depList = d ?? []
      }
      if (!active) return
      setTasks(taskList)
      setDeps(depList)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [project.id])

  const states = useMemo(() => computeTaskStates(tasks, deps), [tasks, deps])

  // Rebuild React Flow nodes/edges whenever data or computed states change.
  useEffect(() => {
    setNodes(
      tasks.map((task, i) => ({
        id: task.id,
        type: 'task',
        position:
          task.pos_x != null && task.pos_y != null
            ? { x: task.pos_x, y: task.pos_y }
            : fallbackPos(i),
        data: { task, state: states.get(task.id) ?? { remaining: [], ready: false, blocked: false } },
      })),
    )
  }, [tasks, states, setNodes])

  useEffect(() => {
    setEdges(
      deps.map((d) => ({
        id: d.id,
        source: d.depends_on_id,
        target: d.task_id,
        animated: states.get(d.task_id)?.blocked ?? false,
        style: { stroke: '#FCB682', strokeWidth: 2 },
      })),
    )
  }, [deps, states, setEdges])

  const readyCount = useMemo(
    () => tasks.filter((t) => states.get(t.id)?.ready).length,
    [tasks, states],
  )

  async function addTask() {
    const pos = fallbackPos(tasks.length)
    const { data } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        project_id: project.id,
        title: 'Nouvelle tâche',
        status: 'todo',
        position: tasks.length,
        pos_x: pos.x,
        pos_y: pos.y,
      })
      .select('id, title, notes, status, pos_x, pos_y, position')
      .single()
    if (data) {
      setTasks((t) => [...t, data])
      setOpenId(data.id)
    }
  }

  async function saveTask(id, patch) {
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    await supabase.from('tasks').update(patch).eq('id', id)
  }

  async function deleteTask(id) {
    setTasks((t) => t.filter((x) => x.id !== id))
    setDeps((d) => d.filter((x) => x.task_id !== id && x.depends_on_id !== id))
    setOpenId(null)
    await supabase.from('task_dependencies').delete().or(`task_id.eq.${id},depends_on_id.eq.${id}`)
    await supabase.from('task_attachments').delete().eq('task_id', id)
    await supabase.from('tasks').delete().eq('id', id)
  }

  // Drag → persist node position.
  const onNodeDragStop = useCallback((_e, node) => {
    saveTask(node.id, { pos_x: node.position.x, pos_y: node.position.y })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Connect two nodes → create a dependency (source is prerequisite of target).
  const onConnect = useCallback(
    async (conn) => {
      const { source, target } = conn
      if (!source || !target) return
      const exists = deps.some((d) => d.task_id === target && d.depends_on_id === source)
      if (exists) return
      if (wouldCreateCycle(deps, source, target)) {
        alert('Impossible : cela créerait une boucle de dépendances.')
        return
      }
      const { data } = await supabase
        .from('task_dependencies')
        .insert({ user_id: user.id, task_id: target, depends_on_id: source })
        .select('id, task_id, depends_on_id')
        .single()
      if (data) setDeps((d) => [...d, data])
    },
    [deps, user.id],
  )

  async function removeDep(depId) {
    setDeps((d) => d.filter((x) => x.id !== depId))
    await supabase.from('task_dependencies').delete().eq('id', depId)
  }

  const onEdgesDelete = useCallback((removed) => {
    const ids = removed.map((e) => e.id)
    setDeps((d) => d.filter((x) => !ids.includes(x.id)))
    supabase.from('task_dependencies').delete().in('id', ids)
  }, [])

  const openTask = tasks.find((t) => t.id === openId) || null

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="shrink-0 px-6 sm:px-8 py-4 bg-white/70 backdrop-blur border-b border-peach-100 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-dusk-900 truncate">
            {project.name}
          </h1>
          <p className="text-sm text-dusk-400">
            {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
            {readyCount > 0 && (
              <span className="text-peach-600 font-medium"> · {readyCount} prête{readyCount > 1 ? 's' : ''} à démarrer</span>
            )}
          </p>
        </div>
        <button
          onClick={addTask}
          className="shrink-0 px-4 py-2 rounded-full bg-sunrise-warm text-white text-sm font-medium shadow-soft hover:opacity-95"
        >
          + Tâche
        </button>
      </header>

      {/* Graph */}
      <div className="flex-1 relative">
        {loading ? (
          <Spinner />
        ) : tasks.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <p className="text-dusk-400 mb-4">
              Aucune tâche pour l'instant. Dépose tout ce qui te passe par la tête,
              <br className="hidden sm:block" /> on reliera et on datera plus tard. 🗺️
            </p>
            <button
              onClick={addTask}
              className="px-5 py-2.5 rounded-full bg-sunrise-warm text-white text-sm font-medium shadow-soft"
            >
              + Première tâche
            </button>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_e, node) => setOpenId(node.id)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ style: { stroke: '#FCB682', strokeWidth: 2 } }}
          >
            <Background color="#FCB682" gap={24} size={1.5} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-white/80 !rounded-xl" />
          </ReactFlow>
        )}
      </div>

      {openTask && (
        <TaskDrawer
          task={openTask}
          tasks={tasks}
          deps={deps}
          onClose={() => setOpenId(null)}
          onSave={(patch) => saveTask(openTask.id, patch)}
          onDelete={deleteTask}
          onRemoveDep={removeDep}
        />
      )}
    </div>
  )
}
