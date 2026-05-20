import type { Structure } from '../api/types'
import { MetricsBadge, StabilityDot } from './MetricsBadge'
import { CrystalThumbnail } from './CrystalThumbnail'

interface CandidateCardProps {
  structure: Structure
  displayNumber: number
  selected?: boolean
  showCheckbox?: boolean
  showEvaluationStatus?: boolean
  isNew?: boolean
  onSelect?: (id: string) => void
  onClick?: (id: string) => void
  /** Animation index for staggered entrance animation */
  animationIndex?: number
}

export function CandidateCard({
  structure,
  displayNumber,
  selected = false,
  showCheckbox = false,
  showEvaluationStatus = false,
  isNew = false,
  onSelect,
  onClick,
  animationIndex = 0,
}: CandidateCardProps) {
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect?.(structure.id)
  }

  const handleCardClick = () => {
    onClick?.(structure.id)
  }

  // Calculate stagger delay (55ms per card, capped at 500ms)
  const staggerDelay = Math.min(animationIndex * 55, 500)

  return (
    <div
      onClick={handleCardClick}
      className={`
        relative cursor-pointer overflow-hidden rounded-lg border transition-all
        hover:border-border-bright hover:bg-surface-raised/50
        animate-card-in
        ${
          selected
            ? 'border-accent bg-accent/10'
            : showEvaluationStatus && !structure.metrics
              ? 'border-border bg-bg/50'
              : 'border-border bg-surface/50'
        }
      `}
      style={{ animationDelay: `${staggerDelay}ms` }}
    >
      {/* Evaluated indicator */}
      {showEvaluationStatus && structure.metrics && (
        <div className="absolute left-2 top-2 z-10">
          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            ✓ Evaluated
          </span>
        </div>
      )}

      {/* New indicator (MatterGen only) */}
      {isNew && !showEvaluationStatus && (
        <div className="absolute left-2 top-2 z-10">
          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            New
          </span>
        </div>
      )}

      {/* 3D Crystal Thumbnail */}
      <CrystalThumbnail
        crystalData={structure.crystalData}
        structureId={structure.id}
      />

      {/* Card content */}
      <div className="p-3 min-h-[106px]">
        {/* Index and checkbox row */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-text-dim">
            #{displayNumber}
          </div>
          {showCheckbox && (
            <div onClick={handleCheckboxClick}>
              <input
                type="checkbox"
                checked={selected}
                onChange={() => {}} // Controlled by onClick
                className="h-4 w-4 rounded border-border-bright bg-surface-raised text-accent focus:ring-accent"
              />
            </div>
          )}
        </div>

        {/* IUPAC Systematic Name (title) - fallback to formula if not available */}
        <div className="mt-1 truncate text-sm font-medium text-text">
          {structure.systematicName || structure.formula}
        </div>

        {/* Formula (subtitle) */}
        <div className="mt-0.5 truncate text-xs text-text-muted">
          {structure.formula}
        </div>

        {/* Metrics badge (if evaluated) */}
        {structure.metrics && (
          <div className="mt-2 flex items-end justify-between">
            <MetricsBadge metrics={structure.metrics} />
            <StabilityDot metrics={structure.metrics} />
          </div>
        )}
      </div>

      {/* Not evaluated overlay */}
      {showEvaluationStatus && !structure.metrics && (
        <div className="absolute bottom-0 left-0 right-0 bg-surface-raised/80 px-2 py-1 text-center text-[10px] text-text-muted">
          Not evaluated
        </div>
      )}
    </div>
  )
}
