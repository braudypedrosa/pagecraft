import { accountEntryPage } from './account-pages.ts';
import { HEADER_DEVICE_ICONS } from '../../shared/builder-header.js';
import { cloudHeader } from './cloud-header.ts';
import { CUSTOM_SELECT_BOOT_SCRIPT } from '../../shared/custom-select.js';
import { UI_MOTION_BOOT_SCRIPT } from '../../shared/ui-motion.js';
import { REVIEW_CSS as css } from './live-review-styles.ts';
import { svg } from '../../app/src/core/icons.ts';
const reviewGlyphs: Record<string,string> = {comment:'<path d="M3 2.5h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6l-3.5 2v-2H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"/><path d="M5 6h6M5 8.5h4"/>',share:'<circle cx="12" cy="3" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="13" r="2"/><path d="m5.7 7 4.6-3M5.7 9l4.6 3"/>'};
const icon = (name: string) => (reviewGlyphs[name] ? `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${reviewGlyphs[name]}</svg>` : svg(name,16)).replace('<svg ', '<svg aria-hidden="true" ');
import { reviewClient } from './live-review-client.ts';
import type { LiveLink } from './live-reviews.ts';
export const escapeReview = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/brand/pagecraft-favicon.svg"><title>${escapeReview(title)} · Pagecraft</title><style>${css}</style></head><body class="${body.includes('class="work"') ? 'review-workspace' : ''}">${body}<script>${UI_MOTION_BOOT_SCRIPT}${CUSTOM_SELECT_BOOT_SCRIPT}</script></body></html>`;
export function reviewEntry(name: string, base: string, publicLink: boolean, message = '') {
  return accountEntryPage(`Review ${name}`, `<p>${publicLink ? 'Sign in or enter your name to leave feedback.' : 'Sign in with your invited email to open this site.'}</p>${message ? `<p class="notice error" role="alert">${escapeReview(message)}</p>` : ''}<form method="get" action="/sign-in"><input type="hidden" name="next" value="${escapeReview(base)}"><button class="oauth" type="submit">Sign in to Pagecraft</button></form>${publicLink ? `<div class="divider"><span>or continue as a guest</span></div><form class="stack" method="post" action="${base}/join"><div class="field"><label for="guest-name">Your name</label><input id="guest-name" name="name" autocomplete="name" required maxlength="80"></div><button class="primary">Continue as guest</button></form>` : ''}`);
}
export function liveReviewPage(input: { name: string; siteId: string; base: string; person: string; owner: boolean; canResolve: boolean; canEdit?: boolean; links: LiveLink[]; pages: {path:string; name:string}[]; invitations: {email:string;kind:string}[] }) {
  const e = escapeReview;
  const share = input.owner ? `<dialog class="pc-dialog" id="share-dialog" aria-labelledby="share-title"><div class="pc-dialog-head"><h2 class="pc-dialog-title" id="share-title">Share review</h2><button class="pc-dialog-close" id="close-share" aria-label="Close sharing">×</button></div><div class="sharing pc-dialog-body"><p>Every link shows the latest saved site and the same comment threads. Public links allow named guests. Private and developer links require an invited account.</p><form method="post" action="/sites/${e(input.siteId)}/reviews/live"><label>Link access<select name="access"><option value="private">Invited reviewers</option><option value="public">Anyone with the link</option><option value="developer">Invited developers</option></select></label><button>Create link</button></form><ul>${input.links.filter(l=>l.active).map(l=>`<li><strong>${e(l.access)}</strong> <a href="/review/${l.token}">Open ${e(l.access)} review</a> <button type="button" data-copy-link="/review/${l.token}">Copy link</button><form method="post" action="${input.base}/revoke"><input type="hidden" name="linkId" value="${l.id}"><button>Revoke link</button></form></li>`).join('')}</ul><form method="post" action="${input.base}/invite"><label>Email<input type="email" name="email" required autocomplete="email"></label><label>Access<select name="kind"><option value="private">Reviewer</option><option value="developer">Developer</option></select></label><button>Invite person</button></form><ul>${input.invitations.map(i=>`<li>${e(i.email)} · ${e(i.kind)}<form method="post" action="${input.base}/remove-invite"><input type="hidden" name="email" value="${e(i.email)}"><button>Remove review access</button></form></li>`).join('')}</ul></div></dialog>` : '';
  const data = JSON.stringify({base:input.base,canResolve:input.canResolve,pages:input.pages,editorUrl:input.canEdit ? '/edit/' + encodeURIComponent(input.siteId) : null}).replace(/</g,'\\u003c');
  return shell(input.name + ' review', `
${cloudHeader(input.name, `${input.owner ? `<a class="button pc-header-action all-reviews" href="/sites/${e(input.siteId)}/reviews">${icon('page')} All reviews</a>` : ''}
  <div class="pc-header-identity"><span class="pc-header-avatar">${e(input.person.slice(0,2).toUpperCase())}</span><span class="identity-copy">${e(input.person)}<small>${input.owner ? 'Owner' : input.canResolve ? 'Developer' : 'Reviewer'}</small></span></div>
  ${input.owner ? `<button id="open-share" class="primary pc-header-action">${icon('share')} Share</button>` : ''}
`, `<div class="review-devices" aria-label="Device">${['desktop','tablet','mobile'].map(d=>`<button data-device="${d}" aria-label="${d[0].toUpperCase()+d.slice(1)}" title="${d[0].toUpperCase()+d.slice(1)}" aria-pressed="${d==='desktop'}">${HEADER_DEVICE_ICONS[d as keyof typeof HEADER_DEVICE_ICONS]}</button>`).join('')}</div>

  `)}
${share}
<nav class="toolbar pc-toolbar-context" aria-label="Review tools">
  <span class="workspace-label">Site review</span><span id="viewport-size" hidden></span>

<span class="spacer"></span>
  <div class="group modes" aria-label="Review mode"><button data-mode="browse" aria-pressed="false">${icon('eye')} Browse</button><button data-mode="comment" aria-pressed="true">${icon('comment')} Comment</button></div>
  <label class="target-control"><span>Target</span><select id="target-mode" aria-label="Annotation target"><option value="element">Element</option><option value="section">Section</option></select></label>
  <button id="update-site" hidden>Load latest site</button>
</nav>
<p id="feedback" role="status" aria-live="polite"></p>
<main class="work">
  <nav class="site-navigator" aria-label="Review navigator">
    <div class="navigator-heading"><h2>Comments</h2><span id="site-feedback-count" class="count"></span></div>
  <label class="field-icon"><span class="sr-only">Page</span><select id="page-select">${input.pages.map(p=>`<option value="${e(p.path)}">${e(p.name)}</option>`).join('')}</select></label>
    <div class="filter-tabs" aria-label="Comment status">${['open','done','all'].map(status=>`<button data-status="${status}" aria-pressed="${status==='open'}">${status==='done'?'Resolved':status[0].toUpperCase()+status.slice(1)}</button>`).join('')}</div>
    <div hidden><select id="status-filter" aria-label="Show comments"><option value="open">Open</option><option value="done">Done</option><option value="all">All</option></select></div>
    <div id="site-outline" class="outline-scroll"></div>
    <div class="panel-foot">Comments for the selected page and device.</div>
  </nav>
  <section class="preview-area" aria-label="Site preview">
    <div class="preview-caption"><span id="mode-hint">Select an element to leave feedback</span><span class="live-dot">Latest saved site</span></div>
    <div id="canvas"><div id="frame-wrap"><iframe id="site-frame" title="Site being reviewed" sandbox="allow-scripts"></iframe></div></div>
  </section>
  <aside class="comments-panel" id="conversation-inspector" aria-label="Conversation inspector" hidden>
    <div class="panel-head"><h2>Conversation</h2><button id="close-inspector" aria-label="Close conversation">×</button></div><div id="selection-path" class="selection-path"></div><span id="thread-count" hidden></span>
    <div class="scope"><span id="scope-page">Home</span><span id="scope-device">Desktop</span></div>
    <div class="thread-scroll">
      <form id="new-comment" hidden><label for="new-body">New comment</label><span id="anchor-label">Selected element</span><textarea id="new-body" placeholder="What needs to change?" maxlength="4000" required></textarea><div class="composer-actions"><button id="cancel-comment" type="button">Cancel</button><button id="save-comment" class="primary">${icon('plus')} Add comment</button></div></form>
      <div id="threads"></div>
    </div>
    <div class="panel-foot"><a id="open-editor" class="button" hidden target="_blank" rel="noopener">Open in editor</a><span id="inspector-note">Feedback for the selected element.</span></div>
  </aside>
</main>
<script id="review-config" type="application/json">${data}</script><script>(${reviewClient.toString()})();</script>`);
}

