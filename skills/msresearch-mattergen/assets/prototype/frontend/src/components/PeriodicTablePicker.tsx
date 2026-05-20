import { useMemo } from 'react'
import {
  PERIODIC_TABLE,
  SUPPORTED_ELEMENTS,
  getCategoryColor,
  elementsToChemicalSystem,
  type Element,
} from '../data/periodicTable'

interface Props {
  selectedElements: string[]
  onChange: (elements: string[]) => void
  supportedElements?: string[]
}

export function PeriodicTablePicker({
  selectedElements,
  onChange,
  supportedElements,
}: Props) {
  // Use provided supported elements or fall back to default
  const supportedSet = useMemo(
    () => new Set(supportedElements ?? SUPPORTED_ELEMENTS),
    [supportedElements]
  )

  const selectedSet = useMemo(() => new Set(selectedElements), [selectedElements])

  const handleElementClick = (element: Element) => {
    if (!supportedSet.has(element.symbol)) return

    if (selectedSet.has(element.symbol)) {
      onChange(selectedElements.filter((e) => e !== element.symbol))
    } else {
      onChange([...selectedElements, element.symbol])
    }
  }

  const handleClearAll = () => {
    onChange([])
  }

  // Group elements by row for rendering
  const elementsByRow = useMemo(() => {
    const rows: Map<number, Element[]> = new Map()
    for (const element of PERIODIC_TABLE) {
      if (!rows.has(element.row)) {
        rows.set(element.row, [])
      }
      rows.get(element.row)!.push(element)
    }
    return rows
  }, [])

  // Chemical system string for display
  const chemicalSystem = elementsToChemicalSystem(selectedElements)

  return (
    <div className="space-y-3">
      {/* Header with selection info */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-text-muted">
          {selectedElements.length === 0 ? (
            <span className="text-text-dim">Click elements to select</span>
          ) : (
            <>
              <span className="font-medium text-accent">{chemicalSystem}</span>
              <span className="ml-2 text-text-dim">
                ({selectedElements.length} element{selectedElements.length !== 1 ? 's' : ''})
              </span>
            </>
          )}
        </div>
        {selectedElements.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-text-muted hover:text-red-400"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Periodic table grid */}
      <div className="overflow-x-auto rounded-lg bg-surface/50 p-3">
        <div className="inline-block min-w-max">
          {/* Main table rows 1-7 */}
          {[1, 2, 3, 4, 5, 6, 7].map((rowNum) => (
            <div key={rowNum} className="flex gap-0.5">
              {Array.from({ length: 18 }, (_, colIndex) => {
                const col = colIndex + 1
                const element = elementsByRow.get(rowNum)?.find((e) => e.col === col)

                // Special case: row 6 col 3 shows "La-Lu" indicator
                if (rowNum === 6 && col === 3) {
                  return (
                    <div
                      key={`${rowNum}-${col}`}
                      className="flex h-9 w-9 items-center justify-center text-[0.5rem] text-text-dim"
                    >
                      57-71
                    </div>
                  )
                }

                // Special case: row 7 col 3 shows "Ac-" indicator
                if (rowNum === 7 && col === 3) {
                  return (
                    <div
                      key={`${rowNum}-${col}`}
                      className="flex h-9 w-9 items-center justify-center text-[0.5rem] text-text-dim"
                    >
                      89-
                    </div>
                  )
                }

                if (!element) {
                  return <div key={`${rowNum}-${col}`} className="h-9 w-9" />
                }

                const isSupported = supportedSet.has(element.symbol)
                const isSelected = selectedSet.has(element.symbol)

                return (
                  <button
                    key={element.symbol}
                    type="button"
                    onClick={() => handleElementClick(element)}
                    disabled={!isSupported}
                    className={`relative flex h-9 w-9 flex-col items-center justify-center rounded text-xs font-medium transition-all ${getCategoryColor(
                      element.category,
                      isSelected,
                      isSupported
                    )} ${isSelected ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-surface' : ''} ${
                      isSupported ? 'cursor-pointer active:scale-95' : ''
                    }`}
                    title={`${element.name} (${element.atomicNumber})${!isSupported ? ' - Not supported' : ''}`}
                  >
                    <span className="text-[0.5rem] opacity-60">{element.atomicNumber}</span>
                    <span className="leading-none">{element.symbol}</span>
                  </button>
                )
              })}
            </div>
          ))}

          {/* Gap before lanthanides/actinides */}
          <div className="h-2" />

          {/* Lanthanides (row 8) */}
          <div className="flex gap-0.5">
            <div className="flex h-9 w-9 items-center justify-center text-[0.5rem] text-fuchsia-400">
              La-Lu
            </div>
            <div className="h-9 w-9" />
            {Array.from({ length: 15 }, (_, i) => {
              const col = i + 3
              const element = elementsByRow.get(8)?.find((e) => e.col === col)
              if (!element) return <div key={`8-${col}`} className="h-9 w-9" />

              const isSupported = supportedSet.has(element.symbol)
              const isSelected = selectedSet.has(element.symbol)

              return (
                <button
                  key={element.symbol}
                  type="button"
                  onClick={() => handleElementClick(element)}
                  disabled={!isSupported}
                  className={`relative flex h-9 w-9 flex-col items-center justify-center rounded text-xs font-medium transition-all ${getCategoryColor(
                    element.category,
                    isSelected,
                    isSupported
                  )} ${isSelected ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-surface' : ''} ${
                    isSupported ? 'cursor-pointer active:scale-95' : ''
                  }`}
                  title={`${element.name} (${element.atomicNumber})${!isSupported ? ' - Not supported' : ''}`}
                >
                  <span className="text-[0.5rem] opacity-60">{element.atomicNumber}</span>
                  <span className="leading-none">{element.symbol}</span>
                </button>
              )
            })}
          </div>

          {/* Actinides (row 9) */}
          <div className="flex gap-0.5">
            <div className="flex h-9 w-9 items-center justify-center text-[0.5rem] text-rose-400">
              Ac-
            </div>
            <div className="h-9 w-9" />
            {Array.from({ length: 6 }, (_, i) => {
              const col = i + 3
              const element = elementsByRow.get(9)?.find((e) => e.col === col)
              if (!element) return <div key={`9-${col}`} className="h-9 w-9" />

              const isSupported = supportedSet.has(element.symbol)
              const isSelected = selectedSet.has(element.symbol)

              return (
                <button
                  key={element.symbol}
                  type="button"
                  onClick={() => handleElementClick(element)}
                  disabled={!isSupported}
                  className={`relative flex h-9 w-9 flex-col items-center justify-center rounded text-xs font-medium transition-all ${getCategoryColor(
                    element.category,
                    isSelected,
                    isSupported
                  )} ${isSelected ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-surface' : ''} ${
                    isSupported ? 'cursor-pointer active:scale-95' : ''
                  }`}
                  title={`${element.name} (${element.atomicNumber})${!isSupported ? ' - Not supported' : ''}`}
                >
                  <span className="text-[0.5rem] opacity-60">{element.atomicNumber}</span>
                  <span className="leading-none">{element.symbol}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-border-bright" /> Unsupported
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-accent" /> Selected
        </span>
      </div>
    </div>
  )
}
