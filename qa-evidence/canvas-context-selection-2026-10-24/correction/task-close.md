# Repeated CMS context correction

Status: source, deterministic builds and final ordinary suite verified. Native corrected right-click acceptance remains root-owned after deployment. Full builder QA remains open.

The initial multi-selection secondary-click return skipped repeated-item context. The corrected selected-secondary branch runs real rememberCanvasItem, paintSel (including HUD) and renderRight without select or selSet. Actual helper regressions cover single and multiple logical selections moving between two repeated DOM copies, active raw CMS index, selectedCanvasElement, outline/HUD geometry and refreshed inspector context. Primary modifiers and unselected secondary clicks remain covered.

Corrected RED:2 failures and9 passes. Focused GREEN:15 passes. Typecheck passes. Two ordered node build.mjs then node packages/editor/build.mjs pairs match all10 generated artifacts. Only index.html/editor.html differ versus ff23; Core71e/runtime76a0/compiler2/schema/golden are unchanged. No Main working/index writes or WP prep.

Pre-gallery ordinary suite:2815 passes,5 skips,sole builder fingerprint failure retained. Root supplied final ordinary suite after actual gallery review:exit0,2816 passes,5 skips,275 files pass and2 skipped. Root fresh24 native captures compare at0 changed pixels; prior30 behavior checks explicitly reused because12 actual gallery HTML outputs are byte-exact. Manifest changes only builder source fingerprint; all24 baseline PNGs/provenance preserved. Gallery PID50160 stopped after root closed native review, owned session63920 exit130.

Integration proposal targets current Main ff23. Source3 plus reviewed manifest4, generated8 index-only, compiler2 excluded, new evidence only. Existing root records and original evidence are never overwritten. Native production/deployment and corrected canvas acceptance are not claimed here.
