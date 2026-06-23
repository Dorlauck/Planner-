// Dependency logic for the project board.
//
// A dependency row { task_id, depends_on_id } means:
//   `task_id` needs `depends_on_id` to be done first.
// On the graph we draw an arrow from the prerequisite to the dependent task:
//   depends_on_id  ──▶  task_id

// For each task, work out whether it is blocked (has unfinished prerequisites),
// ready (a to-do with everything it needs already done) or done.
export function computeTaskStates(tasks, deps) {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const states = new Map()

  for (const task of tasks) {
    const prereqIds = deps
      .filter((d) => d.task_id === task.id)
      .map((d) => d.depends_on_id)

    const remaining = prereqIds.filter((id) => byId.get(id)?.status !== 'done')

    const blocked = task.status !== 'done' && remaining.length > 0
    const ready = task.status === 'todo' && remaining.length === 0

    states.set(task.id, {
      prereqIds,
      remaining,
      blocked,
      ready,
    })
  }

  return states
}

// Can `to` already be reached from `from` following prerequisite → dependent
// arrows? Used to forbid dependencies that would create an impossible loop.
function reaches(deps, from, to) {
  const out = new Map()
  for (const d of deps) {
    if (!out.has(d.depends_on_id)) out.set(d.depends_on_id, [])
    out.get(d.depends_on_id).push(d.task_id)
  }
  const seen = new Set()
  const stack = [from]
  while (stack.length) {
    const node = stack.pop()
    if (node === to) return true
    if (seen.has(node)) continue
    seen.add(node)
    for (const next of out.get(node) ?? []) stack.push(next)
  }
  return false
}

// Adding "source is a prerequisite of target" creates a cycle only if target
// can already reach source.
export function wouldCreateCycle(deps, source, target) {
  if (source === target) return true
  return reaches(deps, target, source)
}
