import { useState } from 'react'
import type { PropertyMetadata, PropertyConstraint } from '../api/types'
import { ElementPickerSlideout } from './ElementPickerSlideout'
import { elementsToChemicalSystem, chemicalSystemToElements } from '../data/periodicTable'

interface Props {
  constraint: PropertyConstraint
  properties: PropertyMetadata[]
  /** Map of property ID -> reason why it's disabled */
  disabledProperties: Map<string, string>
  supportedElements?: string[]
  onChange: (updated: PropertyConstraint) => void
  onRemove: () => void
}

export function PropertySelector({
  constraint,
  properties,
  disabledProperties,
  supportedElements,
  onChange,
  onRemove,
}: Props) {
  const selectedProperty = properties.find((p) => p.id === constraint.propertyId)
  const isChemicalSystem = selectedProperty?.type === 'chemical_system'

  // State for element picker slideout
  const [showElementPicker, setShowElementPicker] = useState(false)

  const handlePropertyChange = (propertyId: string) => {
    const newProperty = properties.find((p) => p.id === propertyId)
    const newIsChemicalSystem = newProperty?.type === 'chemical_system'
    onChange({
      ...constraint,
      propertyId,
      operator: '=', // Operator not used for numeric properties
      value: newIsChemicalSystem ? '' : (newProperty?.example || ''),
    })
  }

  const handleElementsChange = (elements: string[]) => {
    const chemicalSystem = elementsToChemicalSystem(elements)
    onChange({ ...constraint, value: chemicalSystem })
  }

  const handleRemoveElement = (elementToRemove: string) => {
    const currentElements = chemicalSystemToElements(constraint.value)
    const newElements = currentElements.filter((e) => e !== elementToRemove)
    const chemicalSystem = elementsToChemicalSystem(newElements)
    onChange({ ...constraint, value: chemicalSystem })
  }

  // Get current selected elements from value
  const selectedElements = isChemicalSystem ? chemicalSystemToElements(constraint.value) : []

  return (
    <div className="space-y-2 overflow-hidden">
      <div className="group relative flex min-w-0 items-center gap-1.5">
        {/* Property dropdown */}
        <select
          value={constraint.propertyId}
          onChange={(e) => handlePropertyChange(e.target.value)}
          className="h-9 min-w-0 flex-1 appearance-none truncate rounded-l-md border-y border-l border-border-bright bg-surface-raised pl-3 pr-8 text-sm text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.5rem center',
            backgroundSize: '1.25rem',
          }}
        >
          <option value="">Select property...</option>
          {properties
            .filter((prop) => {
              // Always show the currently selected property
              if (prop.id === constraint.propertyId) return true
              // Exclude properties that are disabled (incompatible, already selected, etc.)
              return !disabledProperties.has(prop.id)
            })
            .map((prop) => (
              <option key={prop.id} value={prop.id}>
                {prop.label}
                {prop.group && ` (${prop.group})`}
              </option>
            ))}
        </select>

        {isChemicalSystem ? (
          /* Chemical system: button to open element picker */
          <button
            type="button"
            onClick={() => setShowElementPicker(true)}
            className="flex h-9 flex-shrink-0 items-center gap-1 rounded-r-md border border-border-bright bg-surface-raised px-3 text-sm text-accent transition hover:bg-border"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            <span>Select</span>
          </button>
        ) : (
          /* Numeric/integer: just value input (no operator dropdown) */
          <div className="relative flex h-9 flex-shrink-0 items-center">
            <input
              type="text"
              inputMode={selectedProperty?.type === 'integer' ? 'numeric' : 'decimal'}
              value={constraint.value}
              onChange={(e) => onChange({ ...constraint, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault()
              }}
              placeholder={selectedProperty?.example ?? '0'}
              className="h-full w-28 rounded-r-md border-y border-r border-border-bright bg-surface-raised px-2 text-sm text-text outline-none transition placeholder:text-text-dim focus:border-accent focus:ring-1 focus:ring-accent disabled:text-text-dim"
              disabled={!constraint.propertyId}
            />
            {selectedProperty?.unit && (
              <span className="pointer-events-none absolute right-2 text-xs text-text-dim">
                {selectedProperty.unit}
              </span>
            )}
          </div>
        )}

        {/* Remove button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
          className="ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-text-dim transition hover:bg-red-500/20 hover:text-red-400 active:scale-95"
          title="Remove constraint"
          aria-label="Remove constraint"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Property description - shown when a property is selected */}
      {selectedProperty && !isChemicalSystem && (
        <div className="rounded bg-surface-raised/50 px-2.5 py-2 text-xs text-text-muted">
          <p>{selectedProperty.description}</p>
          {selectedProperty.min !== null && selectedProperty.max !== null && (
            <p className="mt-1 text-text-dim">
              Typical range: {selectedProperty.min}–{selectedProperty.max}
              {selectedProperty.unit ? ` ${selectedProperty.unit}` : ''}
            </p>
          )}
        </div>
      )}

      {/* Element chips for chemical_system */}
      {isChemicalSystem && selectedElements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {selectedElements.map((element) => (
            <span
              key={element}
              className="group/chip inline-flex items-center gap-1 rounded bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent"
            >
              {element}
              <button
                type="button"
                onClick={() => handleRemoveElement(element)}
                className="rounded text-accent/60 transition hover:text-red-400"
                aria-label={`Remove ${element}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Hint when no elements selected */}
      {isChemicalSystem && selectedElements.length === 0 && (
        <p className="pl-1 text-xs text-text-dim">
          Click "Select" to choose elements from the periodic table
        </p>
      )}

      {/* Element picker slideout */}
      <ElementPickerSlideout
        open={showElementPicker}
        selectedElements={selectedElements}
        supportedElements={supportedElements}
        onChange={handleElementsChange}
        onClose={() => setShowElementPicker(false)}
      />
    </div>
  )
}
