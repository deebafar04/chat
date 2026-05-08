# AGENTS.md — `chat` repo

Guidance for Claude Code and other AI CLI agents working in this repository.

---

## Role in the Webroot

This repo is a **Next.js AI chat application** and the source of truth for:
- API key storage and management UI (canonical store: `localStorage['settings_api-keys']`)
- Provider and model registry (`lib/providers.ts` + `chat/keys/providers.js`)
- The embeddable key manager widget (`chat/keys/key-manager.js`)

It lives inside the webroot container at `webroot/chat/` alongside static-file repos (`team/`, `requests/`, `localsite/`, etc.) which are served at `localhost:8887` by a Python HTTP server. **This repo is NOT served by that Python server** — it requires its own Next.js process.

---

## Running from the Webroot

### Unified server (recommended for webroot development)

`chat/server.mjs` is a custom Node.js server that boots the chat Next.js app, prepares a chat-owned runtime copy of the `sanity/` submodule, starts that mounted Sanity Next.js site, and serves sibling webroot static repos from a single port — no separate Python server needed.

```bash
# 1. Install dependencies (first time only, or after pulling new commits)
pnpm --prefix chat install
bun --cwd sanity install

# 2. Start the unified server from the webroot root:
node chat/server.mjs               # → http://localhost:8888
PORT=8887 node chat/server.mjs     # → replaces the Python server

# Or via pnpm:
pnpm --prefix chat dev:webroot
```

The server loads `docker/.env` automatically from the webroot root before booting Next.js.
When `sanity/` is present, it prepares a derived runtime copy outside the submodule, starts the Sanity Next.js dev server on an internal port, and mounts it at `/sanity` on the same public host.

#### URL layout on the unified server

The **chat app occupies the root** — no path prefix:

| URL | Serves |
|---|---|
| `localhost:8888/` | chat home |
| `localhost:8888/chat` | chat list / new chat |
| `localhost:8888/chat/[id]` | a conversation |
| `localhost:8888/settings` | settings |
| `localhost:8888/chat/keys/` | standalone key manager widget |
| `localhost:8888/sanity/` | Sanity frontend |
| `localhost:8888/sanity/admin` | Sanity Studio |
| `localhost:8888/localsite/…` | `localsite/` static files |
| `localhost:8888/team/…` | `team/` static files |
| `localhost:8888/requests/…` | `requests/` static files |

Static repo paths (`/localsite/`, `/team/`, `/requests/`, `/realitystream/`, `/data-pipeline/`, `/home/`) are served directly from the filesystem before Next.js sees the request. `/sanity/*` is proxied to the Sanity Next.js app, and everything else goes to chat Next.js.

#### Why port 8888?

Port 3000 is used internally by the mounted Sanity dev server when you run `node chat/server.mjs`. Port 8887 is the existing Python static server. 8888 is the unified server default; set `PORT=8887` to replace the Python server entirely.

### Chat-only development (fastest)

For working exclusively on the Next.js app with Turbopack HMR:

```bash
cd chat && pnpm dev    # port 3000, Turbopack, no static repo serving
```

`lib/env-loader.ts` finds `docker/.env` at `../docker/.env` relative to `chat/`. No separate `.env` file inside `chat/` is needed.

### No-Supabase mode

If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are absent from the environment, the auth middleware is bypassed automatically. Pages load without login. DB-backed features (chat history, saved messages, admin config) will return errors, but the key manager, settings UI, and client-side features work normally.

For the full chat experience (conversation history, model config from DB, logging), Supabase Cloud credentials in `docker/.env` are required. Running a **local** Supabase instance is not required — the hosted project works directly.

### `pnpm build` and migrations

`pnpm build` runs DB migrations before building (`tsx lib/db/migrate && next build`). `pnpm dev` and `dev:webroot` do **not** run migrations. To apply migrations manually: `pnpm db:migrate`.

---

## Development Commands

```bash
pnpm dev          # Start dev server with Turbopack (preferred)
pnpm build        # Run DB migrations then Next.js build
pnpm start        # Start production server after build
pnpm lint         # Biome linter (not ESLint)
pnpm format       # Biome auto-format
pnpm type-check   # TypeScript check without emitting
pnpm test         # Vitest unit + integration tests
pnpm test:e2e     # Playwright end-to-end tests
```

Run in background when you need it running but want to keep the terminal:
```bash
# Unified webroot server (from webroot/):
nohup node chat/server.mjs > /tmp/chat-dev.log 2>&1 &

# Chat-only Turbopack dev (from webroot/ or chat/):
nohup pnpm --prefix chat dev > /tmp/chat-dev.log 2>&1 &
```

