import { useState, useEffect, FormEvent, useMemo } from 'react'
import type { GenerationRequest, PropertyMetadata, PropertyConstraint, PropertiesConfig } from '../api/types'
import { fetchPropertiesConfig } from '../api/client'
import { PropertySelector } from './PropertySelector'
import { Tooltip } from './Tooltip'
import { tooltipContent } from '../data/tooltipContent'
import { useAppStore } from '../stores/appStore'

interface Props {
  onSubmit: (request: GenerationRequest) => void
  onError?: (message: string) => void
  submitting: boolean
  disabledReason?: string
}

// Helper to generate unique IDs for constraints
let constraintIdCounter = 0
function generateConstraintId(): string {
  return `constraint-${Date.now()}-${constraintIdCounter++}`
}

// Convert constraints to the properties_to_condition_on format
// MatterGen uses target values for diffusion guidance, NOT constraints with operators
function constraintsToPropertiesObject(
  constraints: PropertyConstraint[],
  properties: PropertyMetadata[]
): Record<string, string | number> {
  const result: Record<string, string | number> = {}
  for (const c of constraints) {
    if (c.propertyId && c.value) {
      const prop = properties.find((p) => p.id === c.propertyId)
      if (prop?.type === 'chemical_system') {
        // chemical_system uses just the value (e.g., "Li-O")
        result[c.propertyId] = c.value
      } else {
        // Numeric/integer: send bare numeric value (MatterGen uses target values, not constraints)
        const numValue = parseFloat(c.value)
        result[c.propertyId] = isNaN(numValue) ? c.value : numValue
      }
    }
  }
  return result
}

// Parse a properties object back to constraints (for JSON mode sync)
function propertiesObjectToConstraints(
  obj: Record<string, unknown>,
  properties: PropertyMetadata[]
): PropertyConstraint[] {
  const constraints: PropertyConstraint[] = []
  for (const [key, value] of Object.entries(obj)) {
    const prop = properties.find((p) => p.id === key)

    if (prop?.type === 'chemical_system') {
      // chemical_system: value is the element string directly
      if (typeof value === 'string') {
        constraints.push({
          id: generateConstraintId(),
          propertyId: key,
          operator: '=',
          value: value,
        })
      }
    } else {
      // Numeric/integer: accept number or string
      const strValue = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : null
      if (strValue !== null) {
        constraints.push({
          id: generateConstraintId(),
          propertyId: key,
          operator: '=', // Operator not used, kept for interface compatibility
          value: strValue,
        })
      }
    }
  }
  return constraints
}

// Check if a property is compatible with a set of other properties
function isPropertyCompatible(
  propertyId: string,
  otherPropertyIds: string[],
  properties: PropertyMetadata[]
): { compatible: boolean; reason?: string } {
  const prop = properties.find((p) => p.id === propertyId)
  if (!prop) return { compatible: false, reason: 'Unknown property' }

  if (otherPropertyIds.length === 0) return { compatible: true }

  // Check compatibility with each other property
  for (const otherId of otherPropertyIds) {
    if (otherId === propertyId) {
      return { compatible: false, reason: 'Already selected' }
    }

    const otherProp = properties.find((p) => p.id === otherId)
    if (!otherProp) continue

    // Check if properties are compatible (either lists the other)
    const propCompatible = prop.compatibleWith ?? []
    const otherCompatible = otherProp.compatibleWith ?? []

    if (!propCompatible.includes(otherId) && !otherCompatible.includes(propertyId)) {
      return {
        compatible: false,
        reason: `Cannot combine with ${otherProp.label}`,
      }
    }
  }

  return { compatible: true }
}

