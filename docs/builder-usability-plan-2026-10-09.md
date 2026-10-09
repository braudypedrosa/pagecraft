# Pagecraft builder usability plan

Prepared 9 October 2026, Asia/Manila. Status: implementation delivered locally; staging verification pending. Stages 1–3 and preview readiness are implemented; live latency diagnosis and real participant sessions remain open.

## Decision and outcome

Prioritize **template-first beginners**, as selected by Braudy. Keep blank-canvas creation, advanced controls and the existing Pagecraft visual language available. The editor is an Operate surface: clear tasks, predictable controls and truthful feedback take precedence over decoration.

The intended first journey is: choose an approved site template, personalize its content, adjust one responsive style, save and reload, prepare client feedback, inspect a publication snapshot, then explicitly publish. A beginner should complete it without needing to understand Flex or Grid first.

The next release should improve this journey, not expand the widget catalog. Full-site templates and starter sections are different: a site template creates a starting site; a starter section adds content to the current page.

## Baseline: retain completed work

The following are already recorded as implemented and verified on staging, so they are regression requirements rather than new deliverables:

- Search with familiar aliases, common elements first, expandable advanced groups and starter-section discovery.
- Rich text naming; optional layout, responsive and CMS guidance.
- Clearer Checks, Preview, Live link and Publish explanations; saved snapshot publication.
- Persistent failure feedback and explicit save recovery.
- Tablet insertion opens the inspector; content hints explain that text and images are shared across breakpoints.
- Confirmation modal isolation and native keyboard Cancel behavior.
- Cached, compressed hosted editor assets.

Evidence comes from the 7–9 October project records, not a fresh live audit. Selection predictability and beginner difficulty are hypotheses to validate, not newly reproduced defects. Existing performance observations are a small sample, not percentiles.

## Delivery sequence

| Stage | Work | Exit condition |
|---|---|---|
| 0 | Establish current behavior and reusable fixtures; begin performance measurement | Current friction, baseline timings and affected native controls recorded |
| 1 | Make the template-to-first-edit journey clear | Beginner can personalize a starting page without layout terminology |
| 2 | Make selection, insertion and responsive scope predictable | Correct targets and breakpoint effects are visible; Undo and reload preserve intent |
| 3 | Make client feedback and publication easy to distinguish | Owner finds feedback; reviewed versions and publication status remain truthful |
| 4 | Implement the measured performance remedy and validate the complete journey | Slow path addressed with trace evidence; no blank or misleading completion states |
| 5 | Observe first-time users, repair blockers and decide beta readiness | Recorded task outcomes meet the proposed gates below |

Performance measurement starts in stage 0. A verified, isolated performance fix can ship alongside stages 1–3. No calendar estimate is committed before stage 0 establishes scope.

## 0. Establish the baseline

Use one approved, representative template with navigation, images, text and a form, plus a smaller blank-page fixture. Add a nested-layout fixture and a larger image/CMS fixture for targeted stress checks. Do not promote draft templates merely to support this work.

Record the current first-edit path, selection behavior, insertion rules, responsive indicators and review entry points. Reuse existing controls where they already solve the problem. Capture before states at 1440, 1024 and 768 pixels and verify the 767-pixel editor boundary.

Measure cold and warm startup, server response, assets ready, editor interactive, preview painted and save completion. Record browser, viewport, dataset and network conditions; avoid treating DOMContentLoaded as editor readiness. Correlate slow requests with server/gateway timing. Use synthetic content and avoid recording account secrets or document text in traces.

## 1. Template to first successful edit — highest priority

**Proposed experience:** the existing create-site flow clearly offers approved full-site templates and a blank option. After template creation, provide a small, dismissible next-step prompt tied to actual tasks: edit the main heading, replace an image, update the main button, then preview. Prefer guidance beside the selected element over a blocking tour.

Use the existing template catalog and native editor commands. A task is complete only after its intended change is saved; selecting an element alone is not completion. Templates with different structures need supported targets or a safe generic fallback. Never guess a missing target or silently replace content. A returning author can dismiss guidance and continue normal editing.

