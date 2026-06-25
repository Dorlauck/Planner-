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

function Board({ project, legend }) {
  const { user } = useAuth()
  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow()

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

  // When a task node is deleted, React Flow also fires onEdgesDelete for its
  // edges. We let the node-delete path own those (it snapshots them) and skip
  // them in the edge handler to avoid a duplicate undo entry.
  const removingTaskIds = useRef(new Set())

  // Track the Alt key so a drag can duplicate (Illustrator-style) on release.
  const altDown = useRef(false)
  useEffect(() => {
    const down = (e) => e.key === 'Alt' && (altDown.current = true)
    const up = (e) => e.key === 'Alt' && (altDown.current = false)
    const blur = () => (altDown.current = false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // Always-fresh snapshot of board state for use inside stable callbacks.
  const live = useRef({})
  live.current = { tasks, texts, deps, strokes }

  // ---- Undo stack -------------------------------------------------------
  // Each entry is an async function that reverts one action. DB re-inserts
  // reuse the original ids so dependencies and references stay intact.
  const undoStack = useRef([])
  const [undoLen, setUndoLen] = useState(0)

  const pushUndo = useCallback((run) => {
    undoStack.current.push(run)
    if (undoStack.current.length > 50) undoStack.current.shift()
    setUndoLen(undoStack.current.length)
  }, [])

  const doUndo = useCallback(async () => {
    const run = undoStack.current.pop()
    setUndoLen(undoStack.current.length)
    if (run) await run()
  }, [])

  // Ctrl/Cmd+Z anywhere, except while typing (native text undo wins there).
  const doUndoRef = useRef(doUndo)
  doUndoRef.current = doUndo
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        const el = document.activeElement
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
        e.preventDefault()
        doUndoRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- Load everything for this project ---------------------------------
  useEffect(() => {
    let active = true
    setLoading(true)
    undoStack.current = []
    setUndoLen(0)
    ;(async () => {
      const { data: t } = await supabase
        .from('tasks')
        .select('id, title, notes, status, color, pos_x, pos_y, position')
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
      const existing = live.current.texts.find((t) => t.id === id)
      if (!existing) return
      if (!trimmed) {
        setTexts((arr) => arr.filter((t) => t.id !== id))
        await supabase.from('board_texts').delete().eq('id', id)
        return
      }
      if (trimmed === existing.content) return
      const prev = existing.content
      setTexts((arr) => arr.map((t) => (t.id === id ? { ...t, content: trimmed } : t)))
      await supabase.from('board_texts').update({ content: trimmed }).eq('id', id)
      pushUndo(async () => {
        setTexts((arr) => arr.map((t) => (t.id === id ? { ...t, content: prev } : t)))
        await supabase.from('board_texts').update({ content: prev }).eq('id', id)
      })
    },
    [pushUndo],
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
        style: { stroke: '#CFC8D6', strokeWidth: 1.5 },
      })),
    )
  }, [deps, states, setEdges])

  const readyCount = useMemo(
    () => tasks.filter((t) => states.get(t.id)?.ready).length,
    [tasks, states],
  )

  // ---- Tasks ------------------------------------------------------------
  async function addTask() {
    const pos = fallbackPos(live.current.tasks.length)
    const { data } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        project_id: project.id,
        title: 'Nouvelle tâche',
        status: 'todo',
        position: live.current.tasks.length,
        pos_x: pos.x,
        pos_y: pos.y,
      })
      .select('id, title, notes, status, pos_x, pos_y, position')
      .single()
    if (data) {
      setTasks((t) => [...t, data])
      setOpenId(data.id)
      pushUndo(async () => {
        setTasks((t) => t.filter((x) => x.id !== data.id))
        setOpenId((o) => (o === data.id ? null : o))
        await supabase.from('tasks').delete().eq('id', data.id)
      })
    }
  }

  async function saveTask(id, patch) {
    const prevTask = live.current.tasks.find((x) => x.id === id)
    const prevPatch = prevTask
      ? Object.fromEntries(Object.keys(patch).map((k) => [k, prevTask[k]]))
      : null
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    await supabase.from('tasks').update(patch).eq('id', id)
    if (prevPatch) {
      pushUndo(async () => {
        setTasks((t) => t.map((x) => (x.id === id ? { ...x, ...prevPatch } : x)))
        await supabase.from('tasks').update(prevPatch).eq('id', id)
      })
    }
  }

  // Re-create one or more deleted tasks (+ their texts/deps) with original ids.
  const restore = useCallback(async ({ tasksRows = [], depsRows = [], textsRows = [] }) => {
    if (tasksRows.length) {
      await supabase.from('tasks').insert(tasksRows)
      setTasks((t) => [...t, ...tasksRows.map(({ user_id, project_id, ...r }) => r)])
    }
    if (depsRows.length) {
      await supabase.from('task_dependencies').insert(depsRows)
      setDeps((d) => [...d, ...depsRows.map(({ user_id, ...r }) => r)])
    }
    if (textsRows.length) {
      await supabase.from('board_texts').insert(textsRows)
      setTexts((arr) => [...arr, ...textsRows.map(({ user_id, project_id, ...r }) => r)])
    }
  }, [])

  function snapshotTasks(ids) {
    const tasksRows = live.current.tasks
      .filter((t) => ids.includes(t.id))
      .map((t) => ({ ...t, user_id: user.id, project_id: project.id }))
    const depsRows = live.current.deps
      .filter((d) => ids.includes(d.task_id) || ids.includes(d.depends_on_id))
      .map((d) => ({ id: d.id, task_id: d.task_id, depends_on_id: d.depends_on_id, user_id: user.id }))
    return { tasksRows, depsRows }
  }

  async function deleteTask(id) {
    const snap = snapshotTasks([id])
    setTasks((t) => t.filter((x) => x.id !== id))
    setDeps((d) => d.filter((x) => x.task_id !== id && x.depends_on_id !== id))
    setOpenId(null)
    await supabase.from('tasks').delete().eq('id', id) // cascades deps + attachments
    pushUndo(() => restore(snap))
  }

  async function removeDep(depId) {
    const row = live.current.deps.find((d) => d.id === depId)
    setDeps((d) => d.filter((x) => x.id !== depId))
    await supabase.from('task_dependencies').delete().eq('id', depId)
    if (row) {
      pushUndo(async () => {
        await supabase
          .from('task_dependencies')
          .insert({ id: row.id, task_id: row.task_id, depends_on_id: row.depends_on_id, user_id: user.id })
        setDeps((d) => [...d, { id: row.id, task_id: row.task_id, depends_on_id: row.depends_on_id }])
      })
    }
  }

  // ---- React Flow events ------------------------------------------------
  const onNodeDragStop = useCallback(
    (e, node, dragged) => {
      const moved = dragged && dragged.length ? dragged : node ? [node] : []
      if (!moved.length) return

      // Alt+drag → duplicate: original stays put (state position unchanged, so
      // the rebuild snaps it back), a copy is created where the drag was released.
      const alt = (e && e.altKey) || altDown.current
      if (alt) {
        ;(async () => {
          const taskCopies = []
          const textCopies = []
          moved.forEach((n, i) => {
            if (n.type === 'text') {
              const src = live.current.texts.find((x) => x.id === n.id)
              if (src)
                textCopies.push({
                  user_id: user.id,
                  project_id: project.id,
                  content: src.content,
                  pos_x: n.position.x,
                  pos_y: n.position.y,
                })
            } else {
              const src = live.current.tasks.find((x) => x.id === n.id)
              if (src)
                taskCopies.push({
                  user_id: user.id,
                  project_id: project.id,
                  title: src.title,
                  notes: src.notes,
                  status: src.status,
                  color: src.color,
                  position: live.current.tasks.length + i,
                  pos_x: n.position.x,
                  pos_y: n.position.y,
                })
            }
          })

          const undoIds = { tasks: [], texts: [] }
          if (taskCopies.length) {
            const { data } = await supabase
              .from('tasks')
              .insert(taskCopies)
              .select('id, title, notes, status, color, pos_x, pos_y, position')
            if (data) {
              setTasks((t) => [...t, ...data])
              undoIds.tasks = data.map((d) => d.id)
            }
          }
          if (textCopies.length) {
            const { data } = await supabase
              .from('board_texts')
              .insert(textCopies)
              .select('id, content, pos_x, pos_y')
            if (data) {
              setTexts((a) => [...a, ...data])
              undoIds.texts = data.map((d) => d.id)
            }
          }
          if (undoIds.tasks.length || undoIds.texts.length) {
            pushUndo(async () => {
              if (undoIds.tasks.length) {
                setTasks((t) => t.filter((x) => !undoIds.tasks.includes(x.id)))
                await supabase.from('tasks').delete().in('id', undoIds.tasks)
              }
              if (undoIds.texts.length) {
                setTexts((a) => a.filter((x) => !undoIds.texts.includes(x.id)))
                await supabase.from('board_texts').delete().in('id', undoIds.texts)
              }
            })
          }
        })()
        return
      }

      // Normal move → persist new positions (with undo to restore previous).
      const inverse = []
      for (const n of moved) {
        const arr = n.type === 'text' ? live.current.texts : live.current.tasks
        const prev = arr.find((x) => x.id === n.id)
        if (prev) inverse.push({ type: n.type, id: n.id, pos_x: prev.pos_x, pos_y: prev.pos_y })
        const table = n.type === 'text' ? 'board_texts' : 'tasks'
        const setter = n.type === 'text' ? setTexts : setTasks
        const patch = { pos_x: n.position.x, pos_y: n.position.y }
        setter((items) => items.map((x) => (x.id === n.id ? { ...x, ...patch } : x)))
        supabase.from(table).update(patch).eq('id', n.id)
      }
      if (inverse.length) {
        pushUndo(async () => {
          for (const it of inverse) {
            const table = it.type === 'text' ? 'board_texts' : 'tasks'
            const setter = it.type === 'text' ? setTexts : setTasks
            setter((items) => items.map((x) => (x.id === it.id ? { ...x, pos_x: it.pos_x, pos_y: it.pos_y } : x)))
            await supabase.from(table).update({ pos_x: it.pos_x, pos_y: it.pos_y }).eq('id', it.id)
          }
        })
      }
    },
    [pushUndo, user.id, project.id],
  )

  const onNodesDelete = useCallback(
    (removed) => {
      const taskIds = removed.filter((n) => n.type === 'task').map((n) => n.id)
      const textIds = removed.filter((n) => n.type === 'text').map((n) => n.id)
      removingTaskIds.current = new Set(taskIds)
      setTimeout(() => (removingTaskIds.current = new Set()), 0)
      const snap = snapshotTasks(taskIds)
      const textsRows = live.current.texts
        .filter((t) => textIds.includes(t.id))
        .map((t) => ({ ...t, user_id: user.id, project_id: project.id }))

      if (taskIds.length) {
        setTasks((t) => t.filter((x) => !taskIds.includes(x.id)))
        setDeps((d) => d.filter((x) => !taskIds.includes(x.task_id) && !taskIds.includes(x.depends_on_id)))
        supabase.from('tasks').delete().in('id', taskIds)
      }
      if (textIds.length) {
        setTexts((arr) => arr.filter((x) => !textIds.includes(x.id)))
        supabase.from('board_texts').delete().in('id', textIds)
      }
      if (taskIds.length || textIds.length) {
        pushUndo(() => restore({ ...snap, textsRows }))
      }
    },
    [pushUndo, restore, user.id, project.id],
  )

  const onConnect = useCallback(
    async (conn) => {
      const { source, target } = conn
      if (!source || !target) return
      const d0 = live.current.deps
      if (d0.some((d) => d.task_id === target && d.depends_on_id === source)) return
      if (wouldCreateCycle(d0, source, target)) {
        alert('Impossible : cela créerait une boucle de dépendances.')
        return
      }
      const { data } = await supabase
        .from('task_dependencies')
        .insert({ user_id: user.id, task_id: target, depends_on_id: source })
        .select('id, task_id, depends_on_id')
        .single()
      if (data) {
        setDeps((d) => [...d, data])
        pushUndo(async () => {
          setDeps((d) => d.filter((x) => x.id !== data.id))
          await supabase.from('task_dependencies').delete().eq('id', data.id)
        })
      }
    },
    [user.id, pushUndo],
  )

  const onEdgesDelete = useCallback(
    (removed) => {
      // Edges removed as a side effect of deleting their task are handled by the
      // node-delete path; skip them here.
      const edgesOnly = removed.filter(
        (e) => !removingTaskIds.current.has(e.source) && !removingTaskIds.current.has(e.target),
      )
      const ids = edgesOnly.map((e) => e.id)
      if (!ids.length) return
      const rows = live.current.deps
        .filter((d) => ids.includes(d.id))
        .map((d) => ({ id: d.id, task_id: d.task_id, depends_on_id: d.depends_on_id, user_id: user.id }))
      setDeps((d) => d.filter((x) => !ids.includes(x.id)))
      supabase.from('task_dependencies').delete().in('id', ids)
      if (rows.length) {
        pushUndo(async () => {
          await supabase.from('task_dependencies').insert(rows)
          setDeps((d) => [...d, ...rows.map(({ user_id, ...r }) => r)])
        })
      }
    },
    [user.id, pushUndo],
  )

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
        pushUndo(async () => {
          setTexts((arr) => arr.filter((t) => t.id !== data.id))
          await supabase.from('board_texts').delete().eq('id', data.id)
        })
      }
    },
    [mode, project.id, user.id, screenToFlowPosition, pushUndo],
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
        if (dx * dx + dy * dy < 2) return c
        return { ...c, points: [...c.points, p] }
      })
    },
    [screenToFlowPosition],
  )

  // In draw mode the overlay captures the wheel; zoom the board (centred on the
  // cursor) ourselves so the page never zooms.
  const onWheelZoom = useCallback(
    (e) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const { x, y, zoom } = getViewport()
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      const newZoom = Math.min(2, Math.max(0.2, zoom * factor))
      const fx = (px - x) / zoom
      const fy = (py - y) / zoom
      setViewport({ x: px - fx * newZoom, y: py - fy * newZoom, zoom: newZoom })
    },
    [getViewport, setViewport],
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
    if (data) {
      setStrokes((s) => [...s, data])
      pushUndo(async () => {
        setStrokes((s) => s.filter((x) => x.id !== data.id))
        await supabase.from('board_strokes').delete().eq('id', data.id)
      })
    }
  }, [current, project.id, user.id, pushUndo])

  async function clearStrokes() {
    const all = live.current.strokes
    if (!all.length) return
    if (!confirm('Effacer tous les dessins de ce projet ?')) return
    const rows = all.map((s) => ({
      id: s.id,
      points: s.points,
      color: s.color,
      width: s.width,
      user_id: user.id,
      project_id: project.id,
    }))
    setStrokes([])
    await supabase.from('board_strokes').delete().eq('project_id', project.id)
    pushUndo(async () => {
      await supabase.from('board_strokes').insert(rows)
      setStrokes(rows.map(({ user_id, project_id, ...r }) => r))
    })
  }

  const openTask = tasks.find((t) => t.id === openId) || null
  const isSelect = mode === 'select'
  const isDraw = mode === 'draw'

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
              onUndo={doUndo}
              canUndo={undoLen > 0}
              onClear={clearStrokes}
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
              defaultEdgeOptions={{ style: { stroke: '#CFC8D6', strokeWidth: 1.5 } }}
              deleteKeyCode={['Delete']}
              // --- interaction: desktop / Figma-style ---
              nodesDraggable={!isDraw}
              nodesConnectable={isSelect}
              elementsSelectable={isSelect}
              selectionOnDrag={isSelect}
              panOnDrag={isDraw ? false : [1, 2]}
              // Non-draw: wheel pans, Ctrl+wheel zooms. Draw: the DrawingLayer
              // captures the wheel and zooms the board itself (page never zooms).
              panOnScroll={!isDraw}
              zoomOnScroll={false}
              zoomOnPinch
              selectionKeyCode={null}
            >
              <Background color="#E5DCCF" gap={22} size={1} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable className="!bg-white/80 !rounded-xl" />
              <DrawingLayer
                active={isDraw}
                strokes={strokes}
                current={current}
                onPointerDown={onDrawDown}
                onPointerMove={onDrawMove}
                onPointerUp={onDrawUp}
                onWheelZoom={onWheelZoom}
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
          legend={legend}
          onClose={() => setOpenId(null)}
          onSave={(patch) => saveTask(openTask.id, patch)}
          onDelete={deleteTask}
          onRemoveDep={removeDep}
        />
      )}
    </div>
  )
}

export default function ProjectBoard({ project, legend }) {
  return (
    <ReactFlowProvider>
      <Board project={project} legend={legend} />
    </ReactFlowProvider>
  )
}
