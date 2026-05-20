import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'

interface TourStep {
  target: string // data-tour attribute value
  title: string
  body: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  route?: string // Route to navigate to before showing this step
}

const tourSteps: TourStep[] = [
  {
    target: 'mattergen-tab',
    title: 'Welcome to MatterGen',
    body: 'Start here! MatterGen uses AI to generate novel crystal structures with specific properties.',
    placement: 'bottom',
    route: '/generate',
  },
  {
    target: 'property-form',
    title: 'Configure Properties',
    body: 'Select target properties like bulk modulus or band gap, and specify your desired values.',
    placement: 'right',
    route: '/generate',
  },
  {
    target: 'generate-button',
    title: 'Generate Materials',
    body: 'Click here to generate candidate materials. The AI will create structures optimized for your specified properties.',
    placement: 'top',
    route: '/generate',
  },
  {
    target: 'mattersim-tab',
    title: 'Evaluate with MatterSim',
    body: 'After generating structures, use MatterSim to evaluate their stability and other physical properties.',
    placement: 'bottom',
    route: '/generate',
  },
  {
    target: 'file-upload',
    title: 'Upload Structures',
    body: 'Upload CIF files here, or transfer structures from MatterGen to evaluate their stability.',
    placement: 'right',
    route: '/mattersim',
  },
  {
    target: 'run-mattersim',
    title: 'Run Evaluation',
    body: 'Select structures and click here to run MatterSim evaluation. It will calculate stability metrics like energy above hull.',
    placement: 'bottom',
    route: '/mattersim',
  },
  {
    target: '',
    title: "You're All Set!",
    body: 'Start by configuring your target properties and generating candidate materials. Have fun exploring!',
    route: '/generate',
  },
]

