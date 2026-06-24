import { useEffect, useRef, useState } from 'react'

// A free-text annotation on the board. It is a React Flow node (so it can be
// dragged, box-selected and deleted like anything else) but has no connection
// handles — it never takes part in the dependency graph.
export default function TextNode({ id, data, selected }) {
  const [val, setVal] = useState(data.content ?? '')
  const ref = useRef(null)

  useEffect(() => {
    setVal(data.content ?? '')
  }, [data.content])

  // Auto-grow + optional autofocus for freshly created text.
  useEffect(() => {
    autosize()
    if (data.autoFocus && ref.current) {
      ref.current.focus()
      ref.current.select()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function autosize() {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div
      className={`rounded-lg px-2 py-1 transition ${
        selected ? 'ring-2 ring-peach-300 bg-white/60' : ''
      }`}
    >
      <textarea
        ref={ref}
        value={val}
        onChange={(e) => {
          setVal(e.target.value)
          autosize()
        }}
        onBlur={() => data.onCommit?.(id, val)}
        rows={1}
        placeholder="Texte libre…"
        className="nodrag nopan bg-transparent text-dusk-800 text-base font-medium leading-snug resize-none overflow-hidden focus:outline-none w-44 placeholder:text-dusk-300 placeholder:font-normal"
      />
    </div>
  )
}
