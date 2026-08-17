# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project State

This is a **fully built** internal ERP + team chat + AI assistant platform across 7 modules, built and manually verified end-to-end (see §Testing) as a single-developer demo project — not hardened for production deployment (dev-only hardcoded credentials throughout, see docker-compose.yml/.env.example). All feature categories below are **implemented and tested**.

- `api/` — Complete Express 5 backend with real-time infrastructure, RBAC, file storage, AI RAG assistant.
- `web/`, `desktop/`, `mobile/` — Feature-complete clients.
- `packages/design-system/` — Shared Vue component library.
- `docker-compose.yml` — Postgres (pgvector) + MinIO, fully configured.
- 87 passing tests covering auth, CRUD, authorization, sockets, files, leave approval, tickets, AI.

**Do not treat this as a scaffold.** The `api/CONTRACT.md` is the authoritative live spec — if you're unsure what exists, read it rather than the architecture doc.

## Key Files

- **`api/CONTRACT.md`** — Authoritative REST contract + Socket.IO sockets + error codes. Read this before touching API code.
- **`api/package.json`** — Script definitions (`npm run dev`, `npm run db:migrate`, `npm run ai:index`, `npm test`).
- **`api/.env.example`** — All env vars with defaults; AI section is optional (stub provider works offline).
- **`docker-compose.yml`** — Postgres on port 5433 (host), 5432 (container); MinIO on 9000/9001.
- **`web/.env.example`**, **`mobile/.env.example`** — Client-side API base URL configs.
- **`packages/design-system/src/`** — Shared Vue components + design tokens (re-exported in `web/` via `@phishyhub/design-system`).

## Commands

### Database & Migrations

```bash
cd api
npm run db:migrate              # Apply pending migrations (Sequelize)
npm run db:seed                 # Load demo seeder (6 users, 2 channels, sample data)
npm run db:seed:undo            # Clear demo data
npm run db:migrate:undo:all     # Undo all migrations
```

### API Development

```bash
cd api
npm install                     # Install dependencies (first time only)
npm run dev                     # Start dev server on port 3000 (watch mode)
npm run build                   # Compile TypeScript → dist/
npm run start                   # Run dist/server.js (production)
npm test                        # Run 87 vitest tests (real Postgres, 10 test files)
npm run test:watch              # Watch mode for tests
npm run ai:index                # Index repo for AI assistant (walk/chunk/embed)
```

### Web Development

```bash
cd web
npm install
npm run dev                     # Vite dev server on port 5173 (HMR enabled)
npm run build                   # Build for production (dist/)
npm run preview                 # Preview prod build locally
```

### Desktop Development

```bash
cd desktop
npm install
npm run dev                     # Build TypeScript + launch Electron
npm run build                   # TypeScript compile only
npm run package                 # electron-builder (Windows NSIS / Mac DMG / Linux AppImage)
npm run typecheck               # TypeScript validation (no emit)
```

### Mobile Development

```bash
cd mobile
npm install
npm start                       # Expo dev server (QR code for emulator/device)
expo start --android            # Open Android Emulator
expo start --ios                # Open iOS Simulator
expo start --web                # Run in browser
npm run typecheck
```

### Docker Services

```bash
docker-compose up -d            # Start Postgres + MinIO (from repo root)
docker-compose down             # Stop services
docker-compose logs postgres    # View logs
docker-compose ps               # Check running services
```

## Architecture Overview

**API** (`api/src/`):
- `server.ts` — Express + Socket.IO setup, middleware (auth, rate-limit, CORS, helmet).
- `routes/` — REST endpoints (`/api/v1/*`). Auth, users, departments, channels, messages, files, leave, tickets, meetings, AI, notifications.
- `sockets/handlers/`, `sockets/broadcast.ts` — Real-time event handlers and room broadcasts.
- `services/` — Business logic. Auth (JWT + refresh rotation), channels, messages, files (MinIO), leave approval, tickets, notifications, AI (indexing/retrieval/generation).
- `services/ai/` — RAG pipeline:
  - `indexing.service.ts` — File walk, intelligent chunking, embedding (local HuggingFace model or skipped if unavailable).
  - `retrieval.service.ts` — Hybrid search (pgvector + Postgres tsvector), RRF fusion, adjacent-chunk merge.
  - `generation/` — Provider abstraction (Claude, Gemini, stub).
  - `aiMention.service.ts` — `@ai` chat mention handler.
