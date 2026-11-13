# Deleted-class clipboard repair

Date: 2026-10-24, Asia/Manila. Status: locally verified, staging deployment pending.

Copying styles and then deleting their shared class previously produced a successful paste with lost appearance. The clipboard now retains copy-time definitions for missing classes and resolves their appearance locally. Existing classes remain live. An ambiguous cascade refuses the paste before creating an undo checkpoint. Context menu, keyboard and inspector entry points share the check.

Native builder evidence reproduces the failure, confirms the repair, exact Undo/Redo, actual hover and reload persistence. The independent export audit passed 20 assertions; hover/reload evidence passed 9. Full bounded suite: 2850 passed, 5 skipped. Two ordered build/editor pairs are byte-identical. Public runtime, schema 13, compiler and golden fixture are unchanged.

Earlier default-parallel runs exposed an existing fixed-700ms save-test timing failure. Logs are preserved; assertions were not weakened. The bounded full run passed. Local imported demo preview also reported unavailable images; this is not cleared by the clipboard check.

No production deployment. Staging and WordPress120 native verification remain pending. This closes a bounded regression, not full production QA. Time tracking: unknown. Billing: not prepared.
