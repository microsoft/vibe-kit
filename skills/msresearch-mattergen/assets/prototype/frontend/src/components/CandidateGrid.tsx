import { useNavigate } from 'react-router-dom'
import type { Structure } from '../api/types'
import { CandidateCard } from './CandidateCard'

interface CandidateGridProps {
  structures: Structure[]
  selectedIds?: Set<string>
  showCheckboxes?: boolean
  showEvaluationStatus?: boolean
  latestBatchId?: string | null
  onSelect?: (id: string) => void
  baseRoute: '/generate' | '/mattersim'
}

export function CandidateGrid({
  structures,
  selectedIds = new Set(),
  showCheckboxes = false,
  showEvaluationStatus = false,
  latestBatchId,
  onSelect,
  baseRoute,
}: CandidateGridProps) {
  const navigate = useNavigate()

  const handleCardClick = (id: string) => {
    navigate(`${baseRoute}/structure/${id}`)
  }

  if (structures.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-dim">
        <div className="text-center">
          <p className="text-sm">No structures yet</p>
          <p className="mt-1 text-xs text-text-dim">
            {baseRoute === '/generate'
              ? 'Configure parameters and click Generate'
              : 'Upload files or send structures from MatterGen'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {structures.map((structure, index) => (
          <CandidateCard
            key={structure.id}
            structure={structure}
            displayNumber={index + 1}
            selected={selectedIds.has(structure.id)}
            showCheckbox={showCheckboxes}
            showEvaluationStatus={showEvaluationStatus}
            isNew={latestBatchId ? structure.generationBatchId === latestBatchId : false}
            onSelect={onSelect}
            onClick={handleCardClick}
            animationIndex={index}
          />
        ))}
      </div>
    </div>
  )
}
