# TEAMAKING Desktop

TEAMAKING Desktop is an Electron shell for the live TEAMAKING website. The DMG / EXE exists so users can open TEAMAKING as a desktop app; product behavior, account data, bilingual copy, page relationships, and interaction logic are served by the deployed website.

## Documentation Boundary

- Shared with Teamaking main: all product functionality, business rules, API semantics, data concepts, bilingual copy, route behavior, Course Board / Teamaking Post / TeamUp Interest semantics, and production database behavior.
- Desktop-only: installer packaging, Electron window behavior, allowed-origin navigation, external-link handling, offline retry page, signing/notarization, and platform-specific install notes.
- README and `PROJECT_LOG.md` inherit the original Teamaking writing rules: describe background, implementation changes, verification, and remaining risks; release-impacting warnings must be recorded instead of left only in chat.

## Local Development

```bash
npm install
npm run desktop:dev
```

By default the Electron window loads:

```bash
https://teamingapp.org
```

For local or staging checks:

```bash
TEAMAKING_WEB_URL="http://localhost:3000" \
TEAMAKING_DESKTOP_ALLOWED_ORIGIN="http://localhost:3000" \
npm run desktop:dev
```

## Build DMG / EXE

```bash
npm run dist:mac
npm run dist:win
```

`dist:mac` creates a macOS DMG. `dist:win` creates a Windows x64 NSIS installer. Unsigned builds are expected to trigger Gatekeeper or SmartScreen warnings until Apple notarization and Windows code signing are configured.

## Runtime Model

- The app loads `TEAMAKING_WEB_URL`; it does not start a local Next.js server.
- It does not create SQLite databases, local accounts, local seed data, backups, imports, or local upload storage.
- Login uses the live website login page and production website session cookies inside Electron.
- Electron cookies are stored by the desktop app and are not shared with Safari or Chrome, so first launch may require logging in again.
- Same-origin user pages stay inside the desktop window; external URLs open in the system browser.
- `/admin`, `/admin-login`, and `/crawler` are not user-app destinations inside the desktop shell.
- If the website cannot load, the app shows a local retry page and does not serve cached product UI.
- While the app is open, unread website notifications that are eligible for email reminders are mirrored to macOS / Windows system notifications. Notification text, type, read state, and email preference rules all come from the live website.
- Clicking a system notification focuses the desktop window and opens the notification's same-origin `actionHref`; unsafe, external, admin, and crawler targets are blocked by the Electron main process.

## Git Split

This repository is intended to be published as `StariverKang/Teamaking-Desktop`.

- `origin`: desktop repository.
- `web-origin`: original website repository, used only for manual cherry-picking or comparison.
- Base tag: `desktop-base-2026-05-31`.
