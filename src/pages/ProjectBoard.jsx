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
import MilestoneNode from '../components/MilestoneNode'
import TaskDrawer from '../components/TaskDrawer'
import DrawingLayer from '../components/DrawingLayer'
import PlanningView from '../components/PlanningView'
import BoardToolbar, { PEN_COLORS } from '../components/BoardToolbar'
import { computeTaskStates, wouldCreateCycle } from '../lib/graph'
import { useTheme } from '../contexts/ThemeContext'
import { CalendarIcon, PlusIcon, FlagIcon } from '../components/icons'

const nodeTypes = { task: TaskNode, text: TextNode, milestone: MilestoneNode }
const STROKE_WIDTH = 3 // flow-space thickness (scales with zoom)

// A loose grid so brand-new / never-positioned tasks don't stack up.
function fallbackPos(index) {
  const col = index % 4
  const row = Math.floor(index / 4)
  return { x: 80 + col * 300, y: 80 + row * 180 }
}

function Board({ project, legend }) {
  const { user } = useAuth()
  const { dark } = useTheme()
  const { screenToFlowPosition, getViewport, setViewport, fitView } = useReactFlow()

  const [tasks, setTasks] = useState([])
  const [deps, setDeps] = useState([])
  const [texts, setTexts] = useState([])
  const [strokes, setStrokes] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [showPlanning, setShowPlanning] = useState(false)
  const [imgCounts, setImgCounts] = useState({})
  const [showHelp, setShowHelp] = useState(false)

  const [mode, setMode] = useState('select') // 'select' | 'text' | 'draw'
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [current, setCurrent] = useState(null) // stroke in progress
  const drawing = useRef(false)
  const newTextId = useRef(null)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Latest RF nodes, so drag-stop can persist *every* moved node (not only what
  // React Flow hands back), which fixes positions reverting after a multi-drag.
  const nodesRef = useRef([])
  nodesRef.current = nodes

  // Remember the viewport (pan + zoom) per project so reopening it doesn't
  // re-frame everything (which feels like the tasks "moved").
  const savedViewport = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(`vp:${project.id}`) || 'null')
    } catch {
      return null
    }
  }, [project.id])
  const saveViewport = useCallback(
    (_e, vp) => {
      try {
        localStorage.setItem(`vp:${project.id}`, JSON.stringify(vp))
      } catch {
        /* ignore */
      }
    },
    [project.id],
  )

  // When a task node is deleted, React Flow also fires onEdgesDelete for its
  // edges. We let the node-delete path own those (it snapshots them) and skip
  // them in the edge handler to avoid a duplicate undo entry.
  const removingTaskIds = useRef(new Set())

  // Whether the in-progress drag started with Alt held (Illustrator-style
  // duplicate). Read from the drag-start event, so it can never get "stuck".
  const altDrag = useRef(false)

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

  // ---- Keyboard shortcuts ----------------------------------------------
  const ui = useRef({})
  ui.current = { showPlanning, showHelp, openId }
  const fns = useRef({})
  fns.current = { addTask, fitView, setShowPlanning, setOpenId, setShowHelp }
  useEffect(() => {
    function nudge(sel, dx, dy) {
      for (const n of sel) {
        const isText = n.type === 'text'
        const arr = isText ? live.current.texts : live.current.tasks
        const prev = arr.find((x) => x.id === n.id)
        if (!prev) continue
        const nx = (prev.pos_x ?? n.position.x) + dx
        const ny = (prev.pos_y ?? n.position.y) + dy
        const setter = isText ? setTexts : setTasks
        setter((items) => items.map((x) => (x.id === n.id ? { ...x, pos_x: nx, pos_y: ny } : x)))
        supabase
          .from(isText ? 'board_texts' : 'tasks')
          .update({ pos_x: nx, pos_y: ny })
          .eq('id', n.id)
          .then(({ error }) => error && console.error(error))
      }
    }
    function onKey(e) {
      const el = document.activeElement
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)

      if (e.key === 'Escape') {
        if (ui.current.showHelp) fns.current.setShowHelp(false)
        else if (ui.current.showPlanning) fns.current.setShowPlanning(false)
        else if (ui.current.openId) fns.current.setOpenId(null)
        return
      }
      if (typing || ui.current.showPlanning) return

      if (e.key.startsWith('Arrow')) {
        const sel = nodesRef.current.filter((n) => n.selected)
        if (!sel.length) return
        e.preventDefault()
        const d = e.shiftKey ? 1 : 10
        nudge(sel, e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'n') {
        e.preventDefault()
        fns.current.addTask(false)
      } else if (k === 'm') {
        e.preventDefault()
        fns.current.addTask(true)
      } else if (k === 'f') {
        e.preventDefault()
        fns.current.fitView({ duration: 500, padding: 0.2 })
      } else if (k === 'p') {
        e.preventDefault()
        fns.current.setShowPlanning(true)
      } else if (e.key === '?') {
        e.preventDefault()
        fns.current.setShowHelp((h) => !h)
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
        .select('id, title, notes, status, color, task_date, week_start, plan_month, checklist, is_milestone, pos_x, pos_y, position')
        .eq('project_id', project.id)
        .order('position')
      const taskList = t ?? []
      const ids = taskList.map((x) => x.id)

      const [depsRes, textsRes, strokesRes, attachRes] = await Promise.all([
        ids.length
          ? supabase.from('task_dependencies').select('id, task_id, depends_on_id').in('task_id', ids)
          : Promise.resolve({ data: [] }),
        supabase.from('board_texts').select('id, content, pos_x, pos_y').eq('project_id', project.id),
        supabase
          .from('board_strokes')
          .select('id, points, color, width')
          .eq('project_id', project.id)
          .order('created_at'),
        ids.length
          ? supabase.from('task_attachments').select('task_id').in('task_id', ids)
          : Promise.resolve({ data: [] }),
      ])

      if (!active) return
      const counts = {}
      for (const a of attachRes.data ?? []) counts[a.task_id] = (counts[a.task_id] ?? 0) + 1
      setImgCounts(counts)
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
      type: task.is_milestone ? 'milestone' : 'task',
      position:
        task.pos_x != null && task.pos_y != null ? { x: task.pos_x, y: task.pos_y } : fallbackPos(i),
      data: {
        task,
        state: states.get(task.id) ?? { remaining: [], ready: false, blocked: false },
        imgCount: imgCounts[task.id] ?? 0,
      },
    }))

    const textNodes = texts.map((t) => ({
      id: t.id,
      type: 'text',
      position: { x: t.pos_x, y: t.pos_y },
      connectable: false,
      data: { content: t.content, onCommit: commitText, autoFocus: t.id === newTextId.current },
    }))

    setNodes([...taskNodes, ...textNodes])
  }, [tasks, texts, states, commitText, setNodes, imgCounts])

  useEffect(() => {
    setEdges(
      deps.map((d) => ({
        id: d.id,
        source: d.depends_on_id,
        target: d.task_id,
        animated: states.get(d.task_id)?.blocked ?? false,
        style: { stroke: dark ? '#55555E' : '#CFC8D6', strokeWidth: 1.5 },
      })),
    )
  }, [deps, states, setEdges, dark])

  const readyCount = useMemo(
    () => tasks.filter((t) => !t.is_milestone && states.get(t.id)?.ready).length,
    [tasks, states],
  )

  const onAttachmentsChange = useCallback((taskId, count) => {
    setImgCounts((m) => ({ ...m, [taskId]: count }))
  }, [])

  // ---- Tasks ------------------------------------------------------------
  async function addTask(milestone = false) {
    const pos = fallbackPos(live.current.tasks.length)
    const { data } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        project_id: project.id,
        title: milestone ? 'Nouveau jalon' : 'Nouvelle tâche',
        status: 'todo',
        is_milestone: milestone,
        position: live.current.tasks.length,
        pos_x: pos.x,
        pos_y: pos.y,
      })
      .select(
        'id, title, notes, status, color, task_date, week_start, plan_month, checklist, is_milestone, pos_x, pos_y, position',
      )
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
  const onNodeDragStart = useCallback((e) => {
    altDrag.current = !!(e && e.altKey)
  }, [])

  const onNodeDragStop = useCallback(
    (e, node, dragged) => {
      const moved = dragged && dragged.length ? dragged : node ? [node] : []
      if (!moved.length) return

      // Alt+drag → duplicate: original stays put (state position unchanged, so
      // the rebuild snaps it back), a copy is created where the drag was released.
      const alt = altDrag.current
      altDrag.current = false
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
                  is_milestone: src.is_milestone,
                  checklist: src.checklist ?? [],
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
              .select('id, title, notes, status, color, task_date, week_start, plan_month, checklist, is_milestone, pos_x, pos_y, position')
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

      // Normal move → persist the final positions straight from the event
      // (reliable), plus any other selected node for multi-drag safety.
      const map = new Map()
      for (const n of moved) map.set(n.id, { type: n.type, x: n.position.x, y: n.position.y })
      for (const n of nodesRef.current) {
        if (n.selected && !map.has(n.id)) map.set(n.id, { type: n.type, x: n.position.x, y: n.position.y })
      }

      const changed = []
      for (const [id, p] of map) {
        const arr = p.type === 'text' ? live.current.texts : live.current.tasks
        const prev = arr.find((x) => x.id === id)
        if (!prev) continue
        if (prev.pos_x === p.x && prev.pos_y === p.y) continue
        changed.push({ type: p.type, id, from: { x: prev.pos_x, y: prev.pos_y }, to: { x: p.x, y: p.y } })
      }
      if (!changed.length) return

      for (const c of changed) {
        const table = c.type === 'text' ? 'board_texts' : 'tasks'
        const setter = c.type === 'text' ? setTexts : setTasks
        setter((items) => items.map((x) => (x.id === c.id ? { ...x, pos_x: c.to.x, pos_y: c.to.y } : x)))
        // .then() is required: a supabase query is only sent when awaited/then'd.
        supabase
          .from(table)
          .update({ pos_x: c.to.x, pos_y: c.to.y })
          .eq('id', c.id)
          .then(({ error }) => error && console.error('Position non sauvegardée', error))
      }
      pushUndo(async () => {
        for (const c of changed) {
          const table = c.type === 'text' ? 'board_texts' : 'tasks'
          const setter = c.type === 'text' ? setTexts : setTasks
          setter((items) => items.map((x) => (x.id === c.id ? { ...x, pos_x: c.from.x, pos_y: c.from.y } : x)))
          await supabase.from(table).update({ pos_x: c.from.x, pos_y: c.from.y }).eq('id', c.id)
        }
      })
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
        supabase.from('tasks').delete().in('id', taskIds).then(({ error }) => error && console.error(error))
      }
      if (textIds.length) {
        setTexts((arr) => arr.filter((x) => !textIds.includes(x.id)))
        supabase.from('board_texts').delete().in('id', textIds).then(({ error }) => error && console.error(error))
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
      supabase.from('task_dependencies').delete().in('id', ids).then(({ error }) => error && console.error(error))
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
      <header className="shrink-0 px-6 sm:px-8 py-4 bg-surface/80 backdrop-blur border-b border-line flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-fg truncate">{project.name}</h1>
          <p className="text-sm text-muted">
            {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
            {readyCount > 0 && (
              <span className="text-fg font-medium">
                {' '}· {readyCount} prête{readyCount > 1 ? 's' : ''} à démarrer
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowPlanning(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface text-fg text-sm font-medium border border-line hover:bg-surface2 active:scale-95 transition"
          >
            <CalendarIcon size={16} /> Planning
          </button>
          <button
            onClick={() => addTask(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface text-fg text-sm font-medium border border-line hover:bg-surface2 active:scale-95 transition"
            title="Nouveau jalon (M)"
          >
            <FlagIcon size={15} /> Jalon
          </button>
          <button
            onClick={() => addTask(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-accent-fg text-sm font-medium shadow-card hover:opacity-90 active:scale-95 transition"
            title="Nouvelle tâche (N)"
          >
            <PlusIcon size={16} /> Tâche
          </button>
        </div>
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
                <p className="text-muted mb-4">
                  Board vide. Dépose des tâches, écris du texte libre, esquisse des idées —
                  <br className="hidden sm:block" /> on reliera et on datera plus tard.
                </p>
                <button
                  onClick={() => addTask(false)}
                  className="px-5 py-2.5 rounded-lg bg-accent text-accent-fg text-sm font-medium shadow-card pointer-events-auto active:scale-95 transition"
                >
                  Première tâche
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
              onNodeDragStart={onNodeDragStart}
              onNodeDragStop={onNodeDragStop}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView={!savedViewport}
              fitViewOptions={{ duration: 500, padding: 0.2 }}
              defaultViewport={savedViewport || undefined}
              onMoveEnd={saveViewport}
              minZoom={0.2}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{ style: { stroke: dark ? '#55555E' : '#CFC8D6', strokeWidth: 1.5 } }}
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
              <Background color={dark ? '#34343A' : '#E2E2DE'} gap={22} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                maskColor={dark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.06)'}
                nodeColor={dark ? '#3A3A40' : '#D8D8D4'}
              />
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

      {showPlanning && (
        <PlanningView
          tasks={tasks}
          legend={legend}
          onClose={() => setShowPlanning(false)}
          onSchedule={saveTask}
          onOpenTask={setOpenId}
        />
      )}

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
          onAttachmentsChange={onAttachmentsChange}
        />
      )}

      {showHelp && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-overlay-in"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-sm bg-surface border border-line rounded-2xl shadow-soft p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-fg mb-4">Raccourcis clavier</h3>
            <ul className="space-y-2 text-sm">
              {[
                ['N', 'Nouvelle tâche'],
                ['M', 'Nouveau jalon'],
                ['P', 'Ouvrir le planning'],
                ['F', 'Recentrer le board'],
                ['Suppr', 'Supprimer la sélection'],
                ['↑ ↓ ← →', 'Déplacer la sélection (Maj = fin)'],
                ['Ctrl/⌘ + Z', 'Annuler'],
                ['Alt + glisser', 'Dupliquer'],
                ['Échap', 'Fermer'],
              ].map(([k, d]) => (
                <li key={k} className="flex items-center justify-between gap-4">
                  <span className="text-muted">{d}</span>
                  <kbd className="px-2 py-0.5 rounded-md bg-surface2 border border-line text-xs text-fg font-medium">{k}</kbd>
                </li>
              ))}
            </ul>
            <p className="text-xs text-faint mt-4">Astuce : appuie sur ? pour rouvrir cette fenêtre.</p>
          </div>
        </div>
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
