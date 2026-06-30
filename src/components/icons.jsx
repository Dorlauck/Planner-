// Minimal line icons (inherit color via currentColor). No emojis.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ size = 16, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...rest}>
      {children}
    </svg>
  )
}

export const CursorIcon = (p) => (
  <Svg {...p}>
    <path d="M5 4l6 15 2-6 6-2z" />
  </Svg>
)

export const PenIcon = (p) => (
  <Svg {...p}>
    <path d="M4 20l4-1 9.5-9.5a1.8 1.8 0 0 0 0-2.5l-.5-.5a1.8 1.8 0 0 0-2.5 0L5 16z" />
    <path d="M13.5 6.5l4 4" />
  </Svg>
)

export const CalendarIcon = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
  </Svg>
)

export const PlusIcon = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const SunIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </Svg>
)

export const MoonIcon = (p) => (
  <Svg {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Svg>
)

export const NoteIcon = (p) => (
  <Svg {...p}>
    <path d="M5 4h14v16l-3-2-3 2-3-2-2 1z" />
    <path d="M9 9h6M9 12.5h4" />
  </Svg>
)

export const ChevronLeft = (p) => (
  <Svg {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)

export const ChevronRight = (p) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
)

export const CloseIcon = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const FlagIcon = (p) => (
  <Svg {...p}>
    <path d="M5 21V4M5 4h11l-2 3 2 3H5" />
  </Svg>
)

export const ImageIcon = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M5 18l4.5-4.5L13 17l3-3 3 3" />
  </Svg>
)

export const CheckIcon = (p) => (
  <Svg {...p}>
    <path d="M5 12.5l4 4 10-10" />
  </Svg>
)

export const TrashIcon = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Svg>
)
