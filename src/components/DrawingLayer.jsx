import { useEffect, useRef } from 'react'
import { useViewport } from '@xyflow/react'

// Build an SVG path from a list of flow-space points.
export function pointsToPath(points) {
  if (!points || points.length === 0) return ''
  if (points.length === 1) {
    const p = points[0]
    return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y + 0.1}`
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

// Renders every persisted stroke (plus the one being drawn) in flow
// coordinates, so they pan and zoom together with the board. Pointer events are
// only captured while in draw mode; otherwise the layer is click-through.
export default function DrawingLayer({ active, strokes, current, onPointerDown, onPointerMove, onPointerUp, onWheelZoom }) {
  const { x, y, zoom } = useViewport()
  const ref = useRef(null)

  // While drawing, the overlay sits on top and would otherwise swallow the
  // wheel (the browser then zooms the page). We capture it with a *non-passive*
  // native listener so preventDefault works, and zoom the board instead.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    function handler(e) {
      if (!active) return
      e.preventDefault()
      onWheelZoom?.(e)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [active, onWheelZoom])

  return (
    <svg
      ref={ref}
      className="absolute inset-0 w-full h-full"
      style={{
        pointerEvents: active ? 'auto' : 'none',
        cursor: active ? 'crosshair' : 'default',
        zIndex: 5,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <g transform={`translate(${x} ${y}) scale(${zoom})`}>
        {strokes.map((s) => (
          <path
            key={s.id}
            d={pointsToPath(s.points)}
            stroke={s.color}
            strokeWidth={s.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {current && (
          <path
            d={pointsToPath(current.points)}
            stroke={current.color}
            strokeWidth={current.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>
    </svg>
  )
}
