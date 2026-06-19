import { useRef, useEffect } from 'react'

const TOOLS = [
  { cmd: 'bold', label: 'B', className: 'font-bold', title: 'Gras' },
  { cmd: 'italic', label: 'I', className: 'italic', title: 'Italique' },
  { cmd: 'underline', label: 'U', className: 'underline', title: 'Souligné' },
  { cmd: 'insertUnorderedList', label: '•', title: 'Liste à puces' },
  { cmd: 'insertOrderedList', label: '1.', title: 'Liste numérotée' },
  { cmd: 'formatBlock:H3', label: 'T', className: 'font-serif font-semibold', title: 'Titre' },
]

// Lightweight rich-text editor over contentEditable. Stores HTML.
// Images are NOT embedded inline — pasted images are forwarded to onPasteImage
// so they go through compression + storage instead of bloating the note.
export default function RichEditor({ initialHtml = '', onChange, onPasteImage, placeholder }) {
  const ref = useRef(null)

  // Set content once on mount (avoids caret jumps while typing).
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function emitChange() {
    const el = ref.current
    if (!el) return
    onChange(el.textContent.trim() ? el.innerHTML : '')
  }

  function exec(cmd) {
    if (cmd.startsWith('formatBlock:')) {
      const tag = cmd.split(':')[1]
      document.execCommand('formatBlock', false, tag)
    } else {
      document.execCommand(cmd, false, null)
    }
    ref.current?.focus()
    emitChange()
  }

  function handlePaste(e) {
    const items = [...(e.clipboardData?.items ?? [])]
    const images = items
      .filter((i) => i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter(Boolean)
    if (images.length) {
      e.preventDefault()
      onPasteImage?.(images)
    }
    // text / html paste keeps its default behaviour
  }

  return (
    <div className="bg-white/70 rounded-2xl focus-within:ring-2 focus-within:ring-peach-300">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-peach-100">
        {TOOLS.map((t) => (
          <button
            key={t.cmd}
            type="button"
            title={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(t.cmd)}
            className={`w-7 h-7 rounded-lg text-sm text-dusk-600 hover:bg-peach-50 ${t.className ?? ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="rich-editor min-h-[8rem] max-h-[40vh] overflow-y-auto scrollbar-thin p-4 text-sm leading-relaxed text-dusk-900 focus:outline-none"
      />
    </div>
  )
}
