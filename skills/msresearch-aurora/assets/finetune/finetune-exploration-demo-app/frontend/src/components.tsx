import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import type { TourStep } from "./useTour";

/* ── Microsoft Logo ────────────────────────────────────── */
export function MicrosoftLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 23 23"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
      <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
      <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
    </svg>
  );
}

/* ── Info Icon (reusable) ──────────────────────────────── */
function InfoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ── App Header ────────────────────────────────────────── */
export function AppHeader({
  onInfoClick,
  onTourClick,
}: {
  onInfoClick: () => void;
  onTourClick: () => void;
}) {
  return (
    <header className="border-b border-border" data-tour="header">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <a
            href={import.meta.env.VITE_AI4S_HOME_URL || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <MicrosoftLogo size={18} />
            <span className="text-xs text-text-muted tracking-widest uppercase">
              AI for Science
            </span>
          </a>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-text font-serif tracking-tight">
              Aurora Finetune Exploration
            </h1>
            <button
              onClick={onInfoClick}
              className="text-text-muted hover:text-accent transition-colors focus-ring p-1 rounded"
              aria-label="About this app"
            >
              <InfoIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <button
          onClick={onTourClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted hover:text-accent border border-border hover:border-accent/50 rounded-md transition-colors focus-ring"
          aria-label="Start guided tour"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          Tour
        </button>
      </div>
    </header>
  );
}

/* ── Info Modal (About) ────────────────────────────────── */
export function InfoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-backdrop"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="About Aurora Finetune"
    >
      <div
        className="bg-surface border border-border rounded-xl max-w-lg w-full mx-4 p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <MicrosoftLogo size={28} />
            <h2 className="text-lg font-semibold font-serif text-text">
              Aurora Finetune
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text transition-colors p-1 focus-ring rounded"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="space-y-3 text-sm text-text-muted leading-relaxed">
          <p>
            This demo explores how training data size affects{" "}
            <strong className="text-text">Microsoft Aurora</strong> weather
            model performance when finetuned on regional ERA5 data for Greece.
          </p>
          <p>
            Compare loss curves across training epochs, and visualize spatial
            predictions from the finetuned model against a persistence baseline
            and ground truth observations.
          </p>
          <p>
            Built with the{" "}
            <a
              href="https://github.com/microsoft/vibe-kit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hover underline underline-offset-2"
            >
              Aurora Skill
            </a>
            , part of Microsoft Research AI for Science.
          </p>
        </div>
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs text-text-muted">
            Microsoft Research &middot; AI for Science &middot; Climate &amp;
            Weather
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Panel ─────────────────────────────────────────────── */
export function Panel({
  title,
  subtitle,
  children,
  className = "",
  "data-tour": dataTour,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  "data-tour"?: string;
}) {
  return (
    <section
      className={`bg-surface border border-border rounded-xl p-6 ${className}`}
      data-tour={dataTour}
    >
      <h2 className="text-lg font-semibold text-text font-serif mb-1">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-text-muted mb-4">{subtitle}</p>
      )}
      {children}
    </section>
  );
}

/* ── Spinner ───────────────────────────────────────────── */
export function Spinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <svg
        className="animate-spin h-8 w-8 text-accent"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="text-sm text-text-muted">{label}</span>
    </div>
  );
}

/* ── Tooltip ───────────────────────────────────────────── */
export function Tooltip({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: string;
}) {
  return (
    <span className="group relative inline-block ml-1 align-middle">
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 text-text-muted hover:text-accent transition-colors focus-ring rounded-full"
        aria-label={label}
        aria-describedby={id}
      >
        <InfoIcon />
      </button>
      <span
        id={id}
        role="tooltip"
        className="invisible group-hover:visible group-focus-within:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-text bg-surface-alt border border-border rounded-lg w-56 text-center z-30 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
      >
        {children}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border"></span>
      </span>
      <span className="sr-only">{children}</span>
    </span>
  );
}

