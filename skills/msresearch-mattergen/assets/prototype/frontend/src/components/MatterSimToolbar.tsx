interface MatterSimToolbarProps {
  structureCount: number
  selectedCount: number
  isRunning: boolean
  disabledReason?: string
  onRun: () => void
  onClearAll: () => void
  onClearSelected: () => void
  onSelectAll: () => void
  onClearSelection: () => void
}

export function MatterSimToolbar({
  structureCount,
  selectedCount,
  isRunning,
  disabledReason,
  onRun,
  onClearAll,
  onClearSelected,
  onSelectAll,
  onClearSelection,
}: MatterSimToolbarProps) {
  const hasStructures = structureCount > 0
  const hasSelection = selectedCount > 0
  const allSelected = selectedCount === structureCount && structureCount > 0
  const runDisabled = !hasSelection || isRunning || !!disabledReason

  return (
    <div className="flex items-center justify-between border-b border-border bg-surface/50 px-4 py-2">
      <div className="flex items-center gap-4">
        {/* Selection controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={allSelected ? onClearSelection : onSelectAll}
            disabled={!hasStructures}
            className={`
              rounded px-2 py-1 text-xs font-medium transition-colors
              ${
                !hasStructures
                  ? 'cursor-not-allowed text-text-dim'
                  : 'text-text-muted hover:bg-surface-raised hover:text-text'
              }
            `}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {selectedCount > 0 && (
          <span className="text-sm text-text-dim">
            ({selectedCount} of {structureCount})
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Clear Selected button */}
        <button
          onClick={onClearSelected}
          disabled={!hasSelection || isRunning || !!disabledReason}
          className={`
            rounded-md px-3 py-1.5 text-sm font-medium transition-colors
            ${
              !hasSelection || isRunning || !!disabledReason
                ? 'cursor-not-allowed bg-surface-raised text-text-dim'
                : 'bg-red-900/50 text-red-400 hover:bg-red-900 hover:text-red-300'
            }
          `}
        >
          Clear Selected
        </button>

        {/* Clear All button */}
        <button
          onClick={onClearAll}
          disabled={!hasStructures || isRunning || !!disabledReason}
          className={`
            rounded-md px-3 py-1.5 text-sm font-medium transition-colors
            ${
              !hasStructures || isRunning || !!disabledReason
                ? 'cursor-not-allowed bg-surface-raised text-text-dim'
                : 'bg-surface-raised text-text-muted hover:bg-border-bright'
            }
          `}
        >
          Clear All
        </button>

        {/* Run MatterSim button */}
        <button
          onClick={onRun}
          disabled={runDisabled}
          data-tour="run-mattersim"
          className={`
            rounded-md px-4 py-1.5 text-sm font-medium transition-all
            ${
              runDisabled
                ? 'cursor-not-allowed bg-surface-raised text-text-dim'
                : 'bg-green-600 text-white hover:bg-green-500 hover:-translate-y-px active:translate-y-0'
            }
          `}
        >
          {isRunning ? 'Running...' : disabledReason ? disabledReason : 'Run MatterSim'}
        </button>
      </div>
    </div>
  )
}
