<p align="center">
  <br />
  <code>&nbsp;██╗&nbsp;&nbsp;&nbsp;██╗███████╗&nbsp;██████╗████████╗██╗███████╗&nbsp;</code><br />
  <code>&nbsp;██║&nbsp;&nbsp;&nbsp;██║██╔════╝██╔════╝╚══██╔══╝██║██╔════╝&nbsp;</code><br />
  <code>&nbsp;██║&nbsp;&nbsp;&nbsp;██║█████╗&nbsp;&nbsp;██║&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;██║&nbsp;&nbsp;&nbsp;██║███████╗&nbsp;</code><br />
  <code>&nbsp;╚██╗&nbsp;██╔╝██╔══╝&nbsp;&nbsp;██║&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;██║&nbsp;&nbsp;&nbsp;██║╚════██║&nbsp;</code><br />
  <code>&nbsp;&nbsp;╚████╔╝&nbsp;███████╗╚██████╗&nbsp;&nbsp;&nbsp;██║&nbsp;&nbsp;&nbsp;██║███████║&nbsp;</code><br />
  <code>&nbsp;&nbsp;&nbsp;╚═══╝&nbsp;&nbsp;╚══════╝&nbsp;╚═════╝&nbsp;&nbsp;&nbsp;╚═╝&nbsp;&nbsp;&nbsp;╚═╝╚══════╝&nbsp;</code><br />
  <br />
  <strong>AI-driven design engineering CLI for Penpot</strong>
  <br /><br />
  <a href="#installation"><img src="https://img.shields.io/badge/bun-%E2%89%A51.0-blueviolet" alt="Bun"></a>
  <a href="#installation"><img src="https://img.shields.io/badge/node-%E2%89%A518-blueviolet" alt="Node"></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-blueviolet" alt="License"></a>
  <img src="https://img.shields.io/badge/version-0.1.0-blueviolet" alt="Version">
</p>

---

