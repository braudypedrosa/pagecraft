# Pagecraft novice builder usability study

Status: ready-to-run research protocol. This document contains no participant findings. Record only observed session evidence in [builder-usability-results.csv](builder-usability-results.csv).

## Study purpose

Observe whether five first-time Pagecraft users can build and prepare a small fictional site without prior product training. The study covers starting from a template, editing content, inserting a visual section, responsive styling and inheritance, page structure, global navigation, Preview, and the boundary before publication.

This is a small formative study. It can identify recurring usability problems and guide iteration; it cannot establish universal usability, accessibility conformance, or comparative speed.

## Participants and privacy

Use anonymous participant codes **P1–P5** in every note, file, and capture. Record each participant's self-described website-building experience as `none`, `some content editing`, or `visual builder experience`; do not infer experience from performance. Do not record names, email addresses, employers, or client details.

Before the session, read:

> We are evaluating Pagecraft, not you. The site and content are fictional. You may stop at any time or skip any question. With your permission, I will record task times, actions, errors, and notes. Any screen, audio, or video recording requires your separate consent and will be labelled only with your participant code. Is that okay?

Record `yes` or `no` for participation consent and separately for screen, audio, and video recording. Continue without media recording when participation consent is given but recording consent is not. Stop if participation consent is not given.

## Session setup

Run one moderated session per participant. Allow **30–45 minutes**:

- Welcome, consent, and background: 4–5 minutes
- Seven tasks: 23–32 minutes
- Closing questions: 3–6 minutes

Use the built-in browser and a resettable fictional local fixture. Use the same starting fixture, template choices, synthetic copy, and image assets for P1–P5. Confirm the reset before each session. Record the operating system, browser surface, pointer or trackpad, keyboard, screen size, and viewport in the worksheet.

Provide these fixture materials without explaining where to use them:

- Fictional business: **Harbour Street Bakery**
- Replacement heading: **Fresh bread, every morning**
- Replacement paragraph: **Small-batch loaves, pastries, and coffee baked in the neighbourhood.**
- Replacement image: a supplied synthetic bakery image with filename `bakery-counter.jpg`
- Action text: **See today’s menu**

Use a disposable local publication target. If no safe target is available, the final task must stop before confirmation. Never publish to staging or production during this study.

## Moderator conduct

Do not demonstrate the interface before the tasks. Read each participant prompt exactly. Do not name controls, locations, or click paths unless the assistance rubric requires it. Ask the participant to say what they expect to happen, but allow silence when thinking aloud becomes disruptive.

When a participant pauses, use these prompts in order:

1. “What are you looking for?”
2. “What would you try next?”
3. “What do you expect that to do?”
4. “Would you like a hint, or would you prefer to stop this task?”

Record the assistance level before giving a hint. Do not correct harmless exploration. Stop immediately after an unintended publication, shared-data change, or loss of work that cannot be safely recovered.

Start each task timer after reading the prompt. Stop it when the participant declares completion, the moderator ends the task, or the safety stop is reached. Record actual seconds; do not estimate missing times.

## Tasks and success criteria

### Task 1 — Start from a template

**Participant prompt**

> Create a new website for Harbour Street Bakery. Start with an existing design that gives the business a credible home page. Stop when the site is open for editing.

**Timebox:** 4 minutes.

**Success criteria**

- Creates a new site from a premade template rather than a blank site.
- Reaches the builder with the selected site structure visible.
- Does not alter another site or shared fixture.

### Task 2 — Replace the main image and text

**Participant prompt**

> Make the opening area fit Harbour Street Bakery. Use the supplied image and change the main words to the heading and paragraph provided with the session materials. Stop when the updated opening is visible on the page.

**Timebox:** 5 minutes.

**Success criteria**

- Replaces the intended opening image rather than adding an unrelated duplicate.
- Replaces the intended heading and paragraph with the supplied exact text.
- The updated content is visible on the canvas.
- Existing surrounding layout remains intact.

### Task 3 — Insert a visual starter section

**Participant prompt**

> Add a new section below the opening area that presents three reasons to visit the bakery. Use a ready-made layout and stop when the new section is visible in the page.

**Timebox:** 4 minutes.

**Success criteria**

- Finds the visual starter-section choices.
- Chooses a three-column starter based on its preview and meaningful name.
- Inserts one section in the intended page location.
- Does not create repeated unwanted sections.

### Task 4 — Make and reset a mobile-only style

**Participant prompt**

> On mobile, reduce the space above the new three-column section without changing the desktop version. Then remove that mobile-only change so mobile follows the wider-screen styling again. Check the relevant views when you are done.

