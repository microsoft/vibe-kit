import { useState } from 'react'
import { predictStructure } from '../api'
import { colorSeq, fitnessLevel, proteinNameForPrompt, normalizePrompt } from '../constants'
import type { TaskPreset } from '../constants'
import { MolstarStructureViewer } from './MolstarStructureViewer'
import { VariantTable } from './VariantTable'
import type { GenerationResponse, SequenceWithFitness } from '../types'

function commonPrefixLen(seq: string, prompt: string): number {
  const upper = seq.toUpperCase()
  const max = Math.min(upper.length, prompt.length)
  let i = 0
  while (i < max && upper.charCodeAt(i) === prompt.charCodeAt(i)) i++
  return i
}

function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r === 0 ? `${m}m` : `${m}m ${r}s`
}

interface ResultsProps {
  results: GenerationResponse
  selectedModel: string
  isDemo: boolean
  prompt: string
  taskPreset?: TaskPreset
  elapsedSeconds?: number | null
  esmfoldMax?: number
  onExport: (fmt: string) => void
  onHome: () => void
}

export function ResultsView({ results, selectedModel, isDemo, prompt, taskPreset, elapsedSeconds, esmfoldMax = 400, onExport, onHome }: ResultsProps) {
  const isVariantScoring = taskPreset === 'score'
  const normalizedPrompt = normalizePrompt(prompt)
  const seedLen = normalizedPrompt.length
  const proteinName = proteinNameForPrompt(normalizedPrompt)
  const [copiedAll, setCopiedAll] = useState(false)

  const copyAllFasta = () => {
    const fasta = results.sequences_with_fitness
      .map((s, i) => `>dayhoff_${i + 1} score=${s.fitness_score.toFixed(1)} length=${s.length}\n${s.sequence}`)
      .join('\n')
    navigator.clipboard.writeText(fasta)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 1500)
  }

  return (
    <div className="results">
      <div className="results-header">
        <div>
          <div className="results-header__eyebrow">Output</div>
          <h2 className="results-header__title">{proteinName ? `${proteinName} candidates` : 'Generated candidates'}</h2>
          <div className="results-header__meta">
            {results.stats.total_generated} candidate{results.stats.total_generated === 1 ? '' : 's'} from {seedLen}-residue seed
          </div>
        </div>
        <div className="results-header__actions">
          <button className="btn-outline btn-outline--sm" onClick={onHome} title="Start a new generation">← New</button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="results-stats">
        <div className="results-stats__group">
          <span className="results-stats__label">Model</span>
          <span className="results-stats__val">{results.stats.model || selectedModel}</span>
        </div>
        <div className="results-stats__group">
          <span className="results-stats__label">Avg likelihood</span>
          <span className="results-stats__val" title="Mean Dayhoff sequence-plausibility score across all candidates (0–100, higher is better).">{results.stats.avg_fitness.toFixed(0)}/100</span>
        </div>
        {elapsedSeconds != null && elapsedSeconds > 0 && (
          <div className="results-stats__group">
            <span className="results-stats__label">Generated in</span>
            <span className="results-stats__val" title="Wall-clock time from request to response, including network and Azure ML inference.">{formatElapsed(elapsedSeconds)}</span>
          </div>
        )}
        {isDemo && (
          <div className="results-stats__group">
            <span className="results-stats__label">Source</span>
            <span className="results-stats__val results-stats__cached" title="Precomputed against dayhoff-score:v7 (temp 1.0, min_p 0.05). Edit the sequence or switch models to call your endpoint.">
              <span className="status-dot status-dot--warn" aria-hidden="true" />
              Cached (v7)
            </span>
          </div>
        )}
        <div className="results-stats__exports">
          <button className="export__btn" onClick={copyAllFasta} title="Copy all sequences as FASTA">{copiedAll ? '✓ Copied' : 'Copy FASTA'}</button>
          {['fasta', 'csv', 'json'].map(f => (
            <button key={f} className="export__btn" onClick={() => onExport(f)} title={`Download as ${f.toUpperCase()}`}>{f.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {isVariantScoring ? (
        <VariantTable results={results} selectedModel={selectedModel} />
      ) : (
      <>
      {seedLen > 0 && (
        <div className="seq-seed-legend seq-seed-legend--top" aria-hidden="true">
          <span className="seq-seed-legend__legend">
            <span className="aa-h">hydrophobic</span>
            <span className="aa-c">charged</span>
            <span className="aa-p">polar</span>
            <span className="aa-s">special</span>
          </span>
          <span className="seq-seed-legend__note"><span className="seq-seed-legend__swatch seq-seed-legend__swatch--seed" /> seed <span className="seq-seed-legend__swatch seq-seed-legend__swatch--gen" /> generated</span>
        </div>
      )}

      <p className="results-explainer">
        <span className="results-explainer__label">Likelihood</span>
        The green bar on each card is Dayhoff’s zero-shot fitness score — the average forward + backward log-likelihood of the full sequence (per <a href="https://github.com/microsoft/dayhoff#zero-shot-fitness-scoring" target="_blank" rel="noopener noreferrer">examples/score.py</a>), mapped to 0–100. Higher = the model finds the sequence more plausible. Not experimentally validated.
      </p>

      {results.sequences_with_fitness.map((s, i) => (
        <SeqCard key={i} s={s} rank={i + 1} seedLen={commonPrefixLen(s.sequence, normalizedPrompt)} esmfoldMax={esmfoldMax} />
      ))}
      </>
      )}
    </div>
  )
}

function SeqCard({ s, rank, seedLen, esmfoldMax }: { s: SequenceWithFitness; rank: number; seedLen: number; esmfoldMax: number }) {
  const [copied, setCopied] = useState(false)
  const [structLoading, setStructLoading] = useState(false)
  const [pdb, setPdb] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [structErr, setStructErr] = useState<string | null>(null)
  const lvl = fitnessLevel(s.fitness_score)
  const hydro = (s.sequence.match(/[AILVMFYW]/g) || []).length
  const charged = (s.sequence.match(/[DEKR]/g) || []).length

  const copy = () => { navigator.clipboard.writeText(s.sequence); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  const ESMFOLD_MAX = esmfoldMax
  const tooLong = s.length > ESMFOLD_MAX

  const predict = async () => {
    if (tooLong) {
      setStructErr(`Sequence is ${s.length} aa. ESMFold supports up to ${ESMFOLD_MAX} aa per request.`)
      return
    }
    setStructLoading(true); setStructErr(null); setPdb(null)
    try {
      const r = await predictStructure(s.sequence)
      if (r.success && r.pdb) { setPdb(r.pdb); setViewerOpen(true) }
      else setStructErr(r.error || 'Structure prediction unavailable.')
    } catch (e) { setStructErr((e as Error).message || 'Structure prediction failed.') }
    finally { setStructLoading(false) }
  }

  const dlPdb = () => {
    if (!pdb) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([pdb], { type: 'chemical/x-pdb' }))
    a.download = `dayhoff-${rank}.pdb`; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="seq-card">
      <div className="seq-card__top">
        <span className="seq-card__rank">#{rank}</span>
        <span className="seq-card__len">{s.length} aa</span>
        <div className="seq-card__score" title={`Dayhoff zero-shot likelihood: ${s.fitness_score.toFixed(1)}/100 (avg forward + backward log-likelihood, normalized). Higher = more plausible to the model.`} aria-label={`Likelihood ${s.fitness_score.toFixed(0)} of 100`}>
          <span className="seq-card__score-label">Likelihood</span>
          <div className="seq-card__score-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.fitness_score)}><div className={`seq-card__score-fill seq-card__score-fill--${lvl}`} style={{ width: `${s.fitness_score}%` }} /></div>
          <span className={`seq-card__score-val seq-card__score-val--${lvl}`}>{s.fitness_score.toFixed(0)}<span className="seq-card__score-max">/100</span></span>
        </div>
        <div className="seq-card__actions">
          {!pdb && <button className="seq-card__btn seq-card__btn--primary" onClick={predict} disabled={structLoading || tooLong} title={tooLong ? `Sequence is ${s.length} aa. ESMFold supports up to ${ESMFOLD_MAX} aa.` : 'Predict 3D structure with ESMFold'}>{structLoading ? <><span className="seq-card__btn-spinner" aria-hidden="true" /> Folding…</> : <><span className="seq-card__btn-icon" aria-hidden="true">⌬</span> 3D Structure</>}</button>}
          {pdb && <button className="seq-card__btn seq-card__btn--primary" onClick={() => setViewerOpen(v => !v)}><span className="seq-card__btn-icon" aria-hidden="true">⌬</span> {viewerOpen ? 'Hide structure' : 'Show structure'}</button>}
          {pdb && <button className="seq-card__btn" onClick={dlPdb} title="Download PDB file">PDB↓</button>}
          <button className="seq-card__btn" onClick={copy} aria-label={copied ? 'Sequence copied' : 'Copy sequence to clipboard'} title="Copy sequence">{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
      </div>

      <div className="seq-text">{colorSeq(s.sequence, seedLen)}</div>

      <div className="comp">
        <span>{Math.round(hydro / s.length * 100)}% hydrophobic</span>
        <span>{Math.round(charged / s.length * 100)}% charged</span>
        {s.repetition_warning && (
          <span className="comp__warn" title={s.repetition_warning}>
            ⚠ low diversity
          </span>
        )}
      </div>

      {structErr && (
        <div className="seq-card__err" role="alert">
          <span className="seq-card__err-label">Structure prediction failed</span>
          <span className="seq-card__err-msg">{structErr}</span>
          <button className="seq-card__err-dismiss" onClick={() => setStructErr(null)} aria-label="Dismiss error">×</button>
        </div>
      )}
      {pdb && viewerOpen && <MolstarStructureViewer pdb={pdb} title={`Structure #${rank}`} />}
    </div>
  )
}
