# Pagecraft first-time-user session guide

Status: research plan only. No participant sessions or results are recorded here. Completion rates, task times and assistance rates remain unmeasured.

## Purpose and scope

Observe whether a person new to Pagecraft can create, adapt, review and prepare a small fictional page for publication without prior product training. This is a 20–30 minute moderated walkthrough on desktop and tablet only. It tests comprehension and task success, not design taste, production readiness or comparative speed.

Use the built-in browser and a resettable fictional local fixture. Run one participant at a time. Do not demonstrate the interface before tasks begin. Ask participants to think aloud, but do not require a running commentary if it disrupts their work.

Suggested schedule:

- Welcome, consent and context: 2–3 minutes
- Five tasks: 15–22 minutes total
- Closing questions: 3–5 minutes

## Participant profiles

All participants are first-time Pagecraft users. Recruit one or more from each profile; do not treat these profiles as completed sessions.

1. **Novice author** — Comfortable with ordinary web forms and document editors, but has never built a website or used a visual site builder.
2. **Intermediate site owner** — Has edited content in WordPress or another CMS, understands pages and drafts, but does not routinely design layouts.
3. **Experienced builder user** — Regularly uses a visual builder such as Elementor, Webflow or Framer, but has not used Pagecraft.

Record the participant's self-described experience. Do not infer skill level from task performance.

## Moderator protocol

Before starting, say:

> We are testing Pagecraft, not you. Please work as you normally would and say what you expect to happen. I may stay quiet while you explore. The site and content are fictional.

For each task, read only the task prompt. Do not name controls, tabs, menus or expected click paths. If the participant pauses, use these prompts in order:

1. “What are you looking for?”
2. “What would you try next?”
3. “What do you expect that option to do?”
4. If the task timebox expires, ask whether they want one hint or prefer to stop.

Do not correct harmless exploration. Record a mismatch when the participant clearly predicts one outcome and the interface produces another. Give an explicit control-level hint only after recording the assistance level.

## Tasks and pass criteria

### Task 1 — Start the first page

**Participant prompt:**

> Start a simple page for a fictional neighbourhood café. Give the page a useful opening section with a clear heading and a call to action. Stop when the page has a credible starting point.

**Outcome pass criteria:**

- Adds a suitable starter section or layout to the page.
- Produces a visible opening section containing a heading and a clear call to action.
- Can identify the newly added structure on the canvas.
- Does not require the moderator to perform an interface action.

**Timebox:** 4 minutes.

### Task 2 — Edit the content

**Participant prompt:**

> Change the opening content so it promotes “Saturday brunch” and invites visitors to “View the menu.” Link that action to the fictional test destination `https://example.com/#menu`. Make the finished copy visible on the page.

**Outcome pass criteria:**

- Selects and edits the relevant content rather than adding a duplicate section.
- The heading or supporting copy includes “Saturday brunch.”
- The action label reads “View the menu.”
- Preview or rendered output shows the action targets `https://example.com/#menu`.
- The participant recognizes that the edited draft has been retained or saved.

**Timebox:** 3 minutes.

### Task 3 — Adapt the tablet layout

**Participant prompt:**

> On tablet, make the opening section feel less spacious without changing its desktop appearance. Check both views when you are done.

**Outcome pass criteria:**

- Switches to the Tablet editing scope.
- Changes a responsive spacing value on the opening section.
- Verifies the Tablet result and returns to Desktop to confirm the desktop value remains unchanged.
- Can explain, in their own words, whether Tablet inherited a value or received an override.

**Timebox:** 4 minutes.

### Task 4 — Prepare client review

**Participant prompt:**

> A client wants to comment on the latest saved draft before anything becomes public. Find the appropriate review path and show what you would share with them. Do not send anything or publish the site.

**Outcome pass criteria:**

- Finds the client review surface or link intended for feedback on the latest saved draft.
- Distinguishes client review from Preview, Checks and Publish.
- Reaches a shareable review state without sending a message, invitation or external notification.
- States that this review path does not itself publish the site.

**Timebox:** 4 minutes.

### Task 5 — Prepare a safe publication

**Participant prompt:**

> Prepare this page for publication. Check for problems, inspect what would go live and explain what publishing will do. Stop before the final irreversible or public action unless the moderator says this local fixture is safe to publish.

**Outcome pass criteria:**

