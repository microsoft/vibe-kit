import { useEffect, useRef, useState } from 'react'

type MolstarViewerApi = {
  Viewer: {
    create: (element: HTMLElement, options: Record<string, unknown>) => Promise<{
      plugin?: {
        canvas3d?: {
          props: { renderer?: Record<string, unknown> }
          setProps: (props: Record<string, unknown>) => void
        }
        builders: {
          data: { download: (params: { url: string; isBinary: boolean }) => Promise<unknown> }
          structure: {
            parseTrajectory: (data: unknown, format: 'pdb') => Promise<unknown>
            createModel: (trajectory: unknown) => Promise<unknown>
            createStructure: (model: unknown) => Promise<unknown>
            representation: {
              addRepresentation: (structure: unknown, params: Record<string, unknown>) => Promise<unknown>
            }
          }
        }
        dispose?: () => void
      }
      dispose?: () => void
    }>
  }
}

declare global {
  interface Window {
    molstar?: MolstarViewerApi
  }
}

interface Props {
  pdb: string
  title?: string
}

const MOLSTAR_VERSION = '5.7.0'
const CDN_BASE = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer`
let molstarScriptPromise: Promise<void> | null = null

function ensureMolstarSkin() {
  const skinUrl = `${CDN_BASE}/theme/dark.css`
  const existing = document.getElementById('molstar-skin') as HTMLLinkElement | null
  if (existing?.href === skinUrl) return
  existing?.remove()

  const link = document.createElement('link')
  link.id = 'molstar-skin'
  link.rel = 'stylesheet'
  link.href = skinUrl
  document.head.appendChild(link)
}

function loadMolstar() {
  ensureMolstarSkin()
  if (window.molstar) return Promise.resolve()
  if (molstarScriptPromise) return molstarScriptPromise

  molstarScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = 'molstar-viewer-script'
    script.src = `${CDN_BASE}/molstar.js`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Mol* viewer.'))
    document.head.appendChild(script)
  })

  return molstarScriptPromise
}

export function MolstarStructureViewer({ pdb, title = 'Predicted structure' }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Awaited<ReturnType<MolstarViewerApi['Viewer']['create']>> | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      if (!hostRef.current) return
      setLoading(true)
      setError(null)

      try {
        await loadMolstar()
        if (cancelled || !hostRef.current || !window.molstar) return

        viewerRef.current?.dispose?.()
        viewerRef.current?.plugin?.dispose?.()
        viewerRef.current = null
        hostRef.current.innerHTML = ''

        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = URL.createObjectURL(new Blob([pdb], { type: 'chemical/x-pdb' }))

        const viewer = await window.molstar.Viewer.create(hostRef.current, {
          layoutShowControls: true,
          layoutShowSequence: true,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          layoutShowRightPanel: false,
          layoutIsExpanded: false,
          viewportShowAnimation: true,
          viewportShowTrajectoryControls: false,
          viewportShowExpand: true,
          viewportShowSelectionMode: true,
          viewportShowSettings: true,
          layoutShowRemoteState: false,
          pluginConfig: {
            layout: {
              initial: {
                isExpanded: false,
                showControls: true,
                regionState: {
                  top: 'hidden',
                  left: 'hidden',
                  right: 'hidden',
                  bottom: 'full',
                },
              },
            },
            canvas3d: {
              camera: { manualReset: true, mode: 'perspective' },
              renderer: {
                antialias: true,
                pixelScale: 1,
                backgroundColor: 0x111217,
              },
            },
          },
        })

        if (cancelled) {
          viewer.dispose?.()
          viewer.plugin?.dispose?.()
          return
        }

        viewerRef.current = viewer

        const canvas = viewer.plugin?.canvas3d
        if (canvas) {
          canvas.setProps({
            renderer: {
              ...canvas.props.renderer,
              backgroundColor: 0x1e1e22,
            },
          })
        }

        const data = await viewer.plugin?.builders.data.download({ url: objectUrlRef.current, isBinary: false })
        const trajectory = await viewer.plugin?.builders.structure.parseTrajectory(data, 'pdb')
        const model = await viewer.plugin?.builders.structure.createModel(trajectory)
        const structure = await viewer.plugin?.builders.structure.createStructure(model)
        await viewer.plugin?.builders.structure.representation.addRepresentation(structure, {
          type: 'cartoon',
          color: 'secondary-structure',
          size: 'uniform',
          smoothing: 2,
        })

        window.setTimeout(() => {
          window.dispatchEvent(new Event('resize'))
        }, 50)

        if (!cancelled) setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Structure viewer failed to load.')
          setLoading(false)
        }
      }
    }

    initialize()

    return () => {
      cancelled = true
      viewerRef.current?.dispose?.()
      viewerRef.current?.plugin?.dispose?.()
      viewerRef.current = null
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [pdb])

  return (
    <div className="molstar-viewer-card" aria-label={title}>
      <div ref={hostRef} className="molstar-viewer-card__host" />
      {loading && (
        <div className="molstar-viewer-card__overlay">
          <span className="spinner" />
          <span>Loading 3D structure...</span>
        </div>
      )}
      {error && (
        <div className="molstar-viewer-card__overlay molstar-viewer-card__overlay--error">
          {error}
        </div>
      )}
    </div>
  )
}
