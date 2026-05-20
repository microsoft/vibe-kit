import type {
  GenerationJobWithStructures,
  GenerationRequest,
  Structure,
  EvaluationRequest,
  EvaluationResult,
  EvaluationResponse,
  PropertyMetadata,
  PropertyListResponse,
  PropertiesConfig,
  ApiErrorResponse,
} from './types'
import { ApiError } from './types'
import { parseCIF } from '../utils/cifParser'

const API_BASE = '/api'

// User-friendly error messages mapped by error code
const ERROR_MESSAGES: Record<string, string> = {
  rate_limited:
    "This is an experimental site and we're experiencing an increase in demand. Please try again soon!",
  auth_failed:
    "We're having trouble connecting to the service. Please try again later or contact support if the issue persists.",
  service_unavailable:
    'The generation service is temporarily unavailable. Please try again in a few minutes.',
  timeout:
    'The request took too long to complete. The service may be under heavy load. Please try again.',
  generation_failed: 'Something went wrong while generating structures. Please try again.',
  unexpected_error: 'Something went wrong while generating structures. Please try again.',
}

// Parse error response and throw appropriate ApiError
async function parseErrorResponse(resp: Response): Promise<never> {
  let errorData: ApiErrorResponse | null = null

  try {
    const contentType = resp.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      const json = await resp.json()
      // Check if it's a structured error response
      if (json.error_code && json.message) {
        errorData = json as ApiErrorResponse
      }
    }
  } catch {
    // Failed to parse JSON, will use fallback
  }

  if (errorData) {
    // Use the user-friendly message from our mapping, or fall back to backend message
    const userMessage = ERROR_MESSAGES[errorData.error_code] || errorData.message
    throw new ApiError(errorData.error_code, userMessage, errorData.detail)
  }

  // Fallback for non-structured errors
  const text = await resp.text().catch(() => '')
  const fallbackCode =
    resp.status === 429
      ? 'rate_limited'
      : resp.status === 401 || resp.status === 403
        ? 'auth_failed'
        : resp.status === 502 || resp.status === 503
          ? 'service_unavailable'
          : resp.status === 504
            ? 'timeout'
            : 'unexpected_error'

  const userMessage = ERROR_MESSAGES[fallbackCode]
  throw new ApiError(fallbackCode, userMessage, text || `HTTP ${resp.status}`)
}

// Sample formulas for mock data generation
const SAMPLE_FORMULAS = [
  'TaCr2O6',
  'Fe3O4',
  'SiC',
  'Al2O3',
  'TiO2',
  'ZnO',
  'MgO',
  'CaF2',
  'NaCl',
  'BaTiO3',
  'LiCoO2',
  'LiFePO4',
  'SrTiO3',
  'LaAlO3',
  'YBa2Cu3O7',
  'Bi2Te3',
]

export async function createGenerationJob(
  request: GenerationRequest
): Promise<GenerationJobWithStructures> {
  const resp = await fetch(`${API_BASE}/generation/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!resp.ok) {
    await parseErrorResponse(resp)
  }

  const data = await resp.json()

  // Transform backend response to include generation context and parsed crystal data
  const structures: Structure[] = data.structures.map(
    (s: { id: string; index?: number; formula: string; composition: string; systematic_name?: string; cif?: string; has_trajectory?: boolean; job_id?: string }, index: number) => {
      const structure: Structure = {
        id: s.id,
        index: s.index ?? index,
        formula: s.formula,
        composition: s.composition,
        systematicName: s.systematic_name,
        jobId: s.job_id,
        source: 'generation' as const,
        generationPrompt: request.properties_to_condition_on,
        has_trajectory: s.has_trajectory,
        cifContent: s.cif,
      }

      // Parse CIF content to get crystal data for 3D visualization
      if (s.cif) {
        try {
          structure.crystalData = parseCIF(s.cif)
        } catch (err) {
          console.warn(`Failed to parse CIF for structure ${s.id}:`, err)
        }
      }

      return structure
    }
  )

  return { job: data.job, structures }
}

// Fetch demo data as fallback when real API fails
export async function fetchDemoData(
  request: GenerationRequest
): Promise<GenerationJobWithStructures> {
  const resp = await fetch(`${API_BASE}/demo/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Failed to fetch demo data: ${resp.status} ${text}`)
  }

  const data = await resp.json()

  // Transform backend response same as createGenerationJob
  const structures: Structure[] = data.structures.map(
    (s: { id: string; index?: number; formula: string; composition: string; systematic_name?: string; cif?: string; has_trajectory?: boolean; job_id?: string }, index: number) => {
      const structure: Structure = {
        id: s.id,
        index: s.index ?? index,
        formula: s.formula,
        composition: s.composition,
        systematicName: s.systematic_name,
        jobId: s.job_id,
        source: 'generation' as const,
        generationPrompt: request.properties_to_condition_on,
        has_trajectory: s.has_trajectory,
        cifContent: s.cif,
      }

      // Parse CIF content to get crystal data for 3D visualization
      if (s.cif) {
        try {
          structure.crystalData = parseCIF(s.cif)
        } catch (err) {
          console.warn(`Failed to parse CIF for structure ${s.id}:`, err)
        }
      }

      return structure
    }
  )

  return { job: data.job, structures }
}

export async function getGenerationJob(
  jobId: string
): Promise<GenerationJobWithStructures> {
  const resp = await fetch(`${API_BASE}/generation/jobs/${jobId}`)
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Failed to fetch job: ${resp.status} ${text}`)
  }
  return (await resp.json()) as GenerationJobWithStructures
}

