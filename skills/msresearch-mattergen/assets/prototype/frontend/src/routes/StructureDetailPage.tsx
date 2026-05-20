import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAppStore } from '../stores/appStore'
import { CrystalViewer3D } from '../components/CrystalViewer3D'
import { Tooltip } from '../components/Tooltip'
import { tooltipContent } from '../data/tooltipContent'
import { downloadCif } from '../utils/download'

interface StructureDetailPageProps {
  context: 'mattergen' | 'mattersim'
}

export function StructureDetailPage({ context }: StructureDetailPageProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const structure = useAppStore((s) => s.getStructureById(id || '', context))
  const addToMattersim = useAppStore((s) => s.addToMattersim)
  
  // Get the position-based display number
  const displayNumber = useAppStore((s) => {
    const structures = context === 'mattergen' ? s.mattergenStructures : s.mattersimStructures
    const index = structures.findIndex((str) => str.id === id)
    return index >= 0 ? index + 1 : 0
  })

  const handleBack = () => {
    navigate(context === 'mattergen' ? '/generate' : '/mattersim')
  }

  const handleSendToMatterSim = () => {
    if (structure) {
      addToMattersim([structure])
      toast.success('Sent to MatterSim')
    }
  }

  const handleDownloadCif = () => {
    if (structure?.cifContent) {
      downloadCif(`${structure.formula}_${displayNumber}.cif`, structure.cifContent)
      toast.success('Downloaded CIF file')
    } else {
      toast.error('CIF data not available')
    }
  }

  if (!structure) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted">Structure not found</p>
          <button
            onClick={handleBack}
            className="mt-4 text-sm text-accent hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        {/* Only show "Send to MatterSim" when viewing from MatterGen */}
        <div className="flex items-center gap-2">
          {structure.cifContent && (
            <button
              onClick={handleDownloadCif}
              className="rounded-md border border-border-bright bg-surface-raised px-4 py-1.5 text-sm font-medium text-text hover:bg-border"
            >
              Download CIF
            </button>
          )}
          {context === 'mattergen' && (
            <button
              onClick={handleSendToMatterSim}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-bg transition-all hover:bg-accent-bright hover:-translate-y-px active:translate-y-0"
            >
              Send to MatterSim
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {/* 3D Viewer */}
        <div className="mx-auto max-w-4xl">
          <CrystalViewer3D structure={structure} />
        </div>

        {/* Metadata */}
        <div className="mx-auto mt-6 max-w-4xl">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic info */}
            <div className="rounded-lg bg-surface/70 p-4">
              <h2 className="mb-3 text-sm font-semibold text-text-muted">
                Structure Info
              </h2>
              <dl className="space-y-2 text-sm">
                {structure.systematicName && (
                  <div className="flex justify-between">
                    <dt className="text-text-dim">Name</dt>
                    <dd className="font-medium text-text">{structure.systematicName}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-text-dim">Formula</dt>
                  <dd className="font-medium text-text">{structure.formula}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-dim">Composition</dt>
                  <dd className="text-text-muted">{structure.composition}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-dim">Index</dt>
                  <dd className="text-text-muted">#{displayNumber}</dd>
                </div>
                {structure.source && (
                  <div className="flex justify-between">
                    <dt className="text-text-dim">Source</dt>
                    <dd className="text-text-muted capitalize">{structure.source}</dd>
                  </div>
                )}
                {structure.crystalData && (
                  <div className="flex justify-between">
                    <dt className="text-text-dim">Atoms</dt>
                    <dd className="text-text-muted">{structure.crystalData.atoms.length}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Lattice parameters (if available) */}
            {structure.crystalData && (
              <div className="rounded-lg bg-surface/70 p-4">
                <h2 className="mb-3 text-sm font-semibold text-text-muted">
                  Lattice Parameters
                </h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-text-dim">a</dt>
                    <dd className="text-text-muted">
                      {structure.crystalData.lattice.a.toFixed(4)} A
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-dim">b</dt>
                    <dd className="text-text-muted">
                      {structure.crystalData.lattice.b.toFixed(4)} A
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-dim">c</dt>
                    <dd className="text-text-muted">
                      {structure.crystalData.lattice.c.toFixed(4)} A
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-dim">alpha</dt>
                    <dd className="text-text-muted">
                      {structure.crystalData.lattice.alpha.toFixed(2)}deg
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-dim">beta</dt>
                    <dd className="text-text-muted">
                      {structure.crystalData.lattice.beta.toFixed(2)}deg
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-dim">gamma</dt>
                    <dd className="text-text-muted">
                      {structure.crystalData.lattice.gamma.toFixed(2)}deg
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Metrics (if evaluated) */}
            {structure.metrics ? (
              <div className="rounded-lg bg-surface/70 p-4">
                <h2 className="mb-3 text-sm font-semibold text-text-muted">
                  Evaluation Metrics
                </h2>
                <dl className="space-y-2 text-sm">
                  {/* Energy above hull (if available) */}
                  {structure.metrics.energyAboveHull !== null &&
                    structure.metrics.energyAboveHull !== undefined && (
                      <div className="flex justify-between">
                        <dt className="flex items-center gap-1 text-text-dim">
                          Energy above hull
                          <Tooltip content={tooltipContent.energyAboveHull} />
                        </dt>
                        <dd
                          className={`font-medium ${
                            structure.metrics.energyAboveHull < 0.1
                              ? 'text-green-400'
                              : structure.metrics.energyAboveHull < 0.2
                                ? 'text-yellow-400'
                                : 'text-red-400'
                          }`}
                        >
                          {structure.metrics.energyAboveHull.toFixed(3)} eV/atom
                        </dd>
                      </div>
                    )}
                  {/* Energy per atom (raw MatterSim output) */}
                  {structure.metrics.energyPerAtom !== null &&
                    structure.metrics.energyPerAtom !== undefined && (
                      <div className="flex justify-between">
                        <dt className="flex items-center gap-1 text-text-dim">
                          Energy per atom
                          <Tooltip content={tooltipContent.energyPerAtom} />
                        </dt>
                        <dd className="font-medium text-text-muted">
                          {structure.metrics.energyPerAtom.toFixed(3)} eV/atom
                        </dd>
                      </div>
                    )}
                  <div className="flex justify-between">
                    <dt className="flex items-center gap-1 text-text-dim">
                      Stable
                      <Tooltip content={tooltipContent.isStable} />
                    </dt>
                    <dd
                      className={
                        structure.metrics.isStable ? 'text-green-400' : 'text-text-muted'
                      }
                    >
                      {structure.metrics.isStable ? 'Yes' : 'No'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="flex items-center gap-1 text-text-dim">
                      Novel
                      <Tooltip content={tooltipContent.isNovel} />
                    </dt>
                    <dd
                      className={
                        structure.metrics.isNovel ? 'text-green-400' : 'text-text-muted'
                      }
                    >
                      {structure.metrics.isNovel ? 'Yes' : 'No'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="flex items-center gap-1 text-text-dim">
                      Unique
                      <Tooltip content={tooltipContent.isUnique} />
                    </dt>
                    <dd
                      className={
                        structure.metrics.isUnique ? 'text-green-400' : 'text-text-muted'
                      }
                    >
                      {structure.metrics.isUnique ? 'Yes' : 'No'}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="rounded-lg bg-surface/70 p-4">
                <h2 className="mb-3 text-sm font-semibold text-text-muted">
                  Evaluation Metrics
                </h2>
                <p className="text-sm text-text-dim">
                  Not yet evaluated. Send to MatterSim to compute metrics.
                </p>
              </div>
            )}
          </div>

          {/* Generation prompt (if available) */}
          {structure.generationPrompt && (
            <div className="mt-6 rounded-lg bg-surface/70 p-4">
              <h2 className="mb-3 text-sm font-semibold text-text-muted">
                Generation Prompt
              </h2>
              <pre className="overflow-x-auto rounded-md bg-bg/80 p-3 text-xs text-text-muted">
                {JSON.stringify(structure.generationPrompt, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
