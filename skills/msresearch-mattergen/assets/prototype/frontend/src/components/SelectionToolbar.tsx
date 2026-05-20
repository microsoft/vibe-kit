interface SelectionToolbarProps {
  totalCount: number
  selectedCount: number
  allSelected: boolean
  onSelectAll: () => void
  onClearSelection: () => void
  actionLabel: string
  actionDisabled?: boolean
  onAction: () => void
  secondaryActionLabel?: string
  secondaryActionDisabled?: boolean
  onSecondaryAction?: () => void
  onClearSelected?: () => void
  onClearAll?: () => void
}

export function SelectionToolbar({
  totalCount,
  selectedCount,
  allSelected,
  onSelectAll,
  onClearSelection,
  actionLabel,
  actionDisabled = false,
  onAction,
  secondaryActionLabel,
  secondaryActionDisabled = false,
  onSecondaryAction,
  onClearSelected,
  onClearAll,
}: SelectionToolbarProps) {
  const handleSelectAllChange = () => {
    if (allSelected) {
      onClearSelection()
    } else {
      onSelectAll()
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-border bg-surface/50 px-4 py-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAllChange}
            disabled={totalCount === 0}
            className={`
              rounded px-2 py-1 text-xs font-medium transition-colors
              ${
                totalCount === 0
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
            ({selectedCount} of {totalCount})
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onClearSelected && (
          <button
            onClick={onClearSelected}
            disabled={selectedCount === 0}
            className={`
              rounded-md px-3 py-1.5 text-sm font-medium transition-colors
              ${
                selectedCount === 0
                  ? 'cursor-not-allowed bg-surface-raised text-text-dim'
                  : 'bg-red-900/50 text-red-400 hover:bg-red-900 hover:text-red-300'
              }
            `}
          >
            Clear Selected
          </button>
        )}
        {onClearAll && (
          <button
            onClick={onClearAll}
            className="rounded-md bg-surface-raised px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-border-bright"
          >
            Clear All
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            disabled={secondaryActionDisabled}
            className={`
              rounded-md border px-4 py-1.5 text-sm font-medium transition-colors
              ${
                secondaryActionDisabled
                  ? 'cursor-not-allowed border-border bg-surface-raised text-text-dim'
                  : 'border-border-bright bg-surface-raised text-text hover:bg-border'
              }
            `}
          >
            {secondaryActionLabel}
          </button>
        )}
        <button
          onClick={onAction}
          disabled={actionDisabled}
          className={`
            rounded-md px-4 py-1.5 text-sm font-medium transition-all
            ${
              actionDisabled
                ? 'cursor-not-allowed bg-surface-raised text-text-dim'
                : 'bg-accent text-bg hover:bg-accent-bright hover:-translate-y-px active:translate-y-0'
            }
          `}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
