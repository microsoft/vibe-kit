import { estimateRange, formatEstimateMinutes, pipelinePhase, PIPELINE_STEPS } from '../constants'
import type { GenerationProgressPhase } from '../api'

interface Props {
  elapsed: number
  selectedModel: string
  numSeq: number
  maxLen: number
  livePhase?: GenerationProgressPhase | null
}

// Map backend phase -> pipeline step index (PIPELINE_STEPS order).
// Falls back to time-based estimate when no live phase has been received yet.
const PHASE_TO_STEP: Record<string, number> = {
  received: 0,
  calling_aml: 1,
  validating_output: 2,
  screening: 3,
  done: PIPELINE_STEPS.length,
}

const PHASE_LABEL: Record<string, string> = {
  received: 'Request received',
  calling_aml: 'Calling Azure ML scoring endpoint',
  validating_output: 'Validating model output',
  screening: 'Running safety screening',
  done: 'Complete',
  error: 'Server error',
  unknown: 'Waiting for server',
}

export function GenerationProgress({ elapsed, selectedModel, numSeq, maxLen, livePhase }: Props) {
  const is3B = selectedModel.startsWith('3b')
  const estimatedPhase = pipelinePhase(elapsed, is3B)
  const livePhaseStep = livePhase && livePhase.phase in PHASE_TO_STEP ? PHASE_TO_STEP[livePhase.phase] : null
  const phase = livePhaseStep !== null ? livePhaseStep : estimatedPhase
  const [estLo, estHi] = estimateRange(selectedModel, numSeq, maxLen)
  const estMid = Math.round((estLo + estHi) / 2)
  const pct = Math.min(95, Math.round((elapsed / estMid) * 100))
  const phaseLabel = livePhase && livePhase.phase !== 'unknown' ? (PHASE_LABEL[livePhase.phase] || livePhase.phase) : null

  return (
    <div className="gen-progress">
      <div className="gen-progress__header">
        <div>
          <div className="gen-progress__eyebrow">Working</div>
          <span className="gen-progress__title">Generating {numSeq} sequence{numSeq === 1 ? '' : 's'}</span>
        </div>
        <span className="gen-progress__time">{elapsed}s{elapsed < estMid ? ` / ~${estLo}–${estHi}s` : ''}</span>
      </div>

      <div className="gen-progress__bar-bg">
        <div className="gen-progress__bar" style={{ width: `${pct}%` }} />
      </div>

      <div className="gen-progress__steps">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step.key} className={`gen-step ${i < phase ? 'gen-step--done' : i === phase ? 'gen-step--active' : ''}`}>
            <span className="gen-step__icon">{i < phase ? '✓' : step.icon}</span>
            <span className="gen-step__label">{step.label}</span>
          </div>
        ))}
      </div>

      <div className="gen-progress__meta">
        {is3B
          ? `3B model · higher quality, longer inference`
          : `170M model · smaller, faster inference`}
        {' · '}{maxLen} max residues
      </div>

      <div className="gen-progress__live-notice">
        {phaseLabel
          ? `Live · ${phaseLabel}`
          : `Generating live on Azure ML. ${is3B ? '3B' : '170M'} model typically takes ${formatEstimateMinutes(selectedModel)}.`}
      </div>

      {/* Skeleton result cards */}
      <div className="gen-skeletons">
        {Array.from({ length: Math.min(numSeq, 3) }).map((_, i) => (
          <div key={i} className="skel-card" style={{ animationDelay: `${i * 0.15}s` }}>
            <div className="skel-line skel-line--short" />
            <div className="skel-bar" />
            <div className="skel-line skel-line--full" />
            <div className="skel-line skel-line--full" />
            <div className="skel-line skel-line--med" />
          </div>
        ))}
        {numSeq > 3 && <div className="skel-more">+{numSeq - 3} more</div>}
      </div>
    </div>
  )
}
