---
description: Guidelines for ideating and implementing design
applyTo: "frontend/**/*.{tsx,css}"
---


# Design Guidelines
High-level UX + content rules shaping what should exist before implementation.
### Accessibility (Design Intent)
- Clear, persistent label text (not placeholder-only)
- Visible focus rings retained
- Semantic roles come from proper components (no generic role hacks)
- Icon-only interactive elements have an accessible name (`aria-label` or `aria-labelledby`)

## Content & Naming
- Tone: clear, concise, neutral, inclusive
- Sentence case for labels, buttons, headings (except proper nouns)
- Action-first labels ("Save changes")
- Avoid anthropomorphism (no "smart assistant", "it thinks")
- Avoid filler / fluff / marketing hype
- Prefer concrete verbs: Add / Remove / Edit (avoid "Manage")
- Inclusive language ("Add person", not "Add manpower")
- Short, actionable error text ("Connection failed. Retry.")

## Typography & Icons
- Use semantic HTML headings + `Text` for body/inline text
- Apply design tokens (no custom inline font sizing)
- Icons from Fluent set only
- Decorative icons: `aria-hidden="true"`
- Avoid brain/organ/face metaphors for AI concepts

## AI Output (User Perception)
- Distinct labels: "Model output", "Suggested draft"
- Visual distinction: draft vs confirmed state
- Explicit actions: Accept / Edit / Regenerate / Discard
- Neutral uncertainty phrasing ("May contain errors—review")
- No anthropomorphic framing
- Unsafe / policy-risk content: mask + remediation path

# Frontend Development Guidelines
Engineering execution rules ensuring the design intent is built accessibly and efficiently.

## Components & Patterns (Design Preference)
- Use `@tanstack/react-query` for global state management and API calls
- Prefer Fluent v9 components (avoid custom primitives):
	- `Button`, `Link` (Next.js styled link), `Input`, `Textarea`
	- `Combobox`, `Dropdown`, `Checkbox`, `RadioGroup`, `Switch`
	- `Dialog`, `Tooltip`, `Menu`, `Popover`, `Card`
	- `Spinner`, `ProgressBar`, `DataGrid` (tabular only)
	- `Tab`/`TabList`, `Text`
- Prefer semantic HTML if a semantic element is a better fit than a `div`

## Implementation & Styling
- Use only listed Fluent v9 components (no custom primitive re‑creations)
- Style with Griffel (`makeStyles` / `useStyles`); leverage tokens
- Never hardcode color / spacing / typography values
- Prefer slots or component props for styling—one wrapper `div` for padding allowed when needed

## Accessibility Execution
- Interactive elements are real Fluent components (no `<div role="button">`)
- Icon-only `Button`: provide `aria-label`
- Inputs: associated label via `label` + `htmlFor` or `aria-labelledby`
- Let `Dialog` / `Menu` / `Popover` manage focus automatically
- Keep focus outlines (do not remove outline styles)
- Async status messaging region uses `aria-live="polite"` when needed

## Layout & Spacing
- Use CSS flex + `gap` with spacing tokens
- Remove spacer `<div>`s; adjust layout structure instead

## Forms & Validation
- Validate on blur or submit (avoid per-keystroke validation noise)
- On error: set `aria-invalid` + concise helper text (optionally `role="alert"`)
- Never rely on color alone—always include text or icon + text

## State & Data Patterns
- Co-locate transient UI state; lift only when shared
- Use controlled inputs for dynamic validation flows
- Derive sorting / filtering instead of duplicating arrays
- Replace deep prop drilling with context hooks

## Performance & Quality
- Keep render pure; move heavy / async work to effects
- Virtualize or paginate large lists (>200 rows)
- Memoize expensive calculations / components
- Remove stray `console.log`; keep structured error logging only

## Errors & Loading
- Local async: inline `Spinner` near affected region
- Bulk loads: show skeletons, then real content
- Error surface: brief message + recovery action (Retry / Dismiss)

## Anti-Patterns (Do Not)
- No inline token literals (e.g., `'#0078d4'`)
- No unnecessary wrapper `<div>` around Fluent components
- Don’t disable buttons on load without visible state (spinner or `aria-busy` region)
- Don’t silence TypeScript with `any`—fix the underlying types when writing new code
