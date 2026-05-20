import { useState } from 'react'
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AppHeader } from './components/AppHeader'
import { InfoModal } from './components/InfoModal'
import { GlobalStatusBanner } from './components/GlobalStatusBanner'
import { GuidedTour } from './components/GuidedTour'
import { GeneratePage } from './routes/GeneratePage'
import { MatterSimPage } from './routes/MatterSimPage'
import { StructureDetailPage } from './routes/StructureDetailPage'
import { useAppStore } from './stores/appStore'
import { mattergenInfo, mattersimInfo } from './data/educationalContent'

function TabNavigation() {
  const mattersimCount = useAppStore((s) => s.mattersimStructures.length)
  const pendingCount = useAppStore((s) =>
    s.mattersimStructures.filter((s) => !s.metrics).length
  )

  return (
    <nav className="flex border-b border-border" aria-label="Main navigation">
      <NavLink
        to="/generate"
        data-tour="mattergen-tab"
        className={({ isActive }) =>
          `px-6 py-3 text-sm font-medium transition-colors ${
            isActive
              ? 'border-b-2 border-accent text-accent'
              : 'text-text-muted hover:text-text'
          }`
        }
      >
        MatterGen
      </NavLink>
      <NavLink
        to="/mattersim"
        data-tour="mattersim-tab"
        className={({ isActive }) =>
          `px-6 py-3 text-sm font-medium transition-colors ${
            isActive
              ? 'border-b-2 border-accent text-accent'
              : 'text-text-muted hover:text-text'
          }`
        }
      >
        MatterSim
        {mattersimCount > 0 && (
          <span className="ml-2 rounded-full bg-surface-raised px-2 py-0.5 text-xs">
            {pendingCount > 0 ? `${pendingCount} pending` : mattersimCount}
          </span>
        )}
      </NavLink>
    </nav>
  )
}

export default function App() {
  const [showInfoModal, setShowInfoModal] = useState(false)
  const location = useLocation()
  const appMode = useAppStore((s) => s.appMode)
  const demoMode = useAppStore((s) => s.demoMode)
  const setDemoMode = useAppStore((s) => s.setDemoMode)
  const startTour = useAppStore((s) => s.startTour)

  // Determine current page for info modal
  const isMatterSimPage = location.pathname.startsWith('/mattersim')
  const currentApp = isMatterSimPage ? 'MatterSim' : 'MatterGen'
  const currentSubtitle = isMatterSimPage ? 'STABILITY EVALUATION' : 'MATERIALS DISCOVERY'

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex h-screen max-w-7xl flex-col px-6">
        <AppHeader
          appName={currentApp}
          subtitle={currentSubtitle}
          teamName="AI FOR SCIENCE"
          onInfoClick={() => setShowInfoModal(true)}
        >
        {/* Tour button with ? icon */}
        <button
          onClick={startTour}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted hover:text-text hover:bg-surface-raised rounded-md transition-colors focus-ring"
          aria-label="Take a tour"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
          Tour
        </button>

        {/* Demo Mode Toggle - only shown in research mode */}
        {appMode === 'research' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Demo</span>
            <button
              onClick={() => setDemoMode(!demoMode)}
              className={`relative h-5 w-9 rounded-full transition-colors focus-ring ${
                demoMode ? 'bg-accent' : 'bg-surface-raised'
              }`}
              role="switch"
              aria-checked={demoMode}
              aria-label={demoMode ? 'Disable demo mode' : 'Enable demo mode'}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  demoMode ? 'left-[18px]' : 'left-0.5'
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </AppHeader>

      <TabNavigation />
      <GuidedTour />

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <GlobalStatusBanner />
        <main className="flex flex-1 min-h-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/generate" replace />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route
            path="/generate/structure/:id"
            element={<StructureDetailPage context="mattergen" />}
          />
          <Route path="/mattersim" element={<MatterSimPage />} />
          <Route
            path="/mattersim/structure/:id"
            element={<StructureDetailPage context="mattersim" />}
          />
        </Routes>
        </main>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-3 text-center text-xs text-text-muted">
        <p>
          MatterGen and MatterSim are research models. Predictions must be verified by domain experts before
          any real-world use. Intended for inorganic crystalline materials only. ·{' '}
          <a
            href="https://www.nature.com/articles/s41586-025-08628-5"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            MatterGen Paper
          </a>{' '}
          ·{' '}
          <a
            href="https://arxiv.org/abs/2405.04967"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            MatterSim Paper
          </a>{' '}
          ·{' '}
          <a
            href="https://github.com/microsoft/mattergen"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            GitHub
          </a>
        </p>
      </footer>

      <Toaster
        position="bottom-right"
        toastOptions={{
          className: '',
          style: {
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          },
          duration: 3000,
        }}
      />

      {/* Info Modal */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={currentApp}
        sections={isMatterSimPage ? mattersimInfo : mattergenInfo}
      />
      </div>
    </div>
  )
}