// Evaluate structures with MatterSim
export async function evaluateStructures(
  request: EvaluationRequest
): Promise<EvaluationResult[]> {
  const resp = await fetch(`${API_BASE}/evaluation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Evaluation failed: ${resp.status} ${text}`)
  }

  const data: EvaluationResponse = await resp.json()

  if (data.errors && data.errors.length > 0) {
    console.warn('Evaluation completed with errors:', data.errors)
  }

  return data.results
}

// Fetch available property metadata from backend
export async function fetchProperties(): Promise<PropertyMetadata[]> {
  const resp = await fetch(`${API_BASE}/properties`)

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Failed to fetch properties: ${resp.status} ${text}`)
  }

  const data: PropertyListResponse = await resp.json()
  return data.properties
}

// Fetch full properties configuration (includes groups, checkpoints, elements)
export async function fetchPropertiesConfig(): Promise<PropertiesConfig> {
  const resp = await fetch(`${API_BASE}/properties/config`)

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Failed to fetch properties config: ${resp.status} ${text}`)
  }

  return (await resp.json()) as PropertiesConfig
}

// Fetch IUPAC systematic name for a formula
async function fetchSystematicName(formula: string): Promise<string | undefined> {
  try {
    const resp = await fetch(`${API_BASE}/naming/systematic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ formula }),
    })

    if (!resp.ok) {
      console.warn(`Failed to fetch systematic name for ${formula}`)
      return undefined
    }

    const data = await resp.json()
    return data.systematic_name
  } catch (err) {
    console.warn(`Error fetching systematic name for ${formula}:`, err)
    return undefined
  }
}

// Parse uploaded files into structures
export async function parseUploadedFiles(files: File[]): Promise<Structure[]> {
  const structures: Structure[] = []

  for (let index = 0; index < files.length; index++) {
    const file = files[index]
    const content = await file.text()

    if (file.name.endsWith('.cif')) {
      // Parse CIF file to extract crystal data
      try {
        const crystalData = parseCIF(content)
        const systematicName = await fetchSystematicName(crystalData.formula)
        structures.push({
          id: `upload-${Date.now()}-${index}`,
          index,
          formula: crystalData.formula,
          composition: crystalData.formula,
          systematicName,
          source: 'upload' as const,
          crystalData,
          cifContent: content,
        })
      } catch (err) {
        console.error(`Failed to parse CIF file ${file.name}:`, err)
        // Fall back to filename-based formula
        const baseName = file.name.replace(/\.cif$/, '')
        const systematicName = await fetchSystematicName(baseName)
        structures.push({
          id: `upload-${Date.now()}-${index}`,
          index,
          formula: baseName,
          composition: baseName,
          systematicName,
          source: 'upload' as const,
          cifContent: content,
        })
      }
    } else {
      // For .extxyz and .xyz files, use filename as formula (parsing not yet implemented)
      const baseName = file.name.replace(/\.(extxyz|xyz)$/, '')
      const formula =
        baseName && /^[A-Z][a-z]?\d*/.test(baseName)
          ? baseName
          : SAMPLE_FORMULAS[Math.floor(Math.random() * SAMPLE_FORMULAS.length)]

      const systematicName = await fetchSystematicName(formula)
      structures.push({
        id: `upload-${Date.now()}-${index}`,
        index,
        formula,
        composition: formula,
        systematicName,
        source: 'upload' as const,
      })
    }
  }

  return structures
}
