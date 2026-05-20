import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * FeatureTour — Guided walkthrough for BioEmu prototype.
 *
 * Accessibility:
 *  - role="dialog", aria-modal="true"
 *  - aria-live region announces each step
 *  - Focus trapped inside card; restored on close
 *  - ArrowRight/Left to navigate, Escape to close
 *
 * Visual:
 *  - Box-shadow spotlight with accent glow
 *  - Step dots + "N of M" counter
 *  - Keyboard hints footer
 */

const FeatureTour = ({ steps, onComplete }) => {
  const [current, setCurrent] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const cardRef = useRef(null);
  const previousFocusRef = useRef(null);
  const liveRegionRef = useRef(null);

  const step = steps[current];
  const isFirst = current === 0;
  const isLast = current === steps.length - 1;
  const isWelcome = !step?.target;

  // ── Spotlight positioning ──────────────────────────────────
  const updateSpotlight = useCallback(() => {
    if (!step?.target) { setSpotlightRect(null); return; }
    const el = document.querySelector(step.target);
    if (!el) { setSpotlightRect(null); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Small delay to let scroll finish
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const pad = 8;
      setSpotlightRect({
        top: r.top - pad + window.scrollY,
        left: r.left - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      });
    });
  }, [step]);

  useEffect(() => { updateSpotlight(); }, [updateSpotlight, current]);
  useEffect(() => {
    const onResize = () => updateSpotlight();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onResize, true); };
  }, [updateSpotlight]);

  // ── Focus management ───────────────────────────────────────
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    cardRef.current?.focus();
    return () => { previousFocusRef.current?.focus(); };
  }, []);

  // ── Announce step to screen readers ────────────────────────
  useEffect(() => {
    if (!liveRegionRef.current) return;
    const n = current + 1;
    const m = steps.length;
    let msg;
    if (isFirst) {
      msg = `Guided tour started. Step ${n} of ${m}: ${step.title}. ${step.content}. Use left and right arrow keys to navigate, or press Escape to close.`;
    } else if (isLast) {
      msg = `Step ${n} of ${m}: ${step.title}. ${step.content}. Press Enter or click Done to finish the tour.`;
    } else {
      msg = `Step ${n} of ${m}: ${step.title}. ${step.content}`;
    }
    liveRegionRef.current.textContent = msg;
  }, [current, step, steps.length, isFirst, isLast]);

  // ── Keyboard ───────────────────────────────────────────────
  const close = useCallback(() => { onComplete(); }, [onComplete]);
  const next = useCallback(() => { isLast ? close() : setCurrent(c => c + 1); }, [isLast, close]);
  const prev = useCallback(() => { if (!isFirst) setCurrent(c => c - 1); }, [isFirst]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { close(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { next(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { prev(); e.preventDefault(); }
    else if (e.key === 'Enter' && isLast) { close(); e.preventDefault(); }
    // Focus trap: tab cycles within card
    else if (e.key === 'Tab') {
      const focusable = cardRef.current?.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  }, [close, next, prev, isLast]);

  // ── Card placement ─────────────────────────────────────────
  const placement = step?.placement || 'bottom';
  const cardStyle = (() => {
    if (!spotlightRect) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const gap = 16;
    const s = { position: 'absolute' };
    if (placement === 'bottom') {
      s.top = spotlightRect.top + spotlightRect.height + gap;
      s.left = spotlightRect.left;
    } else if (placement === 'top') {
      s.bottom = window.innerHeight - spotlightRect.top + gap + window.scrollY;
      s.left = spotlightRect.left;
    } else if (placement === 'right') {
      s.top = spotlightRect.top;
      s.left = spotlightRect.left + spotlightRect.width + gap;
    } else if (placement === 'left') {
      s.top = spotlightRect.top;
      s.right = window.innerWidth - spotlightRect.left + gap;
    }
    return s;
  })();

  return (
    <>
      {/* Screen-reader live region */}
      <div ref={liveRegionRef} aria-live="assertive" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }} />

      {/* Backdrop overlay */}
      <div className="tour-overlay" onClick={close} style={isWelcome ? { background: 'rgba(0, 0, 0, 0.55)' } : undefined} />

      {/* Spotlight cutout */}
      {spotlightRect && (
        <div
          className="tour-spotlight"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      )}

      {/* Tour card */}
      <div
        ref={cardRef}
        className={`tour-card ${isWelcome ? 'tour-card--welcome' : ''}`}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${current + 1} of ${steps.length}`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {isWelcome ? (
          <>
            {/* Welcome hero layout */}
            <button className="tour-card__close" onClick={close} aria-label="Skip tour" style={{ position: 'absolute', top: 14, right: 14 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="tour-welcome__brand">
              <svg width="28" height="28" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="10" height="10" fill="#f25022" />
                <rect x="11" width="10" height="10" fill="#7fba00" />
                <rect y="11" width="10" height="10" fill="#00a4ef" />
                <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
              </svg>
              <span className="tour-welcome__label">Microsoft Research</span>
            </div>

            <div className="tour-card__title" style={{ fontSize: 20, marginTop: 12, marginBottom: 4 }}>{step.title}</div>
            <div className="tour-welcome__tagline">Equilibrium Conformation Sampling</div>
            <div className="tour-card__content" style={{ marginTop: 14 }}>{step.content}</div>

            {/* Footer */}
            <div className="tour-card__footer" style={{ justifyContent: 'space-between' }}>
              <button className="tour-welcome__skip" onClick={close}>Skip tour</button>
              <button className="btn-primary" style={{ padding: '8px 24px', fontSize: 13 }} onClick={next}>
                Get Started →
              </button>
            </div>

            <div className="tour-card__hints">← → navigate · Esc close</div>
          </>
        ) : (
          <>
            {/* Standard step layout */}
            <div className="tour-card__header">
              <span className="tour-card__step">{current + 1} of {steps.length}</span>
              <button className="tour-card__close" onClick={close} aria-label="Close tour">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="tour-card__title">{step.title}</div>
            <div className="tour-card__content">{step.content}</div>

            <div className="tour-card__footer">
              <div className="tour-card__dots">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    className={`tour-card__dot ${i === current ? 'tour-card__dot--active' : i < current ? 'tour-card__dot--done' : ''}`}
                    onClick={() => setCurrent(i)}
                    aria-label={`Go to step ${i + 1}`}
                  />
                ))}
              </div>
              <div className="tour-card__nav">
                {!isFirst && (
                  <button className="btn-outline" style={{ padding: '5px 14px', fontSize: 12 }} onClick={prev} aria-label={`Back, go to step ${current} of ${steps.length}`}>
                    Back
                  </button>
                )}
                <button className="btn-primary" style={{ padding: '5px 14px', fontSize: 12 }} onClick={next} aria-label={isLast ? 'Finish tour' : `Next, go to step ${current + 2} of ${steps.length}`}>
                  {isLast ? 'Done' : 'Next'}
                </button>
              </div>
            </div>

            <div className="tour-card__hints">← → navigate · Esc close</div>
          </>
        )}
      </div>
    </>
  );
};

export default FeatureTour;
