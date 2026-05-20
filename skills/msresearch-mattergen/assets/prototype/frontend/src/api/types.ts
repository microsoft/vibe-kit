import type { CrystalData } from '../utils/cifParser'

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface GenerationRequest {
  diffusion_guidance_factor?: number
  properties_to_condition_on: Record<string, unknown>
  adapter_name?: string
}

export interface GenerationJob {
  id: string
  status: JobStatus
  created_at: string
  finished_at?: string
  artifact_uri?: string
  request: GenerationRequest
}

export interface StructureMetrics {
  energyAboveHull: number | null // eV/atom (requires reference dataset)
  energyPerAtom?: number | null // eV/atom (raw MatterSim output)
  isStable: boolean
  isNovel: boolean
  isUnique: boolean
}

export interface Structure {
  id: string
  index: number
  formula: string
  composition: string
  systematicName?: string
  jobId?: string
  source?: 'generation' | 'transfer' | 'upload'
  metrics?: StructureMetrics
  generationPrompt?: Record<string, unknown>
  has_trajectory?: boolean
  crystalData?: CrystalData
  cifContent?: string // Raw CIF content for download
  generationBatchId?: string // Track which generation batch this came from
}

// Legacy type for backward compatibility with existing backend
export interface StructureSummary {
  id: string
  job_id: string
  index: number
  composition: string
  formula: string
  has_trajectory: boolean
  metrics?: Record<string, unknown> | null
}

export interface GenerationJobWithStructures {
  job: GenerationJob
  structures: Structure[]
}

export interface EvaluationRequest {
  structures: Array<{
    id: string
    cif: string
  }>
  relax?: boolean
}

export interface EvaluationMetrics {
  energyAboveHull: number | null
  energyPerAtom: number | null
  totalEnergy: number | null
  isStable: boolean | null
  isNovel: boolean | null
  isUnique: boolean | null
  forces: number[][] | null
  stress: number[] | null
}

export interface EvaluationResult {
  structureId: string
  metrics: EvaluationMetrics
  relaxedCif: string | null
}

export interface EvaluationResponse {
  results: EvaluationResult[]
  errors?: string[]
}

// --- Property Metadata Types ---

export interface PropertyMetadata {
  id: string
  label: string
  type: 'numeric' | 'integer' | 'chemical_system'
  description: string
  operators: string[]
  example: string
  unit: string | null
  min: number | null
  max: number | null
  group?: string
  checkpoint?: string
  compatibleWith?: string[]
  requiresProperty?: string // Property ID that must be selected before this one can be used
}

export interface PropertyGroup {
  id: string
  label: string
  description: string
}

export interface CheckpointInfo {
  name: string
  description: string
  properties: string[]
}

export interface PropertiesConfig {
  properties: PropertyMetadata[]
  groups: PropertyGroup[]
  checkpoints: Record<string, CheckpointInfo>
  supportedElements: string[]
  unsupportedElements: string[]
  appMode: 'research' | 'production'
  demoMode: boolean // Whether demo fallback is enabled (from backend DEMO_MODE env var)
}

// Error codes returned by the backend for structured error handling
export type ApiErrorCode =
  | 'rate_limited'
  | 'auth_failed'
  | 'service_unavailable'
  | 'timeout'
  | 'generation_failed'
  | 'unexpected_error'

// Structured error response from the backend
export interface ApiErrorResponse {
  error_code: ApiErrorCode
  message: string
  detail?: string
}

// Custom error class for API errors with structured data
export class ApiError extends Error {
  constructor(
    public readonly errorCode: ApiErrorCode,
    message: string,
    public readonly detail?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface PropertyListResponse {
  properties: PropertyMetadata[]
}

// Represents a single property constraint in the visual builder
export interface PropertyConstraint {
  id: string // Unique key for React
  propertyId: string // e.g., 'ml_bulk_modulus'
  operator: string // e.g., '>='
  value: string // e.g., '400' or 'Li-O' for chemical_system
}
