# End-to-end test log — 2026-10-03

Build under test: staging `90723a6` (development). Production: `cc026d6`.
Owner account on staging: braudypedrosa@gmail.com, driven in the user's Chrome.
Non-owner roles run on a local copy synced to the same commit and the same site document.
The throwaway site is "QA E2E 2026-10-03" (`59497c7d-0688-481e-90b7-990a3640a1c5`, slug `qa-e2e-20261003`).

Legend: PASS · FAIL · BLOCKED (needs the user) · SKIP (out of scope, reason given)

## Staging — owner

| # | Area | Check | Result | Notes |
| --- | --- | --- | --- | --- |
| S1 | Dashboard | Site limit enforced at 3 of 3: "Add new site" disabled | PASS | |
| S2 | Settings | Delete site (QA Functional Fixes) — done by the user | PASS | The site returns 404 and the count went from 3 to 2 |
| S3 | Dashboard | Create a site from a premade template (stillwood@1.0.0) with a name and slug | PASS | Opens the editor; version 1, owner |
| S4 | Editor | Add a Heading from the Add panel (palette button); it lands wrapped in section, row and column, is selected, and is one Undo step | PASS | 153 to 157 nodes |
| S5 | Editor | Autosave reaches the server; the reloaded document contains the change | PASS | v1 to v2 |
| S6 | Editor | Edit text, then top-bar Undo and Redo; the canvas shows it and autosave stores it | PASS | v3 |
| S7 | Pages | New page dialog: name plus the Contact template creates the page with a working form and switches to it | PASS | /e2e-contact-page, 10 pages |
| S8 | Pages | The New page dialog closes after creating | PASS (see L29) | The tab was hidden, so Chrome froze the closing animation (it stays `data-pc-motion-closing`). Retest with the window visible |
| S9 | Roles | Content editor (Stillwood CMS QA): can read the site; a structural save is refused | PASS | PUT returned 403 "not allowed"; version unchanged |
| S10 | Roles | Content editor: settings, people, analytics, assistants, proposals and publish all refused | PASS | All 403 |
| S11 | Roles | Content editor: overview and submissions inbox allowed | PASS | 200 |
| S12 | Performance | Signed-in page and API latency | FAIL (see S47) | Overview 6.2 s, submissions 3.0 s, APIs 2.0 s, measured from a hidden Chrome tab. Re-measure in the foreground |
| S13 | Publish | Review preview snapshot: changes per page and warnings (nav-page-top, no-title, no-desc, form-contrast) | PASS | 201 in 4.6 s |
| S14 | Publish | Publish the exact snapshot, acknowledging warnings; returns the public URL | PASS | 200 in 2.6 s |
| S15 | Visitor | All pages are served 200 with the owner's edit, the sandbox CSP and nosniff | PASS | |
| S16 | Visitor | Page weight and speed | FAIL (perf) | Every page inlines 8 woff2 fonts (295 KB base64) inside 353 KB of CSS, about 400 KB of HTML (243 KB gzipped) per page. The host sends at about 16 KB/s against 200 KB/s from a CDN, so a full load takes 15–31 s; TTFB is 0.8–1.8 s |
| S17 | Visitor | A missing page | WATCH | Plain-text 29-byte "Not found". There is no styled 404 unless the site has a 404 page |
| S18 | Visitor | sitemap.xml | FAIL (SEO) | 404: the sitemap is only generated when meta.baseUrl is set, and hosted sites don't set it. robots.txt is served |
| S19 | Analytics | Turn on: the browser's zone (Asia/Manila) is stored on first enable | PASS | 4.4 s |
| S20 | Analytics | The click script is served only to counted visits: none for GPC, DNT, Googlebot, prefetch or a signed-in cookie | PASS | |
| S21 | Analytics | Report: 4 views (the repeat was deduplicated; the 5 excluded visits and the 404 were not counted), referrers (Direct, google.com, m.facebook.com), devices 2 desktop and 2 phone, 3 clicks (the repeat was deduplicated; a foreign page and slug were dropped), 2 forms | PASS | The page took 6.2 s |
| S22 | Analytics | CSV: local hour with offset, one row per metric and key | PASS | |
| S23 | Analytics | Time zone change regroups at once (LA `2026-10-02T20:00-07:00`, Manila `2026-10-03T11:00+08:00`); an unknown zone is refused | PASS | |
| S24 | Analytics | Click beacon with a malformed page URL (`http://[`) | FAIL (minor) | 500 instead of 204. Confirms the code review finding |
| S25 | Forms | A valid visitor submission (Origin null, as a sandboxed page sends) and one without Origin | PASS | 303 to /forms/thanks |
| S26 | Forms | Retrying with the same `_pc_request` stores one entry and counts one form | PASS | |
| S27 | Forms | Invalid email and missing required fields: 422 with the reason; stored as failed **without** the values | PASS | |
| S28 | Forms | Honeypot: 303 to thanks, nothing stored. Foreign Origin: 403. JSON: 415. Unknown form: 404 | PASS | |
| S29 | Forms | Inbox: lists success and failed entries; HTML in a value shows as text | PASS | 1.9 s |
| S30 | Forms | CSV export: all entries, with error column; `=HYPERLINK(...)` is exported as `'=HYPERLINK(...)` | PASS | |
| S31 | Account pages | Dates show in the **server's** time zone: 03:06 UTC shows as "Oct 2, 11:06 PM" to an owner in Manila (11:06 AM, Oct 3) | FAIL (minor) | `account-pages.ts:270-273` formats with `Intl.DateTimeFormat` on the server, with no time zone |
| S32 | Draft | Save a text change through the API | PASS | v4 to v5 in 4.9 s (WATCH: slow) |
| S33 | Schedule | Refused without acknowledging warnings (409), less than 2 minutes ahead (400) and a second pending schedule (409 `schedule_exists`); an idempotent replay returns the same schedule | PASS | |
| S34 | Schedule | A cancelled schedule never publishes | PASS | Cancelled for 10:15:52; the live page was unchanged through 10:20 |
| S35 | Schedule | A pending schedule publishes its exact snapshot | PASS | Due 10:18:36, published 10:20:13 on the next cron run |
| S36 | Schedule | Cron cadence | WATCH | The staging crontab runs **every 5 minutes**, so a schedule can be up to about 5 minutes late. Production has no runner key (scheduling is off there) |
| S37 | History | List versions with author; read v4 | PASS | The list took 4.2 s (WATCH; matches the review's "history loads full documents") |
| S38 | History | Restore v4 as a new draft (v6); live is unchanged; a stale `currentVersion` gets 409 | PASS | |
| S39 | People | Invite hello@braudyp.dev as content (a real invitation email is sent); change the role to reviewer | PASS | The invite took **8.7 s**: the outbox is drained inside the request (WATCH) |
| S40 | Settings | Rename and rename back; a bad slug is refused (`site_slug`) | PASS | |
| S41 | Settings | Slug change moves the live site at once: the new address returns 200, the **old one 404 with no redirect**; changing back restores it | PASS / WATCH | Old links and bookmarks break on any slug change. Took 4.1 s |
| S42 | Libraries | Create (2.5 s), publish the Cabin component v1 (2.4 s), share with hello@braudyp.dev (2.6 s) on the shared database (gateway v22) | PASS | |
| S43 | Assistants | Owner page loads with "Connect from the Claude app" and token creation | PASS | Creating a token and connecting a client is the owner's own step; the token path was covered locally (L18–L24) |
| S44 | OAuth | Protected-resource metadata (both paths) and authorization-server metadata are served (about 0.6 s); `/mcp` 401 carries `resource_metadata`; a non-HTTPS redirect is refused at registration (400); an unknown client at authorize gets 400 without redirecting | PASS | |
| S45 | OAuth | The `/mcp` 401 advertises `scope="projects:read packages:read"` (the WordPress scopes) while the metadata lists `site:read proposals:write` | WATCH (minor) | Clients may request the wrong scope; harmless today because authorize ignores scope |
| S46 | Export | "Download my copy" builds a full JSON backup: 551 KB, 11 pages, 1 collection | PASS | Checked in the local editor with the download intercepted (client-side code, same commit) |
| S47 | Performance | Signed-in latency (resource timing, TTFB/total ms, 3 runs): dashboard `/` 1764–2295; `/api/sites` 1015–2729; `/api/sites/:id` 1001–1302/1419–1727; overview 1827–2143; people 1695–2116; submissions 1180–1218; `/edit/:id` 1590–2285/2426–3170. Signed-out `/sign-in`: 207–237 | FAIL (perf) | Every authenticated request costs about 1–2 s on the server: identity check plus gateway round trips to the shared Supabase in ap-southeast-1. Writes took 2.4–8.7 s (S32, S39, S41, S42) |

## Local copy — other roles

Commit `90723a6` with local Supabase (every migration applied) and the local gateway, at `http://localhost:8787`. Local test accounts are owner, coowner, content, reviewer, member and stranger (`qa-<role>@pagecraft.test`, credentials in `.pagecraft-local/development/qa-roles.json`).

The site was created from the same template (stillwood@1.0.0), then given staging's two changed parts. Sync is checked by a SHA-256 of the whole document with origins normalised:
- staging v5 = local v2 = `d39464da1492`;
- after the staging restore, staging v6 = local v3 = `287525a23785`.

| # | Area | Check | Result | Notes |
| --- | --- | --- | --- | --- |
| L1 | People | The owner grants coowner (owner), content and reviewer to existing accounts; access is immediate | PASS | |
| L2 | Roles | Access matrix (statuses below) matches the role design: content has editor, overview, people (self only), submissions, history and assets; reviewer is sent from the editor to Reviews; member and stranger get 404; signed out gets 401 or sign-in | PASS | See the matrix after this table |
| L3 | Content | Changing heading text and a page title is allowed (200) | PASS | |
| L4 | Content | Adding a node, CSS, a link property, meta CSS, deleting a page, and rich text with `<script>`, `onerror` or `javascript:` are all refused (403) | PASS | |
| L5 | Content | Safe rich text is allowed and stored as sent | PASS | It may include `<a href="https://…">`. That is a policy gap: `content.ts` says links are excluded, but a rich-text link is accepted |
| L6 | Content | Plain-slot text `<img src=x onerror=…>` is stored and rendered escaped in the snapshot (sandbox CSP, `connect-src 'none'`) | PASS | |
| L7 | Content, reviewer | Snapshot, publish and assigning reviews are refused (403); reviewer, member and stranger saves are refused (403/404) | PASS | |
| L8 | Reviews (assigned) | The owner assigns a snapshot to a reviewer; assigning to a content member is refused (`review_reviewer`) | PASS | |
| L9 | Reviews (assigned) | The reviewer finds the assignment **only** in Notifications or email; the Reviews page lists live links only | WATCH (UX) | |
| L10 | Reviews (assigned) | The reviewer opens the sandboxed preview, comments (an empty comment is refused) and requests changes; cancelling is refused for the reviewer (403); the owner sees the escaped comment and the decision; a stranger gets 404 and content gets 403 | PASS | |
| L11 | Live review | The owner creates a public link (content: 403). A signed-out guest sees the entry page, can't read state before joining (403), joins by name (blank refused), reads the **draft** preview, pins (bad input 400) and replies; resolving is refused (403); a foreign Origin is refused (403) | PASS | |
| L12 | Live review | The owner resolves; the state shows pin, author, done and reply. A guest name with `<script>` is rendered via `textContent` | PASS | |
| L13 | Live review | Private invite: the reviewer can read (200); stranger, signed-out and guest join are refused (403). Developer invite: the member gains the site role reviewer, can read, pin and resolve; the reviewer can't open the developer link | PASS | |
| L14 | Co-owner | Snapshot (4 warnings) and publish | PASS | |
| L15 | People | Role change content to reviewer and back; content can't change roles or invite (403); a bad role or email is refused; repeat invites are rate-limited (`people_rate`); a new email gets a Supabase invitation mail (Mailpit) and a pending membership; removing it works | PASS | |
| L16 | People | An owner demoting themselves is refused, but with the message `people_last_owner` even when another owner exists | WATCH (copy) | |
| L17 | People | A co-owner can demote the site's creator to content | WATCH (design) | No primary-owner protection. Any owner can lock out the creator |
| L18 | Assistant | Only owners can create tokens (content: 403); a token is shown once and not on reload | PASS | |
| L19 | Assistant | An unknown token gets 401 with `resource_metadata` for OAuth discovery; the 5 tools are listed | PASS | |
| L20 | Assistant | Refused proposals: stale `baseVersion`, unknown slot, `javascript:` link, missing element. Each message tells the assistant what to fix | PASS | |
| L21 | Assistant | A rich-text proposal: `**bold**` and `[link](https)` become tags, `<script>` is escaped, and `- ` lines become line breaks | PASS | The proposal stores `before` |
| L22 | Assistant | Owner API lists pending proposals with previews; the preview has a script-free CSP and shows the escaped script; content gets 403 on the API and the preview | PASS | |
| L23 | Assistant | Decline gives 200; a second decision gives 409; MCP `get_proposal` shows declined | PASS | |
| L24 | Assistant | Demoting the token's maker cuts the token off at once (invalid_token); restoring ownership restores it | PASS | |
| L25 | Proposals UI | `/edit/:id?proposal=` opens the workspace at that proposal, with the diff and a Proposed/Now preview | PASS | In-app browser, visible |
| L26 | Proposals UI | "Now" for a plain-text slot that holds `<img …>` text shows **"Empty"** | FAIL (minor) | Display only. The canvas shows the literal text, escaped, and no image is created |
| L27 | Proposals UI | Apply to draft: one change, the draft saves (v8), the proposal is recorded as applied with version 8, and a toast says Undo reverses it | PASS | |
| L28 | Editor | Undo after applying reverts in one step and autosaves | PASS | "Draft saved 18:29" in local time |
| L29 | Pages | The New page dialog closes after creating (retest of S8 with a visible window): name plus the FAQ template creates and opens the page | PASS | S8 is resolved: it was the hidden-window artefact |
| L30 | CMS | New collection "Retreats"; add a Number field; save | PASS | In-app browser, visible |
| L31 | CMS | CSV import validates before importing: a bad number (line 4) and a line break in a title (line 5) are reported with the right line numbers, and nothing imports until fixed; the extra column can be skipped | PASS | |
| L32 | CMS | Import of 4 entries: quoted comma, escaped quotes and `=CMD()` stored as text; slugs derived (`lakeside-north`, `quote-cabin`, `cmd`) | PASS | |
| L33 | CMS | Undo removes the whole import (4 to 0) and Redo restores it (0 to 4) | PASS | |
| L34 | CMS | Bulk "Hold back as draft" on 4 entries; search; save view "Huts" (search + status) | PASS | |
| L35 | CMS import | On **update**, a short row blanks the fields it omits (`cms-import.ts`: `row[index] ?? ''`) | FAIL (data) | Confirmed in code; matches the review finding |
| L36 | Components | Make a component from a section (usage 1); place an instance on another page (usage 2) | PASS | |
| L37 | Components | An instance nested inside another component's **definition** isn't counted (`instances()` scans only pages and regions): Cabin usage stays at 9 | FAIL | Confirms the review finding |
| L38 | Components | Deleting a component then leaves a **dangling instance** inside the other definition (`def:e2e-banner` → `use: stillwood-cabin`), so that content disappears. Undo restores it | FAIL (data) | Same root cause as L37 |
| L39 | Media | Drop a PNG: stored as WebP (4 KB, 640×400, "unused"); tags saved; tag search finds it | PASS | |
| L40 | Media / templates | A template-created site hot-links its images, favicon and og:image as **absolute** `https://staging.itspagecraft.com/templates/stillwood/1.0.0/…` URLs; none are in the site's Media library | FAIL (design) | The published staging site loads 14 images from the editor host. A site made on staging but published from production (shared DB) would load images from staging |
| L41 | Libraries | Owner creates (a blank name is refused), publishes v1 from the site (a stale version gives 409), shares with the member | PASS | |
| L42 | Libraries | Member sees it as viewer with the owner's name, reads the version bundle, can't publish or share (403), and can leave (then 404). Stranger 404, signed-out 401, content publishing 404 | PASS | |
| L43 | Libraries | Sharing with an email that has no account succeeds (`added: true`) without any acceptance step | WATCH | This is the vector behind the review's canvas-XSS finding |

Access matrix (L2), at local v3:

```
path                                  owner  coowner content reviewer           member stranger anon
/api/sites                            +site  +site   +site   +site              -site  -site    401
/api/sites/:id                        200    200     200     403                404    404      401
/edit/:id                             200    200     200     302 -> /reviews    404    404      302 sign-in
/sites/:id                            200    200     200     200                404    404      302 sign-in
/sites/:id/people                     200    200     200     200                404    404      302 sign-in
/sites/:id/reviews                    200    200     403     200                404    404      302 sign-in
/sites/:id/submissions                200    200     200     403                404    404      302 sign-in
/sites/:id/analytics|assistants|integrations|settings
                                      200    200     403     403                404    404      302 sign-in
/api/sites/:id/history                200    200     200     403                404    404      401
/api/sites/:id/proposals|schedules|people
                                      200    200     403     403                404    404      401
/api/sites/:id/assets                 200    200     200     403                404    404      401
```

## Not covered

| Area | Why |
| --- | --- |
| Uplisting integration | Needs a live Uplisting API key. Code review only |
| Custom domain | Needs DNS for a real domain. Code review only (`site.host`, origin checks) |
| WordPress plugin import | Needs a WordPress site running the plugin. Code review only (credential lifetime findings) |
| Real email delivery content | Invitations to hello@braudyp.dev were sent (S39, S42); please confirm they arrived and read well |
| Claude app (claude.ai) connecting over OAuth on staging | Needs your claude.ai account; discovery and refusal paths are checked (S44) and the full flow is covered by the MCP SDK test in `server/tests/assistant-oauth.test.ts` |

## Cleanup for the user
- Delete the throwaway site "QA E2E 2026-10-03" on staging (Settings, Delete). It holds 4 test submissions, analytics, and 2 schedules.
- Delete the staging library "QA E2E 2026-10-03 library" (shared with hello@braudyp.dev). hello@braudyp.dev is also a reviewer on the QA site.
- The local copy runs on localhost:8787 with local Supabase in Docker; `npm run local:stop` stops Supabase.
