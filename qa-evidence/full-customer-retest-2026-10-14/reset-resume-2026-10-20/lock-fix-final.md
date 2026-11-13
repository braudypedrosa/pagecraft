# `vite-plugin-singlefile` lock fix verification

- `package.json` remains byte-exact with Main: SHA-256 `b74238c2cfaf4223a9c112a145f4fb912f7d34335feed93ed521e7d2f51cedf1`. Existing range remains `^2.3.3`.
- `package-lock.json` changed from SHA-256 `821cbbc5008e3a211eef5b1d1b8534a64affb991558f22bbf708c69a120b9bd5` to `5de93169a145b3ebaea1d325d281d0465bd9925dc7b13ab7ed57a4671adb06b5`. Both clean archives contain the exact updated lock.
- Exact lock delta: `vite-plugin-singlefile 2.3.3` to `2.3.4`; `picomatch 4.0.5` to `4.0.7`; removed `braces 3.0.3`, `micromatch 4.0.8`, nested `picomatch 2.3.2`, `fill-range 7.1.1`, `is-number 7.0.0`, and `to-regex-range 5.0.1`. No other package changed.
- `npm ci` passed in both archives with 0 vulnerabilities.
- Post-fix full suite passed with `npm test -- --maxWorkers=2`: 218 files passed, 2 skipped; 2,426 tests passed, 5 skipped. An earlier parallel-loaded run had one 30-second submissions timeout. A default-worker retry suffered broad machine-load timeouts and was interrupted; the bounded full retry passed.
- Both archives passed `npm run build`, `npm run build:editor-package`, and `node --experimental-strip-types tools/demo-site.mjs`.
- Both `npm audit --json` and `npm audit --omit=dev --json` exit 0 with 0 findings.
- Requested outputs: 10/11 byte-exact. `dist/demo/index.html` differs only in per-run generated IDs. Replacing each run's 77 generated ID tokens produces byte-exact HTML with normalized SHA-256 `f61c8595621b152dd71e39758854ff3e4b8ada9e91ecf69b310ea1f02f186f3e`.
- Both overlay source files remain byte-exact across Main and both archives. Main's protected 11 generated files remain 11/11 byte-exact against prior `protectedBefore` values.
- Main was not edited, built, tested, staged, or committed by this work.

Review `package-lock.diff`, `fix-final-verification.json`, `fix-demo-normalized-comparison.json`, post-fix audit JSON files, and `fix-one-npm-test-max2.log`.
