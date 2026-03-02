---
applyTo: "**/*"
---

# Promptions Innovation Kit - Copilot Instructions

When questions relate to Promptions, dynamic prompt middleware, ephemeral UI controls, or structured prompt parameterization, use these guidelines.

## Kit Location

The Promptions Innovation Kit is installed at `.vibe-kit/innovation-kits/promptions/`.
The reference apps (cloned at setup time) live at `.vibe-kit/innovation-kits/promptions/promptions-app/`.

In all commands below, `<KIT_PATH>` means `.vibe-kit/innovation-kits/promptions`.

## Routing Table

| User Intent                                        | Primary Document               | Key Sections                                       |
| -------------------------------------------------- | ------------------------------ | -------------------------------------------------- |
| "Get started", "run demo", "setup"                 | `docs/quick-start.md`          | Credentials, generate, validate, render, replay    |
| "How does Promptions work", "architecture"         | `SKILL.md`                     | Core workflow, control types, implementation guide |
| "What can I do with this", "use cases"             | `docs/application-patterns.md` | Support, marketing, analytics, education           |
| "Schema", "control types", "reference"             | `docs/REFERENCE.md`            | All 6 control types, full schema                   |
| "Performance", "latency", "scaling"                | `docs/performance-guide.md`    | Caching, batching, streaming                       |
| "Error", "not working", "help"                     | `docs/troubleshooting.md`      | Common issues and fixes                            |
| "Run chatbot", "run image generator", "launch app" | This file                      | Deterministic Launch Procedure                     |
| "Paper", "citation"                                | `SKILL.md` → Resources section | arXiv link, GitHub repo                            |

## Key Concepts

### What Promptions Does

- **Input**: A user prompt (natural language)
- **Output**: Dynamically generated UI controls (sliders, selects, toggles, text inputs) that parameterize the prompt
- **Flow**: Prompt → Generate Controls → Render UI → User Tweaks → Replay Selections → AI Response
- **Value**: Users steer AI output through structured choices instead of crafting complex prompts

### Control Types

| Kind            | UI Component  | Use For                                              |
| --------------- | ------------- | ---------------------------------------------------- |
| `slider`        | Range slider  | Numeric parameters (temperature, length, creativity) |
| `single-select` | Radio buttons | 2-4 categorical choices (tone, style)                |
| `dropdown`      | Select menu   | 5+ options (languages, categories)                   |
| `multi-select`  | Checkboxes    | Selecting multiple items (features, topics)          |
| `text-input`    | Text field    | Specific values (company name, keyword)              |
| `binary`        | Toggle switch | Yes/no options                                       |

### Reference Applications

