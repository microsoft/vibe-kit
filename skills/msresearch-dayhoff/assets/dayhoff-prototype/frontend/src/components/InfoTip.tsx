import { useId, useState } from 'react'

/**
 * Visible, accessible inline tooltip.
 *
 * Shows a small ⓘ icon next to a label. Hover, focus, or tap reveals a short
 * popover with the explanation. Keyboard-accessible (focusable button, Esc to
 * dismiss). Designed for inline use next to advanced-control labels.
 *
 * Why not native title="" — the browser default has a ~1.5s delay, no visible
 * affordance, and is invisible to keyboard users. Researcher feedback
 * (`docs/dayhoff-product-feedback-roadmap.md` § "Add microcopy near every
 * advanced concept") explicitly asked for visible explanations.
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="infotip" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="infotip__trigger"
        aria-label={`More info: ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="4.4" r="0.95" fill="currentColor" />
          <rect x="7.25" y="6.6" width="1.5" height="5.4" rx="0.6" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <span role="tooltip" id={id} className="infotip__bubble">
          {children}
        </span>
      )}
    </span>
  )
}