**Timebox:** 6 minutes.

**Success criteria**

- Switches to the mobile editing scope.
- Creates a mobile-only spacing override and verifies desktop is unchanged.
- Identifies that mobile is overriding an inherited value.
- Resets or removes the mobile override.
- Verifies mobile again follows the inherited wider-screen value.

### Task 5 — Reorder and undo

**Participant prompt**

> Move the three-column section so it appears before the section directly above it. Then return the page to its previous order.

**Timebox:** 4 minutes.

**Success criteria**

- Reorders the intended section once.
- Uses Undo to restore the exact prior order.
- No section or content is lost or duplicated after recovery.

### Task 6 — Update the global header and mobile menu

**Participant prompt**

> Change the site-wide header action to read “See today’s menu.” Make sure a phone visitor can reach that action from the site navigation. Stop when you believe the header works for both desktop and mobile visitors.

**Timebox:** 5 minutes.

**Success criteria**

- Enters the global header rather than changing only page content.
- Changes the header action text to the supplied exact wording.
- Finds and configures or verifies the mobile menu/navigation behavior.
- Can state that the global header applies across pages.
- Verifies both desktop and mobile states.

### Task 7 — Preview and publication boundary

**Participant prompt**

> Review what visitors would see and prepare the site to go live. Explain what will happen next and stop before the final public action.

**Timebox:** 4 minutes.

**Success criteria**

- Opens Preview and inspects the visitor-facing result.
- Finds the publication flow without publishing.
- Correctly distinguishes Preview from making the site public.
- Identifies the final confirmation or action that would publish.
- Stops before that action unless the moderator has explicitly confirmed a disposable local target.

## Recording rubric

Record one CSV row per participant and task. Use additional rows for distinct incidents when needed, keeping the same participant and task identifiers.

### Outcome

- **Pass:** All essential criteria met without a directional or control-level hint.
- **Assisted pass:** Outcome reached after A2 or A3 help, or one non-safety criterion was missed.
- **Not completed:** Outcome not reached, moderator performed the task, or a safety boundary was crossed.
- **Stopped:** Participant or moderator ended the task before an outcome.

### Assistance

- **A0:** Only the task and neutral prompts were given.
- **A1:** Task repeated or neutrally rephrased without naming an interface area.
- **A2:** Hint names an area or concept but not the exact control sequence.
- **A3:** Hint names a control, gives steps, or moderator performs an action.

### Errors

Record the total consequential error count and the highest error level:

- **E0:** No consequential mismatch or unintended action.
- **E1:** One recoverable wrong turn; participant recovers without help.
- **E2:** Repeated wrong turns, lost context, or recovery requiring help.
- **E3:** Unintended publication, shared-data mutation, unrecoverable loss, or another safety breach.

Exploration is not an error unless it conflicts with a stated expectation, creates an unintended result, loses work, or blocks progress.

### Issue severity

Assign severity after the session, based on evidence:

- **S0 — None:** No usability issue observed.
- **S1 — Minor:** Brief hesitation or friction; task remains independently recoverable.
- **S2 — Moderate:** Material delay or repeated error; participant needs help or misses a non-safety criterion.
- **S3 — Major:** Task cannot be completed independently, or the participant produces a materially wrong result.
- **S4 — Critical:** Publication, data integrity, privacy, or unrecoverable-loss risk.

Keep the observation factual. Put interpretation and recommended changes in their dedicated columns.

## Closing questions

Ask without suggesting an answer:

1. What felt easiest?
2. Where were you least certain about what would happen?
3. What did the mobile style reset do?
4. Which parts of the site would you expect the header change to affect?
5. How would you explain the difference between Preview and Publish?
6. What would you expect to remember if you returned tomorrow?

## Session close and analysis

Record the total session duration and any stopped tasks. Save evidence under the participant code, never a name. Reset only the disposable local fixture and confirm the next session starts from the same state.

After all five sessions, report counts and medians only from recorded rows. Separate findings observed in multiple sessions from isolated incidents. Keep participant quotations anonymous and brief. State missing data plainly. Do not convert moderator walkthroughs, test passes, or expert review into participant evidence.

Suggested decision gates for this study:

- At least four of five participants complete Tasks 1–6 without A3 assistance.
- All five correctly identify the Preview/publish boundary and stop before the public action.
- No E3 errors, lost edits, unintended publication, or shared-data mutation.
- Any S3 or S4 issue blocks a novice-readiness claim until corrected and retested.

These gates are study decisions, not pre-existing results.
