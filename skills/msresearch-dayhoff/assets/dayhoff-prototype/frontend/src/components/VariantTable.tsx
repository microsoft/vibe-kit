import { useMemo, useState } from 'react'
import { fitnessLevel } from '../constants'
import type { GenerationResponse, SequenceWithFitness } from '../types'

type SortKey = 'rank' | 'fitness' | 'length' | 'diffs'
type SortDir = 'asc' | 'desc'

interface Props {
  results: GenerationResponse
  selectedModel: string
}

/**
 * D1: Ranked variant table with per-position diff coloring vs. the top-ranked
 * (highest-likelihood) variant. The diff highlight is the closest signal we
 * can derive without a baseline-vs-mutant per-position log-likelihood feed
 * from the scoring container; positions where the residue differs from the
 * top variant are tinted, and the per-sequence fitness tier (low/mid/high)
 * stands in for damaging/plausible coloring at the row level.
 *
 * Switching to a true per-position damaging/plausible heatmap requires the
 * score server to return per-token log-probabilities; that change is tracked
 * separately in the C1/B1 work.
 */
export function VariantTable({ results, selectedModel }: Props) {
  const variants = results.sequences_with_fitness
  const [sortKey, setSortKey] = useState<SortKey>('fitness')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  // Reference = highest-fitness variant (independent of current sort).
  const reference = useMemo<SequenceWithFitness | null>(() => {
    if (variants.length === 0) return null
    return variants.reduce((a, b) => (b.fitness_score > a.fitness_score ? b : a))
  }, [variants])

  const rows = useMemo(() => {
    const enriched = variants.map((v, i) => {
      const diffs = reference ? countDiffs(v.sequence, reference.sequence) : 0
      return { v, originalIdx: i, diffs }
    })
    const sorted = [...enriched].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'fitness': cmp = a.v.fitness_score - b.v.fitness_score; break
        case 'length': cmp = a.v.length - b.v.length; break
        case 'diffs': cmp = a.diffs - b.diffs; break
        case 'rank':
        default: cmp = a.originalIdx - b.originalIdx; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [variants, reference, sortKey, sortDir])

  if (variants.length === 0) return null

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir(k === 'fitness' ? 'desc' : 'asc') }
  }

  return (
    <div className="variant-table">
      <div className="variant-table__head">
        <h3 className="variant-table__title">Ranked variants ({variants.length})</h3>
        <p className="variant-table__sub">
          Reference = highest-likelihood variant. Residues that differ from the reference are
          tinted to surface candidate-damaging positions; the fitness tier on each row signals
          model-assessed plausibility (green = high, amber = mid, red = low).
        </p>
      </div>
      <table className="variant-table__grid" role="table">
        <thead>
          <tr>
            <th><SortBtn k="rank" cur={sortKey} dir={sortDir} on={toggleSort}>#</SortBtn></th>
            <th><SortBtn k="length" cur={sortKey} dir={sortDir} on={toggleSort}>Length</SortBtn></th>
            <th><SortBtn k="fitness" cur={sortKey} dir={sortDir} on={toggleSort}>Likelihood</SortBtn></th>
            <th><SortBtn k="diffs" cur={sortKey} dir={sortDir} on={toggleSort}>Δ vs ref</SortBtn></th>
            <th>Sequence (diff highlighted)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ v, originalIdx, diffs }) => {
            const lvl = fitnessLevel(v.fitness_score)
            const isRef = reference && v.sequence === reference.sequence
            const isOpen = expandedIdx === originalIdx
            return (
              <tr
                key={originalIdx}
                className={`variant-table__row variant-table__row--${lvl} ${isRef ? 'variant-table__row--ref' : ''}`}
              >
                <td className="variant-table__rank">{originalIdx + 1}{isRef && <span className="variant-table__ref-tag" title="Reference (top likelihood)">ref</span>}</td>
                <td className="variant-table__len">{v.length}</td>
                <td>
                  <div className="variant-table__score">
                    <div className="variant-table__score-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v.fitness_score)}>
                      <div className={`variant-table__score-fill variant-table__score-fill--${lvl}`} style={{ width: `${Math.min(100, v.fitness_score)}%` }} />
                    </div>
                    <span className={`variant-table__score-val variant-table__score-val--${lvl}`}>{v.fitness_score.toFixed(0)}</span>
                  </div>
                </td>
                <td className="variant-table__diffs">{isRef ? '—' : diffs}</td>
                <td>
                  <button
                    className="variant-table__seq-toggle"
                    onClick={() => setExpandedIdx(isOpen ? null : originalIdx)}
                    aria-expanded={isOpen}
                    title={isOpen ? 'Collapse sequence' : 'Expand sequence'}
                  >
                    {isOpen ? '▾' : '▸'} {isOpen ? 'Hide' : 'Show'} sequence
                  </button>
                  {isOpen && reference && (
                    <div className="variant-table__seq">
                      {renderDiff(v.sequence, reference.sequence)}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="variant-table__footnote">
        Model: <code>{results.stats.model || selectedModel}</code>. Likelihood is Dayhoff’s
        zero-shot fitness (avg forward + backward log-likelihood, normalized to 0–100). Δ vs ref
        counts positions whose residue differs from the reference, aligned by index (no gap
        alignment performed).
      </p>
    </div>
  )
}

function SortBtn({ k, cur, dir, on, children }: { k: SortKey; cur: SortKey; dir: SortDir; on: (k: SortKey) => void; children: React.ReactNode }) {
  const active = k === cur
  return (
    <button className={`variant-table__sort ${active ? 'variant-table__sort--active' : ''}`} onClick={() => on(k)}>
      {children}{active && <span aria-hidden="true">{dir === 'asc' ? ' ▲' : ' ▼'}</span>}
    </button>
  )
}

function countDiffs(a: string, b: string): number {
  const len = Math.min(a.length, b.length)
  let d = Math.abs(a.length - b.length)
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) d++
  return d
}

function renderDiff(seq: string, ref: string) {
  const len = Math.max(seq.length, ref.length)
  const out: React.ReactNode[] = []
  for (let i = 0; i < len; i++) {
    const c = seq[i]
    const r = ref[i]
    if (c === undefined) break
    if (r === undefined || c !== r) {
      out.push(<span key={i} className="variant-table__diff" title={r ? `Ref: ${r}` : 'No reference residue at this position'}>{c}</span>)
    } else {
      out.push(c)
    }
  }
  return <>{out}</>
}