- Opens Checks and notices any remaining findings or confirms none are blocking.
- Uses Preview or the publication review to inspect the intended output.
- Identifies that publication uses a saved, frozen version and later draft edits require another publication.
- Reaches the final publication decision without publishing on staging or another shared environment.
- If the moderator has confirmed a disposable local publication target, completes the local publication and verifies its result.

**Timebox:** 5 minutes.

## Scorecard

Record observed evidence, including the participant's words where they reveal a mental model. Do not convert missing measurements into estimates.

| Task | Result (2/1/0) | Time | Assistance (A0–A3) | Errors (E0–E3) | Decisive observation |
|---|---:|---:|---:|---:|---|
| 1. First page | — | unmeasured | — | — | — |
| 2. Edit content | — | unmeasured | — | — | — |
| 3. Tablet styling | — | unmeasured | — | — | — |
| 4. Client review | — | unmeasured | — | — | — |
| 5. Safe publication | — | unmeasured | — | — | — |

### Result rubric

- **2 — Pass:** Meets all essential outcome criteria without a control-level hint.
- **1 — Assisted pass:** Reaches the outcome after an explicit directional or control-level hint, or misses one non-safety criterion.
- **0 — Not completed:** Stops, exceeds the timebox without reaching the outcome, requires the moderator to perform an action, or violates a safety stop.

### Assistance rubric

- **A0:** No moderator help beyond reading the task and neutral think-aloud prompts.
- **A1:** Task is repeated or rephrased without naming a location or control.
- **A2:** Directional hint names an area or concept, but not the exact control sequence.
- **A3:** Moderator names the control, gives steps or performs an action. Record the task as assisted or not completed as applicable.

### Time rubric

Start timing after the task prompt and stop when the participant declares completion or the moderator ends the task. Record actual elapsed time only.

- **Within timebox:** Completed before the listed task limit.
- **Over timebox:** Completed after the limit because the participant chose to continue.
- **Stopped:** Outcome not reached when the participant or moderator ended the task.

The timeboxes manage a short session; they are not established usability benchmarks. Do not report averages, completion rates or time-to-task claims until real sessions have been recorded.

### Error rubric

- **E0:** No consequential mismatch or unintended action.
- **E1:** One recoverable wrong turn; participant recovers without help.
- **E2:** Repeated wrong turns, lost context or recovery that needs moderator assistance.
- **E3:** Unintended publication, external message, shared-data mutation, unrecoverable state or another safety breach. Stop the session and preserve evidence.

Exploration is not an error unless it conflicts with the participant's stated expectation, loses work, creates an unintended result or blocks progress.

## Closing questions

Ask without suggesting a preferred answer:

1. What felt easiest?
2. Where were you least certain about what would happen?
3. How would you describe the difference between client review, preview and publication?
4. If you returned tomorrow, what would you expect to remember without help?

## Environment and data safeguards

- Use a fictional, resettable local fixture by default. Confirm the exact local environment before each session.
- Label fixtures and captures with the session date and participant code, never a real client or participant name.
- Use synthetic café copy and media. Do not enter personal, client, confidential or licensed production content.
- Desktop and Tablet are in scope. Phone behavior is not assessed in this guide.
- Staging and production currently share the Pagecraft Supabase project, accounts and site records. A staging edit, deletion, import, invitation, membership change or collection mutation can affect production data.
- Treat staging as read-only during these sessions. Do not save content, create or delete sites or collections, change accounts or memberships, send invitations, publish, connect WordPress, import data or alter schema on staging.
- The client-review task stops at displaying or copying a fictional local link. Do not send an external message or notification.
- The publication task stops before final confirmation on staging or any shared environment. Execute publication only when the moderator has verified a disposable local target and its reset path.
- Keep staging background queue workers disabled. Do not use a usability session to test email, scheduling or production integrations.
- Capture only the app surface needed for evidence. Obtain participant consent before recording audio, video or identifiable interaction data.
- After each session, preserve the scorecard and evidence, then reset only the disposable local fixture. Do not clean up shared data as part of this protocol.

## Session record

- Participant code: —
- Profile: novice / intermediate / experienced
- Date and timezone: —
- Environment and fixture ID: —
- Desktop viewport: —
- Tablet viewport: —
- Recording consent: yes / no / not recorded
- Moderator: —
- Session duration: unmeasured
- Completed tasks: unmeasured
- Notes and evidence paths: —

Any later summary must separate observed results from moderator interpretation. This guide contains no participant evidence and does not establish beginner completion rate, task time, usability across all skill levels or production safety.
