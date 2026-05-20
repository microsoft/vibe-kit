import type { ProteinInfo, TaskPreset } from '../constants'
import { AA_TYPE, MODEL_CHIPS, MODEL_DETAILS, normalizePrompt, parseFastaSequences } from '../constants'

interface Props {
  proteinInfo: ProteinInfo | null
  prompt: string
  numSeq: number
  maxLen: number
  temp: number
  selectedModel: string
  taskPreset: TaskPreset
  variantsText?: string
}

/** Right-column context surface; fills the area with real, scientific content. */
export function InfoPanel({ proteinInfo, prompt, numSeq, maxLen, temp, selectedModel, taskPreset, variantsText = '' }: Props) {
  const seq = normalizePrompt(prompt)
  const seedLen = seq.length
  const newRes = Math.max(maxLen - seedLen, 0)
  const seedPct = maxLen > 0 ? Math.min(100, (seedLen / maxLen) * 100) : 0
  const modelMeta = MODEL_CHIPS.find(m => m.key === selectedModel)
  const modelDetail = MODEL_DETAILS.find(m => m.key === selectedModel)
  const isScore = taskPreset === 'score'
  const isDenovo = taskPreset === 'denovo'
  const parsedVariants = isScore ? parseFastaSequences(variantsText) : null
  const variantCount = parsedVariants?.sequences.length ?? 0
  const invalidVariantCount = parsedVariants?.errors.length ?? 0

  // ── Composition stats for the seed (when present)
  const counts = { h: 0, c: 0, p: 0, s: 0 }
  for (const aa of seq) counts[(AA_TYPE[aa] ?? 's') as 'h' | 'c' | 'p' | 's']++
  const pct = (n: number) => seedLen > 0 ? Math.round((n / seedLen) * 100) : 0

  return (
    <div className="info-panel">
      {/* ── Header ────────────────────────────────────────── */}
      <header className="info-panel__head">
        {isScore ? (
          <>
            <div className="info-panel__eyebrow">Score variants</div>
            <h2 className="info-panel__title">Rank pasted proteins by Dayhoff likelihood</h2>
            <p className="info-panel__lede">
              Paste FASTA records, comma-separated sequences, or one sequence per line.
              Dayhoff scores each complete sequence and ranks the variants from most to
              least plausible under the selected model.
            </p>
            <p className="info-panel__lede info-panel__lede--cta">
              No residues are generated in this workflow, so Candidates, Max length,
              Direction, and Temperature are intentionally hidden.
            </p>
          </>
        ) : proteinInfo ? (
          <>
            <div className="info-panel__eyebrow">Selected reference</div>
            <h2 className="info-panel__title">{proteinInfo.fullName}</h2>
            <div className="info-panel__sub">
              <span className="info-panel__org">{proteinInfo.organism}</span>
              <span aria-hidden="true">·</span>
              <span>{proteinInfo.totalResidues.toLocaleString()} residues full length</span>
            </div>
            <p className="info-panel__lede">{proteinInfo.whatItDoes}</p>
          </>
        ) : (
          <>
            <div className="info-panel__eyebrow">About Dayhoff</div>
            <h2 className="info-panel__title">A family of generative models for proteins</h2>
            <p className="info-panel__lede">
              Dayhoff is Microsoft Research's protein language model, trained on the
              Dayhoff Atlas: 3.34 billion metagenomic, genomic, and structure-derived
              synthetic sequences. Give it a protein prefix and it samples plausible
              continuations residue by residue, the same way an LLM continues text.
            </p>
            <p className="info-panel__lede info-panel__lede--cta">
              Pick a workflow on the left, choose an example seed or paste your own,
              then hit Generate.
            </p>
          </>
        )}
      </header>

      {/* ── Input context card ──────────────────────────────── */}
      {isScore ? (
        <section className="ip-card" aria-label="Variant scoring input">
          <div className="ip-card__head">
            <div>
              <div className="ip-card__eyebrow">Variants to score</div>
              <div className="ip-card__title">
                {variantCount > 0
                  ? <>{variantCount} parsed sequence{variantCount === 1 ? '' : 's'}</>
                  : 'Paste variants on the left'}
              </div>
            </div>
            <div className="ip-card__meta">
              {invalidVariantCount > 0 ? `${invalidVariantCount} invalid` : 'canonical AA validation'}
            </div>
          </div>
          {variantCount > 0 ? (
            <div className="aa-empty">
              Ready to score {variantCount} sequence{variantCount === 1 ? '' : 's'} with {modelMeta?.name ?? selectedModel}.
              Results will be ranked by zero-shot likelihood / fitness and rendered as sortable sequence cards.
            </div>
          ) : (
            <div className="aa-empty">
              This workflow is for bring-your-own variants. Paste complete protein sequences or upload a FASTA file;
              Dayhoff will validate canonical amino acids and reject ambiguous residues like B, X, O, U, and Z.
            </div>
          )}
        </section>
      ) : isDenovo ? (
        <section className="ip-card" aria-label="De novo input">
          <div className="ip-card__head">
            <div>
              <div className="ip-card__eyebrow">Input</div>
              <div className="ip-card__title">No seed by design</div>
            </div>
          </div>
          <div className="aa-empty">
            De novo design starts from the model's learned protein distribution rather than a user-supplied prefix.
            Tune model, candidate count, max length, and temperature in Run setup, then generate novel candidates.
          </div>
        </section>
      ) : (
      <section className="ip-card" aria-label="Seed sequence">
        <div className="ip-card__head">
          <div>
            <div className="ip-card__eyebrow">Seed sequence</div>
            <div className="ip-card__title">
              {seedLen > 0
                ? <>{seedLen} residue{seedLen === 1 ? '' : 's'}{proteinInfo ? <> · <span className="ip-card__title-sub">{proteinInfo.seedDescription}</span></> : null}</>
                : 'No seed yet'}
            </div>
          </div>
          {seedLen > 0 && (
            <div className="ip-comp" aria-label="Composition">
              <span><b>{pct(counts.h)}%</b> hydrophobic</span>
              <span><b>{pct(counts.c)}%</b> charged</span>
              <span><b>{pct(counts.p)}%</b> polar</span>
              <span><b>{pct(counts.s)}%</b> special</span>
            </div>
          )}
        </div>

        {seedLen > 0 ? (
          <>
            <div className="aa-grid" aria-hidden="true">
              {seq.split('').map((aa, i) => {
                const cls = AA_TYPE[aa] ?? 's'
                return <span key={i} className={`aa-block aa-block--${cls}`} title={`${i + 1}: ${aa}`}>{aa}</span>
              })}
            </div>
            <div className="aa-legend" aria-hidden="true">
              <span className="aa-legend__item"><span className="aa-legend__dot aa-legend__dot--h" />hydrophobic</span>
              <span className="aa-legend__item"><span className="aa-legend__dot aa-legend__dot--c" />charged</span>
              <span className="aa-legend__item"><span className="aa-legend__dot aa-legend__dot--p" />polar</span>
              <span className="aa-legend__item"><span className="aa-legend__dot aa-legend__dot--s" />special (C / G / P)</span>
            </div>
          </>
        ) : (
          <div className="aa-empty">
            Paste a sequence on the left, or pick an example reference protein. The seed will appear
            here as a coloured residue map.
          </div>
        )}
      </section>
      )}

      {/* ── Generation preview card ─────────────────────────── */}
      {!isScore && <section className="ip-card" aria-label="Generation preview">
        <div className="ip-card__head">
          <div>
            <div className="ip-card__eyebrow">Generation preview</div>
            <div className="ip-card__title">
              Up to <b>{maxLen}</b> residues per candidate
              <span className="ip-card__title-sub"> · {newRes} new to be sampled</span>
            </div>
          </div>
          <div className="ip-card__meta">
            {numSeq} candidate{numSeq === 1 ? '' : 's'}
          </div>
        </div>

        <div className="length-bar" role="img" aria-label={`Seed ${seedLen} of ${maxLen} residues; up to ${newRes} to be generated`}>
          {seedLen > 0 && (
            <div className="length-bar__seed" style={{ width: `${seedPct}%` }}>
              <span>seed · {seedLen}</span>
            </div>
          )}
          <div className="length-bar__gen">
            <span>{newRes > 0 ? `to generate · ≤ ${newRes}` : 'no headroom · increase max length'}</span>
          </div>
        </div>
        <div className="length-bar__axis" aria-hidden="true">
          <span>0</span>
          <span>{Math.round(maxLen / 2)}</span>
          <span>{maxLen} aa</span>
        </div>

        {proteinInfo && (
          <div className="ip-card__note">
            <div className="ip-card__note-eyebrow">What to expect</div>
            <p className="ip-card__note-body">{proteinInfo.whatToExpect}</p>
          </div>
        )}
      </section>}
      {isScore && <section className="ip-card" aria-label="Scoring preview">
        <div className="ip-card__head">
          <div>
            <div className="ip-card__eyebrow">Scoring preview</div>
            <div className="ip-card__title">
              {variantCount > 0 ? `Rank ${variantCount} pasted variant${variantCount === 1 ? '' : 's'}` : 'Awaiting variants'}
            </div>
          </div>
          <div className="ip-card__meta">no generation</div>
        </div>
        <div className="ip-card__note">
          <div className="ip-card__note-eyebrow">What to expect</div>
          <p className="ip-card__note-body">
            The output is a ranked table of the input variants with Dayhoff likelihood / fitness scores.
            Higher scores mean the selected model considers the full sequence more protein-like; this is not experimental validation.
          </p>
        </div>
      </section>}

      {/* ── Run config tiles ────────────────────────────────── */}
      <section className="ip-tiles" aria-label="Run configuration">
        <div className="ip-tile">
          <div className="ip-tile__label">Model</div>
          <div className="ip-tile__value">{modelMeta?.name ?? selectedModel}</div>
          <div className="ip-tile__sub">{modelDetail?.params ?? modelMeta?.badge ?? ''}</div>
        </div>
        {isScore ? (
          <>
            <div className="ip-tile">
              <div className="ip-tile__label">Parsed variants</div>
              <div className="ip-tile__value ip-tile__value--num">{variantCount}</div>
              <div className="ip-tile__sub">ready to score</div>
            </div>
            <div className="ip-tile">
              <div className="ip-tile__label">Invalid entries</div>
              <div className="ip-tile__value ip-tile__value--num">{invalidVariantCount}</div>
              <div className="ip-tile__sub">rejected before scoring</div>
            </div>
            <div className="ip-tile">
              <div className="ip-tile__label">Operation</div>
              <div className="ip-tile__value">Score</div>
              <div className="ip-tile__sub">rank supplied sequences</div>
            </div>
          </>
        ) : (
          <>
            <div className="ip-tile">
              <div className="ip-tile__label">Candidates</div>
              <div className="ip-tile__value ip-tile__value--num">{numSeq}</div>
              <div className="ip-tile__sub">independent samples</div>
            </div>
            <div className="ip-tile">
              <div className="ip-tile__label">Max length</div>
              <div className="ip-tile__value ip-tile__value--num">{maxLen}<span className="ip-tile__unit"> aa</span></div>
              <div className="ip-tile__sub">per candidate</div>
            </div>
            <div className="ip-tile">
              <div className="ip-tile__label">Temperature</div>
              <div className="ip-tile__value ip-tile__value--num">{temp.toFixed(2)}</div>
              <div className="ip-tile__sub">{temp <= 0.7 ? 'conservative · stays near training' : temp >= 1.0 ? 'exploratory · more diverse' : 'balanced sampling'}</div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
