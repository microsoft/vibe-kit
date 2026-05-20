import { ReactNode } from 'react'

/**
 * Microsoft four-color logo
 */
function MicrosoftLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 23 23"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  )
}

/**
 * Check if running in external/deployed mode.
 * Set VITE_EXTERNAL=true in your .env.production to enable the back link.
 */
function isExternalMode(): boolean {
  return import.meta.env.VITE_EXTERNAL === 'true'
}

const DEFAULT_BACK_URL = ''

interface AppHeaderProps {
  /** Application name displayed prominently (e.g., "MatterGen") */
  appName: string

  /** Domain description in uppercase (e.g., "MATERIALS DISCOVERY") */
  subtitle: string

  /** Team attribution after "MICROSOFT RESEARCH" (default: "AI FOR SCIENCE") */
  teamName?: string

  /** URL for the back button (default: empty; supply via prop or VITE_BACK_URL) */
  backUrl?: string

  /** Back button label (default: "AI for Science Labs") */
  backLabel?: string

  /** Override ENV var check for showing back link */
  showBackLink?: boolean

  /** Callback when info button is clicked (shows info button when provided) */
  onInfoClick?: () => void

  /** Right-side content slot for tools (Tour button, settings, etc.) */
  children?: ReactNode

  /** Additional className for the header container */
  className?: string
}

export function AppHeader({
  appName,
  subtitle,
  teamName = 'AI FOR SCIENCE',
  backUrl = DEFAULT_BACK_URL,
  backLabel = 'AI for Science Labs',
  showBackLink,
  onInfoClick,
  children,
  className,
}: AppHeaderProps) {
  const showBack = showBackLink ?? isExternalMode()

  return (
    <header
      className={`flex-shrink-0 border-b border-border ${className ?? ''}`}
      data-tour="header"
    >
      {/* Back link row - only shown in external/deployed mode */}
      {showBack && (
        <div className="pt-3">
          <a
            href={backUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted border border-border rounded-full hover:border-border-bright hover:text-text transition-colors focus-ring"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 12L6 8l4-4" />
            </svg>
            {backLabel}
          </a>
        </div>
      )}

      {/* Main header row */}
      <div className="flex items-center justify-between gap-4 py-4">
        {/* Left: Logo + App info */}
        <div className="flex items-center gap-3">
          <MicrosoftLogo size={28} />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-text font-display leading-tight tracking-tight">
                {appName}
              </h1>
              {onInfoClick && (
                <button
                  onClick={onInfoClick}
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent hover:bg-accent/30 transition-colors focus-ring"
                  aria-label={`About ${appName}`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-text-muted">
              {subtitle} · MICROSOFT RESEARCH {teamName}
            </p>
          </div>
        </div>

        {/* Right: Tools slot */}
        {children && <div className="flex items-center gap-3">{children}</div>}
      </div>
    </header>
  )
}
