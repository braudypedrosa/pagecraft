import type { User } from './auth.ts';
import { cloudHeader, CLOUD_HEADER_CSS } from './cloud-header.ts';
import { UI_FONTS_CSS } from '../../shared/ui-fonts.js';
import { UI_TOKENS_CSS } from '../../shared/ui-tokens.js';
import { UI_TYPOGRAPHY_CSS } from '../../shared/ui-typography.js';
import { UI_FOCUS_CSS } from '../../shared/ui-focus.js';
import { WORKSPACE_CSS } from '../../shared/workspace-styles.js';
import { supportClient } from './support-client.ts';

// Iconify Lucide icons, used by the existing Pagecraft workspaces.
const icon = (paths: string) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const chat = icon('<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>');
const expand = icon('<path d="M7 17 17 7M7 7h10v10"/>');
const close = icon('<path d="m18 6-12 12M6 6l12 12"/>');
const back = icon('<path d="m12 19-7-7 7-7M5 12h14"/>');

const styles = `<style>
.pc-support [hidden]{display:none!important}
.pc-support{color:var(--pc-text);font:var(--pc-type-input);min-width:0}
.pc-support button,.pc-support a{touch-action:manipulation}
.pc-support-launch.pc-btn{position:fixed;z-index:45;right:max(24px,env(safe-area-inset-right));bottom:max(24px,env(safe-area-inset-bottom));height:46px;padding:0 17px;gap:8px;background:var(--pc-ink);border-color:var(--pc-ink);color:white;box-shadow:0 3px 12px #11131126}
.pc-support-launch.pc-btn:hover{background:#2b3029;border-color:#2b3029;color:#fff}
.pc-support-launch svg{color:var(--pc-green)}
.pc-support-panel{position:fixed;right:max(24px,env(safe-area-inset-right));bottom:max(80px,calc(env(safe-area-inset-bottom) + 56px));width:min(380px,calc(100vw - 32px));max-height:min(570px,calc(100dvh - 100px));display:flex;flex-direction:column;z-index:46;overflow:hidden;border:1px solid var(--pc-line-2);border-radius:var(--pc-radius-card,10px);background:var(--pc-panel);box-shadow:0 12px 48px #11131126}
.pc-support-bar{display:flex;align-items:center;gap:6px;background:var(--pc-ink);color:white;padding:9px 12px 9px 18px}
.pc-support-bar strong{flex:1;color:inherit;font:var(--pc-type-control)}
.pc-support .pc-support-icon{display:inline-grid;place-items:center;width:34px;height:34px;min-height:34px;padding:0;background:transparent;border:0;color:inherit;border-radius:var(--pc-control-radius)}
.pc-support .pc-support-icon:hover{background:#ffffff20}
.pc-support-content{display:flex;flex-direction:column;min-height:0;min-width:0}
.pc-support-page .pc-support-content{max-width:740px;border:1px solid var(--pc-line);border-radius:var(--pc-radius-card,10px);background:var(--pc-panel)}
.pc-support-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;padding:12px 18px;border-bottom:1px solid var(--pc-line)}
.pc-support-toolbar h2{font:var(--pc-type-control);margin:0;overflow-wrap:anywhere}
.pc-support .pc-support-back{display:inline-flex;align-items:center;gap:6px;padding:4px 0;min-height:32px;color:var(--pc-ui-secondary);background:transparent;border:0;font:var(--pc-type-control)}
.pc-support-back svg{width:15px}
.pc-support .pc-support-new{height:34px;min-height:34px}
.pc-support-list{list-style:none;margin:0;padding:0;overflow:auto}
.pc-support-list li+li{border-top:1px solid var(--pc-line)}
.pc-support-list a{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;text-decoration:none;color:var(--pc-text);font:var(--pc-type-control);overflow-wrap:anywhere}
.pc-support-list a:hover{background:var(--pc-field)}
.pc-support time{font:var(--pc-type-description);color:var(--pc-ui-secondary);white-space:nowrap}
.pc-support-empty,.pc-support-status{margin:0;padding:16px 18px;font:var(--pc-type-description);color:var(--pc-ui-secondary)}
.pc-support-status:empty{display:none}
.pc-support-status[data-error]{color:var(--pc-danger)}
.pc-support-thread{margin:0;padding:16px 18px;list-style:none;display:grid;gap:18px;overflow:auto;overscroll-behavior:contain}
.pc-support-page .pc-support-thread{max-height:min(52svh,540px)}
.pc-support-thread li{min-width:0}
.pc-support-meta{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}
.pc-support-meta strong{font:var(--pc-type-control)}
.pc-support-thread p{margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}
.pc-support-form{padding:16px 18px;display:grid;gap:8px;border-top:1px solid var(--pc-line);min-height:0;overflow:auto}
.pc-support-form label{font:var(--pc-type-control)}
.pc-support-form textarea{display:block;width:100%;min-height:68px;max-height:180px;resize:vertical;background:var(--pc-field);border:1px solid var(--pc-line-2);border-radius:var(--pc-control-radius);padding:10px 12px;font:inherit;color:var(--pc-text)}
.pc-support-form button{justify-self:end}
@media(max-width:600px){.pc-support-launch.pc-btn{right:12px;bottom:max(12px,env(safe-area-inset-bottom))}.pc-support-panel{right:12px;bottom:max(68px,calc(env(safe-area-inset-bottom) + 56px));width:calc(100vw - 24px);max-height:calc(100dvh - 84px)}}
</style>`;

