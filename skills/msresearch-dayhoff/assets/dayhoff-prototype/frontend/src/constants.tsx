/* ── Amino acid highlighting ── */
export const AA_TYPE: Record<string, string> = {
  A:'h',I:'h',L:'h',V:'h',M:'h',F:'h',Y:'h',W:'h',
  D:'c',E:'c',K:'c',R:'c',
  N:'p',Q:'p',S:'p',T:'p',H:'p',
  C:'s',G:'s',P:'s',
}

export function colorSeq(seq: string, seedLength = 0) {
  return seq.split('').map((aa, i) => {
    const cls = `aa-${AA_TYPE[aa]||'s'}${i < seedLength ? ' aa-seed' : ''}`
    return <span key={i} className={cls}>{aa}</span>
  })
}

/** Map a prompt string to a recognizable protein name, or null */
export function proteinNameForPrompt(prompt: string): string | null {
  for (const ex of EXAMPLES) {
    if (ex.prompt && ex.prompt === prompt) {
      return ex.label.replace(/ prefix$/, '')
    }
  }
  return null
}

/* ── Fitness helpers ── */
export function fitnessLevel(s: number) {
  if (s >= 70) return 'high'
  if (s >= 40) return 'med'
  return 'low'
}

/* ── Estimated generation time (seconds) by model class ──
 * Calibrated against measured A100 latency for the dayhoff-multi configuration
 * (3 sequences, max_length=512, warm endpoint):
 *   170m-UR50-BRn: 29–33s observed → 25–45s with headroom
 *   3B variants:   40–43s observed → 30–60s with headroom
 * Estimates scale linearly with num_sequences and max_length.
 * Cold-start adds ~10–20s; the upper bound covers that.
 */
const MODEL_ESTIMATE: Record<string, [number, number]> = {
  '170m-UR50-BRn': [25, 45],
  '3b-UR90': [30, 60],
  '3b-GR-HM-c': [30, 60],
  '3b-GR-HM': [30, 60],
}

export function estimateRange(model: string, numSeq: number, maxLen = 512): [number, number] {
  const [lo, hi] = MODEL_ESTIMATE[model] ?? [60, 180]
  const seqScale = Math.max(1, numSeq / 3)
  const lenScale = Math.max(0.5, maxLen / 512)
  return [Math.round(lo * seqScale * lenScale), Math.round(hi * seqScale * lenScale)]
}

/** Human-readable ETA range for a model at the default 3 seq / 512 len workload. */
export function formatEstimateMinutes(model: string): string {
  const [lo, hi] = MODEL_ESTIMATE[model] ?? [60, 180]
  // Sub-90s ranges read better in seconds; longer ones in minutes.
  if (hi < 90) return `${lo}–${hi}s`
  const loMin = Math.round((lo / 60) * 10) / 10
  const hiMin = Math.round((hi / 60) * 10) / 10
  const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))
  return `${fmt(loMin)}–${fmt(hiMin)} min`
}

export const PIPELINE_STEPS = [
  { key: 'send', label: 'Request sent', icon: '↑' },
  { key: 'generate', label: 'Generating & scoring on GPU', icon: '◈' },
  { key: 'validate', label: 'Validating results', icon: '△' },
] as const

export function pipelinePhase(elapsed: number, is3B: boolean): number {
  if (!is3B) {
    if (elapsed < 1) return 0
    return 1
  }
  if (elapsed < 2) return 0
  return 1
}

/* ── Examples ── */
export const EXAMPLES = [
  { label: 'Cas9 prefix', prompt: 'MDKKYSIGLDIGTNSVGWAVITDEYKVPSKKFKVLGNTDRHSIKKNLIGALLFDSG' },
  { label: 'Insulin prefix', prompt: 'MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKT' },
  { label: 'DNA polymerase prefix', prompt: 'MSKRKAPQETLNGGITDMLTELANFEKNVSQAIHK' },
  { label: 'Coronavirus spike prefix', prompt: 'MFVFLVLLPLVSSQCVNLTTRTQLPPAYTNSFTRGVYYPDKVFRSSVLHSTQDLFLPFF' },
  { label: 'Blank custom seed', prompt: '' },
]

/** Rich info for known reference proteins, used by the context panel */
export interface ProteinInfo {
  key: string
  name: string
  fullName: string
  organism: string
  totalResidues: number
  seedDescription: string
  whatItDoes: string
  whatToExpect: string
}

