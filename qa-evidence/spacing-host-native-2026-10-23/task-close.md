# Spacer host retest, in progress

Cloud native height units px/rem/%/vw/vh, positive/zero/negative-clamp/decimal inputs were exercised through the builder. The temporary document was restored to Version1189 exactly.

The percentage case exposed an editor/Preview discrepancy:25% is10px in the editor's40px minimum-height Column, but0px in public Preview's indefinite auto-height parent. The authored rule is not lost. A fix needs layout and selection proof before changing the editor scaffold. See [issue](open-percent-height-parity.json) and [native measurement](cloud-spacer-percent-context.json).

This is not Spacer host acceptance. WordPress parity, reset and saved responsive host cases remain open. Full builder QA remains open. No source change was made for this issue yet.
