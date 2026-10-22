# List No-wrap and Preview keyboard: local acceptance

Native authoring reproduced unreadable collapsed cards in release88. List-only nonshrinking/local-scroll fallbacks and a named keyboard group now keep18cards reachable. Preview no longer sends ordinary editing shortcuts to hidden editor state. Authored sizing/overflow/padding retain precedence; Slider and wrapped layouts retain their own defaults.

The first candidate was rejected for Mobile ink overflow and Preview key interception. A4px follow-up was rejected on Desktop: clientHeight207/scrollHeight209. The final8px low-priority fallback passes actual Desktop215/215 and Mobile101/101 with no page overflow. Actual arrow keys reach the fully visible final card6239px from the start; native wheel input works. Grid/Slider switching, Next, responsive clearing, explicit padding and save/reload pass. No captured errors.

Final full suite:2634pass,5existing skips, exit0. Gallery30real interaction checks pass and24/24 captures match reviewed baselines. Two ordered buildpairs are identical. Touch gesture dispatch is unsupported; emulation/CPU cleanup is recorded. No physical-touch acceptance claim.

Local bounded slice accepted. Main integration, Cloud staging exact-marker acceptance and WordPress pin/guard acceptance remain pending. Full customer QA and production readiness remain open.
