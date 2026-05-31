# TEAMAKING Desktop

TEAMAKING Desktop is a local-first desktop build of TEAMAKING. It keeps the product language and boundaries of the web app: Course Board, Teamaking Post, TeamUp Interest, and the separation between `course_catalog` course-library data and programme handbook curriculum rules.

## Documentation Boundary

- Shared with Teamaking main: product functionality, business rules, domain terms, API meaning, import semantics, course catalog / programme handbook boundaries, and user data concepts.
- Desktop-only: DMG/EXE packaging, Electron runtime, local SQLite storage, local account copy, backup/import UI, window behavior, offline status, desktop status bar, and other user-facing interaction/UI decisions.
- README and `PROJECT_LOG.md` inherit the original Teamaking writing rules: describe background, implementation changes, verification, and remaining risks; sync schema/API/domain-term changes to the right docs; record release-impacting warnings instead of leaving them only in chat.
- When changing both layers, record the shared product rule separately from the desktop presentation. The desktop presentation must not be treated as a requirement for the web app unless the web repository accepts the same change.

## Local Development

```bash
npm install
npm run desktop:dev
```

The desktop dev runner creates `.desktop-data/teamaking.db`, initializes the SQLite schema, seeds local workspace data, starts Next.js on `127.0.0.1`, and opens Electron.

Default local admin:

```text
local.admin@teamaking.desktop
teamaking-local-admin
```

## Build DMG / EXE

```bash
npm run dist:mac
npm run dist:win
```

`dist:mac` creates a macOS DMG. `dist:win` creates a Windows NSIS installer. Unsigned builds are expected to trigger Gatekeeper or SmartScreen warnings until Apple notarization and Windows code signing are configured.

## Data Model

- Runtime is marked with `TEAMAKING_RUNTIME=desktop` and `AUTH_MODE=local`.
- SQLite is used through `DATABASE_URL=file:<data-dir>/teamaking.db`.
- The app initializes SQLite from `desktop/sqlite-schema.sql`, generated from `prisma/schema.prisma`.
- Uploads, crawler outputs, course import artifacts, and backups live under `TEAMAKING_DATA_DIR`.
- The desktop app does not connect to the production website database or reuse website sessions.

## Backup

The desktop status bar exposes:

- Backup export: downloads a zip containing files under the desktop data directory.
- Backup import: restores a zip into the desktop data directory. Restart the app after importing a backup that contains database files.

## Git Split

This repository is intended to be published as `StariverKang/Teamaking-Desktop`.

- `origin`: desktop repository.
- `web-origin`: original website repository, used only for manual cherry-picking or comparison.
- Base tag: `desktop-base-2026-05-31`.
