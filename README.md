# Phishy Hub

A fully-built internal ERP + team chat + AI assistant platform, built and manually verified end-to-end as a single-developer demo project — not hardened for production deployment (dev-only hardcoded credentials throughout, see `docker-compose.yml`/`.env.example`). Express backend with real-time Socket.IO, PostgreSQL persistence, S3-compatible file storage, JWT auth with role-based access control, and an AI-powered code assistant with semantic search.

## Architecture

The system spans 7 modules across four client implementations:

1. **`api/`** — Express 5 + Sequelize backend. JWT auth (access+refresh rotation), RBAC (employee/developer/sales/hr/admin), MinIO file storage, real-time chat via Socket.IO, leave/HR management, ticket/Kanban boards, and AI RAG code assistant. Authoritative contract: [`api/CONTRACT.md`](api/CONTRACT.md).
2. **`web/`** — Vue 3 + Vite + TypeScript SPA. The main desktop client: chat, boards, HR/leave, admin panels, AI assistant.
3. **`packages/design-system/`** — Shared Vue component library + design tokens, used by `web/`.
4. **`desktop/`** — Electron wrapper around `web/`'s build output (system tray, native notifications, custom `app://` protocol handler).
5. **`mobile/`** — Expo/React Native/TypeScript client. Auth, channels, chat, attachments, biometric login, push notification infrastructure.
6. **Module 7** — AI RAG assistant. Lives in `api/src/services/ai/` (indexing, retrieval, generation) + `web/src/features/ai/` (UI panel). Works offline with a stub provider; upgrade to real Claude or Gemini by setting a single env var.

The API publishes a versioned REST contract (`/api/v1/*`) + a Socket.IO real-time layer, both at the same host/port. Postgres uses pgvector for embeddings; MinIO provides S3-compatible file storage. Demo data is fully seeded.

## Quick Start (single machine)

### Prerequisites

- Docker and Docker Compose (for Postgres + MinIO)
- Node.js 18+ and npm
- 500MB free disk space (for node_modules and Postgres/MinIO volumes)

### 1. Start backing services

```bash
cd c:\Users\berat\Desktop\PhishHub
docker-compose up -d
```

This starts Postgres (port 5433) and MinIO (API 9000, console 9001). Wait ~5 seconds for initialization.

### 2. Set up and run the API

```bash
cd api
npm install  # if not already done
npm run db:migrate
npm run db:seed
npm run dev
```

The API starts on `http://localhost:3000`. Verify health:

```bash
curl http://localhost:3000/health
# { "status":"ok", "db":"ok", "uptimeSeconds": ... }
```

### 3. Run the web client

In a new terminal:

```bash
cd web
npm install  # if not already done
npm run dev
```

The SPA starts on `http://localhost:5173`. Open it in your browser and log in.

### Demo Users

All demo users have password `Password123!`:

| Email | Role | Department |
|---|---|---|
| admin@phishyhub.local | admin | Engineering |
| hr@phishyhub.local | hr | Human Resources |
| dev1@phishyhub.local | developer | Engineering |
| dev2@phishyhub.local | developer | Engineering |
| sales1@phishyhub.local | sales | Sales |
| employee1@phishyhub.local | employee | Support |

**Note**: `dev1` is the manager of the Engineering department and will approve leave requests for team members in that department. Other departments have no manager and requests auto-escalate to HR.

### 4. (Optional) Run Electron desktop app

In a new terminal:

```bash
cd desktop
npm install  # if not already done
npm run dev
```

This wraps the Vue SPA and adds system tray, native notifications, and an `app://` protocol handler for deep linking.

### 5. (Optional) Run mobile client

In a new terminal:

```bash
cd mobile
npm install  # if not already done
npm start
```

Then follow the Expo prompts to open in Android emulator, iOS simulator, or web. For physical device testing, update `mobile/.env` to your dev machine's LAN IP (not `localhost`).

## AI Assistant Setup

**Out of the box**: The AI assistant works with zero configuration using an offline stub provider. Full feature set — channels, chat, retrieval, streaming — all functional. No cost, no API calls.

**Upgrade to real generation**:

1. Set one of these in `api/.env`:
   - `ANTHROPIC_API_KEY=sk-...` (uses Claude Sonnet; optional `ANTHROPIC_MODEL` and `ANTHROPIC_MAX_TOKENS`)
   - `GEMINI_API_KEY=AI_...` (uses Gemini Flash; optional `GEMINI_MODEL`)
   - **Both keys can be set; Claude is prioritized.**

2. Build the semantic search index:

```bash
cd api
npm run ai:index
```

This walks the repository, chunks source files, embeds them, and indexes them in Postgres. Takes ~30 seconds on first run. Runs with embedding model disabled if network unavailable (graceful degradation to lexical search).