Check if already running: `lsof -ti:8888`

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| React | React 19 RC |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + `shadcn/ui` components |
| Linter/Formatter | **Biome** (not ESLint, not Prettier) |
| Package manager | **pnpm** (not npm, not yarn) |
| Database | PostgreSQL via Supabase |
| ORM | Drizzle ORM — schema in `lib/db/drizzle-schema.ts` |
| DB migrations | `lib/db/migrations/` — run with `pnpm db:migrate` |
| Auth | better-auth (`lib/auth/`) |
| AI SDK | Vercel AI SDK v5 (`@ai-sdk/*`) |
| Icons | Custom inline SVG in `components/icons.tsx` |

---

## Environment Variables

Loaded from `docker/.env` (relative to the webroot root, not this folder). Key variables:

```
ANTHROPIC_API_KEY     # Claude — for browser UX, not CLI
GEMINI_API_KEY        # Google Gemini
OPENAI_API_KEY        # OpenAI
XAI_API_KEY           # xAI (Grok)
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
POSTGRES_URL
BETTER_AUTH_SECRET
REQUIRE_AUTH          # optional — true/false to override host-based auth gate
```

The `lib/env-loader.ts` file handles reading these at runtime.

### Where to document new env vars

There is **no `chat/.env.example`**. The canonical sample env file for this app lives at the webroot root: **`../docker/.env.example`**. Add new variable placeholders and explanatory comments there, not inside `chat/`.

Agent behavior when adding a new env var example:

1. Add the placeholder + comment to `docker/.env.example`.
2. **Ask the user** whether the same placeholder should also be appended to `docker/.env` (the live config). Don't add it silently — the live file may already be populated and the user may want to set a real value rather than a placeholder.

---

## Key Architectural Patterns

### Icons

Two icon systems are in use — choose based on context:

| Context | Library | How to import |
|---|---|---|
| Sidebar tab row (`TABS` array in `app-sidebar.tsx`) | `lucide-react` | `import { BrainCog } from "lucide-react"` |
| Admin components (legacy) | `lucide-react` | same |
| All other components | Custom inline SVG in `components/icons.tsx` | `import { CheckCircleFillIcon } from "@/components/icons"` |

When adding a **new sidebar tab**, use `lucide-react` for visual consistency with the existing tab row. For everything else, add to or use `components/icons.tsx`.

The relevant check-mark icon for "key available" states is `CheckCircleFillIcon` (from `components/icons.tsx`).

### Storage
All browser-side key storage uses the `LocalStorageManager` singleton. Never write to `localStorage` directly from components — always go through the `storage` helper from `lib/storage/helpers.ts`:

```ts
import { storage } from "@/lib/storage/helpers";

storage.apiKeys.get("google")        // returns decrypted key or null
storage.apiKeys.set("google", key)   // encrypts and stores
storage.apiKeys.remove("google")     // deletes
```

Keys are stored encrypted in `localStorage['settings_api-keys']` using a non-extractable AES-GCM browser key held in IndexedDB (see `lib/storage/crypto.ts`).

### Database / Model Config
Provider and model configuration is stored in the `model_config` table. Queries are in `lib/db/queries/model-config.ts`. The DB seed is at `lib/db/migrations/0007_seed_data_model_config.sql`.

The **static provider registry** at `chat/keys/providers.js` must be kept manually in sync with the DB seed when models are added or removed.

### AI Providers
Provider implementations live in `lib/ai/providers/{google,anthropic,openai}/`. Each has agent variants (chat, document, mermaid, python, etc.). The resolver `lib/ai/chat-agent-resolver.ts` selects the right agent at runtime.

### Client vs Server API Calls
In this Vercel repo, the main chat goes through the app server because of architecture, not because browser JavaScript is inherently incapable of calling external APIs.

Within independent static widget folders (like chat/keys), you can add static javascript that calls provider APIs directly from browser JavaScript for some flows. The current chat path uses `/api/chat` because:

- the client intentionally sends the key to the app server: `components/chat.tsx`
- the server reads that header and runs the chat agent there: `app/(chat)/api/chat/route.ts`
- the agent code is explicitly server-only: `lib/ai/providers/google/chat-agent.ts`, `lib/ai/providers/google/agentConfigLoader.ts`
- the server path is tied into auth, DB saves, streaming, tool orchestration, and optional server env fallback key: `app/(chat)/api/chat/route.ts`

CORS is not the reason for Vercel's server-side emphasis. The chat repo already provide some browser-direct calls. The current chat implementation is server-mediated because that is how the app is structured. Whether a specific provider endpoint can be moved fully client-side depends on that provider's browser/CORS support and whether you are willing to move (duplicate) streaming, tools, auth checks, and persistence from the server-side folders.

