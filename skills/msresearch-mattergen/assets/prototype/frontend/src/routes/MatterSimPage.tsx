import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAppStore } from '../stores/appStore'
import { CandidateGrid } from '../components/CandidateGrid'
import { MatterSimToolbar } from '../components/MatterSimToolbar'
import { FileUpload } from '../components/FileUpload'
import { ConfirmModal } from '../components/ConfirmModal'
import { evaluateStructures } from '../api/client'
import type { Structure, StructureMetrics } from '../api/types'

export function MatterSimPage() {
  const [showClearAllModal, setShowClearAllModal] = useState(false)
  const [showClearSelectedModal, setShowClearSelectedModal] = useState(false)
  const [showReEvalModal, setShowReEvalModal] = useState(false)
  const [reEvalCount, setReEvalCount] = useState(0)
  const [pendingRunStructures, setPendingRunStructures] = useState<Structure[]>([])

  const {
    mattersimStructures,
    mattersimSelection,
    evaluationStatus,
    isGenerating,
    addUploadedToMattersim,
    setEvaluationStatus,
    updateMetrics,
    clearMattersim,
    removeFromMattersim,
    toggleMattersimSelection,
    selectAllMattersim,
    clearMattersimSelection,
  } = useAppStore()

  const evaluatedCount = mattersimStructures.filter((s) => s.metrics).length
  const selectedCount = mattersimSelection.size

  const handleFilesUploaded = (structures: Structure[]) => {
    addUploadedToMattersim(structures)
    toast.success(`Uploaded ${structures.length} structures`)
  }

  const runEvaluation = async (structures: Structure[]) => {
    setEvaluationStatus('running')

    try {
      const results = await evaluateStructures({
        structures: structures.map((s) => ({
          id: s.id,
          cif: s.cifContent!,
        })),
        relax: true,
      })

      // Map evaluation metrics to the StructureMetrics format used by UI
      const metricsMap: Record<string, StructureMetrics> = {}
      for (const result of results) {
        const m = result.metrics
        console.log('API result for', result.structureId, ':', {
          energyAboveHull: m.energyAboveHull,
          energyPerAtom: m.energyPerAtom,
          isStable: m.isStable,
        })
        metricsMap[result.structureId] = {
          energyAboveHull: m.energyAboveHull,
          energyPerAtom: m.energyPerAtom,
          isStable: m.isStable ?? false,
          isNovel: m.isNovel ?? false,
          isUnique: m.isUnique ?? false,
        }
      }
      console.log('metricsMap being sent to store:', metricsMap)

      updateMetrics(metricsMap)
      setEvaluationStatus('complete')
      toast.success(`Evaluated ${results.length} structures`)
    } catch (err) {
      setEvaluationStatus('idle')
      toast.error('Evaluation failed')
      console.error(err)
    }
  }

  const handleRunMatterSim = () => {
    const selected = mattersimStructures.filter((s) => mattersimSelection.has(s.id))

    // Filter to structures that have CIF content
    const selectedWithCif = selected.filter((s) => s.cifContent)
    if (selectedWithCif.length === 0) {
      toast.error('No selected structures with CIF content to evaluate')
      return
    }

    const alreadyEvaluated = selectedWithCif.filter((s) => s.metrics)

    if (alreadyEvaluated.length > 0) {
      // Some structures already have results -- ask user whether to overwrite
      setPendingRunStructures(selectedWithCif)
      setReEvalCount(alreadyEvaluated.length)
      setShowReEvalModal(true)
      return
    }

    // No conflicts -- run immediately
    if (selectedWithCif.length < selected.length) {
      toast(
        `${selected.length - selectedWithCif.length} selected structures skipped (no CIF content)`,
        { icon: '⚠️' }
      )
    }
    runEvaluation(selectedWithCif)
  }

  const handleConfirmReEval = () => {
    const structures = pendingRunStructures
    setShowReEvalModal(false)
    setPendingRunStructures([])
    setReEvalCount(0)
    runEvaluation(structures)
  }

  const handleCancelReEval = () => {
    setShowReEvalModal(false)
    setPendingRunStructures([])
    setReEvalCount(0)
  }

  const handleClearAll = () => {
    setShowClearAllModal(true)
  }

  const handleConfirmClearAll = () => {
    clearMattersim()
    setShowClearAllModal(false)
    toast.success('Cleared all structures')
  }

  const handleClearSelected = () => {
    setShowClearSelectedModal(true)
  }

  const handleConfirmClearSelected = () => {
    const count = mattersimSelection.size
    removeFromMattersim([...mattersimSelection])
    setShowClearSelectedModal(false)
    toast.success(`Removed ${count} structures`)
  }

  return (
    <div className="flex flex-1 flex-row overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full max-w-md min-h-0 overflow-y-auto border-r border-border bg-bg/90 px-4 py-6 sm:px-6">
        <div className="space-y-4 rounded-lg bg-surface/70 p-6 shadow-xl shadow-bg/60">
          <h2 className="text-xl font-semibold tracking-tight font-display">Evaluate structures</h2>
          {/* Upload zone */}
          <FileUpload onFilesUploaded={handleFilesUploaded} />
        </div>

        {/* Status */}
        <div className="mt-6 rounded-lg bg-surface/50 p-4">
          <h2 className="mb-2 text-sm font-medium text-text-muted">Status</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-dim">Total structures</dt>
              <dd className="text-text-muted">{mattersimStructures.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-dim">Evaluated</dt>
              <dd className="text-text-muted">{evaluatedCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-dim">Pending</dt>
              <dd className="text-text-muted">
                {mattersimStructures.length - evaluatedCount}
              </dd>
            </div>
            {selectedCount > 0 && (
              <div className="flex justify-between">
                <dt className="text-accent">Selected</dt>
                <dd className="text-accent">{selectedCount}</dd>
              </div>
            )}
          </dl>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col min-h-0">
        {/* Toolbar */}
        <MatterSimToolbar
          structureCount={mattersimStructures.length}
          selectedCount={selectedCount}
          isRunning={evaluationStatus === 'running'}
          disabledReason={
            isGenerating ? 'Generation in progress...' : undefined
          }
          onRun={handleRunMatterSim}
          onClearAll={handleClearAll}
          onClearSelected={handleClearSelected}
          onSelectAll={selectAllMattersim}
          onClearSelection={clearMattersimSelection}
        />

        {/* Grid */}
        <CandidateGrid
          structures={mattersimStructures}
          selectedIds={mattersimSelection}
          showCheckboxes={true}
          showEvaluationStatus={true}
          onSelect={toggleMattersimSelection}
          baseRoute="/mattersim"
        />
      </main>

      {/* Confirmation modal for clear all */}
      <ConfirmModal
        open={showClearAllModal}
        title="Clear all structures?"
        message="This will remove all structures from MatterSim. This cannot be undone."
        confirmLabel="Clear All"
        onConfirm={handleConfirmClearAll}
        onCancel={() => setShowClearAllModal(false)}
      />

      {/* Confirmation modal for clear selected */}
      <ConfirmModal
        open={showClearSelectedModal}
        title="Clear selected structures?"
        message={`This will remove ${mattersimSelection.size} selected structure${mattersimSelection.size !== 1 ? 's' : ''} from MatterSim. This cannot be undone.`}
        confirmLabel="Clear Selected"
        onConfirm={handleConfirmClearSelected}
        onCancel={() => setShowClearSelectedModal(false)}
      />

      {/* Confirmation modal for re-evaluating already-evaluated structures */}
      <ConfirmModal
        open={showReEvalModal}
        title="Re-evaluate structures?"
        message={`${reEvalCount} of ${pendingRunStructures.length} selected structure${pendingRunStructures.length !== 1 ? 's have' : ' has'} already been evaluated by MatterSim. Would you like to overwrite ${reEvalCount !== 1 ? 'these evaluations' : 'this evaluation'}?`}
        confirmLabel="Overwrite & Run"
        onConfirm={handleConfirmReEval}
        onCancel={handleCancelReEval}
      />
    </div>
  )
}