export const PROTEIN_INFO: Record<string, ProteinInfo> = {
  'MDKKYSIGLDIGTNSVGWAVITDEYKVPSKKFKVLGNTDRHSIKKNLIGALLFDSG': {
    key: 'cas9', name: 'Cas9', fullName: 'CRISPR-associated protein 9',
    organism: 'Streptococcus pyogenes', totalResidues: 1368,
    seedDescription: 'N-terminal RuvC-like domain (first 56 of 1,368 residues)',
    whatItDoes: 'A programmable endonuclease used in CRISPR gene editing. Cuts DNA at sites specified by a guide RNA.',
    whatToExpect: 'Candidates should extend the RuvC domain and continue into the recognition and HNH nuclease domains.',
  },
  'MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKT': {
    key: 'insulin', name: 'Insulin', fullName: 'Preproinsulin',
    organism: 'Homo sapiens', totalResidues: 110,
    seedDescription: 'Signal peptide + B chain start (first 53 of 110 residues)',
    whatItDoes: 'A peptide hormone that regulates blood glucose. The signal peptide directs it to the secretory pathway.',
    whatToExpect: 'Candidates should complete the B chain, C peptide, and A chain of preproinsulin.',
  },
  'MSKRKAPQETLNGGITDMLTELANFEKNVSQAIHK': {
    key: 'dnapol', name: 'DNA polymerase I', fullName: 'DNA polymerase I',
    organism: 'Escherichia coli', totalResidues: 928,
    seedDescription: '5′→3′ exonuclease domain start (first 35 of 928 residues)',
    whatItDoes: 'A DNA replication enzyme with polymerase, proofreading, and nick-translation activities.',
    whatToExpect: 'Candidates should extend through the exonuclease, proofreading, and Klenow polymerase domains.',
  },
  'MFVFLVLLPLVSSQCVNLTTRTQLPPAYTNSFTRGVYYPDKVFRSSVLHSTQDLFLPFF': {
    key: 'spike', name: 'Spike protein', fullName: 'Spike glycoprotein',
    organism: 'SARS-CoV-2', totalResidues: 1273,
    seedDescription: 'Signal peptide + NTD start (first 59 of 1,273 residues)',
    whatItDoes: 'Mediates viral entry by binding ACE2 on human cells. Target of COVID-19 vaccines.',
    whatToExpect: 'Candidates should extend through the N-terminal domain, receptor-binding domain, and fusion machinery.',
  },
}

export function getProteinInfo(prompt: string): ProteinInfo | null {
  return PROTEIN_INFO[normalizePrompt(prompt)] ?? null
}

export const CANONICAL_AA = 'ACDEFGHIKLMNPQRSTVWY'