- `models/` — Sequelize models (User, Channel, Message, File, LeaveRequest, Ticket, etc.).
- `database/migrations/`, `database/seeders/` — Sequelize migration files and demo data.
- `tests/` — 87 vitest tests using real Postgres (globalSetup auto-creates test DB).

**Web** (`web/src/`):
- `main.ts` / `App.vue` — Vue 3 app entry + root component.
- `router/` — vue-router config (named views, `meta.section`-based nav state, `roleGuard`).
- `layouts/` — `AppShell.vue` (post-login shell + icon rail), `AuthLayout.vue`.
- `features/` — Feature modules, each typically `views/` + `components/` (auth, chat, boards, hr, admin, ai).
- `components/shared/` — Cross-feature components (e.g. the global user-profile modal).
- `stores/` — Pinia state, one store per domain (auth, messages, channels, tickets, leave, ai, etc.).
- `api/` — REST client (`http.ts`, `tokenManager.ts`) + `endpoints/*.ts` wrappers.
- `socket/` — Socket.IO client; `eventBridge.ts` is the **sole** `socket.on()` call site — components/stores never call it directly.
- `lib/` — Cross-cutting helpers, notably `permissions.ts` (role-check helpers — no raw role-string literals in templates).

**Design System** (`packages/design-system/src/`):
- `components/` — Reusable Vue components (Button, Input, Card, etc.).
- `tokens/` — Design tokens (colors, spacing, typography).
- `styles/` — Global CSS (reset, token variables).
- `index.ts` — Module export.

**Desktop** (`desktop/src/`):
- `main.ts` — Electron main process (window, system tray, protocols).
- Wraps `web/dist/` (must build web first).

**Mobile** (Expo Router — no tab navigator; a linear auth-gated stack):
- `app/_layout.tsx`, `app/index.tsx` (auth-state gate: booting/locked/unauthenticated/authenticated), `app/login.tsx`, `app/unlock.tsx` (biometric unlock).
- `app/channels/index.tsx` (channel list), `app/channels/[channelId].tsx` (chat screen).
- `src/api/`, `src/socket/` — mirror `web/src/api`/`web/src/socket`'s conventions (SecureStore-backed tokens, single-flight refresh, callback-form socket auth).
- `src/auth/` — `AuthContext.tsx` + `biometrics.ts` (`expo-local-authentication`).
- `src/components/`, `src/hooks/`, `src/notifications/`, `src/config/`, `src/theme/`, `src/utils/`.
- There is currently no dedicated profile screen.

## Environment Variables

### API (`api/.env` or defaults from `.env.example`)

**Essential**:
- `PORT=3000`
- `DB_HOST`, `DB_PORT=5433`, `DB_NAME=phishy_hub`, `DB_USER=phishy_user`, `DB_PASSWORD=phishy_password`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (min 32 chars, change for production)
- `CORS_ORIGIN` (e.g., `http://localhost:5173,http://localhost:3000` for local demo)

**Optional but recommended**:
- `LOG_LEVEL=info` (or `debug` for verbose logging)
- `MAX_UPLOAD_SIZE_MB=25` (client-side reference, multer enforces on server)
- `SIGNED_URL_EXPIRY_SECONDS=900` (presigned download URLs)

**AI (all optional, omit both keys for offline stub provider)**:
- `ANTHROPIC_API_KEY=sk-...` (enables Claude generation; preferred)
- `GEMINI_API_KEY=AI_...` (enables Gemini generation; fallback)
- `AI_GENERATION_PROVIDER=auto` (`auto`, `stub`, `claude`, or `gemini`)
- `AI_INDEX_ROOT=` (repo path to index, defaults to repo root)
- `AI_ALLOWED_ROLES=developer,sales,admin` (roles allowed to use AI endpoints)
- `AI_RETRIEVAL_TOP_K=8`, `AI_CONTEXT_MAX_CHARS=24000` (tuning)