Browser-direct calls include:

  - GitHub repo search/user repo fetch is done from client code with the PAT in the request header: chat/lib/github-components/github-context-
    integration.tsx
  - API key verification for Google/OpenAI/Anthropic is also client-side fetch code: chat/components/settings/settings-page.tsx, chat/lib/verification/
    google-verification-service.ts:24, chat/lib/verification/openai-verification-service.ts:22, chat/lib/verification/anthropic-verification-service.ts

### Left Sidebar Navigation

The sidebar (`components/app-sidebar.tsx`) has a top icon row defined in the `TABS` array. Each tab is a round icon button that switches the panel content below it. Current tabs (all icons from `lucide-react`):

| Tab `id` | Icon (`lucide-react`) | Label | Panel content |
|---|---|---|---|
| `sources` | `Library` | Sources | Repo checklist for RAG context selection |
| `chats` | `MessageSquare` | List Chats | Chat history (`SidebarHistory`) with New Chat and Delete All |
| `kb` | `BookOpen` | Knowledge Base | Suggested questions that pre-populate the chat input |
| `visibility` | `BrainCog` | AI Models & Keys | All provider models with availability indicators + key management (`KeyManagerPanel`) |

The `visibility` tab (formerly using `Lock`, label "Visibility") is being repurposed to show the full AI model list and key management UI — see `team/key/PLAN.md` Phase 3. The Private/Public visibility toggle moves into that panel alongside the model list.

> **New tabs** added to the `TABS` array should use `lucide-react` icons for visual consistency with the existing row.

### Components
- `components/ui/` — shadcn/ui primitives (Button, Card, Input, Sheet, Sidebar, etc.)
- `components/settings/` — settings page and all its sub-sections
- `components/key-manager/` — embeddable key manager (React + hook)
- `components/icons.tsx` — all icons for non-sidebar components; add new ones here

### Routing
App Router (`app/` directory). Route groups:
- `app/(chat)/` — main chat UI and its API routes
- `app/(auth)/` — authentication
- `app/api/admin/` — admin API endpoints
- `app/settings/` — settings page

---

## The `chat/keys/` Static Subfolder

`chat/keys/` contains a **vanilla JS embeddable key manager** served statically at `localhost:8887/chat/keys/` by the Python HTTP server — no Next.js build required.

```
chat/keys/
  index.html        # Standalone settings page, no build needed
  key-manager.js    # Vanilla JS widget (no React, no bundler)
  providers.js      # Static copy of provider + model registry
  style.css         # Widget styles
```

### Keeping `key-manager.js` in sync

**Whenever you update key management logic in the Next.js app, also update `chat/keys/key-manager.js`** to match. The two share the same `localStorage['settings_api-keys']` format and encryption scheme (`lib/storage/crypto.ts` logic is duplicated in vanilla JS in `key-manager.js`). Non-Next.js pages (`team/projects/index.html`, `requests/engine/`) embed this file via:

```html
<script src="/chat/keys/providers.js"></script>
<script src="/chat/keys/key-manager.js"></script>
```

The public API is `window.KeyManager`:
- `KeyManager.init(el, options)` — render full widget into a container element
- `KeyManager.get(providerId)` — returns decrypted key or null
- `KeyManager.set(providerId, value)` — encrypts and stores
- `KeyManager.has(providerId)` — boolean
- `KeyManager.remove(providerId)` — deletes
- `KeyManager.migrateFromLegacy()` — one-time migration from `aPro` / `${aiType}_api_key`

Changes that require a `key-manager.js` update:
- Any change to the `settings_api-keys` JSON format
- Any change to the encryption/decryption logic in `crypto.ts`
- Any new provider added to `providers.ts` / `providers.js`
- Any UX change to the key entry widget that should also apply in non-Next.js contexts

---

## Linting and Formatting

This project uses **Biome**, not ESLint or Prettier. Run before committing:

```bash
pnpm lint      # check
pnpm format    # auto-fix formatting
```

The Biome config is at `biome.json` in the repo root.

---

## Database Migrations

Migrations live in `lib/db/migrations/`. To create a new migration:

```bash
pnpm db:generate   # generate from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:studio     # open Drizzle Studio (visual DB browser)
```

The build script (`pnpm build`) runs migrations automatically before building.

---

## Testing

```bash
pnpm test              # all unit + integration tests (Vitest)
pnpm test:unit         # unit tests only
pnpm test:integration  # integration tests only
pnpm test:e2e          # Playwright end-to-end
pnpm test:coverage     # with coverage report
```

Tests live in `tests/`. Fixtures in `tests/fixtures/`.

---

## Git Workflow

- Do **not** commit automatically — only commit when the user explicitly asks
- Use `./git.sh push` from the webroot root (not from inside `chat/`)
- This repo is a **site repo** (in `.siterepos`), not a git submodule