export function normalizePrompt(value: string) {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function validatePrompt(value: string, maxLength: number) {
  const normalized = normalizePrompt(value)
  const invalid = [...new Set(normalized.split('').filter(aa => !CANONICAL_AA.includes(aa)))].sort()
  if (invalid.length) {
    const residues = invalid.join(', ')
    const phrase = invalid.length === 1 ? 'is not a valid amino acid' : 'are not valid amino acids'
    return `${residues} ${phrase}. Use only the 20 canonical amino acids: ${CANONICAL_AA}.`
  }
  if (normalized.length > maxLength) return `Prompt length ${normalized.length} exceeds max length ${maxLength}.`
  return null
}

/**
 * Parse FASTA / line-delimited / comma-separated input into normalized canonical sequences.
 * Returns parsed sequences and any per-record errors (1-based index, message).
 */
export function parseFastaSequences(raw: string): { sequences: string[]; errors: { index: number; message: string }[] } {
  const sequences: string[] = []
  const errors: { index: number; message: string }[] = []
  if (!raw || !raw.trim()) return { sequences, errors }

  const text = raw.trim()
  const records: string[] = []

  if (text.includes('>')) {
    // FASTA: split on '>' headers
    const parts = text.split(/^>.*$/m).map(p => p.trim()).filter(Boolean)
    for (const part of parts) records.push(part)
  } else {
    // One sequence per line, or comma/semicolon separated
    for (const line of text.split(/[\n,;]+/)) {
      const t = line.trim()
      if (t) records.push(t)
    }
  }

  records.forEach((rec, i) => {
    const norm = normalizePrompt(rec)
    if (!norm) return
    const invalid = [...new Set(norm.split('').filter(aa => !CANONICAL_AA.includes(aa)))].sort()
    if (invalid.length) {
      errors.push({ index: i + 1, message: `Homolog #${i + 1}: ${invalid.join(', ')} not a valid amino acid.` })
      return
    }
    sequences.push(norm)
  })

  return { sequences, errors }
}

/* ── Model short descriptions ── */
export const MODEL_DESCRIPTIONS: Record<string, string> = {
  '170m-UR50-BRn': '170M parameters. Fast candidate generation for exploratory runs.',
  '3b-UR90': '3B parameters. General-purpose generation with stronger structural benchmarks.',
  '3b-GR-HM-c': '3B parameters. Best zero-shot mutation-effect benchmark among Dayhoff variants.',
  '3b-GR-HM': '3B parameters. Use with homolog context for family-conditioned generation.',
}

/* ── Models that support homolog conditioning ── */
export const HOMOLOG_MODELS = new Set(['3b-GR-HM', '3b-GR-HM-c'])

/* ── Model chip data ── */
export const MODEL_CHIPS = [
  { key: '170m-UR50-BRn', name: 'UR50-BRn', badge: '170M', purpose: 'Fast exploration',           note: 'Smallest variant. ~25–45s per run.' },
  { key: '3b-UR90',       name: 'UR90',     badge: '3B',   purpose: 'Highest-quality generation', note: 'Strongest structural benchmarks. ~30–60s per run.' },
  { key: '3b-GR-HM-c',    name: 'GR-HM-c',  badge: '3B',   purpose: 'Mutation-effect scoring',    note: 'Best zero-shot fitness predictor. ~30–60s per run.' },
  { key: '3b-GR-HM',      name: 'GR-HM',    badge: '3B',   purpose: 'Homolog-guided design',      note: 'Needs family context. ~30–60s per run.' },
] as const

/* ── Model detail cards (right panel overview) ── */
export const MODEL_DETAILS = [
  { key: '170m-UR50-BRn', name: 'UR50-BRn', params: '170M parameters', speed: 'Fast', best: 'Fast sequence completion', desc: 'Use for booth demos and rapid first-pass exploration.', benchmarks: 'pLDDT 0.432 · Fitness 0.341 · RFDiffusion 7.26', homologs: false },
  { key: '3b-UR90', name: 'UR90', params: '3B parameters', speed: '', best: 'General protein generation', desc: 'Use when generation quality matters more than latency.', benchmarks: 'pLDDT 0.454 · Fitness 0.394 · RFDiffusion 16.32 · MotifBench 8.36', homologs: false },
  { key: '3b-GR-HM-c', name: 'GR-HM-c', params: '3B parameters', speed: '', best: 'Mutation-effect scoring', desc: 'Use for zero-shot mutation-effect assessment.', benchmarks: 'Fitness 0.417 · pLDDT 0.423 · RFDiffusion 14.14', homologs: true },
  { key: '3b-GR-HM', name: 'GR-HM', params: '3B parameters', speed: '', best: 'Homolog-guided generation', desc: 'Use when related family sequences are available.', benchmarks: 'pLDDT 0.406 · Fitness 0.328 · MotifBench 4.96', homologs: true },
] as const

/* ── Task presets ── */
export type TaskPreset = 'complete' | 'variants' | 'denovo' | 'score' | 'custom'
export const TASK_PRESETS: Record<Exclude<TaskPreset, 'custom'>, { label: string; desc: string; temp: number; model: string; maxLen: number; numSeq: number }> = {
  complete: { label: 'Complete protein', desc: 'Extend a protein prefix', temp: 1.0, model: '170m-UR50-BRn', maxLen: 512, numSeq: 3 },
  variants: { label: 'Generate variants', desc: 'Sample plausible alternatives', temp: 1.0, model: '3b-UR90', maxLen: 512, numSeq: 5 },
  denovo:   { label: 'De novo design',    desc: 'Sample without a seed',         temp: 1.3, model: '170m-UR50-BRn', maxLen: 256, numSeq: 5 },
  score:    { label: 'Score variants',    desc: 'Rank pasted sequences by Dayhoff likelihood', temp: 0,   model: '3b-GR-HM-c', maxLen: 1024, numSeq: 0 },
}

/* ── Tour steps ── */
export const TOUR_STEPS = [
  {
    target: null,
    title: 'Welcome to Dayhoff',
    content: 'Dayhoff is a family of protein language models from Microsoft Research. This 60-second tour walks you through the interface.',
    placement: 'bottom' as const,
  },
  {
    target: '[data-tour="demo-badge"]',
    title: 'Live backend',
    content: 'When this badge says Live, Generate runs the real Dayhoff models on a GPU. The four example chips also have cached results so they return instantly.',
    placement: 'bottom' as const,
  },
  {
    target: '[data-tour="workflow"]',
    title: 'Pick a workflow',
    content: 'Extend a known protein, sample variants, design from scratch, or score existing sequences. Choose a workflow to get started.',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="examples"]',
    title: 'Start from a real protein',
    content: 'Cas9, insulin, DNA polymerase, or the SARS-CoV-2 spike. Click one to load its N-terminal seed and the matching cached result.',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="input"]',
    title: 'Edit the seed',
    content: 'The model continues this prefix. Only the 20 canonical amino acids. Paste your own or tweak the example.',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="surface"]',
    title: 'Run preview',
    content: 'The right side previews what\u2019s about to happen: the protein, residue makeup, how much sequence will be sampled, and the active config.',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="settings"]',
    title: 'Run setup (optional)',
    content: 'Open this to swap model variants, change candidate count and length, or reach the advanced controls. Skip it for the defaults.',
    placement: 'right' as const,
  },
  {
    target: '[data-tour="generate-row"]',
    title: 'Generate',
    content: 'Each candidate gets a 0\u2013100 plausibility score. Export results as FASTA, CSV, or JSON.',
    placement: 'right' as const,
  },
  {    target: '[data-tour="generate-row"]',
    title: 'See the 3D fold',
    content: 'Every candidate has a 3D Structure button. One click sends the sequence to ESMFold and renders the predicted structure inline, colored by per-residue confidence (pLDDT). Works on sequences up to 400 aa.',
    placement: 'right' as const,
  },
  {    target: '[data-tour="tour-btn"]',
    title: 'You\u2019re set',
    content: 'Tour lives here if you want it back. Theme toggle next to it. Footer links go to the GitHub repo, the Hugging Face collection, and Microsoft Foundry.',
    placement: 'bottom' as const,
  },
]