Vectis is a slash-command REPL that connects to a self-hosted [Penpot](https://penpot.app) instance via its official MCP server and uses the Claude API for AI-powered design generation, auditing, and analysis — all from your terminal.

> **The CLI is the brain. Each project folder is its memory. Penpot is the canvas. Slash commands are the language. `@references` are the inputs.**

## Features

- **`/create` Pipeline** — Describe a UI in natural language, get a validated layout spec, preview as ASCII, then push directly to Penpot (flex + grid)
- **`@reference` System** — Pull files (`@src/tokens.json`), folders (`@briefs/`), Penpot boards (`@penpot:Dashboard/Home`), and images (`@image:mockup.png`) into Claude's context
- **`/structure` Onboarding** — Feed messy brief documents; Vectis converses with you to generate structured flows, screens, and context files
- **30+ Slash Commands** — Setup, design generation, auditing, analysis, flow navigation, skill management, conversation history
- **Skills System** — Extend the AI with project-local, global, or community skills (markdown instruction sets injected into prompts)
- **Live Penpot Bridge** — MCP client for canvas operations + WebSocket listener for real-time selection and shape events
- **SQLite Graph Store** — Persistent project graph (flows, screens, boards, tokens) with migration support
- **Conversation History** — Sessions are stored and resumable, with auto-compaction at token budget limits
- **Vim Mode & Keybindings** — Modal editing, paste mode, customizable keybindings via `~/.vectis/keybindings.json`
- **Purple Terminal UI** — Truecolor gradient banner, themed prompt, and consistent purple accent palette

## Installation

### Prerequisites

| Dependency | Version | Purpose |
|------------|---------|---------|
| [Bun](https://bun.sh) | >= 1.0 | Runtime |
| [Penpot](https://penpot.app) | Self-hosted or cloud | Design canvas |
| [Penpot MCP Server](https://github.com/penpot/penpot) | `mcp/` directory | Canvas bridge |
| Anthropic API Key | — | AI features |

### Setup

```bash
# Clone and install
git clone https://github.com/dinethlive/vectis-cli.git
cd vectis-cli
bun install

# Start in dev mode
bun run dev

# Run the setup wizard (configures API key, Penpot URLs)
# Inside the REPL:
/init
```

### Penpot + MCP Server

Vectis expects these services running locally:

| Port | Protocol | Service |
|------|----------|---------|
| 9001 | HTTP | Penpot UI |
| 4401 | HTTP | MCP Streamable HTTP (`/mcp`) |
| 4402 | WebSocket | Live events |

```bash
# Start Penpot (Docker)
docker compose -p penpot -f docker-compose.yaml up -d

# Start MCP Server (from penpot repo mcp/ directory)
pnpm run start
```

## Quick Start

```bash
bun run dev
```

```
  ╭────────────────────────────────────────────────────╮
  │░░░░░░░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓██████████████│
  │                                                    │
  │   ██╗   ██╗███████╗ ██████╗████████╗██╗███████╗   │
  │   ██║   ██║██╔════╝██╔════╝╚══██╔══╝██║██╔════╝   │
  │   ██║   ██║█████╗  ██║        ██║   ██║███████╗   │
  │   ╚██╗ ██╔╝██╔══╝  ██║        ██║   ██║╚════██║   │
  │    ╚████╔╝ ███████╗╚██████╗   ██║   ██║███████║   │
  │     ╚═══╝  ╚══════╝ ╚═════╝   ╚═╝   ╚═╝╚══════╝   │
  │                                                    │
  │  AI-driven design engineering for Penpot           │
  │  v0.1.0  ·  Type /help for commands               │
  │                                                    │
  ╰────────────────────────────────────────────────────╯

vectis >
```

```bash
# Check everything is connected
/doctor

# Scan your Penpot file
/pull

# Generate a UI board from a description
/create Login "A clean login form with email, password, and a sign-in button"

# Ask Claude about your project with context
/ask "what tokens do we use?" @context/tokens.json

# Audit an existing board against design rules
/audit Dashboard/Home
```

## Commands

### Setup & Health

| Command | Description |
|---------|-------------|
| `/init` | Setup wizard — API key, Penpot URLs, project config |
| `/doctor` | Validate API key, Penpot connection, MCP server |
| `/pull` | Scan Penpot file for pages, boards, components, tokens |

### AI & Design Generation

| Command | Description |
|---------|-------------|
| `/create <board> "<description>"` | Full pipeline: generate spec, validate, preview, push to Penpot |
| `/ask "<question>" [@refs...]` | Ask Claude with optional `@file`, `@folder`, `@penpot` context |
| `/audit <board>` | UX review against design rules and graph constraints |
| `/analyze <flow>` | Deep analysis of an entire flow |
| `/explain <layer>` | Explain a Penpot layer's role and relationships |

### Project Navigation

| Command | Description |
|---------|-------------|
| `/structure` | Conversational onboarding — generate flows/screens from brief files |
| `/flow [name]` | Show or switch active flow |
| `/flows` | List all tracked flows |
| `/checkout <flow>` | Switch to a flow and load its context |

### Skills & Tokens

| Command | Description |
|---------|-------------|
| `/skill list\|show\|add\|new\|enable\|disable` | Manage AI skills |
| `/token pull\|push\|show\|diff` | Design token operations |

### Session & History

| Command | Description |
|---------|-------------|
| `/status` | Current flow, boards, Penpot connection, tokens |
| `/context` | Show mode, model, project root |
| `/memory` | Loaded skills and token counts |
| `/usage` | Token usage and estimated cost |
| `/history` | List or load past conversations |
| `/compact` | Compress conversation history to save tokens |
| `/log [n]` | Show recent conversation turns |
| `/pending` | List boards awaiting approval |
| `/approve <flow>` | Promote pending board to context |

### Misc

| Command | Description |
|---------|-------------|
| `/help [command]` | Detailed help for any command |
| `/clear` | Clear the terminal |
| `/exit` | Save session and quit |
| `/vim` | Toggle vim modal editing |
| `/keybindings` | Show keyboard shortcuts |
| `/bug` | Open a pre-filled GitHub issue |

## The `/create` Pipeline

The core design generation flow:

```
Description ──► Prompt Assembly ──► Claude (tool_use) ──► Post-Process ──► Validate ──► Preview ──► Penpot
                     │                    │                    │              │           │           │
              system prompt +      LayoutSpec JSON      4px grid snap    Zod schema   ASCII tree   Plugin JS
              skills + tokens +    via structured       min 32px touch   + business   renders      (flex/grid)
              component patterns   output tool          fill text defaults  rules      the spec
```

1. **Prompt Assembly** — System prompt with LayoutSpec schema, design principles, component pattern library (11 patterns), active skills, and detected layout template
2. **Generation** — Claude returns a structured `LayoutSpec` via `tool_use` for reliable JSON extraction
3. **Post-Processing** — Snap to 4px grid, enforce 32px minimum for interactive elements, fill text defaults, warn on low contrast
4. **Validation** — Zod structural validation + business rules (token refs, naming conventions, layout requirements)
5. **Preview** — ASCII tree preview in the terminal
6. **Push** — User chooses: push to Penpot, edit, regenerate, save spec, or quit

## `@reference` System

Pull external context into any AI command:

```bash
# Local files
/ask "explain this" @src/components/Button.tsx

# Entire folders
/ask "summarize the brief" @briefs/

# Penpot boards
/ask "what's wrong with this layout?" @penpot:Dashboard/Home

# Penpot shortcuts
@penpot:selection          # Currently selected shapes
@penpot:tokens             # Design tokens
@penpot:components         # Component library
@penpot:page/Dashboard     # All boards on a page

# Images
/ask "recreate this" @image:mockup.png
```

## Configuration

### Precedence

```
Environment variables  >  Project config  >  Global config  >  Defaults
```

### Config Files

```
~/.vectis/config.json          # Global (API key, default model)
<project>/.vectis/config.json  # Project (Penpot file, MCP URLs, model override)
```

### Global Config

```json
{
  "anthropicApiKey": "sk-ant-...",
  "defaultModel": "claude-sonnet-4-20250514",
  "globalSkillsDir": "~/.vectis/skills"
}
```

### Project Config

```json
{
  "penpotFileId": "...",
  "penpotFileUrl": "http://localhost:9001/...",
  "mcpServerUrl": "http://localhost:4401/mcp",
  "wsServerUrl": "ws://localhost:4402",
  "model": "claude-sonnet-4-20250514"
}
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API key (highest precedence) |
| `VECTIS_DEBUG` | Set to `1` for verbose logging |

## Project Structure

```
src/
  index.ts              # Entry point
  constants.ts          # Version, defaults, limits
  types/                # VectisError, Config, ReplState, SessionContext
  config/               # Layered config loading + Zod schemas
  ai/                   # Claude client (streaming + tool_use), retry, RAG, prompts
  bridge/               # Penpot MCP client + WebSocket listener
  references/           # @file, @folder, @penpot, @image resolver + security
  workspace/            # Context assembler (system prompt + refs + skills)
  graph/                # SQLite graph store, migrations, CRUD
  conversation/         # Store, compactor, history
  generation/           # Spec pipeline: generator → postprocess → validator → renderer
  structure/            # /structure analyser, conversation, writer, differ
  skills/               # Registry, loader, installer
  context/              # Event processor, pending queue
  utils/                # Logger, spinner, platform, JSON output
  repl/
    theme.ts            # Truecolor purple palette (6 shades)
    banner.ts           # ANSI-shadow gradient banner
    prompt.ts           # Mode/flow/stream indicators
    session.ts          # REPL loop, readline, slash dispatch
    commands/           # 30+ slash command handlers
    ...                 # vim-mode, paste-mode, completer, keybindings, signals
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript (strict, NodeNext) |
| AI | [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) |
| Penpot Bridge | [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) + WebSocket |
| Database | bun:sqlite (WAL mode) |
| Validation | [Zod](https://zod.dev) |
| Testing | [Vitest](https://vitest.dev) |
| Terminal | [picocolors](https://github.com/alexeyraspopov/picocolors) + truecolor ANSI |

## Development

```bash
# Start dev REPL
bun run dev

# Run tests
bun test

# Type check
bun run lint

# Build for distribution
bun run build
```

## Workspace Layout

When you run `/init` and `/structure`, Vectis creates this in your project:

```
your-project/
├── briefs/                  # Your messy input files
├── .vectis/
│   ├── config.json          # Project config
│   ├── graph.db             # SQLite graph store
│   ├── skills/              # Project-local skills
│   └── conversations/       # Session history
├── context/
│   ├── project.md           # Generated by /structure
│   ├── flows/               # Flow definitions
│   ├── screens/             # Screen definitions
│   └── tokens.json          # Design tokens
├── specs/                   # Saved LayoutSpec files
└── exports/                 # CSS/Tailwind token exports
```

## License

MIT

---

<p align="center">
  Built by <a href="https://github.com/dinethlive">@dinethlive</a>
</p>
