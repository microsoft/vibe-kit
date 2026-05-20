import { useEffect } from 'react'
import { PeriodicTablePicker } from './PeriodicTablePicker'
import { elementsToChemicalSystem } from '../data/periodicTable'

interface Props {
  open: boolean
  selectedElements: string[]
  supportedElements?: string[]
  onChange: (elements: string[]) => void
  onClose: () => void
}

export function ElementPickerSlideout({
  open,
  selectedElements,
  supportedElements,
  onChange,
  onClose,
}: Props) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const chemicalSystem = elementsToChemicalSystem(selectedElements)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Slideout panel - needs ~750px for full periodic table (18 cols × 36px + gaps) */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[780px] flex-col bg-surface shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-text">Select Elements</h2>
            <p className="text-sm text-text-muted">
              Click elements to add them to your chemical system
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted transition hover:bg-surface-raised hover:text-text"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-6 w-6"
            >
              <path
                fillRule="evenodd"
                d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <PeriodicTablePicker
            selectedElements={selectedElements}
            onChange={onChange}
            supportedElements={supportedElements}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {selectedElements.length === 0 ? (
                <span className="text-text-dim">No elements selected</span>
              ) : (
                <>
                  <span className="text-text-muted">Chemical system: </span>
                  <span className="font-medium text-accent">{chemicalSystem}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-accent px-6 py-2 text-sm font-medium text-bg transition hover:bg-accent-bright"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
