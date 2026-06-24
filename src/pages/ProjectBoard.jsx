import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'
import TaskNode from '../components/TaskNode'
import TextNode from '../components/TextNode'
import TaskDrawer from '../components/TaskDrawer'
import DrawingLayer from '../components/DrawingLayer'
import BoardToolbar, { PEN_COLORS } from '../components/BoardToolbar'
import { computeTaskStates, wouldCreateCycle } from '../lib/graph'

const nodeTypes = { task: TaskNode, text: TextNode }
const STROKE_WIDTH = 3 // flow-space thickness (scales with zoom)

// A loose grid so brand-new / never-positioned tasks don't stack up.
function fallbackPos(index) {
  const col = index % 4
  const row = Math.floor(index / 4)
  return { x: 80 + col * 300, y: 80 + row * 180 }
}

function Board({ project }) {
  const { user } = useAuth()
  const { screenToFlowPosition } = useReactFlow()

  const [tasks, setTasks] = useState([])
  const [deps, setDeps] = useState([])
  const [texts, setTexts] = useState([])
  const [strokes, setStrokes] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  const [mode, setMode] = useState('select') // 'select' | 'text' | 'draw'
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [current, setCurrent] = useState(null) // stroke in progress
  const drawing = useRef(false)
  const newTextId = useRef(null)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // ---- Load everything for this project ---------------------------------
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

      const [depsRes, textsRes, strokesRes] = await Promise.all([
        ids.length
          ? supabase.from('task_dependencies').select('id, task_id, depends_on_id').in('task_id', ids)
          : Promise.resolve({ data: [] }),
        supabase.from('board_texts').select('id, content, pos_x, pos_y').eq('project_id', project.id),
        supabase
          .from('board_strokes')
          .select('id, points, color, width')
          .eq('project_id', project.id)
          .order('created_at'),
      ])

      if (!active) return
      setTasks(taskList)
      setDeps(depsRes.data ?? [])
      setTexts(textsRes.data ?? [])
      setStrokes(strokesRes.data ?? [])
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [project.id])

  const states = useMemo(() => computeTaskStates(tasks, deps), [tasks, deps])

  const commitText = useCallback(
    async (id, content) => {
      const trimmed = content.trim()
      const existing = texts.find((t) => t.id === id)
      if (!existing) return
      if (!trimmed) {
        // Empty annotation → remove it.
        setTexts((arr) => arr.filter((t) => t.id !== id))
        await supabase.from('board_texts').delete().eq('id', id)
        return
      }
      if (trimmed === existing.content) return
      setTexts((arr) => arr.map((t) => (t.id === id ? { ...t, content: trimmed } : t)))
      await supabase.from('board_texts').update({ content: trimmed }).eq('id', id)
    },
    [texts],
  )

  // ---- Build React Flow nodes (tasks + free texts) ----------------------
  useEffect(() => {
    const taskNodes = tasks.map((task, i) => ({
      id: task.id,
      type: 'task',
      position:
        task.pos_x != null && task.pos_y != null ? { x: task.pos_x, y: task.pos_y } : fallbackPos(i),
      data: { task, state: states.get(task.id) ?? { remaining: [], ready: false, blocked: false } },
    }))

    const textNodes = texts.map((t) => ({
      id: t.id,
      type: 'text',
      position: { x: t.pos_x, y: t.pos_y },
      connectable: false,
      data: { content: t.content, onCommit: commitText, autoFocus: t.id === newTextId.current },
    }))

    setNodes([...taskNodes, ...textNodes])
  }, [tasks, texts, states, commitText, setNodes])

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

  // ---- Tasks ------------------------------------------------------------
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
    await supabase.from('tasks').delete().eq('id', id) // cascades deps + attachments
  }

  async function removeDep(depId) {
    setDeps((d) => d.filter((x) => x.id !== depId))
    await supabase.from('task_dependencies').delete().eq('id', depId)
  }

  // ---- React Flow events ------------------------------------------------
  const onNodeDragStop = useCallback((_e, node, dragged) => {
    const moved = dragged && dragged.length ? dragged : node ? [node] : []
    for (const n of moved) {
      const patch = { pos_x: n.position.x, pos_y: n.position.y }
      if (n.type === 'text') {
        setTexts((arr) => arr.map((t) => (t.id === n.id ? { ...t, ...patch } : t)))
        supabase.from('board_texts').update(patch).eq('id', n.id)
      } else {
        supabase.from('tasks').update(patch).eq('id', n.id)
      }
    }
  }, [])

  const onNodesDelete = useCallback((removed) => {
    const taskIds = removed.filter((n) => n.type === 'task').map((n) => n.id)
    const textIds = removed.filter((n) => n.type === 'text').map((n) => n.id)
    if (taskIds.length) {
      setTasks((t) => t.filter((x) => !taskIds.includes(x.id)))
      setDeps((d) => d.filter((x) => !taskIds.includes(x.task_id) && !taskIds.includes(x.depends_on_id)))
      supabase.from('tasks').delete().in('id', taskIds)
    }
    if (textIds.length) {
      setTexts((arr) => arr.filter((x) => !textIds.includes(x.id)))
      supabase.from('board_texts').delete().in('id', textIds)
    }
  }, [])

  const onConnect = useCallback(
    async (conn) => {
      const { source, target } = conn
      if (!source || !target) return
      if (deps.some((d) => d.task_id === target && d.depends_on_id === source)) return
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

  const onEdgesDelete = useCallback((removed) => {
    const ids = removed.map((e) => e.id)
    setDeps((d) => d.filter((x) => !ids.includes(x.id)))
    supabase.from('task_dependencies').delete().in('id', ids)
  }, [])

  const onNodeClick = useCallback((_e, node) => {
    if (node.type === 'task') setOpenId(node.id)
  }, [])

  // Click on empty board in text mode → drop a new free-text annotation.
  const onPaneClick = useCallback(
    async (e) => {
      if (mode !== 'text') return
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const { data } = await supabase
        .from('board_texts')
        .insert({ user_id: user.id, project_id: project.id, content: '', pos_x: pos.x, pos_y: pos.y })
        .select('id, content, pos_x, pos_y')
        .single()
      if (data) {
        newTextId.current = data.id
        setTexts((arr) => [...arr, data])
      }
    },
    [mode, project.id, user.id, screenToFlowPosition],
  )

  // ---- Drawing ----------------------------------------------------------
  const onDrawDown = useCallback(
    (e) => {
      if (mode !== 'draw') return
      e.currentTarget.setPointerCapture?.(e.pointerId)
      drawing.current = true
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setCurrent({ points: [p], color: penColor, width: STROKE_WIDTH })
    },
    [mode, penColor, screenToFlowPosition],
  )

  const onDrawMove = useCallback(
    (e) => {
      if (!drawing.current) return
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setCurrent((c) => {
        if (!c) return c
        const last = c.points[c.points.length - 1]
        const dx = p.x - last.x
        const dy = p.y - last.y
        if (dx * dx + dy * dy < 2) return c // skip near-duplicate points
        return { ...c, points: [...c.points, p] }
      })
    },
    [screenToFlowPosition],
  )

  const onDrawUp = useCallback(async () => {
    if (!drawing.current) return
    drawing.current = false
    const stroke = current
    setCurrent(null)
    if (!stroke || stroke.points.length < 1) return
    const { data } = await supabase
      .from('board_strokes')
      .insert({
        user_id: user.id,
        project_id: project.id,
        points: stroke.points,
        color: stroke.color,
        width: stroke.width,
      })
      .select('id, points, color, width')
      .single()
    if (data) setStrokes((s) => [...s, data])
  }, [current, project.id, user.id])

  async function undoStroke() {
    const last = strokes[strokes.length - 1]
    if (!last) return
    setStrokes((s) => s.slice(0, -1))
    await supabase.from('board_strokes').delete().eq('id', last.id)
  }

  async function clearStrokes() {
    if (!strokes.length) return
    if (!confirm('Effacer tous les dessins de ce projet ?')) return
    setStrokes([])
    await supabase.from('board_strokes').delete().eq('project_id', project.id)
  }

  const openTask = tasks.find((t) => t.id === openId) || null
  const isSelect = mode === 'select'

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="shrink-0 px-6 sm:px-8 py-4 bg-white/70 backdrop-blur border-b border-peach-100 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-dusk-900 truncate">{project.name}</h1>
          <p className="text-sm text-dusk-400">
            {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
            {readyCount > 0 && (
              <span className="text-peach-600 font-medium">
                {' '}· {readyCount} prête{readyCount > 1 ? 's' : ''} à démarrer
              </span>
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

      {/* Board */}
      <div className="flex-1 relative">
        {loading ? (
          <Spinner />
        ) : (
          <>
            <BoardToolbar
              mode={mode}
              setMode={setMode}
              penColor={penColor}
              setPenColor={setPenColor}
              onUndo={undoStroke}
              onClear={clearStrokes}
              canUndo={strokes.length > 0}
              hasDrawings={strokes.length > 0}
            />

            {tasks.length === 0 && texts.length === 0 && strokes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
                <p className="text-dusk-400 mb-4">
                  Board vide. Dépose des tâches, écris du texte libre, esquisse des idées —
                  <br className="hidden sm:block" /> on reliera et on datera plus tard. 🗺️
                </p>
                <button
                  onClick={addTask}
                  className="px-5 py-2.5 rounded-full bg-sunrise-warm text-white text-sm font-medium shadow-soft pointer-events-auto"
                >
                  + Première tâche
                </button>
              </div>
            )}

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgesDelete={onEdgesDelete}
              onNodesDelete={onNodesDelete}
              onNodeDragStop={onNodeDragStop}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{ style: { stroke: '#FCB682', strokeWidth: 2 } }}
              deleteKeyCode={['Delete']}
              // --- interaction: desktop / Figma-style ---
              nodesDraggable={mode !== 'draw'}
              nodesConnectable={isSelect}
              elementsSelectable={isSelect}
              selectionOnDrag={isSelect}
              panOnDrag={mode === 'draw' ? false : [1, 2]}
              panOnScroll
              zoomOnScroll={false}
              zoomOnPinch
              selectionKeyCode={null}
            >
              <Background color="#FCB682" gap={24} size={1.5} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable className="!bg-white/80 !rounded-xl" />
              <DrawingLayer
                active={mode === 'draw'}
                strokes={strokes}
                current={current}
                onPointerDown={onDrawDown}
                onPointerMove={onDrawMove}
                onPointerUp={onDrawUp}
              />
            </ReactFlow>
          </>
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

export default function ProjectBoard({ project }) {
  return (
    <ReactFlowProvider>
      <Board project={project} />
    </ReactFlowProvider>
  )
}