**MinIO**:
- `MINIO_INTERNAL_ENDPOINT=localhost`, `MINIO_INTERNAL_PORT=9000` (API → MinIO, single machine)
- `MINIO_PUBLIC_ENDPOINT=localhost`, `MINIO_PUBLIC_PORT=9000` (clients ← presigned URLs, **change to LAN IP for multi-machine demo**)
- `MINIO_ACCESS_KEY=minio_admin`, `MINIO_SECRET_KEY=minio_password123` (dev credentials, hardcoded in `docker-compose.yml`)

### Web (`web/.env`)

- `VITE_API_BASE_URL=http://localhost:3000` (REST + Socket.IO endpoint)
- `VITE_SOCKET_URL=http://localhost:3000` (alternatively separate Socket.IO URL, rarely needed)

### Mobile (`mobile/.env`)

- `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000` (use LAN IP for physical device, not `localhost`)
- `EXPO_PUBLIC_SOCKET_URL=http://localhost:3000`

## Demo Data

Seeded via `api/src/database/seeders/20260101000100-demo-seed.js`:

**Users** (password: `Password123!`):
| Email | Role | Department |
|---|---|---|
| admin@phishyhub.local | admin | Engineering |
| hr@phishyhub.local | hr | Human Resources |
| dev1@phishyhub.local | developer | Engineering (manager) |
| dev2@phishyhub.local | developer | Engineering |
| sales1@phishyhub.local | sales | Sales |
| employee1@phishyhub.local | employee | Support |

**Channels**: `#general` (public, all members), `#engineering` (private, admin+dev1+dev2), 1 welcome message.

**6 tickets** spread across all 4 statuses. **5 leave requests** spread across the full approval lifecycle, with audit-trail reviews. Meetings are modeled in the API but not seeded.

**Leave balances**: Each user has 20 annual leave days for the current year.

## Testing

```bash
cd api
npm test                        # Run all 87 tests (Vitest)
npm run test:watch              # Watch mode
```

**Test files** (10 total):
- `tests/auth.test.ts` — Register, login, refresh, logout, token rotation, reuse detection
- `tests/crud.test.ts` — User/department/channel/message CRUD
- `tests/authz.test.ts` — RBAC: message edit, ticket close, leave review, file access
- `tests/pagination.test.ts` — Offset + cursor pagination
- `tests/files.test.ts` — Upload, download (with presigned URL), attach, thumbnail generation
- `tests/sockets.test.ts` — Channel join/leave, message send/read, typing, reactions, presence
- `tests/messageFeatures.test.ts` — Reactions (toggle idempotency), threads (exclude from timeline, replies endpoint), DM get-or-create
- `tests/leaveApproval.test.ts` — Two-stage approval chain (manager → HR), auto-skip, overlap validation, balance
- `tests/ticketFeatures.test.ts` — Create/update/delete, search, comments, broadcast
- `tests/aiFileWalker.test.ts` — Indexing security (`.env` files never indexed), normal files indexed

Each test uses real Postgres (auto-created test DB via `globalSetup`). No mocking.

## CORS & Multi-Machine Setup

- Single machine: `CORS_ORIGIN=http://localhost:5173,http://localhost:3000` (API `.env`), clients use `http://localhost:3000`.
- Multi-machine demo: 
  - API machine: Set `CORS_ORIGIN=http://<client-machines>:*` (or specific IPs) and `MINIO_PUBLIC_ENDPOINT=<api-machine-ip>`.
  - Client machines: Set `VITE_API_BASE_URL=http://<api-machine-ip>:3000` (web) or `EXPO_PUBLIC_API_BASE_URL=http://<api-machine-ip>:3000` (mobile).
  - Electron (desktop): Update hardcoded URL in renderer/preload context.

## AI System Highlights

- **Zero-config stub provider**: Runs offline, no API keys required. Full feature set (retrieval, generation, streaming, citations) works. Stub generates replies from retrieved context deterministically.
- **Real providers**: Set `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` to switch. Claude preferred when both set.
- **Indexing**: `npm run ai:index` walks repo, chunks by function/class/heading, embeds locally (HuggingFace Xenova model, 384-dim), stores in pgvector. Gracefully degrades to lexical search if embedding model unavailable (e.g., no internet).
- **Retrieval**: Hybrid (vector + full-text), RRF fusion, 24KB context budget (tunable).
- **Chat mention**: `@ai <question>` or `<@00000000-0000-4000-8000-00000000a1a1>` (bot user ID) triggers async bot response with citations.
- **RBAC**: Default allowed roles are `developer`, `sales`, `admin`. Non-allowed roles get `403` on AI endpoints.

