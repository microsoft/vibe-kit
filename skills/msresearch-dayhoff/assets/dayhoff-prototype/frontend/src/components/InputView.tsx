import { useRef, useState } from 'react'
import {
  MODEL_CHIPS, HOMOLOG_MODELS, TASK_PRESETS,
  normalizePrompt, validatePrompt, parseFastaSequences,
} from '../constants'
import type { TaskPreset, ProteinInfo } from '../constants'
import type { GenerationMode, Direction } from '../types'
import { DEMO_WORKFLOWS, getCachedResult } from '../demoCache'
import { InfoTip } from './InfoTip'

const PROTEINS = [
  { key: 'cas9', name: 'Cas9', what: 'Gene-editing enzyme from CRISPR systems', size: '1,368 amino acids' },
  { key: 'insulin', name: 'Insulin', what: 'Hormone that regulates blood sugar', size: '110 amino acids' },
  { key: 'dnapol', name: 'DNA Pol I', what: 'Enzyme that copies DNA during replication', size: '928 amino acids' },
  { key: 'spike', name: 'Spike', what: 'Protein that lets SARS-CoV-2 enter human cells', size: '1,273 amino acids' },
]

interface Props {
  ready: boolean; loading: boolean; prompt: string; numSeq: number; maxLen: number
  temp: number; minP: number; mode: GenerationMode; dir: Direction; showAdv: boolean
  selectedModel: string; taskPreset: TaskPreset; proteinInfo: ProteinInfo | null
  hasResults: boolean
  homologs: string[]
  onHomologsChange: (v: string[]) => void
  variantsText: string
  onVariantsTextChange: (v: string) => void
  onPromptChange: (v: string) => void; onNumSeqChange: (v: number) => void
  onMaxLenChange: (v: number) => void; onTempChange: (v: number) => void
  onMinPChange: (v: number) => void
  onModeChange: (v: GenerationMode) => void; onDirChange: (v: Direction) => void
  onShowAdvChange: (v: boolean) => void; onModelChange: (v: string) => void
  onTaskPresetChange: (v: TaskPreset) => void
  onGenerate: () => void; onCancel: () => void
  onSelectProtein: (wf: typeof DEMO_WORKFLOWS[number]) => void
}

