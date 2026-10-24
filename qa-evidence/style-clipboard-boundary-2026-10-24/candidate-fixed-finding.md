# Fixed candidate native paste audit

Status: accepted for the supplied bounded native desktop flow. All 20 independent offline assertions passed. This result supplements the preserved before-fix failure evidence; it does not turn the full QA programme green.

The imported source fixture contained the deleted class. After copying, deleting the class and pasting, the target retained the source's baked Ink background, 18px resting radius, direct 7px margin, all responsive CSS buckets and complete authored interaction state. Its Hover state contains the green background and 24px radius. Neither source nor target retains an orphan class ID.

Actual native DOM confirms both buttons use `rgb(36, 44, 39)`, `18px` radius and a `7px` top margin. The actual candidate JPEG was opened and visually inspected: source and selected target are both dark and rounded. Feedback shows the copy, class deletion with appearance preservation, and paste actions.

Whole-project comparison shows only target styling changes. Target identity, content, visibility, advanced fields and children remain exact. The source, all other nodes, every metadata field and the class catalogue remain unchanged by Paste. One Undo restores the original complete after-class-deletion project semantically and byte for byte. One Redo restores the fixed pasted project semantically and byte for byte.

A read-only review of the isolated candidate source confirms that it captures the copy-time source styling envelope and applied class definitions, resolves only missing class references through the existing class-removal planner, preserves surviving live class references, and exposes a pre-edit rejection check for ambiguous cases. This is consistent with the repaired basic native flow. The supplied native fixture does not exercise ambiguous class-order rejection or changing a surviving class after Copy.

This acceptance is limited to one deleted class and one pasted button in the standalone candidate desktop editor. Hover is verified as exact authored state, not as a supplied native hovered screenshot. These files do not prove save/reload, mobile, WordPress, multi-target, deployment or production acceptance. The independent auditor performed no browser actions, source edits, builds or commits.

Run `python3 candidate-fixed-assertions.py` from this directory. See `candidate-fixed-verdict.json` for input hashes, complete assertions and explicit limits.