The open-source [microsoft/Promptions](https://github.com/microsoft/Promptions) repo includes two fully working reference apps:

- **Chatbot** (`apps/promptions-chat`, port 3003): Type a prompt, get dynamic controls, tweak them, and see the AI response update live
- **Image Generator** (`apps/promptions-image`, port 3004): Same flow but generates images with DALL-E

These are cloned during setup (not bundled in the kit) so you always get the latest version.

## Quick Commands

```bash
# Clone reference apps (done once during setup)
git clone https://github.com/microsoft/Promptions.git <KIT_PATH>/promptions-app

# Install dependencies
cd <KIT_PATH>/promptions-app && corepack yarn install

# Build all packages
corepack yarn build

# Run chatbot demo
cd <KIT_PATH>/promptions-app/apps/promptions-chat && npx vite --port 3003 --host 0.0.0.0

# Run image generator demo
cd <KIT_PATH>/promptions-app/apps/promptions-image && npx vite --port 3004 --host 0.0.0.0
```

## Deterministic Launch Procedure

When a user asks to "install and run", "launch", "start", "run", "demo", or "try" Promptions, follow this **exact** procedure.

### Pre-check: Is the Kit Installed?

Before anything else, check if the kit is installed:

```bash
test -d <KIT_PATH>
```

**If the kit directory does NOT exist**, run the install first:

```bash
cd /workspaces/vibe-kit && python vibekit-cli/src/cli.py install promptions
```

Then continue with Step 0 below. This allows users to go from zero to running demo with a single prompt like "Install and run the Promptions demo".

### CRITICAL: Terminal Rules

1. **Background terminals are isolated** — A command run with `isBackground: true` creates a NEW terminal. Do NOT run additional commands in it.
2. **Use `get_terminal_output`** to check background process status instead of running commands.
3. **Use absolute paths** — Always use full workspace paths, not relative.
4. **Never skip the .env check** — Users forget to save the file. Always verify.

### Step 0: Check for OpenAI API Key (CRITICAL — DO NOT SKIP)

**Check if .env already has a real API key set:**

```bash
grep -qE "OPENAI_API_KEY=.+" <KIT_PATH>/.env && grep -vqE "OPENAI_API_KEY=$" <KIT_PATH>/.env
```

The `.env` file is auto-created from `.env.example` during `vibekit install`. If it somehow doesn't exist, copy it:

```bash
cp <KIT_PATH>/.env.example <KIT_PATH>/.env
```

**If the key is missing or empty, inform the user and STOP:**

```
⚠️  OPENAI API KEY REQUIRED

Your .env file is at:
  <KIT_PATH>/.env

Please add your OpenAI API key:
  - Open the file and set OPENAI_API_KEY=sk-... (no quotes, no spaces)
  - Get a key at: https://platform.openai.com/api-keys
  - Save the file (Ctrl+S / Cmd+S)

Tell me when you've saved it and I'll continue.
```

**Do NOT proceed until user confirms they've saved their key.**

### Step 1: Validate the API Key

**Test that the key actually works before doing anything else:**

```bash
source <KIT_PATH>/.env
curl -s -o /dev/null -w "%{http_code}" https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

- If the response is `200`: proceed to Step 2
- If `401`: tell the user their key is invalid, re-check and try again
- If `429`: tell the user they may have rate limits, but the key is valid — proceed

**Inform the user:**

```
✅ API key validated successfully!
```

### Step 2: Clone the Reference Apps (if not already cloned)

```bash
if [ ! -d "<KIT_PATH>/promptions-app" ]; then
  git clone https://github.com/microsoft/Promptions.git "<KIT_PATH>/promptions-app"
fi
```

### Step 3: Install Dependencies and Build

```bash
cd <KIT_PATH>/promptions-app && corepack yarn install && corepack yarn build
```

- This uses Yarn 4.9.1 via corepack (no manual Yarn install needed)
- Do NOT use `corepack enable` — it requires root permissions in dev containers
- Build compiles the shared `promptions-llm` and `promptions-ui` packages

### Step 4: Ask the User Which Demo to Run

**Present the choice:**

```
The Promptions repo includes two reference applications:

1. 💬 **Chatbot** — Type a prompt, get dynamic controls, tweak parameters, see the response update live
2. 🎨 **Image Generator** — Same flow but generates images with DALL-E

Which would you like to try?
```

**Wait for the user to choose before proceeding.**

### Step 5: Create the App .env and Launch

**For chatbot:**

```bash
source <KIT_PATH>/.env
echo "VITE_OPENAI_API_KEY=$OPENAI_API_KEY" > "<KIT_PATH>/promptions-app/apps/promptions-chat/.env"
cd "<KIT_PATH>/promptions-app/apps/promptions-chat" && npx vite --port 3003 --host 0.0.0.0
```

**For image generator:**

```bash
source <KIT_PATH>/.env
echo "VITE_OPENAI_API_KEY=$OPENAI_API_KEY" > "<KIT_PATH>/promptions-app/apps/promptions-image/.env"
cd "<KIT_PATH>/promptions-app/apps/promptions-image" && npx vite --port 3004 --host 0.0.0.0
```

- **IMPORTANT**: Do NOT use `corepack yarn workspace ... dev` — Yarn 4 hoists all deps to the root `node_modules` and does not create local `.bin` symlinks, causing "permission denied: vite" errors. Use `npx vite` from the app directory instead, which resolves vite from the hoisted root `node_modules`.
- **CRITICAL**: Always use `--host 0.0.0.0` — Vite v7 binds to IPv6 `::1` by default, which breaks dev container port forwarding. Without this flag the app won't load in any browser.
- **MUST** use `isBackground: true` so the terminal stays running in the background; then use `get_terminal_output` to verify the server started and `open_simple_browser` to open the URL.
- Wait for the Vite dev server to show `Local: http://localhost:3003` (chat) or `http://localhost:3004` (image)

### Step 6: Announce Success and Open Browser

```
✅ Promptions is ready!

- App: http://localhost:3003 (or 3004 for image generator)

Opening in your browser now. Try typing a prompt and watch the dynamic controls appear!
```

Then open the URL with `open_simple_browser` or `$BROWSER`.

### NEVER DO THIS:

- ❌ Launch without checking for `OPENAI_API_KEY` first
- ❌ Skip the "save the file" reminder — users routinely forget
- ❌ Skip API key validation — a bad key wastes 5 minutes of confusing errors
- ❌ Run a terminal-only demo instead of the web apps — the whole point is the UI
- ❌ Run the demo autonomously with a canned prompt — the user should interact
- ❌ Use `pip install` or `npm install` at the root — use `corepack yarn install`
- ❌ Use `corepack enable` — it fails with permission errors in dev containers; use `corepack yarn` directly
- ❌ Use `isBackground: true` for the dev server (hides terminal from user)
- ❌ Build a custom demo app when the reference apps already exist
- ❌ Tell the user about the `examples/` folder code modules first — lead with the apps
- ❌ Suggest mock backends or stub APIs

## After the Demo

Once the user has seen Promptions in action, **then** offer next steps:

- "Want to understand how the controls are generated? See the `examples/` modules"
- "Want to build your own app? The `docs/quick-start.md` walks through API integration"
- "Want to see domain-specific patterns? Check `docs/application-patterns.md`"
- "Want to read the research paper? `assets/papers/promptions.pdf`"

## Prototype Structure

```
.vibe-kit/innovation-kits/promptions/     ← Installed kit
├── SKILL.md                              # Agent skill definition
├── MANIFEST.yml                          # Kit metadata
├── .env.example                          # Credential template
├── .env                                  # User's credentials (created at setup)
├── assets/papers/                        # Research paper
├── docs/                                 # Guides and reference
│   ├── quick-start.md                    # API integration tutorial
│   ├── REFERENCE.md                      # Full schema documentation
│   ├── application-patterns.md           # Domain use cases
│   ├── troubleshooting.md                # Error diagnosis
│   └── ...
├── examples/                             # TypeScript modules (importable code)
│   ├── control-schema.ts                 # Type definitions
│   ├── generate-controls.ts              # Control generation
│   ├── validate-controls.ts              # Validation
│   ├── replay-selections.ts              # Selection replay
│   └── render-controls.tsx               # React/Fluent UI component
└── promptions-app/                       # ← Cloned at setup from GitHub
    ├── apps/
    │   ├── promptions-chat/              # Chatbot reference app (port 3003)
    │   └── promptions-image/             # Image generator reference app (port 3004)
    └── packages/
        ├── promptions-llm/               # Shared LLM utilities
        └── promptions-ui/                # Shared UI components
```

## Response Guidelines

1. **Lead with the reference apps** — Show users the working demo before explaining code
2. **Use kit docs** — Always reference specific files for detailed info
3. **Action first** — Run commands, then explain what happened
4. **The UI is the point** — Promptions is about ephemeral UI, not terminal output
5. **User interaction is the point** — Never run demos autonomously with canned prompts

## Dependencies

- **Node.js 18+** (pre-installed in dev container)
- **Corepack** (ships with Node.js 16.10+, manages Yarn version)
- **OpenAI API key** (required for both chat and image generation)
- **No GPU needed** — all processing is API-based