## Known Quirks & Decisions

(See `api/CONTRACT.md` §9, §11, §12 for detailed justifications.)

1. **Postgres port**: `docker-compose.yml` maps to 5433 (host) not 5432 due to existing container on implementer's machine. `api/.env` reflects this. Changeable if port 5432 free.
2. **Refresh token hash**: SHA-256, not bcrypt (high-entropy JWT input doesn't need slow hash).
3. **`User` defaultScope**: Hides `passwordHash` by default; separate `withPassword` scope for login.
4. **Presence broadcasts**: Sent org-wide (not room-scoped) to all connected clients.
5. **Reactions/Threads/DM get-or-create**: Later-added features. Thread replies excluded from main timeline to avoid duplication.
6. **Ticket/Meeting visibility**: No access restrictions (hereinafter authenticated users see all). Designed for small internal tool.
7. **`@ai` bot user**: Fixed ID `00000000-0000-4000-8000-00000000a1a1`, idempotent seeder upsert, never loginable, protected from admin delete.
8. **Migration down-direction**: Sequelize enum drops are unsupported by Postgres — `down()` migrations are documented no-ops for enum additions.

## Useful Patterns

### Add a new REST endpoint

1. Create route handler in `api/src/routes/` (or add to existing file).
2. Add service logic in `api/src/services/`.
3. If a socket broadcast is needed, wrap it in a local `safeBroadcast()` try/catch helper (precedent: `ticket.service.ts`, `services/ai/aiMention.service.ts`) so a broadcast failure never fails the underlying request.
4. Test in `api/tests/` with real DB and Postgres-specific assertions.
5. Update `api/CONTRACT.md` §3.x with endpoint spec.

### Add a new Socket.IO event

1. Handler in `api/src/sockets/handlers/`.
2. Emit via `socket.to()`, `io.emit()`, or `io.to('user:X').emit()` (see CONTRACT.md §4.3 for room semantics).
3. Client listens via `socket.on()` (web/mobile).
4. Broadcast from REST via `sockets/broadcast.ts` helper (safeguards socket layer absence).

### Modify AI retrieval/generation

1. Retrieval: `api/src/services/ai/retrieval.service.ts` (vector + lexical merge).
2. Generation: Provider class in `api/src/services/ai/generation/` (Claude / Gemini / Stub).
3. Selection logic: `api/src/services/ai/index.ts::getGenerationProvider()`.
4. Indexing: `api/src/services/ai/indexing.service.ts`, file walker at `api/src/services/ai/fileWalker.ts`.

### Edit a Vue component

Components live in `web/src/components/` (SPA layout/pages) and `packages/design-system/src/components/` (reusable). Design system components are tree-shaken at build.

### Test a feature

Run subset: `npm test -- --grep "leave approval"` (vitest grep filter). Tests auto-create test DB, run migrations, seed demo data, then clean up.

## Performance Notes

- **Pagination**: Offset (for lists) + cursor keyset (for messages) — mixed approach per §2 of CONTRACT.md.
- **Unread counts**: Single SQL query per channel list (not N+1) via `channel.service.ts::attachChannelListMeta()`.
- **File thumbnails**: Synchronous 256×256 webp generation on upload (sharp), baked into presigned URL response.
- **AI indexing**: Lazy — only run `npm run ai:index` when repo changed; incremental re-index copies embeddings for unchanged chunks.
- **Socket.IO**: Single process (no Redis), presence kept in memory. Works fine for ~50 concurrent users. Scale horizontally with Redis adapter if needed.

## References

- **API spec**: `api/CONTRACT.md` (definitive REST + Socket.IO contract)
- **Sequelize docs**: Schema in `api/src/models/`, migrations in `api/src/database/migrations/`
- **Vue 3 + Vite**: `web/` uses standard setup; see `web/vite.config.ts` + `web/tsconfig.json`
- **Electron**: `desktop/` wraps web build; see `desktop/src/main.ts` for ipc + protocol handlers
- **Expo/React Native**: `mobile/` uses Expo managed workflow; see `mobile/app/` for routing + components
- **Design tokens**: `packages/design-system/src/tokens/` (colors, spacing, typography — imported as CSS vars + TS objects)
