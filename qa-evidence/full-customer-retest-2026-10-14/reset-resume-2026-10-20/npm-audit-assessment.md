# npm audit assessment

`npm audit --json` exits 1 with 3 high package findings. `npm audit --omit=dev --json` exits 0 with 0 findings. The affected chain exists only under the direct development dependency `vite-plugin-singlefile`.

## Advisory

- Name: `braces vulnerable to stack-exhaustion denial of service through deeply nested patterns`
- ID: `GHSA-vfj7-8cjw-p6xm`
- CWE: `CWE-674`
- CVSS: 7.5 high
- Affected range: `braces <=3.0.3`
- Installed chain: `vite-plugin-singlefile@2.3.3` (direct dev dependency) > `micromatch@4.0.8` (transitive) > `braces@3.0.3` (transitive)
- npm propagates the single advisory through the chain and reports 3 high package findings: `braces`, `micromatch`, and `vite-plugin-singlefile`.

## Exposure and risk

- Production dependency audit is clean: 0 vulnerabilities with `--omit=dev`.
- `vite-plugin-singlefile` is declared in `devDependencies`, so the vulnerable chain is used by local/CI build tooling and is not shipped as a production runtime dependency.
- Advisory requires a deeply nested pattern processed by `braces`. Pagecraft runtime is not exposed through this dependency chain. Build or CI availability is the relevant risk if untrusted input can reach glob/pattern processing in this tooling.
- No exploit test was run. Assessment is based on npm's dependency tree, advisory metadata, and production-only audit.

## Available fix

- `npm audit fix --dry-run --json` proposes `vite-plugin-singlefile 2.3.3` to `2.3.4`, within the current direct range `^2.3.3`.
- Proposed tree removes `micromatch@4.0.8`, `braces@3.0.3`, and four related transitive packages; it also changes `picomatch 4.0.5` to `4.0.7`.
- Dry run exits 1 because it reports the current audit state. It leaves `package-lock.json` byte-exact: SHA-256 `821cbbc5008e3a211eef5b1d1b8534a64affb991558f22bbf708c69a120b9bd5` before and after.
- No dependency or lockfile changes were made.

Raw evidence: `npm-audit.json`, `npm-audit-omit-dev.json`, `npm-audit-tree.json`, `npm-audit-fix-dry-run.json`, and matching `.exit` or status files.
