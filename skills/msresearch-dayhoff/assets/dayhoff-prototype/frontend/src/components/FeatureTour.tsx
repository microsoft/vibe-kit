import { useState, useEffect, useRef, useCallback } from 'react'

interface TourStep {
  target: string | null
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

interface Props {
  steps: TourStep[]
  onComplete: () => void
}

export function FeatureTour({ steps, onComplete }: Props) {
  const [current, setCurrent] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<{top:number,left:number,width:number,height:number}|null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<HTMLDivElement>(null)

  const step = steps[current]
  const isFirst = current === 0
  const isLast = current === steps.length - 1
  const isWelcome = !step?.target

  const updateSpotlight = useCallback(() => {
    if (!step?.target) { setSpotlightRect(null); return }
    const el = document.querySelector(step.target)
    if (!el) { setSpotlightRect(null); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      const pad = 8
      setSpotlightRect({
        top: r.top - pad + window.scrollY,
        left: r.left - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      })
    })
  }, [step])

  useEffect(() => { updateSpotlight() }, [updateSpotlight, current])
  useEffect(() => {
    const fn = () => updateSpotlight()
    window.addEventListener('resize', fn)
    window.addEventListener('scroll', fn, true)
    return () => { window.removeEventListener('resize', fn); window.removeEventListener('scroll', fn, true) }
  }, [updateSpotlight])

  // ── Focus card on each step change for keyboard nav ──
  useEffect(() => { 
    setTimeout(() => {
      cardRef.current?.focus()
      // Scroll card into view
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 150)
  }, [current])

  useEffect(() => {
    if (!liveRef.current) return
    liveRef.current.textContent = `Step ${current + 1} of ${steps.length}: ${step.title}. ${step.content}`
  }, [current, step, steps.length])

  const close = useCallback(() => onComplete(), [onComplete])
  const next = useCallback(() => { isLast ? close() : setCurrent(c => c + 1) }, [isLast, close])
  const prev = useCallback(() => { if (!isFirst) setCurrent(c => c - 1) }, [isFirst])

  // Global keydown listener for keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); e.preventDefault() }
      else if (e.key === 'ArrowRight') { next(); e.preventDefault() }
      else if (e.key === 'ArrowLeft') { prev(); e.preventDefault() }
      else if (e.key === 'Enter' && isLast) { close(); e.preventDefault() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [close, next, prev, isLast])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); e.preventDefault() }
    else if (e.key === 'ArrowRight') { next(); e.preventDefault() }
    else if (e.key === 'ArrowLeft') { prev(); e.preventDefault() }
    else if (e.key === 'Enter' && isLast) { close(); e.preventDefault() }
  }, [close, next, prev, isLast])

  const cardStyle: React.CSSProperties = (() => {
    if (!spotlightRect) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    const gap = 16
    const cardWidth = 360
    const cardHeight = 200 // approximate
    const placement = step?.placement || 'top'

    // Center card horizontally relative to spotlight, clamped to viewport
    const spotCenter = spotlightRect.left + spotlightRect.width / 2
    const idealLeft = spotCenter - cardWidth / 2
    const clampedLeft = Math.max(16, Math.min(idealLeft, window.innerWidth - cardWidth - 16))

    if (placement === 'top') {
      // Position card above the spotlight
      const topPos = spotlightRect.top - cardHeight - gap
      return { position: 'absolute', top: Math.max(8, topPos), left: clampedLeft, maxWidth: cardWidth }
    }
    if (placement === 'bottom') {
      return { position: 'absolute', top: spotlightRect.top + spotlightRect.height + gap, left: clampedLeft, maxWidth: cardWidth }
    }
    if (placement === 'right') {
      // Position card to the right of spotlight, vertically centered
      const rightLeft = spotlightRect.left + spotlightRect.width + gap
      const safeLeft = rightLeft + cardWidth > window.innerWidth ? spotlightRect.left - cardWidth - gap : rightLeft
      const centerTop = spotlightRect.top + spotlightRect.height / 2 - cardHeight / 2
      const clampedTop = Math.max(8, Math.min(centerTop, document.documentElement.scrollHeight - cardHeight - 8))
      return { position: 'absolute', top: clampedTop, left: Math.max(16, safeLeft), maxWidth: cardWidth }
    }
    return { position: 'absolute', top: spotlightRect.top + spotlightRect.height + gap, left: clampedLeft, maxWidth: cardWidth }
  })()

  return (
    <>
      <div ref={liveRef} aria-live="assertive" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }} />

      <div className="tour-overlay" onClick={close} style={isWelcome ? { background: 'rgba(0,0,0,0.55)' } : { background: 'transparent' }} />

      {spotlightRect && (
        <div className="tour-spotlight" style={{ top: spotlightRect.top, left: spotlightRect.left, width: spotlightRect.width, height: spotlightRect.height }} />
      )}

      <div
        ref={cardRef}
        className={`tour-card ${isWelcome ? 'tour-card--welcome' : ''}`}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {isWelcome ? (
          <>
            <button className="tour-card__close" onClick={close} aria-label="Skip tour">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <div className="tour-welcome__brand">
              <svg width="28" height="28" viewBox="0 0 21 21"><rect width="10" height="10" fill="#f25022"/><rect x="11" width="10" height="10" fill="#7fba00"/><rect y="11" width="10" height="10" fill="#00a4ef"/><rect x="11" y="11" width="10" height="10" fill="#ffb900"/></svg>
              <span className="tour-welcome__label">Microsoft Research</span>
            </div>
            <div className="tour-card__title" style={{ fontSize: 20, marginTop: 12 }}>{step.title}</div>
            <div className="tour-welcome__tagline">Protein Sequence Design</div>
            <div className="tour-card__content" style={{ marginTop: 14 }}>{step.content}</div>
            <div className="tour-card__footer" style={{ justifyContent: 'space-between' }}>
              <button className="tour-welcome__skip" onClick={close}>Skip tour</button>
              <button className="btn-tour--primary" style={{ padding: '8px 24px', fontSize: 13 }} onClick={next}>Get Started</button>
            </div>
            <div className="tour-card__hints">← → navigate · Esc close</div>
          </>
        ) : (
          <>
            <div className="tour-card__header">
              <span className="tour-card__step">{current + 1} of {steps.length}</span>
              <button className="tour-card__close" onClick={close} aria-label="Close tour">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="tour-card__title">{step.title}</div>
            <div className="tour-card__content">{step.content}</div>
            <div className="tour-card__footer">
              <div className="tour-card__dots">
                {steps.map((_, i) => (
                  <button key={i} className={`tour-card__dot ${i === current ? 'tour-card__dot--active' : i < current ? 'tour-card__dot--done' : ''}`} onClick={() => setCurrent(i)} aria-label={`Go to step ${i + 1}`} />
                ))}
              </div>
              <div className="tour-card__nav">
                {!isFirst && <button className="btn-tour--outline" onClick={prev}>Back</button>}
                <button className="btn-tour--primary" onClick={next}>{isLast ? 'Done' : 'Next'}</button>
              </div>
            </div>
            <div className="tour-card__hints">← → navigate · Esc close</div>
          </>
        )}
      </div>
    </>
  )
}
