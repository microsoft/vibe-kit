import React, { useState, useEffect, useCallback } from 'react'
import { FeatureTour, GenerationProgress } from './components'
import { InputView } from './components/InputView'
import { ResultsView } from './components/ResultsView'
import { InfoPanel } from './components/InfoPanel'
import { generateSequences, checkHealth, exportSequences, scoreVariants, fetchGenerationProgress } from './api'
import type { GenerationProgressPhase } from './api'
import { DEMO_WORKFLOWS, getCachedResult, setCachedResult } from './demoCache'
import { normalizePrompt, validatePrompt, TOUR_STEPS, HOMOLOG_MODELS, TASK_PRESETS, getProteinInfo } from './constants'
import type { TaskPreset } from './constants'
import type { GenerationParams, GenerationResponse, GenerationMode, Direction } from './types'
import './styles.css'

export default function App() {
  const [ready, setReady] = useState(false)
  const [esmfoldMax, setEsmfoldMax] = useState(400)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<GenerationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showTour, setShowTour] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [lastElapsed, setLastElapsed] = useState<number | null>(null)
  const [isDemo, setIsDemo] = useState(false)

  const [prompt, setPrompt] = useState('MDKKYSIGLDIGTNSVGWAVITDEYKVPSKKFKVLGNTDRHSIKKNLIGALLFDSG')
  const [numSeq, setNumSeq] = useState(TASK_PRESETS.complete.numSeq)
  const [maxLen, setMaxLen] = useState(TASK_PRESETS.complete.maxLen)
  const [temp, setTemp] = useState(TASK_PRESETS.complete.temp)
  const [mode, setMode] = useState<GenerationMode>('unconditional')
  const [dir, setDir] = useState<Direction>('n_to_c')
  const [minP, setMinP] = useState(0.05)
  const [showAdv, setShowAdv] = useState(false)
  const [selectedModel, setSelectedModel] = useState(TASK_PRESETS.complete.model)
  const [taskPreset, setTaskPreset] = useState<TaskPreset>('complete')
  const [homologs, setHomologs] = useState<string[]>([])
  const [variantsText, setVariantsText] = useState('')
  const [livePhase, setLivePhase] = useState<GenerationProgressPhase | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const didAutoTourRef = React.useRef(false)

  const hasResults = !!(results || loading || error)

  useEffect(() => { if (mode === 'family_guided' && !HOMOLOG_MODELS.has(selectedModel)) setMode('unconditional') }, [selectedModel, mode])

  const [dark, setDark] = useState(() => { const s = localStorage.getItem('dayhoff-theme'); return s ? s === 'dark' : true })
  const isEmbed = typeof window !== 'undefined' && window.self !== window.top
  useEffect(() => { document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); localStorage.setItem('dayhoff-theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => { checkHealth().then(d => { setReady(d.model_loaded); if (d.esmfold_max_length) setEsmfoldMax(d.esmfold_max_length) }).catch(() => setReady(false)) }, [])
  useEffect(() => {
    if (didAutoTourRef.current) return
    didAutoTourRef.current = true
    if (!localStorage.getItem('dayhoff-tour-done')) {
      const t = setTimeout(() => setShowTour(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  const handleGenerate = useCallback(async (opts?: { forceLive?: boolean }) => {
    const np = normalizePrompt(prompt)
    const err = validatePrompt(np, maxLen)
    if (err) { setError(err); setResults(null); return }

    if (!opts?.forceLive) {
      const cached = getCachedResult(np, selectedModel, maxLen, numSeq)
      if (cached) { setResults(cached); setIsDemo(true); setLastElapsed(null); return }
    }

    abortRef.current?.abort()
    const ctrl = new AbortController(); abortRef.current = ctrl
    setLoading(true); setError(null); setElapsed(0); setLastElapsed(null); setIsDemo(false); setResults(null); setLivePhase(null)
    const t0 = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    // C1: parallel progress polling so the UI reflects real backend phases.
    const rid = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID().slice(0, 16) : `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    let pollActive = true
    const pollProgress = async () => {
      while (pollActive && !ctrl.signal.aborted) {
        const p = await fetchGenerationProgress(rid, ctrl.signal)
        if (p) setLivePhase(p)
        if (p && (p.phase === 'done' || p.phase === 'error')) break
        await new Promise(res => setTimeout(res, 1500))
      }
    }
    pollProgress()
    try {
      const params: GenerationParams = { prompt: np, num_sequences: numSeq, max_length: maxLen, temperature: temp, generation_mode: mode, direction: dir, model: selectedModel, min_p: minP }
      if (HOMOLOG_MODELS.has(selectedModel) && homologs.length > 0) {
        params.homologs = homologs
      }
      const data = await generateSequences(params, ctrl.signal, rid)
      if (data.success && data.sequences_with_fitness.length > 0) { setResults(data); setCachedResult(np, data, selectedModel); setLastElapsed(Math.round((Date.now() - t0) / 1000)) }
      else { setResults(null); setError(data.error || 'No valid sequences generated.') }
    } catch (e) { if ((e as Error).name !== 'AbortError') setError((e as Error).message) }
    finally { pollActive = false; clearInterval(timer); setLoading(false); abortRef.current = null }
  }, [prompt, numSeq, maxLen, temp, mode, dir, selectedModel, homologs, minP])

  const handleCancel = useCallback(() => { abortRef.current?.abort() }, [])

  const handleScoreVariants = useCallback(async () => {
    if (!variantsText.trim()) { setError('Paste at least one protein sequence (FASTA, comma-separated, or one per line).'); return }
    abortRef.current?.abort()
    const ctrl = new AbortController(); abortRef.current = ctrl
    setLoading(true); setError(null); setElapsed(0); setIsDemo(false); setResults(null)
    const t0 = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    try {
      const data = await scoreVariants(variantsText, selectedModel, ctrl.signal)
      if (data.success && data.variants.length > 0) {
        // Map variant scoring response into GenerationResponse shape so ResultsView can render it.
        const sequences_with_fitness = data.variants.map(v => ({
          sequence: v.sequence, fitness_score: v.fitness_score, length: v.length,
        }))
        const invalid_sequences: [string, string][] = (data.invalid_sequences || []).map(
          (e) => [e.sequence, e.error] as [string, string],
        )
        const avg_fitness = sequences_with_fitness.reduce((a, b) => a + b.fitness_score, 0) / sequences_with_fitness.length
        const adapted: GenerationResponse = {
          success: true,
          sequences: sequences_with_fitness.map(s => s.sequence),
          sequences_with_fitness,
          invalid_sequences,
          stats: {
            total_generated: data.stats.total_submitted,
            valid_count: data.stats.scored_count,
            invalid_count: data.stats.invalid_count,
            success_rate: data.stats.scored_count / Math.max(1, data.stats.total_submitted),
            generation_mode: 'unconditional',
            direction: 'n_to_c',
            avg_fitness,
            model: data.stats.model,
          },
        }
        setResults(adapted); setLastElapsed(Math.round((Date.now() - t0) / 1000))
      } else { setResults(null); setError(data.error || 'No valid variants to score.') }
    } catch (e) { if ((e as Error).name !== 'AbortError') setError((e as Error).message) }
    finally { clearInterval(timer); setLoading(false); abortRef.current = null }
  }, [variantsText, selectedModel])

  const handleSubmit = useCallback((opts?: { forceLive?: boolean }) => {
    if (taskPreset === 'score') return handleScoreVariants()
    return handleGenerate(opts)
  }, [taskPreset, handleScoreVariants, handleGenerate])

  const handleSelectProtein = useCallback((workflow: typeof DEMO_WORKFLOWS[number]) => {
    setPrompt(workflow.prompt); setSelectedModel(workflow.model)
    setNumSeq(3); setMaxLen(512); setTemp(0.8); setMode('unconditional'); setDir('n_to_c')
    setTaskPreset(workflow.key === 'spike' ? 'variants' : 'complete')
    setHomologs([])
    setResults(null); setIsDemo(false); setError(null)
  }, [])

  const handleExport = useCallback(async (fmt: string) => {
    if (!results) return
    try {
      const blob = await exportSequences(fmt, { sequences: results.sequences_with_fitness, parameters: { prompt, num_sequences: numSeq, max_length: maxLen, temperature: temp, generation_mode: mode, direction: dir, model: results.stats.model || selectedModel } })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dayhoff.${fmt}`; a.click(); URL.revokeObjectURL(a.href)
    } catch { /* ignore */ }
  }, [results, prompt, numSeq, maxLen, temp, mode, dir, selectedModel])

  const handleHome = useCallback(() => {
    abortRef.current?.abort(); setResults(null); setError(null); setLoading(false); setElapsed(0); setLastElapsed(null); setIsDemo(false)
    setPrompt('MDKKYSIGLDIGTNSVGWAVITDEYKVPSKKFKVLGNTDRHSIKKNLIGALLFDSG')
    setNumSeq(TASK_PRESETS.complete.numSeq); setMaxLen(TASK_PRESETS.complete.maxLen); setTemp(TASK_PRESETS.complete.temp)
    setMode('unconditional'); setDir('n_to_c'); setSelectedModel(TASK_PRESETS.complete.model); setTaskPreset('complete')
    setHomologs([]); setVariantsText('')
  }, [])

  const proteinInfo = getProteinInfo(normalizePrompt(prompt))

  return (
    <div className={`app-shell ${isEmbed ? 'app-shell--embedded' : ''}`}>
      {/* ── Header (BioEmu pattern) ── */}
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__main">
            <button className="app-header__brand" onClick={handleHome} aria-label="Return to Microsoft Dayhoff home">
              <svg width="22" height="22" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="10" height="10" fill="#f25022" />
                <rect x="11" width="10" height="10" fill="#7fba00" />
                <rect y="11" width="10" height="10" fill="#00a4ef" />
                <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
              </svg>
              <span className="app-header__name">Microsoft Dayhoff</span>
              <span className="app-header__sep" aria-hidden="true" />
              <span className="app-header__subtitle">Protein Language Model &middot; Microsoft Research</span>
              <span className="app-header__badges">
                <span className="app-header__badge">Research Preview</span>
                <span
                  className={`app-header__badge app-header__badge--demo ${ready ? 'app-header__badge--live' : 'app-header__badge--demo-offline'}`}
                  data-tour="demo-badge"
                  title={ready ? 'Connected to live Dayhoff backend' : 'Backend offline · cached examples only'}
                >
                  <span className="app-header__badge-dot" aria-hidden="true" />
                  {ready ? 'Live' : 'Demo · offline'}
                </span>
              </span>
            </button>

            <div className="app-header__actions">
              <button className="app-header__btn" onClick={() => setShowTour(true)} title="Take a guided tour" aria-label="Open guided tour" data-tour="tour-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r="0.5" fill="currentColor" /></svg>
                Tour
              </button>
              <button className="app-header__btn" onClick={() => setDark(d => !d)} title={`Switch to ${dark ? 'light' : 'dark'} theme`} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {dark ? <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /> : <><circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></>}
                </svg>
                {dark ? 'Dark' : 'Light'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main: single 2-column workspace, always ── */}
      <main className="workspace">
        <aside className="workspace__rail" aria-label="Generate">
          <InputView
            ready={ready} loading={loading} prompt={prompt} numSeq={numSeq} maxLen={maxLen}
            temp={temp} minP={minP} mode={mode} dir={dir} showAdv={showAdv} selectedModel={selectedModel}
            taskPreset={taskPreset} proteinInfo={proteinInfo} hasResults={hasResults}
            homologs={homologs} onHomologsChange={setHomologs}
            variantsText={variantsText} onVariantsTextChange={setVariantsText}
            onPromptChange={setPrompt} onNumSeqChange={setNumSeq} onMaxLenChange={setMaxLen}
            onTempChange={setTemp} onMinPChange={setMinP} onModeChange={setMode} onDirChange={setDir} onShowAdvChange={setShowAdv}
            onModelChange={setSelectedModel} onTaskPresetChange={setTaskPreset}
            onGenerate={handleSubmit} onCancel={handleCancel} onSelectProtein={handleSelectProtein}
          />
        </aside>
        <section className="workspace__surface" aria-label="Output" data-tour="surface">
          {error && (
            <div className="error-card" role="alert">
              <span className="status-dot status-dot--err" aria-hidden="true" />{error}
            </div>
          )}
          {loading && <GenerationProgress elapsed={elapsed} selectedModel={selectedModel} numSeq={numSeq} maxLen={maxLen} livePhase={livePhase} />}
          {results && !loading && (
            <ResultsView results={results} selectedModel={selectedModel} isDemo={isDemo} prompt={prompt}
              elapsedSeconds={lastElapsed}
              esmfoldMax={esmfoldMax}
              taskPreset={taskPreset} onExport={handleExport} onHome={handleHome} />
          )}
          {!loading && !results && !error && (
            <InfoPanel proteinInfo={proteinInfo} prompt={prompt} numSeq={numSeq} maxLen={maxLen} temp={temp} selectedModel={selectedModel} taskPreset={taskPreset} variantsText={variantsText} />
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="app-footer">
        <div className="app-footer__main">
          <span>Dayhoff · Microsoft Research</span>
          <span className="app-footer__sep">·</span>
          <a className="app-footer__link" href="https://github.com/microsoft/dayhoff" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span className="app-footer__sep">·</span>
          <a className="app-footer__link" href="https://huggingface.co/collections/microsoft/dayhoff-atlas-6866d679465a2685b06ee969" target="_blank" rel="noopener noreferrer">Hugging Face</a>
          <span className="app-footer__sep">·</span>
          <a className="app-footer__link" href="https://ai.azure.com/explore/models" target="_blank" rel="noopener noreferrer">Microsoft Foundry</a>
        </div>
        <div className="app-footer__notice" data-tour="about">
          <span className="app-footer__notice-label">Research preview</span>
          <span>Not for clinical or therapeutic use</span>
        </div>
      </footer>

      {showTour && <FeatureTour steps={TOUR_STEPS} onComplete={() => { setShowTour(false); localStorage.setItem('dayhoff-tour-done', '1') }} />}
    </div>
  )
}
