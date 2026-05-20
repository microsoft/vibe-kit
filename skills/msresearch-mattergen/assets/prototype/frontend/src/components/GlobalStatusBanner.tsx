import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'

export function GlobalStatusBanner() {
  const isGenerating = useAppStore((s) => s.isGenerating)
  const evaluationStatus = useAppStore((s) => s.evaluationStatus)
  const isEvaluating = evaluationStatus === 'running'
  const isActive = isGenerating || isEvaluating
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Reset and start timer when an operation starts
  useEffect(() => {
    if (!isActive) {
      setElapsedSeconds(0)
      return
    }

    setElapsedSeconds(0)
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive])

  if (!isActive) {
    return null
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  const message = isGenerating
    ? 'Generating materials...'
    : 'Running MatterSim evaluation...'

  const bgClass = isGenerating
    ? 'border-accent/50'
    : 'border-green-500/50'

  const textClass = isGenerating ? 'text-accent' : 'text-green-400'

  return (
    <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 text-sm bg-surface-raised border ${bgClass} rounded-full shadow-lg`}>
      {/* Spinner */}
      <svg
        className={`h-4 w-4 animate-spin ${textClass}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className={textClass}>{message}</span>
      <span className={`font-mono ${textClass} opacity-70`}>{formatTime(elapsedSeconds)}</span>
    </div>
  )
}
