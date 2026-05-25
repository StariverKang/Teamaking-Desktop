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

### PLI-2026-05-25-001 - Vercel build dependency warnings

Status: `Open`

Source: 2026-05-25 Vercel production build log.

Current impact:

- Build 已成功，当前不判断为运行时阻塞问题。
- 主要影响开发工具链、类型检查、未来依赖升级稳定性。
- 下次正式上线前需要清理或重新评估，避免 warning 积累成真实 build failure。

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

Next action before next launch:

1. Upgrade `@types/node` to a version satisfying Vite's peer range, at least `22.12.0`.
2. Review ESLint / Next lint / Vitest compatibility before upgrading ESLint, because Next.js lint integration can be sensitive to major ESLint changes.
3. Run dependency install and commit both `package.json` and `package-lock.json`.
4. Re-run full verification:

```bash
npm run prisma:validate
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

5. Confirm the next Vercel build no longer contains this peer dependency warning; any remaining deprecated transitive dependency warnings should be re-listed here with updated package paths.

Blocking current deploy: `No`

Required before next production launch: `Yes`