export function reviewHubPage(input: {siteId:string;name:string;owner:boolean;links:LiveLink[];assignments:{id:string;publicationId:string;reviewerEmail:string;decision?:{status:string}|null}[]}) {
  const e = escapeReview, base = '/sites/' + encodeURIComponent(input.siteId);
  return shell(input.name + ' reviews', `${cloudHeader(input.name, `<a class="pc-header-action" href="${base}">Site overview</a>`)}<main class="hub"><div class="hub-heading"><div><h1>Reviews</h1><p>Share your site. Collect feedback. Track every fix.</p></div></div><div class="hub-grid">${input.owner ? `<section class="sharing"><h2>Create a review link</h2><p>Each page has its own desktop, tablet and mobile annotations. All links share the same conversations.</p><form method="post" action="${base}/reviews/live"><label for="live-access">Share with<select id="live-access" name="access"><option value="private">Invited reviewers</option><option value="public">Anyone with the link</option><option value="developer">Invited developers</option></select></label><button class="primary">Create review link</button></form></section>` : ''}<section class="sharing"><h2>Live reviews</h2>${input.links.length ? `<ul>${input.links.map(l=>`<li><a class="button" href="/review/${l.token}">Open ${l.access === 'developer' ? 'developer' : l.access === 'private' ? 'private' : 'public'} review</a> <span>${l.access === 'public' ? 'Name or login required' : 'Invited account required'}</span></li>`).join('')}</ul>` : `<p>${input.owner ? 'Create a link to start collecting feedback.' : 'No live reviews have been shared with you yet.'}</p>`}</section></div><details class="sharing"><summary>Previous snapshot reviews</summary><p>These retain the original frozen version and approval history.</p>${input.assignments.map(a=>`<p><a href="${base}/reviews/${e(a.id)}">${e(a.reviewerEmail)}</a> · ${e(a.decision?.status || 'Awaiting review')}<br><small>Snapshot ${e(a.publicationId)}</small></p>`).join('')}<a href="${base}/reviews?legacy=1">Open snapshot review archive</a></details></main>`);
}