**Acceptance:**

- Template creation opens the expected page; the first editing target is visible and understandable.
- Heading, image and button edits survive save/reload; Undo restores the previous value.
- An unavailable template, missing asset or failed creation has an actionable error and retry without duplicate sites.
- Dismissing guidance preserves edits and does not obstruct later sessions. Existing sites and blank starts work normally.
- Content-only members receive only permitted instructions and actions. Templates with forms clearly indicate destination setup still needed.

**Likely surfaces:** native site/template creation flow, `app/src/ui/Add.tsx`, inspector guidance and the existing editor selection bridge. Locate the creation handler in stage 0 before assigning file ownership.

## 2. Predictable selection, insertion and responsive editing

**Selection and insertion:** make the selected element and its immediate container apparent in the canvas, Navigator and inspector. Evaluate the existing ancestor controls before adding a compact parent path. Show the actual insertion location before a click insertion or drag drop. Invalid targets explain the restriction. Newly inserted content becomes selected and visible without unexpected scrolling or losing the current task.

**Responsive controls:** retain the existing device scope, override badges and help. Make field-level inherited versus overridden values easier to read where testing shows ambiguity. Clearing an override returns to the inherited value; changing text, images or links explicitly communicates that content is shared across breakpoints. Distinguish the editor's viewport size from the site's selected output breakpoint.

**Acceptance:**

- Select a child, select its parent, insert beside/inside an allowed container, then Undo/Redo: all three surfaces agree on the target.
- Pointer, keyboard and tablet paths reach equivalent results. Escape and focus return remain predictable.
- Automatic wrappers and inserted content form one undoable action; no duplicate insertion after dragging.
- Changing tablet padding leaves the desktop base unchanged. Clearing the override restores inheritance, including Mobile's Tablet-to-Desktop fallback.
- Shared content changes appear at every breakpoint; reload preserves both content and responsive overrides.
- Component instances, global header/footer, long names and locked/content-only states retain their existing editing rules.

**Likely surfaces:** `builder.html`, native selection/insertion commands, `app/src/ui/Add.tsx`, `app/src/ui/inspector/Inspector.tsx`, `Controls.tsx` and `ContextHelp.tsx`.

## 3. Discoverable client feedback and clear publication

Provide a direct, appropriately permissioned Client review entry near existing output actions, using the established review hub. Keep Publish as the primary release action. At tablet widths, preserve an accessible overflow/menu path rather than crowding the header.

The entry must distinguish two existing workflows: feedback on the latest saved draft and formal review/approval of an immutable snapshot. Neither means that the current draft is published. Show what a recipient will see and whether unsaved changes are excluded. Opening the entry does not send an invitation, create a public link or publish. Those remain explicit actions with their current access rules.

**Acceptance:**

- An owner reaches the appropriate review workflow from the editor without searching Help.
- Users can distinguish Checks, Preview, client feedback, snapshot approval and the live site.
- Existing owner, content-editor and reviewer permissions are preserved in both UI and server routes.
- A later draft edit does not inherit approval of an older snapshot. Revoked links and missing memberships remain denied.
- Unsaved, saving, failed save, no publication, published and changed-since-publication states are truthful.
- Browser QA uses fictional/local review recipients and links; no real invitation or notification is sent for testing.

**Likely surfaces:** `builder.html` output actions, existing review hub/routes and shared dialogs. Contracts: `docs/live-reviews.md` and `docs/phase3-review-release.md`.

## 4. Responsive feedback and measured speed

Preserve the completed cache/compression work. Choose the next remedy from the stage-0 trace: server/gateway wait, redundant request, asset decode, rendering or preview readiness. Do not add a cache without evidence, cache private documents publicly, or weaken current membership checks.

During unavoidable waits, keep stable editor geometry, explain the current operation and expose a bounded failure/retry state. A preview is ready when content is painted; a save succeeds only after acknowledgement. Any optimistic interaction must roll back safely and retain unsaved work on failure.

