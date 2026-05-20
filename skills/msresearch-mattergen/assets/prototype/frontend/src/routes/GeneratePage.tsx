import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { createGenerationJob, fetchDemoData } from '../api/client'
import type { GenerationRequest } from '../api/types'
import { ApiError } from '../api/types'
import { PropertyPromptForm } from '../components/PropertyPromptForm'
import { CandidateGrid } from '../components/CandidateGrid'
import { SelectionToolbar } from '../components/SelectionToolbar'
import { ConfirmModal } from '../components/ConfirmModal'
import { ErrorDisplay } from '../components/ErrorDisplay'
import { useAppStore } from '../stores/appStore'
import { downloadMultipleCifsAsZip } from '../utils/download'
import type { ApiErrorCode } from '../api/types'

interface ErrorState {
  message: string
  errorCode?: ApiErrorCode
}

export function GeneratePage() {
  const navigate = useNavigate()
  const [error, setError] = useState<ErrorState | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showClearAllModal, setShowClearAllModal] = useState(false)
  const [showClearSelectedModal, setShowClearSelectedModal] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<GenerationRequest | null>(
    null
  )

  const {
    mattergenStructures,
    mattergenSelection,
    latestMattergenBatchId,
    setMattergenResults,
    clearMattergenResults,
    removeFromMattergen,
    toggleMattergenSelection,
    selectAllMattergen,
    clearMattergenSelection,
    addToMattersim,
    demoMode,
    isGenerating,
    setIsGenerating,
    evaluationStatus,
  } = useAppStore()

  const mutation = useMutation({
    mutationFn: async (request: GenerationRequest) => {
      setIsGenerating(true)
      try {
        // Try real API first
        return await createGenerationJob(request)
      } catch (err) {
        // If demo mode is enabled, fall back to demo data
        if (demoMode) {
          console.warn('Real API failed, falling back to demo data:', err)
          toast('Using demo data', { icon: 'ℹ️', duration: 3000 })
          return await fetchDemoData(request)
        }
        // Re-throw if demo mode is disabled
        throw err
      } finally {
        setIsGenerating(false)
      }
    },
    onSuccess: (data) => {
      setMattergenResults(data.job.id, data.structures)
      toast.success(`Generated ${data.structures.length} structures`)
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setError({ message: err.message, errorCode: err.errorCode })
      } else {
        setError({
          message: err instanceof Error ? err.message : 'Something went wrong while generating structures. Please try again.',
          errorCode: 'unexpected_error',
        })
      }
    },
  })

  const handleSubmit = (request: GenerationRequest) => {
    setPendingRequest(request)
    setShowConfirmModal(true)
  }

  const handleConfirmGenerate = () => {
    if (pendingRequest) {
      setError(null)
      mutation.mutate(pendingRequest)
      setPendingRequest(null)
    }
    setShowConfirmModal(false)
  }

  const handleSendToMatterSim = () => {
    const selectedStructures = mattergenStructures.filter((s) =>
      mattergenSelection.has(s.id)
    )

    if (selectedStructures.length === 0) {
      toast.error('No structures selected')
      return
    }

    addToMattersim(selectedStructures)
    clearMattergenSelection()
    toast.success(`Sent ${selectedStructures.length} structures to MatterSim`)
    navigate('/mattersim')
  }

  const handleDownloadCifs = async () => {
    const selectedStructures = mattergenStructures.filter(
      (s) => mattergenSelection.has(s.id) && s.cifContent
    )

    if (selectedStructures.length === 0) {
      toast.error('No structures with CIF data selected')
      return
    }

    try {
      await downloadMultipleCifsAsZip(
        selectedStructures.map((s) => ({
          formula: s.formula,
          cifContent: s.cifContent!,
          index: s.index,
        }))
      )
      toast.success(`Downloaded ${selectedStructures.length} structures as zip`)
    } catch (err) {
      toast.error('Failed to create zip file')
    }
  }

  const handleClearAll = () => {
    setShowClearAllModal(true)
  }

  const handleConfirmClearAll = () => {
    clearMattergenResults()
    setShowClearAllModal(false)
    toast.success('Cleared all structures')
  }

  const handleClearSelected = () => {
    setShowClearSelectedModal(true)
  }

  const handleConfirmClearSelected = () => {
    const count = mattergenSelection.size
    removeFromMattergen([...mattergenSelection])
    setShowClearSelectedModal(false)
    toast.success(`Removed ${count} structures`)
  }

  const allSelected =
    mattergenStructures.length > 0 &&
    mattergenSelection.size === mattergenStructures.length

  return (
    <div className="flex flex-1 flex-row overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full max-w-md min-h-0 overflow-y-auto border-r border-border bg-bg/90 px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4">
            <ErrorDisplay
              message={error.message}
              errorCode={error.errorCode}
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        <PropertyPromptForm
          onSubmit={handleSubmit}
          onError={(message) => setError({ message, errorCode: 'unexpected_error' })}
          submitting={mutation.isPending || isGenerating}
          disabledReason={
            evaluationStatus === 'running'
              ? 'Simulation in progress...'
              : undefined
          }
        />
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col min-h-0">
        {/* Toolbar (only show when there are structures) */}
        {mattergenStructures.length > 0 && (
          <SelectionToolbar
            totalCount={mattergenStructures.length}
            selectedCount={mattergenSelection.size}
            allSelected={allSelected}
            onSelectAll={selectAllMattergen}
            onClearSelection={clearMattergenSelection}
            actionLabel="Send to MatterSim"
            actionDisabled={mattergenSelection.size === 0}
            onAction={handleSendToMatterSim}
            secondaryActionLabel="Download CIF"
            secondaryActionDisabled={mattergenSelection.size === 0}
            onSecondaryAction={handleDownloadCifs}
            onClearSelected={handleClearSelected}
            onClearAll={handleClearAll}
          />
        )}

        {/* Grid */}
        <CandidateGrid
          structures={mattergenStructures}
          selectedIds={mattergenSelection}
          showCheckboxes={true}
          latestBatchId={latestMattergenBatchId}
          onSelect={toggleMattergenSelection}
          baseRoute="/generate"
        />
      </main>

      {/* Confirmation modal for generation */}
      <ConfirmModal
        open={showConfirmModal}
        title="Start generation?"
        message="This may take some time. Continue?"
        confirmLabel="Generate"
        onConfirm={handleConfirmGenerate}
        onCancel={() => {
          setShowConfirmModal(false)
          setPendingRequest(null)
        }}
      />

      {/* Confirmation modal for clear all */}
      <ConfirmModal
        open={showClearAllModal}
        title="Clear all structures?"
        message="This will remove all generated structures. This cannot be undone."
        confirmLabel="Clear All"
        onConfirm={handleConfirmClearAll}
        onCancel={() => setShowClearAllModal(false)}
      />

      {/* Confirmation modal for clear selected */}
      <ConfirmModal
        open={showClearSelectedModal}
        title="Clear selected structures?"
        message={`This will remove ${mattergenSelection.size} selected structure${mattergenSelection.size !== 1 ? 's' : ''} from MatterGen. This cannot be undone.`}
        confirmLabel="Clear Selected"
        onConfirm={handleConfirmClearSelected}
        onCancel={() => setShowClearSelectedModal(false)}
      />
    </div>
  )
}
