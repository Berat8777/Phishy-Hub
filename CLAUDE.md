# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repo is an early-stage scaffold — there is no application source code yet. `api/` contains only `package.json`, `package-lock.json`, and `node_modules`; there is no `index.js`, `src/`, routes, models, or tests, even though `package.json`'s `main` field points at `index.js`. Treat the "Architecture" section below as the stack implied by installed dependencies and `docker-compose.yml`, not as existing structure — verify before assuming any feature is implemented.

## Commands

- Install API dependencies: `cd api && npm install`
- Start backing services (Postgres + MinIO): `docker-compose up -d` (from repo root)
- No start/build/lint scripts are defined yet. `npm test` in `api/` is still the default placeholder (`Error: no test specified`, exits 1) — there is no real test suite to run.

## Architecture (implied by dependencies, not yet built)

- `api/` is a Node.js backend built on Express 5 (`express`, `cors`, `dotenv`).
- `jsonwebtoken` + `bcrypt` imply JWT-based auth with hashed passwords.
- `sequelize` + `pg`/`pg-hstore` imply a Sequelize ORM layer over PostgreSQL.
- `socket.io` implies planned realtime/WebSocket functionality.
- No `.env` file exists yet; `dotenv` is installed, so one will need to be created for DB/MinIO credentials and any secrets (e.g. JWT signing key).

## docker-compose.yml services

- `postgres` (postgres:15-alpine) — db `phishy_hub`, user `phishy_user`, exposed on `5432`.
- `minio` — S3-compatible object storage, API on `9000`, console on `9001`.

Both use hardcoded dev credentials in `docker-compose.yml` — fine for local dev, but don't reuse them anywhere real.