3. No other code change needed — the app automatically detects the key and switches providers.

**Architecture**: Retrieval (semantic + lexical hybrid search) is decoupled from generation. Retrieval works offline (no API key needed); generation provider is swappable (`Claude` / `Gemini` / `stub`). Chat mentions (`@ai` or `<@00000000-0000-4000-8000-00000000a1a1>`) trigger async bot responses with citations.

## Distributed Demo (multi-machine LAN)

Run API and database on one machine, clients on others:

### On the API machine:

1. Update `api/.env`:
   ```
   MINIO_PUBLIC_ENDPOINT=<machine-ip>  (e.g. 192.168.1.100)
   MINIO_PUBLIC_PORT=9000
   CORS_ORIGIN=http://<client-ips>:*,http://localhost:*
   ```

2. Docker-compose, migrate, seed, and run API as normal. Ensure the machine's firewall allows inbound on ports 3000 and 9000.

### On each client machine:

**Web**:
```
VITE_API_BASE_URL=http://<api-machine-ip>:3000
VITE_SOCKET_URL=http://<api-machine-ip>:3000
```

**Mobile**:
```
EXPO_PUBLIC_API_BASE_URL=http://<api-machine-ip>:3000
EXPO_PUBLIC_SOCKET_URL=http://<api-machine-ip>:3000
```

**Desktop**: Update the Electron renderer's hardcoded API URL (currently `http://localhost:3000` in preload/config).

### Critical: MinIO Public Endpoint

Presigned download URLs embed the `MINIO_PUBLIC_ENDPOINT`. If clients can't reach it, file downloads fail. **On demo day, set it to the API machine's LAN IP** (not `localhost`).

## What's Built

- **✓ Authentication**: JWT access+refresh rotation, refresh token reuse detection (family-based revocation on suspicious activity), bcrypt password hashing.
- **✓ RBAC**: Five roles — `admin`, `hr`, `developer`, `sales`, `employee` — with resource-level enforcement (e.g., only message sender or admin can edit messages; only ticket assignee can close).
- **✓ Real-time messaging**: Channels (public/private), direct messages (group DMs, get-or-create semantics), thread replies, reactions (emoji with toggle idempotency), unread counts, typing indicators, presence (online/offline with grace period).
- **✓ Chat features**: Message search (lexical), file attachments, thumbnails (256×256 webp auto-generated for images), presigned download URLs with expiry.
- **✓ Leave management**: Two-stage approval chain (department manager → HR), auto-skip if no manager, leave balance tracking (entitled + carried-over), work-day calculation (Mon–Fri, cross-year splits).
- **✓ Tickets**: Creation, status workflow, assignment, priorities, comments, bulk listing with search, real-time updates.
- **✓ Meetings**: RSVP statuses (invited/accepted/declined/tentative), calendar view, notifications. (Not currently included in demo seed data.)
- **✓ File storage**: MinIO S3-compatible backend, automatic thumbnails for images, access control (uploader, admin, or message/ticket/meeting/leave-request member), soft-delete.
- **✓ AI assistant**: 
  - RAG pipeline: repo indexing (file walk, intelligent chunking by function/class/heading), semantic embeddings (local or skipped if unavailable), hybrid retrieval (pgvector + Postgres full-text).
  - Generation: Claude API (preferred), Gemini API (fallback), or offline stub.
  - Chat integration: `@ai` mentions + direct queries, streaming responses, citations with file path/line number.
  - RBAC: Configurable allowed roles (default: `developer`, `sales`, `admin`).
- **✓ Admin features**: User/department management (create, edit, soft-delete), user role/status changes, bulk notifications, AI indexing triggers.
- **✓ Test suite**: 87 tests across 10 test files (Vitest + real Postgres), covering auth, CRUD, authorization, socket.io, file I/O, leave approval chain, tickets, message features, AI file walker.

## Development Commands

### API

```bash
npm run dev              # Start dev server (watch mode, port 3000)
npm run build            # TypeScript compile
npm start                # Run built dist/server.js
npm run db:migrate       # Apply pending migrations
npm run db:migrate:undo  # Undo last migration
npm run db:seed          # Run demo seeder
npm run db:seed:undo     # Undo seeder
npm run ai:index         # Index repo for AI assistant (walk/chunk/embed)
npm test                 # Run vitest (87 tests)
npm run test:watch       # Run vitest in watch mode
```

### Web

```bash
npm run dev              # Vite dev server (port 5173, HMR enabled)
npm run build            # Vue TSC + Vite build (output: dist/)
npm run preview          # Preview production build locally
```

### Desktop

```bash
npm run dev              # Build TypeScript + launch Electron
npm run build            # Build TypeScript only
npm run package          # Package into installer (Windows NSIS / Mac DMG / Linux AppImage)
npm run typecheck        # TypeScript check (no emit)
```