/* ── Guided Tour ───────────────────────────────────────── */
export function GuidedTour({
  active,
  step,
  steps,
  onNext,
  onPrev,
  onDismiss,
}: {
  active: boolean;
  step: number;
  steps: TourStep[];
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;
}) {
  const [cutout, setCutout] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save focus on mount, restore on unmount
  useEffect(() => {
    if (!active) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [active]);

  // Auto-focus the card and set aria-hidden on main content
  useEffect(() => {
    if (!active) return;
    // Focus the card after a brief delay to let it render
    const timer = setTimeout(() => {
      cardRef.current?.focus();
    }, 100);

    // Hide main content from screen readers while tour is active
    const root = document.getElementById("root");
    if (root) root.setAttribute("aria-hidden", "true");

    return () => {
      clearTimeout(timer);
      if (root) root.removeAttribute("aria-hidden");
    };
  }, [active, step]);

  // Focus trap within the tour card
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
        return;
      }
      if (e.key !== "Tab") return;

      const card = cardRef.current;
      if (!card) return;

      const focusable = card.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onDismiss]
  );

  // Cutout positioning
  useEffect(() => {
    if (!active) return;
    const current = steps[step];
    const el = document.querySelector(
      `[data-tour="${current.target}"]`
    ) as HTMLElement | null;
    if (el) {
      el.classList.add("tour-highlight");
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      const pad = 8;
      const updateRect = () => {
        const rect = el.getBoundingClientRect();
        setCutout({
          x: rect.left - pad,
          y: rect.top - pad,
          w: rect.width + pad * 2,
          h: rect.height + pad * 2,
        });
      };

      const timer = setTimeout(updateRect, 350);
      window.addEventListener("resize", updateRect);
      window.addEventListener("scroll", updateRect, { capture: true, passive: true });

      return () => {
        el.classList.remove("tour-highlight");
        clearTimeout(timer);
        window.removeEventListener("resize", updateRect);
        window.removeEventListener("scroll", updateRect, { capture: true });
      };
    }
  }, [active, step, steps]);

  if (!active) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const r = 12;

  return (
    <div className="fixed inset-0 z-[90]">
      {/* Dark overlay with cutout */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto"
        style={{ zIndex: 90 }}
        onClick={onDismiss}
        aria-hidden="true"
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {cutout && (
              <rect
                x={cutout.x}
                y={cutout.y}
                width={cutout.w}
                height={cutout.h}
                rx={r}
                ry={r}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#tour-mask)"
        />
        {cutout && (
          <rect
            x={cutout.x}
            y={cutout.y}
            width={cutout.w}
            height={cutout.h}
            rx={r}
            ry={r}
            fill="none"
            stroke="#4ca6ff"
            strokeWidth="2"
            strokeOpacity="0.5"
          />
        )}
      </svg>

      {/* Tour card — focus-trapped modal dialog */}
      <div
        ref={cardRef}
        className="pointer-events-auto fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-accent/30 rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl animate-fade-in"
        style={{ zIndex: 91 }}
        role="dialog"
        aria-modal="true"
        aria-label="Guided tour"
        aria-describedby="tour-step-content"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-accent font-mono" aria-hidden="true">
            {step + 1}/{steps.length}
          </span>
          <span className="sr-only">
            Step {step + 1} of {steps.length}
          </span>
          <button
            onClick={onDismiss}
            className="text-text-muted hover:text-text text-xs transition-colors focus-ring rounded px-1"
          >
            Skip tour
          </button>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <h3
            className="text-base font-semibold text-text font-serif mb-1"
            id="tour-step-title"
          >
            {current.title}
          </h3>
          <p
            className="text-sm text-text-muted leading-relaxed mb-4"
            id="tour-step-content"
          >
            {current.content}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={onPrev}
            disabled={step === 0}
            className="text-sm text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-ring rounded px-2 py-1"
            aria-label={step > 0 ? `Back to step ${step}` : "Back"}
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="text-sm bg-accent hover:bg-accent-hover text-bg font-medium px-4 py-1.5 rounded-md transition-colors focus-ring"
            aria-label={
              isLast ? "Finish tour" : `Next: step ${step + 2}`
            }
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
