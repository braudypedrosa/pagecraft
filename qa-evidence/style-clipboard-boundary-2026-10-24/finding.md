# Paste styles loses the appearance of a class deleted after copying

Status: reproduced before the fix. Feature acceptance fails. The independent evidence audit passed 23 assertions that establish the failure and its preservation boundaries. A successful auditor exit confirms the reproduction, not that Paste styles works correctly.

The native flow copied styles from a button with the `qa-clipboard-delete` class, deleted that class, then pasted onto another button. The class supplied an Ink background, an 18px resting radius, and a green hover background with a 24px radius. A direct 7px top margin belonged to the source element itself.

Class deletion correctly preserved the existing source appearance by baking the class values and hover state into its local styling. The source remained dark and rounded. Paste then copied only the earlier direct 7px margin and discarded the deleted class ID. The target lost the class background, radius and hover state. Its actual resting DOM showed `rgb(239, 239, 239)` and `0px`, while the source showed Ink (`rgb(36, 44, 39)`) and `18px`. The interface still displayed “Styles pasted”.

The actual full viewport JPEG was opened and visually inspected. It shows the dark rounded source above the pale flat selected target, alongside the success message. The screenshot is 1689 by 1314 pixels. The supplied DOM record independently confirms the resting values. Hover loss is established by the native authored exports, which show no target hover state; this evidence does not include a native hovered screenshot.

The current implementation's comment at `app/src/core/index.ts:4092` says Paste styles means making the target look like the source. The comment at line 4082 also explicitly says dropping hover is not what users mean. However, `copyStyles` stores only local CSS, local states and class IDs. `pasteStyles` filters those IDs against current classes. After deletion, filtering protects against orphan references but leaves no captured class appearance to apply.

The existing regression at `tests/core.test.ts:6748`, “a class deleted between the copy and the paste is dropped, not carried”, asserts only an empty destination class-ID list. That assertion passes while the customer's appearance expectation fails. This audit therefore separates the passing orphan-ID contract from the failing appearance fallback.

Preservation checks passed. Class deletion changed only the deleted class catalogue entry and its existing source's appearance. Paste changed only the target styling; content, identity, structure, source, every other node and project metadata remained unchanged. One Undo restored the complete after-deletion export byte for byte. One Redo restored the complete pasted export byte for byte. The export after reload was semantically identical to the whole pasted project, although serialization key order changed its raw SHA. Original baseline and final restored exports are byte-identical with SHA256 `0826a13f998d879b0fe66028f1b2e9fd7f5855e3cdf91c47c8bdd5fe98acd9b7` and nine pages.

The fix must retain the copy-time class appearance when a referenced class disappears, including its interaction states, without reintroducing an orphan class ID. Existing live class references should preserve their intended shared behavior. Candidate implementation and native acceptance belong to the separate fix pass. This record covers only the supplied Cloud desktop before-fix evidence. It does not establish WordPress, mobile or fixed-build acceptance.

Evidence: `native-before-fix-verdict.json`, the eight native project exports, `after-paste-dom.json`, and `after-deleted-class-paste.jpg`. Run `python3 native-before-fix-assertions.py` from this directory to reproduce the bounded offline audit.
