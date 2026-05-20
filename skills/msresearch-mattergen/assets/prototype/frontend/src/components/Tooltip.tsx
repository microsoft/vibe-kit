import { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  content: string
  children?: React.ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<'top' | 'bottom'>('top')
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      // Show tooltip below if too close to top of viewport
      setPosition(rect.top < 100 ? 'bottom' : 'top')
    }
  }, [isVisible])

  return (
    <span className="relative inline-flex items-center">
      <span
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="ml-1 inline-flex cursor-help items-center justify-center rounded-full text-text-muted hover:text-text"
      >
        {children || (
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path
              strokeLinecap="round"
              strokeWidth="2"
              d="M12 16v-4m0-4h.01"
            />
          </svg>
        )}
      </span>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 w-64 rounded-md bg-surface-raised px-3 py-2 text-xs text-text shadow-lg ${
            position === 'top'
              ? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
              : 'left-1/2 top-full mt-2 -translate-x-1/2'
          }`}
        >
          {content}
          {/* Arrow */}
          <div
            className={`absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-surface-raised ${
              position === 'top' ? '-bottom-1' : '-top-1'
            }`}
          />
        </div>
      )}
    </span>
  )
}