**Acceptance:**

- Repeat a fixed cold/warm protocol before and after using the same fixtures and conditions; publish sample counts, median and tail observations separately.
- Agree numeric performance budgets after the baseline, before implementing the remedy. The provisional usability goal is immediate visible response to local actions and no silent blank wait.
- Capture the previously slow path with a correlated trace, or explicitly leave it unresolved; a faster average alone does not close the issue.
- Test slow network, offline save, missing image and failed preview. A recoverable problem must not discard edits or falsely report success.
- No regression in permissions, isolation, save/reload, published output or WordPress/standalone packaging.

**Likely surfaces:** `server/src/editor-assets.ts`, editor route handling in `server/src/app.ts`, existing preview/public-serving timing and editor feedback. Backend/gateway work requires its applicable repository and service guidance before implementation.

## 5. First-time-user validation and release gates

Reuse the existing [session guide](../qa-evidence/beginner-validation-2026-10-07/session-guide.md). Recruit five people new to Pagecraft, including at least three beginners and two experienced site builders. Recruitment and participant scheduling are user dependencies, not performed by this plan. Use a fictional business and approved template, with no real customer content or outbound messages.

Observe participants personalizing a template, selecting nested content, inserting a section, changing tablet spacing, saving/reloading, preparing feedback and distinguishing a publication snapshot from the current draft. Record assistance, wrong turns, task time, failures and recovery; do not infer outcomes from agent walkthroughs.

**Proposed pilot gates, to agree before sessions:** at least four of five participants complete the core journey without moderator instructions, including at least two of the three beginners; all five correctly identify what would become public before confirmation; zero lost edits, unintended publication or permission breaches. Small-sample results guide the beta and do not establish universal usability. Measure time before choosing time-to-completion claims.

## Implementation and verification boundaries

- Braudy subsequently authorized implementation. Application and test changes use local fictional fixtures; customer records and released template packages remain unchanged.
- Future work follows `development`, preserves unrelated changes and delivers one reviewable stage at a time. Choose Local/worktree under the coding workflow at implementation start; a worktree does not isolate the database.
- Mutating walkthroughs use resettable local fixtures first. Shared staging/production data requires specifically scoped disposable records before any staging mutation.
- Use the built-in browser. Test the editor at 768, 1024 and 1440 pixels, plus the 767-pixel lock. Test published phone output when affected; phone editing remains outside scope.
- Each stage requires focused behavior tests, required full checks/build/demo, actual desktop/tablet screenshots and task-close evidence. Future staging release requires successful CI, matching `/__deployment` and affected rendered journeys. Production promotion remains a separate decision.
- Keep document schema, released template hashes, publishing safety, existing review permissions and the Cloud/WordPress ownership model intact unless a separately reviewed change proves necessary.
- Billing, founder CRM, new widgets, rebranding, locale expansion and broad template production are outside this builder-usability plan.

## Execution ownership

The main agent owns baseline evidence, interaction decisions, shared `builder.html` changes, integration and final browser verification. After contracts and files are established, one worker can handle a narrowly scoped Add/template guidance change while another handles measurement-only performance work. Inspector and header changes run sequentially if they share state or generated output. Workers do not independently operate the shared browser or deploy. Review all changes before combined verification.

## Evidence and next action

Sources: [usability improvements](../qa-evidence/easy-use-2026-10-07/task-close.md), [beginner workflow verification](../qa-evidence/beginner-validation-2026-10-07/task-close.md), [performance measurements](../qa-evidence/builder-load-2026-10-07/review.md), [existing roadmap](development-roadmap.md), and current Add/Inspector source.

Implementation now includes template-first creation, saved-change guidance, ancestor navigation, insertion previews, responsive inheritance labels, Client review entry, preview readiness and route timing. See the implementation evidence record for current delivery and validation. Stage 4 remains partial: timing identifies the next trace but does not prove the earlier live outlier fixed. Stage 5 requires five real participants; no participant outcomes or production readiness are claimed.