// Compute which properties should be disabled for a given constraint
// Only considers constraints BEFORE this one in the list (by index).
// This allows the first constraint to always be changeable, and changing it
// will auto-remove incompatible later constraints via handleUpdateConstraint.
function getDisabledPropertiesForConstraint(
  constraintIndex: number,
  allConstraints: PropertyConstraint[],
  properties: PropertyMetadata[]
): Map<string, string> {
  // Only consider constraints BEFORE this index (not after)
  const priorPropertyIds = allConstraints
    .slice(0, constraintIndex)
    .filter((c) => c.propertyId)
    .map((c) => c.propertyId)

  const disabled = new Map<string, string>()

  for (const prop of properties) {
    // Check if this property requires another property to be selected first
    if (prop.requiresProperty && !priorPropertyIds.includes(prop.requiresProperty)) {
      const requiredProp = properties.find((p) => p.id === prop.requiresProperty)
      const requiredLabel = requiredProp?.label ?? prop.requiresProperty
      disabled.set(prop.id, `Requires ${requiredLabel}`)
      continue
    }

    const { compatible, reason } = isPropertyCompatible(prop.id, priorPropertyIds, properties)
    if (!compatible && reason) {
      disabled.set(prop.id, reason)
    }
  }

  return disabled
}

export function PropertyPromptForm({ onSubmit, onError, submitting, disabledReason }: Props) {
  const [guidance, setGuidance] = useState<number | ''>(2.0)

  // Config state (properties, groups, checkpoints, elements)
  const [config, setConfig] = useState<PropertiesConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  // Visual builder state
  const [constraints, setConstraints] = useState<PropertyConstraint[]>([])

  // JSON mode state
  const [showJsonMode, setShowJsonMode] = useState(false)
  const [rawJson, setRawJson] = useState('{}')
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Derived properties list
  const properties = config?.properties ?? []

  // Get setAppMode and setDemoMode from store
  const setAppMode = useAppStore((s) => s.setAppMode)
  const setDemoMode = useAppStore((s) => s.setDemoMode)

  // Fetch config from backend on mount
  useEffect(() => {
    fetchPropertiesConfig()
      .then((cfg) => {
        setConfig(cfg)
        setConfigLoading(false)
        // Set app mode and demo mode from backend config
        setAppMode(cfg.appMode)
        setDemoMode(cfg.demoMode)
        // Start with empty constraints - user adds properties as needed
      })
      .catch((err) => {
        setConfigError(err.message)
        setConfigLoading(false)
      })
  }, [setAppMode, setDemoMode])

  // Sync constraints to JSON when switching modes
  useEffect(() => {
    if (showJsonMode && properties.length > 0) {
      const obj = constraintsToPropertiesObject(constraints, properties)
      setRawJson(JSON.stringify(obj, null, 2))
      setJsonError(null)
    }
  }, [showJsonMode, constraints, properties])

  // Get set of property IDs already in use (for disabling in dropdown)
  const usedPropertyIds = useMemo(
    () => new Set(constraints.map((c) => c.propertyId).filter(Boolean)),
    [constraints]
  )

  // Get available properties (not yet used and compatible with current selection)
  // Used for the "Add constraint" button
  const availableProperties = useMemo(() => {
    const allPropertyIds = constraints.map((c) => c.propertyId).filter(Boolean)
    return properties.filter((p) => {
      if (usedPropertyIds.has(p.id)) return false
      // Check if this property requires another property to be selected first
      if (p.requiresProperty && !allPropertyIds.includes(p.requiresProperty)) {
        return false
      }
      const { compatible } = isPropertyCompatible(p.id, allPropertyIds, properties)
      return compatible
    })
  }, [properties, usedPropertyIds, constraints])

  const handleAddConstraint = () => {
    // Find first available property
    const unusedProp = availableProperties[0]
    if (!unusedProp) return

    setConstraints([
      ...constraints,
      {
        id: generateConstraintId(),
        propertyId: unusedProp.id,
        operator: '=', // Operator not used for numeric properties
        value: unusedProp.example || '',
      },
    ])
  }

  const handleUpdateConstraint = (index: number, updated: PropertyConstraint) => {
    const oldConstraint = constraints[index]
    const propertyChanged = oldConstraint.propertyId !== updated.propertyId

    // If the property didn't change, just update normally
    if (!propertyChanged) {
      const newConstraints = [...constraints]
      newConstraints[index] = updated
      setConstraints(newConstraints)
      return
    }

    // Property changed - check if other constraints are still compatible
    const newPropertyId = updated.propertyId

    // If the new property is empty (user selected "Select property..."),
    // just update this constraint without filtering others
    if (!newPropertyId) {
      const newConstraints = [...constraints]
      newConstraints[index] = updated
      setConstraints(newConstraints)
      return
    }

    const newProp = properties.find((p) => p.id === newPropertyId)
    const newCompatibleWith = newProp?.compatibleWith ?? []

    // Filter out constraints that are incompatible with the new property
    const filteredConstraints = constraints.filter((c, i) => {
      // Always keep the constraint being updated
      if (i === index) return true

      // Keep constraints without a property selected
      if (!c.propertyId) return true

      // Check if this constraint's property is compatible with the new property
      const otherProp = properties.find((p) => p.id === c.propertyId)
      const otherCompatibleWith = otherProp?.compatibleWith ?? []

      // Compatible if either lists the other
      return newCompatibleWith.includes(c.propertyId) || otherCompatibleWith.includes(newPropertyId)
    })

    // Update the constraint at the correct index in the filtered list
    // Need to find the new index since some constraints may have been removed
    const newIndex = filteredConstraints.findIndex((c) => c.id === oldConstraint.id)
    if (newIndex !== -1) {
      filteredConstraints[newIndex] = updated
    }

    setConstraints(filteredConstraints)
  }

  const handleRemoveConstraint = (index: number) => {
    setConstraints(constraints.filter((_, i) => i !== index))
  }

  const handleJsonChange = (value: string) => {
    setRawJson(value)
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        setJsonError(null)
      } else {
        setJsonError('Must be a JSON object')
      }
    } catch {
      setJsonError('Invalid JSON syntax')
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    let propertiesObj: Record<string, unknown> = {}

    if (showJsonMode) {
      // Use raw JSON in JSON mode
      try {
        const parsed = JSON.parse(rawJson)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          propertiesObj = parsed as Record<string, unknown>
        } else {
          if (onError) onError('Properties must be a JSON object')
          return
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid JSON'
        if (onError) onError(`Invalid JSON properties: ${message}`)
        return
      }
    } else {
      // Use visual builder constraints
      propertiesObj = constraintsToPropertiesObject(constraints, properties)
    }

    const request: GenerationRequest = {
      properties_to_condition_on: propertiesObj,
    }

    // Add guidance factor if properties are specified
    const hasProperties = Object.keys(propertiesObj).length > 0
    if (hasProperties && guidance !== '') {
      request.diffusion_guidance_factor = Number(guidance)
    }

    onSubmit(request)
  }

  // Sync JSON back to constraints when exiting JSON mode
  const handleToggleJsonMode = () => {
    if (showJsonMode) {
      // Switching from JSON to visual mode - parse JSON to constraints
      try {
        const parsed = JSON.parse(rawJson)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const newConstraints = propertiesObjectToConstraints(
            parsed as Record<string, unknown>,
            properties
          )
          setConstraints(newConstraints.length > 0 ? newConstraints : [])
        }
      } catch {
        // Keep existing constraints if JSON is invalid
      }
    }
    setShowJsonMode(!showJsonMode)
  }

  // Determine which checkpoint will be used based on current constraints
  const selectedCheckpoint = useMemo(() => {
    if (!config || constraints.length === 0) return config?.checkpoints?.mattergen_base
    const propIds = constraints.map((c) => c.propertyId).filter(Boolean)
    if (propIds.length === 0) return config.checkpoints.mattergen_base

    // Find checkpoint that supports all selected properties
    for (const [, checkpoint] of Object.entries(config.checkpoints)) {
      const checkpointProps = new Set(checkpoint.properties)
      if (propIds.every((id) => checkpointProps.has(id))) {
        return checkpoint
      }
    }
    return null
  }, [config, constraints])

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg bg-surface/70 p-6 shadow-xl shadow-bg/60"
      data-tour="property-form"
    >
      <h2 className="text-xl font-semibold tracking-tight font-display">Generate materials</h2>

      {/* Target properties section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-sm text-text">
            Target properties
            <Tooltip content={tooltipContent.targetProperties} />
          </span>
          {/* JSON mode toggle hidden for now */}
        </div>

        {configLoading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading properties...
          </div>
        ) : configError ? (
          <div className="rounded-md bg-red-900/20 p-2 text-sm text-red-400">
            Failed to load properties: {configError}
          </div>
        ) : showJsonMode ? (
          /* JSON mode */
          <div className="space-y-1">
            <textarea
              value={rawJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              rows={6}
              className={`w-full resize-y rounded-md border bg-surface px-3 py-2 font-mono text-xs text-text focus:outline-none focus:ring-1 ${
                jsonError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-border focus:border-accent focus:ring-accent'
              }`}
            />
            {jsonError && <p className="text-xs text-red-400">{jsonError}</p>}
            <p className="text-xs text-text-dim">
              Valid properties:{' '}
              {properties.map((p) => (
                <code
                  key={p.id}
                  className="mx-0.5 rounded bg-surface-raised px-1 py-0.5 text-[0.65rem]"
                >
                  {p.id}
                </code>
              ))}
            </p>
          </div>
        ) : (
          /* Visual builder mode */
          <div className="space-y-3 pb-2">
            {constraints.map((constraint, index) => {
              // Compute disabled properties for this specific constraint
              // Only constraints BEFORE this one affect what's disabled
              const disabledProperties = getDisabledPropertiesForConstraint(
                index,
                constraints,
                properties
              )
              return (
                <PropertySelector
                  key={constraint.id}
                  constraint={constraint}
                  properties={properties}
                  disabledProperties={disabledProperties}
                  supportedElements={config?.supportedElements}
                  onChange={(updated) => handleUpdateConstraint(index, updated)}
                  onRemove={() => handleRemoveConstraint(index)}
                />
              )
            })}

            {availableProperties.length > 0 && (
              <button
                type="button"
                onClick={handleAddConstraint}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-bright text-sm text-text-muted transition hover:border-accent hover:bg-accent/5 hover:text-accent"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                Add target property
              </button>
            )}

            {constraints.length === 0 && (
              <p className="py-2 text-center text-xs text-text-dim">
                No target properties added. Generation will be unconditional.
              </p>
            )}

            {/* Checkpoint indicator */}
            {selectedCheckpoint && (
              <div className="mt-2 rounded bg-surface-raised/50 px-3 py-2 text-xs text-text-muted">
                <span className="font-medium text-text-muted">Checkpoint: </span>
                <span className="text-accent">{selectedCheckpoint.name}</span>
                <span className="ml-2 text-text-dim">- {selectedCheckpoint.description}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Guidance factor - only show when constraints exist */}
      {constraints.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-1 text-text">
            Diffusion guidance factor
            <Tooltip content={tooltipContent.diffusionGuidanceFactor} />
          </span>
          <input
            type="number"
            step="0.1"
            min="1"
            value={guidance}
            onChange={(e) => {
              const value = e.target.value
              setGuidance(value === '' ? ('' as never) : Number(value))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault()
            }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <span className="text-xs text-text-dim">
            Higher values (1.5-3.0) produce structures closer to target values
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={submitting || !!disabledReason || configLoading || (showJsonMode && !!jsonError)}
        className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-md shadow-accent/30 transition-all hover:bg-accent-bright hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-text-muted disabled:translate-y-0 disabled:shadow-none"
        data-tour="generate-button"
      >
        {submitting ? 'Generating...' : disabledReason ? disabledReason : 'Generate candidates'}
      </button>
    </form>
  )
}
