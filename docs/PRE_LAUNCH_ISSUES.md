# Pre-Launch Issues

本文件记录“不阻塞当前运行，但必须在下一次正式上线前统一判断和处理”的问题，尤其是 Vercel / npm / build log 中出现的 warning、deprecated dependency、peer dependency conflict 和上线准备风险。

## 使用规则

- 任何 build、deploy、migration、seed、邮件、存储、DNS 或第三方服务配置中出现的非阻塞 warning，都要记录到这里。
- 每条问题必须写明：来源、影响判断、是否阻塞当前上线、下次上线前动作、验证命令。
- 问题解决后不要删除，改为 `Fixed`，并补充解决 commit / 日期 / 验证结果。
- 如果决定暂缓处理，必须标为 `Deferred` 并写明原因。

状态：

- `Open`：尚未处理，下次上线前需要复查。
- `Fixed`：已处理并验证。
- `Deferred`：已评估但明确延期。

## Open

### PLI-2026-05-27-001 - Independent DB import/approve smoke not rerun in current shell

Status: `Open`

Source: 2026-05-27 local pre-launch closure.

Current impact:

- Local architecture guards, typecheck, lint, unit/integration tests, build, e2e, and crawler limit smokes can be verified locally.
- `TEST_DATABASE_URL` is not set in the current shell or `.env`, so the DB-backed CourseImportWorkflow create pending / approve effect check cannot be rerun without risking development or production data.

Next action before next launch:

1. Configure an isolated PostgreSQL database whose name clearly includes `test`.
2. Run the DB-backed integration suite:

```bash
TEST_DATABASE_URL="postgresql://..." npm run test -- tests/integration/course-import-workflow.integration.test.ts
```

3. Run a 2023 `limit=1` programme handbook JSON through CourseImportWorkflow create pending / approve and verify BNBU school, FBM faculty, ACCT major, ACCT2003 course, curriculum rule, and `2026-Fall` Programme Plan board effects.

Blocking current local commit: `No`

Required before next production launch: `Yes`

### PLI-2026-05-27-002 - Deployed crawler serverless parser trace still needs post-redeploy proof

Status: `Open`

Source: 2026-05-26 production crawler failure and 2026-05-27 local closure.

Current impact:

- Local crawler smokes prove the scripts and PDF parser dependencies work in this workspace.
- The original failure happened inside Vercel serverless under `/var/task`, so the final proof is a deployed retry after this commit is redeployed.

Observed production failure:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'pdfjs-dist' imported from /var/task/scripts/bnbu-crawler/run-handbook-preview.mjs
```

Next action before next launch:

1. Redeploy the commit that contains the crawler tracing and architecture guard changes.
2. In the deployed admin/crawler UI, run `programme_handbook` for `2023 limit=1`.
3. Run `programme_handbook` for `2025,2024,2023 limit=1`.
4. Confirm there is no `ERR_MODULE_NOT_FOUND` for `pdfjs-dist` or `pdf-parse`, and confirm the output files belong to the current job.

Blocking current local commit: `No`

Required before next production launch: `Yes`

### PLI-2026-05-27-003 - Production env, email, admin bootstrap, and manual acceptance remain external launch checks

Status: `Open`

Source: 2026-05-27 local pre-launch closure.

Current impact:

- Local automated e2e covers the main student/admin/demo smoke surface.
- Production-only dependencies still require manual verification in Vercel, Neon, Tencent SES, object/file storage, DNS/host routing, and real browser sessions.

Next action before next launch:

1. Complete the production environment checklist in `docs/ENVIRONMENT_VARIABLES.md`.
2. Confirm Neon migrations and admin/bootstrap account setup.
3. Verify Tencent SES registration and password-reset email delivery with debug code responses disabled.
4. Run the manual acceptance flows in `docs/ACCEPTANCE_CHECKLIST.md`: registration/login, admin access, profile upload preview, course search/join, Course Board post, TeamUp Interest, Follow Request, support ticket, announcements, and version checkpoint/restore.

Blocking current local commit: `No`

Required before next production launch: `Yes`

## Resolved History

### PLI-2026-05-25-001 - Vercel build dependency warnings

Status: `Fixed`

Source: 2026-05-25 Vercel production build log.

Current impact:

- Build 已成功，当前不判断为运行时阻塞问题。
- `@types/node` peer dependency warning 已通过升级到 Node 22 peer range 内版本解决。
- ESLint 8 deprecated warning 仍存在，但 `eslint-config-next@14.2.18` peer range 是 `^7.23.0 || ^8.0.0`；在 Next 14 项目中直接升 ESLint 9 风险高于收益，因此延期到 Next/ESLint 工具链升级窗口。

Observed warnings:

```text
npm warn ERESOLVE overriding peer dependency
While resolving: vite@8.0.14
Found: @types/node@22.10.2
peerOptional @types/node@"^20.19.0 || >=22.12.0" from vite@8.0.14

