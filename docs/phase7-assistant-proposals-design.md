# Phase 7: assistant proposals over MCP

Status: built 2026-10-02.

An AI assistant connected over MCP can read one site and propose changes to it. The site's owner
reviews each proposal in the editor and applies or declines it. The assistant never changes the
site itself.

## Decisions

| Question | Decision (user, 2026-10-02) |
| --- | --- |
| How an assistant connects | A **per-site token** the owner creates on the site's **Assistants** page and pastes into the assistant's MCP settings. It is shown once and can be revoked. |
| Who reviews and applies | **Owners only.** |

These follow from the roadmap contract:
- A proposal may change text, use one of the site's existing images, set a component's exposed
  properties, and insert existing components.
- Stale proposals are rejected.
- A proposal is applied through native, validated commands, in one Undo step, after explicit
  review.
- An assistant cannot publish, edit code, or change permissions.
- Existing read-only credentials gain no new authority. The WordPress import credential keeps
  exactly its three read tools.

## Tokens

- **Format:** `pca.<base64url(siteId)>.<tokenId>.<secret>`, with a 32-byte secret. Only its
  SHA-256 digest is stored, under `<publication root>/.assistants/<sha256(site)>/tokens/`, one file
  per token. A token made on staging therefore works only on staging.
- **Created on** `/sites/:id/assistants` (owners only). The page shows the token once and gives
  the Claude Code command
  (`claude mcp add --transport http … --header "Authorization: Bearer …"`) and the generic MCP
  URL and header. It lists tokens with their last use and lets the owner revoke them.
- **Limits:** up to 10 active tokens per site, and 10 created per owner per hour.
- **Authority ends** when the token is revoked, or when the owner who made it is no longer an
  owner of the site. Every request checks both.

## MCP tools for an assistant token (`/mcp`)

| Tool | What it does |
| --- | --- |
| `pagecraft_site` | The outline: pages, regions, components and their properties, images, the version and the limits. |
| `pagecraft_get_page` | One page, or the header or footer, as flat elements: id, kind, text by slot, images by slot, component values, and which components it `canHold`. |
| `pagecraft_propose_changes` | `{baseVersion, title, summary?, changes[]}`. The change types are `text`, `image`, `property` and `insert`. The result includes a review URL. |
| `pagecraft_get_proposal` / `pagecraft_list_proposals` | Status: pending, applied or declined. |

## Checking and applying

The core holds the proposal engine (`app/src/core/index.ts`, "assistant proposals"):

- **`proposalPrepare(changes, {assets})`** checks the changes against the current document and
  resolves each into a concrete change. A change records its region, its target, the value to
  write and the value it replaces (`before`). One bad change refuses the whole proposal, with a
  reason the assistant can act on.
  - **Text** must be one of the node's own text slots. Embed code is refused. Values are plain
    text, and every plain slot is escaped when rendered.
    - Rich text (the WYSIWYG `html` slot and rich component properties) also takes a markdown
      subset: `**bold**`, `*italic*`, `[text](link)` and `- ` list lines. It is escaped first and
      then given back only those tags. Links pass the same check as link properties.
    - `proposalOutline` returns existing rich text as the same markdown, so sending it back
      unchanged keeps its formatting.
  - **Images** must be one of this site's assets.
  - **Properties** are validated by kind:
    - text as is, and rich text into escaped paragraphs;
    - `img` must be a site asset;
    - `link` must be a site page (stored as `slug.html`), an anchor, or an `http(s)`, `mailto` or
      `tel` URL;
    - `select` must be one of its options; `bool` becomes `1` or empty;
    - `color` must be a hex value or a site colour; `icon` must be a known icon.
  - **Inserts** need an existing component, a region, and a parent that `fitsIn`, or none for
    the region's top level.
  - Nodes inside component definitions can't be addressed, because editing one would change
    every instance.
- **`proposalCheck(changes)`** returns `ok`, `stale` (the target's current value differs from
  `before`) or `missing` for each change.
- **`proposalApply(changes)`** writes with `slotSet`, `instSet` and `instanceInsert`. A root
  insert briefly points the editor's scope at the region, then restores it.

The server prepares a proposal on a restored copy of the draft, synchronously, as `renderSite`
does. Before that it requires `baseVersion` to equal the current draft version: if the site
changed since the assistant read it, the assistant must read it again. The editor re-checks at
apply time, so edits elsewhere in the draft don't block a proposal, but a change to anything the
proposal touches does.