export function InputView(props: Props) {
  const {
    ready, loading, prompt, numSeq, maxLen,
    selectedModel, proteinInfo,
    onPromptChange, onGenerate, onCancel, onSelectProtein,
  } = props

  const isScore = props.taskPreset === 'score'
  const err = isScore ? null : validatePrompt(prompt, maxLen)
  const np = normalizePrompt(prompt)
  const newRes = Math.max(maxLen - np.length, 0)
  const hasCache = !isScore && !!getCachedResult(np, selectedModel)
  // Label the cache hit as a "demo seed" whenever the prompt matches a DEMO_WORKFLOWS
  // entry — every demo prompt is cached for all four model variants.
  const isDemoSeed = hasCache && DEMO_WORKFLOWS.some(
    w => normalizePrompt(w.prompt) === np,
  )
  const parsedVariants = isScore ? parseFastaSequences(props.variantsText) : null
  const variantCount = parsedVariants?.sequences.length ?? 0
  const canGenerate = isScore
    ? ready && variantCount > 0 && !loading
    : (ready || hasCache) && !err && !loading
  const activeChip = MODEL_CHIPS.find(m => m.key === selectedModel)
  const taskEntries = Object.entries(TASK_PRESETS) as [Exclude<TaskPreset, 'custom'>, typeof TASK_PRESETS['complete']][]

  // ─── Tool form (left rail) ───
  const activeTask = taskEntries.find(([k]) => k === props.taskPreset)?.[1] ?? TASK_PRESETS.complete
  const isDenovo = props.taskPreset === 'denovo'

  return (
    <div className="app-input" data-tour="input-card">
      {isDemoSeed && !loading && (
        <div className="demo-notice" data-tour="demo-notice" role="status">
          <span className="demo-notice__dot" aria-hidden="true" />
          <div className="demo-notice__body">
            <div className="demo-notice__title">
              {ready ? 'Demo seed · cached result' : 'Demo mode · backend offline'}
            </div>
            <div className="demo-notice__sub">
              {ready
                ? `Generate returns the cached result for ${proteinInfo?.name ?? 'this seed'} so the demo stays instant. Edit the sequence to run the live model.`
                : `Backend is unreachable. Generate returns the cached result for ${proteinInfo?.name ?? 'this seed'}.`}
            </div>
          </div>
        </div>
      )}
      <div className="app-input__header">
        <div className="app-input__eyebrow">Generate</div>
        <h2 className="app-input__title">New run</h2>
        <p className="app-input__desc">Pick a workflow, choose a seed, and run.</p>
      </div>

      {/* Workflow: primary framing choice, promoted out of settings */}
      <div className="app-input__section" data-tour="workflow">
        <span className="app-input__label">Workflow</span>
        <div className="workflow-seg" role="tablist" aria-label="Workflow">
          {taskEntries.map(([key, p]) => (
            <button
              key={key}
              role="tab"
              aria-selected={props.taskPreset === key}
              className={`workflow-seg__btn ${props.taskPreset === key ? 'workflow-seg__btn--active' : ''}`}
              onClick={() => {
                props.onTaskPresetChange(key as TaskPreset)
                props.onTempChange(p.temp); props.onModelChange(p.model)
                props.onMaxLenChange(p.maxLen); props.onNumSeqChange(p.numSeq)
                if (key === 'denovo') onPromptChange('')
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="workflow-seg__desc">{activeTask.desc}</div>
      </div>

      {/* Examples row: only relevant when a seed is needed */}
      {!isDenovo && !isScore && (
        <div className="app-input__examples" data-tour="examples">
          <span className="app-input__examples-label">Demo examples</span>
          {PROTEINS.map(p => {
            const wf = DEMO_WORKFLOWS.find(w => w.key === p.key)!
            const active = proteinInfo?.key === p.key
            return (
              <button key={p.key} className={`chip ${active ? 'chip--active' : ''}`} onClick={() => onSelectProtein(wf)}
                title={`${p.what} · ${p.size}`} aria-pressed={active}>
                {p.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Sequence input */}
      {!isDenovo && !isScore && (
        <div className="app-input__seq-section" data-tour="input">
          <div className="app-input__seq-head">
            <label className="app-input__label" htmlFor="seq-input">Seed sequence</label>
            <span className="app-input__seq-meta">{np.length} aa{maxLen ? ` · ~${newRes} new` : ''}</span>
          </div>
          <textarea
            id="seq-input"
            className="seq-input"
            value={prompt}
            onChange={e => onPromptChange(normalizePrompt(e.target.value))}
            placeholder="Paste or type an amino acid sequence, e.g. MDKKYS…"
            rows={3}
            spellCheck={false}
            autoCapitalize="characters"
          />
          {err && <div className="field-error" role="alert">{err}</div>}
        </div>
      )}

      {/* Score variants input */}
      {isScore && (
        <VariantsInput
          value={props.variantsText}
          onChange={props.onVariantsTextChange}
          parsed={parsedVariants}
        />
      )}

      {/* Homolog context: only shown when a homolog-capable model is selected */}
      {!isScore && HOMOLOG_MODELS.has(selectedModel) && (
        <HomologsInput
          homologs={props.homologs}
          onChange={props.onHomologsChange}
          modelName={activeChip?.name ?? selectedModel}
        />
      )}

      {/* Run setup: open by default so users see model/params */}
      <details className="app-input__settings" data-tour="settings" open>
        <summary className="app-input__settings-summary">
          <span>Run setup</span>
          <span className="app-input__settings-current">{isScore ? activeChip?.name : `${activeChip?.name} · ${numSeq} × ${maxLen} aa`}</span>
        </summary>
        <SettingsPanel {...props} taskEntries={taskEntries} activeChip={activeChip} isScore={isScore} />
      </details>

      {/* Generate: final action, anchored at the bottom */}
      <div className="btn-generate-row" data-tour="generate-row">
        <button className="btn-generate" onClick={onGenerate} disabled={!canGenerate} data-tour="generate" aria-describedby="gen-status">
          {loading ? (
            <><span className="spinner" /> {isScore ? 'Scoring…' : 'Generating…'}</>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3l14 9-14 9V3z" /></svg>
              {isScore ? `Score ${variantCount} variant${variantCount === 1 ? '' : 's'}` : isDenovo ? 'Generate de novo proteins' : `Generate ${proteinInfo?.name ?? ''} candidates`}
            </>
          )}
        </button>
        {loading && <button className="btn-cancel" onClick={onCancel}>Cancel</button>}
        <div id="gen-status" className="btn-generate__caption">
          <span className={`status-dot ${ready ? 'status-dot--ok' : hasCache ? 'status-dot--warn' : 'status-dot--err'}`} aria-hidden="true" />
          <span>{loading ? 'Working…' : !ready ? (hasCache ? 'Backend offline · cached result available' : 'Connecting to backend…') : isScore ? (variantCount > 0 ? `Ready · ${activeChip?.name ?? selectedModel} · ${variantCount} variant${variantCount === 1 ? '' : 's'} to score` : 'Paste at least one sequence above') : `Ready · ${activeChip?.name ?? selectedModel} · ${numSeq} candidate${numSeq === 1 ? '' : 's'}`}</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Shared settings panel ─── */
function SettingsPanel({ onTempChange, onMinPChange, onModelChange, onMaxLenChange, onNumSeqChange, onModeChange, onDirChange, onShowAdvChange, selectedModel, numSeq, maxLen, temp, minP, mode, dir, showAdv, isScore, activeChip: _ }: Props & { taskEntries: [string, typeof TASK_PRESETS['complete']][]; activeChip: typeof MODEL_CHIPS[number] | undefined; isScore: boolean }) {
  return (
    <div className="settings-panel">
      <div>
        <div className="settings-panel__head">
          <div className="label">Model</div>
          <span className="settings-panel__hint">{isScore ? 'GR-HM-c is the recommended fitness scorer; other variants will also score sequences.' : 'Each variant is tuned for a different downstream task.'}</span>
        </div>
        <div className="model-chips">
          {MODEL_CHIPS.map(m => {
            const isActive = selectedModel === m.key
            return (
              <button
                key={m.key}
                type="button"
                className={`model-chip ${isActive ? 'model-chip--active' : ''}`}
                onClick={() => onModelChange(m.key)}
                aria-pressed={isActive}
              >
                <div className="model-chip__top">
                  <span className="model-chip__name">{m.name}</span>
                  <span className="model-chip__badge">{m.badge}</span>
                </div>
                <span className="model-chip__purpose">{m.purpose}</span>
                <span className="model-chip__note">{m.note}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="ctrl-row">
        {!isScore && (
          <div className="ctrl-group">
            <div className="label">Candidates</div>
            <div className="stepper">
              <button className="stepper__btn" onClick={() => onNumSeqChange(Math.max(1, numSeq - 1))}>−</button>
              <span className="stepper__val">{numSeq}</span>
              <button className="stepper__btn" onClick={() => onNumSeqChange(Math.min(50, numSeq + 1))}>+</button>
            </div>
          </div>
        )}
        {!isScore && (
          <div className="ctrl-group">
            <div className="label">Max length</div>
            <input type="number" min={20} max={600} value={maxLen} onChange={e => onMaxLenChange(+e.target.value)} />
          </div>
        )}
      </div>
      {!isScore && (
        <button className={`adv-toggle ${showAdv ? 'adv-toggle--open' : ''}`} onClick={() => onShowAdvChange(!showAdv)}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M3 0l4 5-4 5z" /></svg> Advanced
        </button>
      )}
      {!isScore && showAdv && (
        <div className="adv-panel">
          <div className="adv-section">
              <div className="label">Mode <InfoTip label="Mode"><strong>Unconditional</strong> generates from your seed sequence alone. <strong>Family-guided</strong> also conditions on related (homologous) sequences you upload as FASTA — only available on models trained for this (GR-HM, GR-HM-c).</InfoTip></div>
            <div className="seg-ctrl">
              <button className={`seg-ctrl__btn ${mode === 'unconditional' ? 'seg-ctrl__btn--active' : ''}`} onClick={() => onModeChange('unconditional')}>Unconditional</button>
              <button className={`seg-ctrl__btn ${mode === 'family_guided' ? 'seg-ctrl__btn--active' : ''} ${!HOMOLOG_MODELS.has(selectedModel) ? 'seg-ctrl__btn--disabled' : ''}`}
                onClick={() => HOMOLOG_MODELS.has(selectedModel) && onModeChange('family_guided')} disabled={!HOMOLOG_MODELS.has(selectedModel)}>Family-guided</button>
            </div>
          </div>
          <div className="adv-row">
            <div className="adv-section">
              <div className="label">Direction <InfoTip label="Direction"><strong>N→C</strong> extends from the start of the protein toward the end (N-terminus to C-terminus, the natural reading direction — the default). <strong>C→N</strong> extends backward, from the end toward the start.</InfoTip></div>
              <div className="seg-ctrl seg-ctrl--compact">
                <button className={`seg-ctrl__btn ${dir === 'n_to_c' ? 'seg-ctrl__btn--active' : ''}`} onClick={() => onDirChange('n_to_c')}>N→C</button>
                <button className={`seg-ctrl__btn ${dir === 'c_to_n' ? 'seg-ctrl__btn--active' : ''}`} onClick={() => onDirChange('c_to_n')}>C→N</button>
              </div>
            </div>
            <div className="adv-section adv-section--temp">
              <div className="label">Temp <span className="slider-val">{temp.toFixed(1)}</span> <InfoTip label="Temperature">How adventurous the model is when picking each next residue. <strong>1.0</strong> is the recommended default. Lower values stick closer to high-probability choices (more conservative, more repetitive); higher values explore rarer choices (more diverse, more surprising).</InfoTip></div>
              <input type="range" min={0.1} max={1.9} step={0.1} value={temp} onChange={e => onTempChange(+e.target.value)} />
            </div>
            <div className="adv-section adv-section--temp">
              <div className="label">min_p <span className="slider-val">{minP.toFixed(2)}</span> <InfoTip label="min_p">Filters out residues the model thinks are very unlikely before it samples. Anything below this probability is removed. <strong>0.05</strong> is the recommended default — it cuts noise without overly constraining the output.</InfoTip></div>
              <input type="range" min={0} max={0.2} step={0.01} value={minP} onChange={e => onMinPChange(+e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Variants paste input (Score workflow) ─── */
function VariantsInput({ value, onChange, parsed }: {
  value: string
  onChange: (v: string) => void
  parsed: { sequences: string[]; errors: { index: number; message: string }[] } | null
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const sequences = parsed?.sequences ?? []
  const errors = parsed?.errors ?? []

  return (
    <div className="app-input__seq-section" data-tour="input">
      <div className="app-input__seq-head">
        <span className="app-input__label">Variants to score</span>
        <span className="app-input__seq-meta">{sequences.length} parsed{errors.length ? ` · ${errors.length} invalid` : ''}</span>
      </div>
      <div className="homologs__actions">
        <button
          type="button"
          className="homologs__upload-btn"
          onClick={() => fileRef.current?.click()}
        >
          ⇪ Upload FASTA
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".fasta,.fa,.faa,.txt"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const txt = await f.text()
            onChange(txt)
            if (fileRef.current) fileRef.current.value = ''
          }}
        />
        {value && (
          <button type="button" className="homologs__upload-btn" onClick={() => onChange('')} title="Clear pasted variants">
            Clear
          </button>
        )}
      </div>
      <textarea
        className="seq-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={'Paste protein sequences (FASTA, comma-separated, or one per line).\n\n>variant_1\nMDKKYSIGLDIGTNSVGW...\n\n>variant_2\nMDKRYSIGLDIGTNSVGW...'}
        rows={6}
        spellCheck={false}
      />
      {sequences.length > 0 && (
        <ul className="homologs__list" aria-label="Parsed variants">
          {sequences.slice(0, 5).map((s, i) => (
            <li key={i} className="homologs__list-item">
              <span className="homologs__list-index">#{i + 1}</span>
              <span className="homologs__list-len">{s.length} aa</span>
              <span className="homologs__list-preview">{s.slice(0, 32)}{s.length > 32 ? '…' : ''}</span>
            </li>
          ))}
          {sequences.length > 5 && (
            <li className="homologs__list-item homologs__list-item--more">+{sequences.length - 5} more</li>
          )}
        </ul>
      )}
      {errors.length > 0 && (
        <ul className="homologs__errors" role="alert">
          {errors.map((e, i) => (
            <li key={i} className="homologs__errors-item">Variant #{e.index}: {e.message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ─── Homologs / family-context input ─── */
function HomologsInput({ homologs, onChange, modelName }: { homologs: string[]; onChange: (v: string[]) => void; modelName: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [errs, setErrs] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement | null>(null)

  const apply = (raw: string) => {
    setText(raw)
    const { sequences, errors } = parseFastaSequences(raw)
    setErrs(errors.map(e => e.message))
    onChange(sequences)
  }

  const onFile = async (file: File) => {
    const raw = await file.text()
    apply(raw)
    setOpen(true)
  }

  const clear = () => { setText(''); setErrs([]); onChange([]) }

  const summary = homologs.length > 0
    ? `${homologs.length} homolog${homologs.length === 1 ? '' : 's'} loaded`
    : 'None'

  return (
    <div className="homologs">
      <button
        type="button"
        className="homologs__toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="homologs__toggle-label">Family context</span>
        <span className={`homologs__toggle-summary ${homologs.length > 0 ? 'homologs__toggle-summary--active' : ''}`}>{summary}</span>
        <svg className={`homologs__chev ${open ? 'homologs__chev--open' : ''}`} width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M3 0l4 5-4 5z" /></svg>
      </button>
      {open && (
        <div className="homologs__body">
          <p className="homologs__desc">
            {modelName} can condition generation on homologous sequences (proteins from the same family).
            Paste FASTA or one sequence per line, or upload a `.fasta` file.
          </p>
          <div className="homologs__actions">
            <button
              type="button"
              className="homologs__file-btn"
              onClick={() => fileRef.current?.click()}
            >
              Upload FASTA
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".fasta,.fa,.fna,.txt,text/plain"
              hidden
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
                e.target.value = ''
              }}
            />
            {(text || homologs.length > 0) && (
              <button type="button" className="homologs__clear-btn" onClick={clear}>Clear</button>
            )}
          </div>
          <textarea
            className="seq-input homologs__textarea"
            value={text}
            onChange={e => apply(e.target.value)}
            placeholder=">homolog_1&#10;MDKKYS...&#10;>homolog_2&#10;MDRKYS..."
            rows={4}
            spellCheck={false}
          />
          {homologs.length > 0 && (
            <div className="homologs__list" aria-label="Parsed homologs">
              {homologs.slice(0, 5).map((h, i) => (
                <div key={i} className="homologs__list-item">
                  <span className="homologs__list-idx">#{i + 1}</span>
                  <span className="homologs__list-len">{h.length} aa</span>
                  <span className="homologs__list-preview">{h.slice(0, 24)}{h.length > 24 ? '…' : ''}</span>
                </div>
              ))}
              {homologs.length > 5 && (
                <div className="homologs__list-more">+{homologs.length - 5} more</div>
              )}
            </div>
          )}
          {errs.length > 0 && (
            <div className="homologs__errs" role="alert">
              {errs.slice(0, 3).map((m, i) => <div key={i}>{m}</div>)}
              {errs.length > 3 && <div>…and {errs.length - 3} more</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