npm warn deprecated rimraf@3.0.2
npm warn deprecated inflight@1.0.6
npm warn deprecated eslint@8.57.1
npm warn deprecated @humanwhocodes/config-array@0.13.0
npm warn deprecated @humanwhocodes/object-schema@2.0.3
npm warn deprecated glob@7.2.3
```

Interpretation:

- `@types/node@22.10.2` is below Vite 8's peer range for Node 22; this is a type package mismatch, not runtime Node itself.
- `eslint@8.57.1` is deprecated; related `@humanwhocodes/*`, `rimraf@3`, `glob@7`, and `inflight@1` warnings are likely direct or transitive toolchain dependencies.
- These should be handled as dependency hygiene before the next launch cycle, not as emergency production rollback items.

Original next action before next launch:

1. Keep `@types/node` at `22.12.0` or newer.
2. Revisit the ESLint/rimraf/glob/@humanwhocodes warnings when upgrading Next.js or replacing `next lint`.
3. Re-run full verification after any future lint toolchain change:

```bash
npm run prisma:validate
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Resolution notes, 2026-05-26:

- Upgraded `@types/node` to `22.19.19`.
- Upgraded Next.js / `eslint-config-next` to `16.2.6` and ESLint to `9.39.4`; `npm run lint` now uses flat config through `eslint.config.mjs`.
- Replaced the vulnerable `xlsx` dependency with `read-excel-file`, and pinned `uuid` through npm overrides so TencentCloud SES resolves to `uuid@11.1.1`.
- `npm audit --omit=dev --registry=https://registry.npmjs.org --json` reports zero vulnerabilities.
- Verification passed: `npm run prisma:validate`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build`.

Blocking current deploy: `No`

Required before next production launch: `No, fixed`

### PLI-2026-05-26-001 - Next 16 Turbopack NFT tracing warning

Status: `Fixed`

Source: local `npm run build` after upgrading to Next.js `16.2.6`.

Observed warning:

```text
Turbopack build encountered 1 warnings:
./next.config.mjs
Encountered unexpected file in NFT list
Import trace:
  App Route:
    ./next.config.mjs
    ./app/api/[...route]/route.ts
```

Current impact:

- Production build succeeds and emits the expected route manifest.
- The warning is caused by the unified API route containing crawler/import artifact filesystem paths and child-process startup logic. Runtime paths are still validated before file download, and production crawler writes to `/tmp/teamaking`.
- This was not a functional blocker, but keeping the deploy log warning-free is preferable before production redeploy.

Resolution notes, 2026-05-26:

- `npm run build` now uses `next build --webpack`, avoiding the Turbopack NFT tracing false positive for the large catch-all API route.
- Migrated `middleware.ts` to `proxy.ts`, matching the Next 16 file convention.
- Updated route/page params and `cookies()` access for Next 16 async APIs.
- Re-ran:

```bash
npm run typecheck
npm run build
npm run test:e2e
```

Blocking current deploy: `No`

Required before next production launch: `No, fixed`