### Mobile

```bash
npm start                # Expo dev server (QR code for simulator/device)
expo start --android     # Open in Android Emulator
expo start --ios         # Open in iOS Simulator
expo start --web         # Run in browser (limited)
npm run typecheck        # TypeScript check (no emit)
```

### Design System

```bash
npm run typecheck        # Vue TSC validation (components + tokens)
```

## Environment Variables

See `api/.env.example`, `web/.env.example`, and `mobile/.env.example` for full reference. Critical variables:

**API** (`api/.env`):
- `PORT=3000` — API listen port
- `DB_HOST`, `DB_PORT=5433`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — Postgres connection (see `docker-compose.yml`)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — JWT signing keys (min 32 chars, change for production)
- `CORS_ORIGIN` — Comma-separated list of allowed origins for Express CORS + Socket.IO
- `MINIO_INTERNAL_ENDPOINT`, `MINIO_INTERNAL_PORT` — How API talks to MinIO (localhost:9000 in dev)
- `MINIO_PUBLIC_ENDPOINT`, `MINIO_PUBLIC_PORT` — Baked into presigned URLs sent to clients (change to LAN IP for multi-machine demo)
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` — Optional; omit both for offline stub AI
- `AI_ALLOWED_ROLES` — Comma-separated roles allowed to use AI (default: `developer,sales,admin`)

**Web** (`web/.env`):
- `VITE_API_BASE_URL` — REST API base URL (e.g., `http://localhost:3000`)
- `VITE_SOCKET_URL` — Socket.IO server URL (same as API base URL)

**Mobile** (`mobile/.env`):
- `EXPO_PUBLIC_API_BASE_URL` — REST API base URL (must not be `localhost` for physical device)
- `EXPO_PUBLIC_SOCKET_URL` — Socket.IO server URL

## Database Migrations & Seeding

Migrations do **not** run automatically — run them explicitly before starting the API for the first time (already covered in Quick Start step 2 above):

```bash
cd api
npm run db:migrate           # Apply pending migrations
npm run db:migrate:undo      # Undo last migration
npm run db:migrate:undo:all  # Undo all migrations
npm run db:seed              # Load demo data (fails on duplicate-key if already seeded)
npm run db:seed:undo         # Clear demo data — run this before re-seeding
```

To reset demo data from scratch:

```bash
npm run db:seed:undo && npm run db:seed
```

The seeder creates:
- 1 organization
- 4 departments (Engineering with manager, others without)
- 6 demo users (roles above)
- 2 channels (#general, #engineering with appropriate members), 1 welcome message
- 6 sample tickets spread across all 4 statuses (open/in_progress/resolved/closed)
- 5 sample leave requests spread across the full approval lifecycle (pending/manager_approved/approved/rejected), plus their audit-trail reviews and a leave balance row per user

Meetings are modeled in the API (`meeting.model.ts`/`meeting.routes.ts`) but not currently seeded with demo data.

## Testing

Run the full test suite:

```bash
cd api
npm test
```

Tests use a separate test database (auto-setup via `vitest.config.ts`'s `globalSetup`), real Postgres (not mocked), and cover auth, CRUD, RBAC, socket.io, files, leave approvals, tickets, AI, and edge cases. All 87 tests pass.

## Troubleshooting

**API won't start**: Check `docker-compose ps` — Postgres and MinIO must be running. Verify ports (5433 for Postgres, 9000 for MinIO) aren't blocked.

**Web shows "API unreachable"**: Ensure `VITE_API_BASE_URL` matches the API's `CORS_ORIGIN` in `api/.env`. If running on different machines, set both to the API machine's LAN IP.

**File downloads fail**: Check `MINIO_PUBLIC_ENDPOINT` in `api/.env` — must be reachable by the client. On multi-machine setups, use the API machine's LAN IP, not `localhost`.

**AI assistant unavailable**: If `POST /ai/query` returns `503 AI_UNAVAILABLE`, the generation provider couldn't initialize. Set `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` and restart. Omit both to use stub provider (always works offline).

**Tests fail**: Ensure Postgres is running (`docker-compose ps`), DB is migrated (`npm run db:migrate`), and port 5433 is free.

## Architecture & Design Decisions

Refer to [`api/CONTRACT.md`](api/CONTRACT.md) for:
- Detailed REST endpoint specs (§3)
- Socket.IO event contract (§4)
- File upload/download flow (§5)
- RBAC rules (§1.4)
- Error codes and HTTP status mappings (§0)
- AI system architecture and generation provider selection (§3.12, §12)
- Demo seed data (§8)
- Known limitations and deviations from architecture docs (§9, §11, §12)

For component/token documentation, see `packages/design-system/src/`.

## License

ISC