/** The page and widget use the same ticket list, conversation and form. */
export function supportView(widget: boolean) {
  const content = `<div class="pc-support-content">
    <div class="pc-support-toolbar"><h2 data-title tabindex="-1">Your tickets</h2><button class="pc-btn pc-support-new" data-new type="button">New ticket</button><button class="pc-support-back" data-back type="button" hidden>${back} All tickets</button></div>
    <p class="pc-support-status" data-status role="status"></p>
    <p class="pc-support-empty" data-empty hidden>No support tickets yet.</p>
    <ul class="pc-support-list" data-list aria-label="Support tickets"></ul>
    <ol class="pc-support-thread" data-thread aria-label="Conversation" hidden></ol>
    <form class="pc-support-form" data-form hidden><label for="pc-support-message">Message</label><textarea id="pc-support-message" name="message" rows="3" maxlength="8000" placeholder="How can we help?" required></textarea><button class="pc-btn primary" type="submit">Send message</button></form>
  </div>`;
  return `${styles}<div class="pc-support pc-support-${widget ? 'widget' : 'page'}" data-support>
    ${widget ? `<button class="pc-btn pc-support-launch" type="button" aria-controls="pc-support-panel" aria-expanded="false" aria-label="Support chat" data-launch>${chat} Support</button>
    <section class="pc-support-panel" id="pc-support-panel" role="dialog" aria-label="Pagecraft Support" hidden><div class="pc-support-bar"><strong>Pagecraft Support</strong><a class="pc-support-icon" href="/account/support" data-expand title="Open Support page" aria-label="Open Support page">${expand}</a><button class="pc-support-icon" data-close title="Close support chat" aria-label="Close support chat" type="button">${close}</button></div>${content}</section>` : content}
  </div><script>(${supportClient.toString()})();</script>`;
}

/** The caller supplies the signed-in Sites dashboard. Keep its normal navigation and chrome. */
export function withSupportWidget(html: string) {
  return html.replace('href="mailto:hello@braudyp.dev" title="Help"', 'href="/account/support" title="Help"')
    .replace('</main>', () => supportView(true) + '</main>');
}

const pageStyles = `
*{box-sizing:border-box}
body{margin:0;color-scheme:light}
.dashboard-app{--pc-ink:#111311;--pc-green:#b7f34a;--pc-green-hi:#c5fa63;--pc-on-green:#111311;--pc-line-2:var(--pc-border-strong);--pc-panel:#fff;--pc-danger:#8f312b;display:flex;flex-direction:column;height:100svh;min-height:0;background:var(--pc-surface-subtle);color:var(--pc-text)}
.pc-support-account{color:var(--pc-rail-text);padding:6px 10px;text-decoration:none;display:flex;gap:8px;align-items:center;min-width:0}
.pc-support-account span{max-width:18ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-support-account:hover{background:#ffffff16;border-radius:var(--pc-control-radius)}
.pc-support-main{display:flex;flex:1;min-height:0}
.pc-support-nav{display:flex;flex-direction:column;align-self:stretch;flex:0 0 var(--pc-rail-width);background:#111311;padding:0;gap:4px}
.pc-support-nav a{min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;text-decoration:none;color:#aeb5ad;font:var(--pc-type-toolbar)}
.pc-support-nav a:hover{color:white;background:#272b27}
.pc-support-nav a[aria-current]{background:var(--pc-green);color:var(--pc-ink)}
.pc-support-main .pc-workspace{min-width:0;flex:1;overflow:auto}
.pc-support-main .pc-btn{border:1px solid var(--pc-line-2);border-radius:var(--pc-control-radius);height:var(--pc-control-height);padding:var(--pc-control-padding);background:var(--pc-panel);color:var(--pc-text);font:var(--pc-type-control)}
.pc-support-main .pc-btn.primary{background:var(--pc-green);border-color:var(--pc-green)}
button{cursor:pointer}
button:disabled{cursor:default;opacity:.55}
@media(max-width:520px){.pc-support-nav{flex-basis:56px}.pc-support-nav a{min-height:52px}.pc-support-nav a span,.pc-support-account span{display:none}}
`;

export function supportPage(user: User) {
  const accountName = (user.name || user.email).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const accountIcon = icon('<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/>');
  const sitesIcon = icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" type="image/svg+xml" href="/brand/pagecraft-favicon.svg"><title>Support — Pagecraft</title>
<style>${UI_FONTS_CSS}${UI_TOKENS_CSS}${CLOUD_HEADER_CSS}${WORKSPACE_CSS}${UI_TYPOGRAPHY_CSS}${UI_FOCUS_CSS}${pageStyles}</style></head><body>
<main class="dashboard-app">${cloudHeader('Support', `<a class="pc-support-account" href="/account" aria-label="Account settings"><span>${accountName}</span>${accountIcon}</a>`)}
<div class="pc-support-main"><nav class="pc-support-nav" aria-label="Workspace"><a href="/" aria-label="Sites">${sitesIcon}<span>Sites</span></a><a href="/account/support" aria-label="Support" aria-current="page">${chat}<span>Support</span></a></nav>
<section class="pc-workspace"><div class="pc-content"><header class="pc-workspace-head"><div><h1>Support</h1><p>View your tickets and continue the conversation with Pagecraft Support.</p></div></header>
${supportView(false)}</div></section></div></main></body></html>`;
}