export function GuidedTour() {
  const navigate = useNavigate()
  const location = useLocation()
  const tourActive = useAppStore((s) => s.tourActive)
  const endTour = useAppStore((s) => s.endTour)

  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const total = tourSteps.length
  const step = tourSteps[currentStep]

  // Store previously focused element and restore on close
  useEffect(() => {
    if (tourActive) {
      previousFocusRef.current = document.activeElement as HTMLElement
      setCurrentStep(0)
    }
    return () => {
      if (!tourActive && previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [tourActive])

  // Navigate to correct route when step changes
  useEffect(() => {
    if (tourActive && step.route && location.pathname !== step.route) {
      navigate(step.route)
    }
  }, [tourActive, step, location.pathname, navigate])

  // Position the spotlight on the target element
  const updatePosition = useCallback(() => {
    if (!tourActive) return

    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (!el) {
      setTargetRect(null)
      return
    }
    setTargetRect(el.getBoundingClientRect())
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [tourActive, step.target])

  useEffect(() => {
    if (!tourActive) return

    // Small delay to allow navigation to complete
    const timeout = setTimeout(updatePosition, 100)

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [tourActive, updatePosition, currentStep])

  // Focus trap and keyboard navigation
  useEffect(() => {
    if (!tourActive) return

    const card = cardRef.current
    if (!card) return

    // Focus the card
    card.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          endTour()
          break
        case 'ArrowRight':
          e.preventDefault()
          if (currentStep < total - 1) setCurrentStep(currentStep + 1)
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (currentStep > 0) setCurrentStep(currentStep - 1)
          break
        case 'Enter':
          e.preventDefault()
          if (currentStep === total - 1) {
            endTour()
          } else {
            setCurrentStep(currentStep + 1)
          }
          break
        case 'Tab':
          // Trap focus within the card
          const focusable = card.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          const first = focusable[0]
          const last = focusable[focusable.length - 1]

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tourActive, currentStep, total, endTour])

  if (!tourActive) return null

  // Calculate card position
  const cardStyle: React.CSSProperties = { position: 'fixed' }
  const gap = 16

  if (targetRect) {
    const placement = step.placement || 'bottom'
    switch (placement) {
      case 'bottom':
        cardStyle.top = targetRect.bottom + gap
        cardStyle.left = Math.max(16, Math.min(targetRect.left, window.innerWidth - 336))
        break
      case 'top':
        cardStyle.bottom = window.innerHeight - targetRect.top + gap
        cardStyle.left = Math.max(16, Math.min(targetRect.left, window.innerWidth - 336))
        break
      case 'right':
        cardStyle.top = targetRect.top
        cardStyle.left = Math.min(targetRect.right + gap, window.innerWidth - 336)
        break
      case 'left':
        cardStyle.top = targetRect.top
        cardStyle.right = window.innerWidth - targetRect.left + gap
        break
    }
  } else {
    // Center if no target found
    cardStyle.top = '50%'
    cardStyle.left = '50%'
    cardStyle.transform = 'translate(-50%, -50%)'
  }

  const goNext = () => {
    if (currentStep < total - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      endTour()
    }
  }

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Build screen reader announcement
  const getAnnouncement = () => {
    if (currentStep === 0) {
      return `Guided tour started. Step 1 of ${total}: ${step.title}. ${step.body}. Use left and right arrow keys to navigate, or press Escape to close.`
    }
    if (currentStep === total - 1) {
      return `Step ${currentStep + 1} of ${total}: ${step.title}. ${step.body}. Press Enter or click Done to finish the tour.`
    }
    return `Step ${currentStep + 1} of ${total}: ${step.title}. ${step.body}`
  }

  return (
    <>
      {/* Screen reader announcements */}
      <div
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {getAnnouncement()}
      </div>

      {/* Clickable overlay - allows clicking outside to close */}
      <div
        className="fixed inset-0 z-[100]"
        onClick={endTour}
        aria-hidden="true"
      />

      {/* Spotlight on target - creates its own backdrop via box-shadow */}
      {targetRect ? (
        <div
          className="fixed z-[101] rounded-md pointer-events-none transition-all duration-200"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: `
              0 0 0 9999px rgba(0, 0, 0, 0.75),
              0 0 20px 4px var(--accent-glow)
            `,
            border: '1px solid var(--accent-dim)',
          }}
          aria-hidden="true"
        />
      ) : (
        /* Fallback: full dark backdrop when no target element found */
        <div
          className="fixed inset-0 z-[101] bg-black/75"
          aria-hidden="true"
        />
      )}

      {/* Tour card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Guided tour: ${step.title}`}
        tabIndex={-1}
        className="z-[102] w-80 bg-surface border border-border rounded-lg shadow-2xl animate-tour-card-in"
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-xs text-text-muted font-medium">
            {currentStep + 1} of {total}
          </span>
          <button
            onClick={endTour}
            className="p-1 text-text-muted hover:text-text transition-colors focus-ring rounded"
            aria-label="Close tour"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <h3 className="text-base font-semibold text-text mb-1.5 font-display">{step.title}</h3>
          <p className="text-sm text-text-muted leading-relaxed">{step.body}</p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4 pb-2">
          <button
            onClick={goPrev}
            disabled={currentStep === 0}
            aria-label={
              currentStep === 0
                ? 'Back (disabled, this is the first step)'
                : `Back to step ${currentStep} of ${total}`
            }
            className={`px-3 py-1.5 text-sm rounded transition-colors focus-ring ${
              currentStep === 0
                ? 'text-text-dim cursor-not-allowed'
                : 'text-text-muted hover:text-text hover:bg-surface-raised'
            }`}
          >
            Back
          </button>

          {/* Step dots */}
          <div className="flex gap-1.5" aria-hidden="true">
            {tourSteps.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentStep
                    ? 'bg-accent'
                    : i < currentStep
                    ? 'bg-accent/50'
                    : 'bg-border'
                }`}
              />
            ))}
          </div>

          <button
            onClick={goNext}
            aria-label={
              currentStep === total - 1
                ? 'Done, finish the tour'
                : `Next, go to step ${currentStep + 2} of ${total}`
            }
            className="px-3 py-1.5 text-sm bg-accent text-bg rounded font-medium hover:brightness-110 hover:-translate-y-px active:translate-y-0 transition-all focus-ring"
          >
            {currentStep === total - 1 ? 'Done' : 'Next'}
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="px-4 pb-3 pt-1">
          <p className="text-[0.65rem] text-text-dim text-center">
            <kbd className="px-1 py-0.5 bg-bg rounded text-text-muted">←</kbd>{' '}
            <kbd className="px-1 py-0.5 bg-bg rounded text-text-muted">→</kbd> to navigate
            ·{' '}
            <kbd className="px-1 py-0.5 bg-bg rounded text-text-muted ml-1">Esc</kbd> to
            close
          </p>
        </div>
      </div>
    </>
  )
}
