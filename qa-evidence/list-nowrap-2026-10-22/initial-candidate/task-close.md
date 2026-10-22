# Task close — List No-wrap local scrolling candidate

Date: 2026-10-22, Asia/Manila. Isolated checkout: list-nowrap-33ed365. Base is recorded exactly in verification.json.

Status: implementation and focused/static checks complete; ready for root review and builds. No rendered acceptance claimed.

Native root reproduced18 bound factory cards after Mobile No wrap save/reload: computed card width1.28px, grow/shrink/basis100/1/100%, List client363/scroll385 and page403/scroll405. Before evidence remains in the separate motion-validation-2aedc6d checkout under qa-evidence/list-nowrap-2026-10-22. Wrap is responsive CSS flex-wrap, not props.wrap.

Core now emits private List fallback variables with the same selector/breakpoint/state precedence as each Wrap declaration. No wrap defaults to local overflow-x:auto, min-width0/max-width100% and nonshrinking direct cards. Wrap restores ordinary defaults. Low-specificity root fallback declarations preserve explicit overflow/min/max; direct-child shrink uses base Column specificity and appears before authored node/class styling, preserving explicit flex/shrink/basis. Each List resets private variables, isolating nested Lists. Slider is excluded from these fallback selectors. No fixed card-width migration, generic Column/Row/Box rule change, global clipping or new Slider behavior.

Potentially nowrap ordinary Lists expose a named group and tabindex0 for keyboard scrolling. Node/class/state and component definition/instance sources are considered. A list can keep this focus stop when a wider breakpoint wraps; this is deliberate without adding runtime focus toggling. Custom CSS flex-wrap outside that structured model is not inferred; authored custom overflow remains a higher-priority declaration.

Eight new compiler/cascade cases produce six RED failures and two unaffected passes, then all eight pass. Related List default/Slider/controls/Core suites pass670 cases in four files. Typecheck exits0 and diff check passes. Tests verify active responsive CSS and variables separately because jsdom cannot resolve variable geometry. Factory Mobile card basis100% and grow100 remain; fallback shrink becomes0. The existing Slider factory Mobile basis remains100% rather than inventing an80% requirement. Explicit overflow, authored max/min, childflex0 1 42%, responsive classes, nested resets, save/restore without private data migration, and nonList Box isolation are covered.

The mechanical detector reports one pre-existing source-comment example containing <img onerror> (HEAD5403), not rendered UI. Initial test import typing was corrected using the repository's createRequire jsdom pattern; final typecheck passed. All logs are retained.

Only app/src/core/index.ts and tests/list-nowrap-scroll.test.ts changed, plus this bounded evidence directory. Source/test hashes are frozen in source-tests.sha256. No builds, full suite, browser, Main, commits, pushes or deployment. Root owns integration and native verification: actual widths/no page overflow, useful first/last card reachability, keyboard/touch/RTL, nested parents, authored overflow/classes, responsive Wrap and unchanged Slider. Work time unknown; billing not prepared.

## Reviewed build handoff

Root accepted the scoped source and official WordPress golden regeneration. The original standalone flex-wrap rule shape remains intact; fallback variables are emitted in a separate same-specificity rule. Added class-focus and component-root cases bring the new test suite to10 cases. Existing focused final checks passed39 cases; failed-file rerun passed79 cases.

The first full run failed the exact Wrap rule assertion, the expected signed golden and a gateway-db10s startup hook. Those logs remain. After the rule-shape repair and authorized golden update, the complete suite passes251 files/2,630 tests, with2 files/5 tests skipped; build-order/typecheck pass, duration114.21s. Two complete correct-order builds produce11 identical artifact hashes. Root reviewed the semantic golden delta: route CSS plus derived route hashes and signed envelopes only; HTML/entities/forms/assets/schema remain unchanged. Before/after fixtures, field paths, decoded envelope changes and CSS diffs are saved.

Read-only audit reports two moderate entries in unchanged Vitest4.1.11/@vitest/mocker, advisories GHSA-qxg6-89mg-rqv8 and GHSA-xp26-3454-mjgp. Root explicitly kept dependency remediation separate. Audit is not green; shared dependencies were not mutated.

Fresh fictional harness: http://localhost:4992/edit/s1, PID88212/session66551. It copies committed tools/qa-ui.mjs with port-only substitution and starts after final builds. Served assetf9d47efbfc96abd3c6b2c7ab0b102eb2ac0ebe7ca971aa358d0e5e23e9b65780 matches final index-derived bytes exactly. Current17 source/test/reference/artifact entries are frozen. Other ports/fixtures remain untouched. Native geometry and scrolling, authored/class overrides, responsive Wrap, keyboard/touch and final acceptance remain root-owned gates. No staging or production claim.
