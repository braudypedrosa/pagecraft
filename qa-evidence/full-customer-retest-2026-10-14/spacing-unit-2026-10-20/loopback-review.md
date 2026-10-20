# Loopback visual review handoff

- Harness: `node tools/qa-ui.mjs`
- Contract: isolated loopback-only diagnostic app; fictional in-memory accounts and data; no Supabase, SMTP, production credentials, or hosted writes; data resets on restart.
- Candidate root: `/private/tmp/pagecraft-spacing-unit-08-vvkcOR`
- Base revision: `08b9820890082c86b6a222a71fffd8f7c55c2971`
- Candidate `builder.html` SHA-256: `84fe4198158862580536bda0dc76b202436b35ffd880be407063a9561285bc84`
- Served `index.html` SHA-256: `64d1820de841475f547ffcc4fcbd03c3d6e9a1fe5d07213ea8ee096bea0fa469`
- Fixture: `s1`, QA Foundations; finite fictional fixture from `tools/fixtures/ui-site.ts`
- Exact editor URL: `http://127.0.0.1:4944/edit/s1`
- Health check: HTTP 200 for `/` and `/edit/s1`
- Listener PID at handoff: `19700`
- Shutdown command: `kill -TERM 19700`

Server remains running for root built-in browser inspection. No browser was opened by this task.
