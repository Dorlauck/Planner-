import { useViewport } from '@xyflow/react'

// Build an SVG path from a list of flow-space points.
export function pointsToPath(points) {
  if (!points || points.length === 0) return ''
  if (points.length === 1) {
    // a dot — draw a tiny segment so it shows up
    const p = points[0]
    return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y + 0.1}`
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

// Renders every persisted stroke (plus the one being drawn) in flow
// coordinates, so they pan and zoom together with the board. Pointer events are
// only captured while in draw mode; otherwise the layer is click-through.
export default function DrawingLayer({ active, strokes, current, onPointerDown, onPointerMove, onPointerUp }) {
  const { x, y, zoom } = useViewport()

  return (
    <svg
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
