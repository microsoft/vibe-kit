import type { StructureMetrics } from '../api/types'

interface MetricsBadgeProps {
  metrics: StructureMetrics
}

function getStabilityInfo(energyAboveHull: number): {
  dotColor: string
  label: string
} {
  if (energyAboveHull < 0.1) {
    return { dotColor: 'bg-green-400', label: 'Stable' }
  } else if (energyAboveHull < 0.2) {
    return { dotColor: 'bg-yellow-400', label: 'Marginal' }
  } else {
    return { dotColor: 'bg-red-400', label: 'Unstable' }
  }
}

export function StabilityDot({ metrics }: MetricsBadgeProps) {
  const hasEnergyAboveHull = metrics.energyAboveHull !== null && metrics.energyAboveHull !== undefined

  if (hasEnergyAboveHull) {
    const stability = getStabilityInfo(metrics.energyAboveHull!)
    return (
      <span
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${stability.dotColor}`}
        title={`${stability.label} (${metrics.energyAboveHull!.toFixed(3)} eV/at above hull)`}
      />
    )
  }

  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-border-bright"
      title="Energy above hull not available for this chemical system"
    />
  )
}

export function MetricsBadge({ metrics }: MetricsBadgeProps) {
  const hasEnergyPerAtom = metrics.energyPerAtom !== null && metrics.energyPerAtom !== undefined

  if (!hasEnergyPerAtom) {
    return (
      <div
        className="inline-flex rounded border border-border/50 bg-surface-raised/50 px-1.5 py-0.5 text-[10px] font-medium text-text-dim"
        title="No energy data available"
      >
        --
      </div>
    )
  }

  return (
    <div
      className="inline-flex rounded border border-border-bright/50 bg-surface-raised/50 px-1.5 py-0.5 text-[10px] font-medium text-text-muted"
      title="Energy per atom"
    >
      {metrics.energyPerAtom!.toFixed(3)} eV/at
    </div>
  )
}
