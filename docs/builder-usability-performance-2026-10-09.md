# Builder performance and preview readiness

9 October 2026. Local implementation; no staging or production deployment claimed.

## Implemented

- Private editor responses expose fixed `Server-Timing` phases for access, document, storage, WordPress targets, schedules and shell injection, alongside existing gateway timings and per-request `X-Request-ID`. No additional persistence calls, cache or authorization changes.
- Publication comparison frames show loading, displayed, degraded and timeout states with retry. The private snapshot HTML route accepts an optional `pcPreviewReady` value of exactly 32 hexadecimal characters. After initial images and fonts settle and two animation frames run, its script sends a token-correlated readiness message. Image/font failure or a 10-second deadline reports degradation; the parent validates the current token and emitting frame, with its own 15-second timeout.
- Snapshot authentication, opaque sandbox and CSP remain unchanged. Diagnostics never modify immutable snapshot bytes or public output. Readiness indicates initial rendering, not approval or publication.
- Working-draft canvas preview shows nonblocking rendering/image status and retry. Image readiness does not establish that every CSS background, embedded runtime or future lazy resource has succeeded.

## Isolated measurement

The same built editor and synthetic blank document were exercised through in-process Hono requests with memory stores. Each of five new application instances received one cold request and five warm requests. No network, browser, live account or external database was involved.

| Measurement | Baseline median / maximum | After instrumentation median / maximum | Samples per run |
|---|---:|---:|---:|
| App creation and shared-asset preparation | 53.704 / 58.980 ms | 55.906 / 62.934 ms | 5 |
| First request | 0.943 / 16.382 ms | 0.885 / 18.164 ms | 5 |
| Warm request | 0.161 / 0.457 ms | 0.165 / 0.510 ms | 25 |

These small differences are ordinary scheduling/JIT variation, not evidence of a speed improvement. Maximum is a sample maximum, not a production percentile. Asset preparation occurs at startup. The benchmark does not measure browser interaction, preview painting, save completion or gateway delay. A warm median under 1 ms and no extra remote round trip are proposed regression budgets for this specific local fixture only.

Reproduce from the repository root:

```sh
node qa-evidence/builder-usability-2026-10-09/performance/measure.mjs rerun.json
```

The output is saved beside the script and includes every sample, timing header, conditions and editor SHA-256. [Baseline](../qa-evidence/builder-usability-2026-10-09/performance/baseline.json) · [After](../qa-evidence/builder-usability-2026-10-09/performance/after.json) · [Detailed evidence](../qa-evidence/builder-usability-2026-10-09/performance/review.md).

## Unresolved live latency

The 7 October warm editor samples measured 1.32–1.41 seconds in the application, principally fresh authentication/membership followed by already parallel storage and WordPress reads. The 8 October public-serving trace measured 3.2–20.0 ms inside the application against 888–1,867 ms until client response headers. Neither reproduced the earlier 7–14-second public-serving tail. Its cause remains unresolved; a speculative filesystem cache or relaxed authentication is not supported by this evidence.

## Next matching-trace protocol

1. Verify the exact staging deployment and use an explicitly scoped disposable site. Keep the template/version, content, image/CMS fixture, browser, viewport and network conditions fixed; include a blank comparison fixture. Do not mutate shared records merely for timing.
2. Capture at least 20 visits with cold-cache and warm-cache runs recorded separately. Record request start, connection timing, response headers, `X-Request-ID`, complete `Server-Timing`, transfer bytes and cache state. Keep credentials, document content and session headers out of evidence.
3. Measure assets-ready, editor interactive, preview painted and acknowledged save separately. DOMContentLoaded and an iframe `load` event are insufficient substitutes. Use the built-in browser and record errors, retry behavior and the actual rendered state.
4. On a matching slow request, correlate application/gateway timings with hosting/proxy timing. Separate time before application entry from application execution and transfer. A faster average does not close an unreproduced tail.
5. Choose a remedy only from the correlated bottleneck, agree numeric journey budgets from the baseline, and repeat the identical protocol after the change. Report sample count, median and observed tail separately. Keep missing traces and unverified browser outcomes explicit.

Focused timing/readiness tests and TypeScript verification passed; the main task's verification record owns the final combined suite and rendered acceptance results.