Limits:
- 50 changes per proposal, 10,000 characters per value;
- a title of up to 120 characters and a summary of up to 2,000;
- 25 proposals waiting per site;
- 30 proposals per token per hour.

Decided proposals are kept for 90 days.

## Review in the editor

- **Where:** a **Proposals** rail button, for owners in the hosted editor, with a count of
  proposals waiting. A review link, `/edit/:id?proposal=<id>`, opens that proposal directly. A
  new proposal also posts an in-app notice to the owner who made the token. There is no email.
- **The workspace** (`app/src/ui/ProposalsWorkspace.tsx`), full width like the CMS:
  - a list of proposals;
  - each change shown now and proposed, flagged when stale or missing;
  - a preview of each affected page, proposed or as it is now. The previews come from
    `/api/sites/:id/proposals/:p/preview/<file>`, rendered server-side with the applicable
    changes and the same script-free CSP as the dashboard preview.
- **Apply to draft** is disabled while any change is stale, missing or already applied. When
  clicked it:
  1. claims the proposal on the server, which moves it to `applying` once — a second claim gets
     a 409, and a claim older than ten minutes was abandoned and can be taken again;
  2. runs `C.edit(() => C.proposalApply(changes, proposalId))`, which is one Undo step. An
     inserted instance takes an id derived from the proposal id and the change's index, so
     `proposalCheck` reports an insert that is already in the draft as `applied`;
  3. re-renders the editor;
  4. flushes the draft;
  5. records the proposal as applied, with the saved version.

  Publishing stays a separate, deliberate step. **Decline** asks first.
- **Editor API**, owners only:
  - `GET /api/sites/:id/proposals[?status=pending]` (with preview paths);
  - the preview route;
  - `POST /api/sites/:id/proposals/:p/claim`, single use as above;
  - `POST /api/sites/:id/proposals/:p/decision` with `{status, version}`, from `pending` or
    `applying`. A proposal is decided once; a second decision gets a 409.

## Code

- `app/src/core/index.ts` holds `proposalPrepare`, `proposalCheck`, `proposalApply` and
  `proposalOutline`. They're tested in `tests/proposals.test.ts`.
- `server/src/assistants.ts` is the token and proposal store.
- `server/src/assistant-mcp.ts` holds the tools.
- `server/src/assistant-routes.ts` holds the owner page, the editor API, previews and the MCP
  context.
- `server/src/account-pages.ts` has the Assistants page and its rail item. It is fingerprinted.
- `app/src/ui/ProposalsWorkspace.tsx`, plus the bridge and rail button in `builder.html`
  (fingerprinted).
- Tests: `server/tests/assistants.test.ts` and `tests/proposals-ui.test.tsx`.

## Signing in from the Claude app (OAuth, added 2026-10-03)

claude.ai, Claude Desktop and other MCP clients can connect without a pasted token
(`server/src/assistant-oauth.ts`).
- **Discovery.** `/mcp`'s 401 carries `resource_metadata`, which points to
  `/.well-known/oauth-protected-resource`. That names this server as the authorization server,
  described at `/.well-known/oauth-authorization-server`. The WordPress plugin still reads only
  the realm and scope.
- **Registration** (RFC 7591) at `/oauth/assistants/register`. Public clients only. Redirects
  must be HTTPS, or http on localhost. Rate-limited per source.
- **Consent** at `/oauth/assistants/authorize`:
  - It requires PKCE S256, and a `resource` must be this `/mcp`.
  - The owner signs in, sees the app's name and where it returns to, and picks one of the sites
    they own.
  - The consent and the code are single use for ten minutes; a failed exchange spends the code.
  - The form navigates natively, because its redirect leaves Pagecraft. That is why
    `shared/account-actions.js` exempts it.
- **Token** at `/oauth/assistants/token`. The code exchange issues the same per-site assistant
  token as the Assistants page, named "<app> (connected app)":
  - it is listed and revocable there;
  - it lapses with its maker's ownership;
  - signing in again replaces the app's previous token for that site.

  There is no refresh token, and the token has no expiry beyond revocation.
- **Tests.** `server/tests/assistant-oauth.test.ts` covers this, including the MCP SDK's own
  client signing in end to end.

## Not in this version

- Uploading new images.
- Proposals for content editors.
