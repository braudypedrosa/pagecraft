import { cloudHeader, CLOUD_HEADER_CSS } from './cloud-header.ts';
import { UI_FONTS_CSS } from '../../shared/ui-fonts.js';
import { UI_TOKENS_CSS } from '../../shared/ui-tokens.js';
import { UI_FOCUS_CSS } from '../../shared/ui-focus.js';
import { planEntitlements, type AccountPlan } from './plans.ts';

/* The plans and checkout pages. They use the same light workbench look as Account settings
   (dark top bar, light workspace, Pagecraft tokens) but keep their own markup here, so the
   gated account-pages.ts and its UI baselines stay untouched. */

const esc = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const size = (bytes: number) => bytes >= 1024 ** 3 ? `${bytes / 1024 ** 3} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
const sites = (count: number | null) => count === null ? 'Unlimited sites' : `${count} site${count === 1 ? '' : 's'}`;

const checkIcon = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>';
const backIcon = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4 5.5 8l4 4"/></svg>';

const TAGLINES: Record<string, string> = {
  free: 'For trying Pagecraft with one site.',
  launch: 'For a handful of live sites.',
  studio: 'For studios running client sites.',
  pro: 'For teams that need room to grow.',
};

const CSS = `
${UI_FONTS_CSS}
${CLOUD_HEADER_CSS}
${UI_TOKENS_CSS}
${UI_FOCUS_CSS}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--pc-surface-subtle);color:#171a17;font-family:Manrope,Inter,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}button,input,select{font:inherit}
.pc-plans-app{--pc-text:#171a17;--pc-text-2:#6f7771;--pc-line:var(--pc-border);--pc-line-2:var(--pc-border-strong);--pc-green:#b7f34a;--pc-green-hi:#c5fa63;--pc-on-green:#111311;--pc-panel:#fff;min-height:100vh;display:flex;flex-direction:column}
.pc-plans-content{width:min(100%,1180px);margin:0 auto;padding:clamp(28px,5vw,56px) clamp(16px,5vw,72px) 72px}
.pc-plans-back{display:inline-flex;align-items:center;gap:6px;margin:0 0 18px;color:var(--pc-text-2);font:500 .78rem/1.4 "DM Sans",system-ui,sans-serif;text-decoration:none}
.pc-plans-back:hover{color:var(--pc-text)}
.pc-plans-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding-bottom:24px;border-bottom:1px solid var(--pc-line)}
.pc-plans-head h1{margin:0 0 8px;font-size:clamp(1.8rem,3.3vw,2.5rem);line-height:1;letter-spacing:-.04em}
.pc-plans-head p{margin:0;max-width:60ch;color:var(--pc-text-2);font-size:.9rem;line-height:1.5}
.pc-plan-badge{display:inline-flex;align-items:center;min-height:28px;padding:0 11px;border-radius:999px;background:var(--pc-green);color:var(--pc-on-green);font:700 .72rem/1 "DM Sans",system-ui,sans-serif}
.pc-plans-notice{margin:24px 0 0;padding:11px 13px;border:1px solid #b9d791;border-radius:var(--pc-control-radius);background:#edf4e3;color:#263d20;font-size:.84rem;line-height:1.5}
.pc-plans-notice.error{border-color:#b45b53;background:#fff0ed;color:#6f201b}
.pc-plans-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-top:28px}
.pc-plan-card{display:flex;flex-direction:column;margin:0;padding:22px;border:1px solid var(--pc-line);border-radius:var(--pc-radius-card);background:var(--pc-panel)}
.pc-plan-card.is-current{border-color:var(--pc-text);box-shadow:inset 0 0 0 1px var(--pc-text)}
.pc-plan-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:28px}
.pc-plan-card h2{margin:0;font-size:1.12rem;letter-spacing:-.02em;line-height:1.3}
.pc-plan-card-tagline{margin:6px 0 0;color:var(--pc-text-2);font-size:.8rem;line-height:1.5}
.pc-plan-card-limits{display:grid;gap:2px;margin:20px 0 0;padding:16px 0;border-top:1px solid var(--pc-line);border-bottom:1px solid var(--pc-line)}
.pc-plan-card-limits strong{font-size:1.35rem;letter-spacing:-.03em;line-height:1.2}
.pc-plan-card-limits span{color:var(--pc-text-2);font:400 .8rem/1.5 "DM Sans",system-ui,sans-serif}
.pc-plan-card ul{display:grid;gap:10px;margin:16px 0 0;padding:0;list-style:none;font:400 .8rem/1.45 "DM Sans",system-ui,sans-serif}
.pc-plan-card li{display:grid;grid-template-columns:16px minmax(0,1fr);gap:8px;align-items:start}
.pc-plan-card li svg{margin-top:1px;color:#4f7f16}
.pc-plan-card-action{display:grid;gap:12px;margin-top:auto;padding-top:22px}
.pc-interval{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;margin:0;padding:4px;border:1px solid var(--pc-line);border-radius:var(--pc-control-radius);background:var(--pc-surface-muted)}
.pc-interval legend{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.pc-interval label{position:relative;display:grid;place-items:center;min-height:32px;border-radius:6px;color:var(--pc-text-2);font:600 .76rem/1 "DM Sans",system-ui,sans-serif;cursor:pointer}
.pc-interval input{position:absolute;opacity:0;pointer-events:none}
.pc-interval label:has(input:checked){background:var(--pc-panel);color:var(--pc-text);box-shadow:0 1px 2px rgba(17,19,17,.08),0 0 0 1px var(--pc-line)}
.pc-interval label:has(input:focus-visible){outline:2px solid var(--pc-text);outline-offset:1px}
.pc-plan-single{display:grid;place-items:center;min-height:42px;color:var(--pc-text-2);font:500 .76rem/1.4 "DM Sans",system-ui,sans-serif}
.pc-plans-btn{width:100%;min-height:var(--pc-control-height);display:inline-flex;align-items:center;justify-content:center;padding:var(--pc-control-padding);border:1px solid var(--pc-line-2);border-radius:var(--pc-control-radius);background:var(--pc-panel);color:var(--pc-text);font-size:var(--pc-control-font,.875rem);font-weight:600;text-decoration:none;cursor:pointer}
.pc-plans-btn.primary{border-color:var(--pc-green);background:var(--pc-green);color:var(--pc-on-green)}
.pc-plans-btn.primary:hover{background:var(--pc-green-hi);border-color:var(--pc-green-hi)}
.pc-plans-btn[aria-disabled="true"]{background:var(--pc-surface-muted);color:var(--pc-text-2);cursor:default}
.pc-plans-subscription{margin-top:28px;padding:22px;border:1px solid var(--pc-line);border-radius:var(--pc-radius-card);background:var(--pc-panel)}
.pc-plans-subscription h2{margin:0 0 4px;font-size:1.12rem;letter-spacing:-.02em}
.pc-plans-subscription>p{margin:0;color:var(--pc-text-2);font-size:.8rem;line-height:1.5}
.pc-plans-subscription dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin:18px 0 0;padding-top:18px;border-top:1px solid var(--pc-line)}
.pc-plans-subscription dt{color:var(--pc-text-2);font:500 .72rem/1.4 "DM Sans",system-ui,sans-serif}
.pc-plans-subscription dd{margin:4px 0 0;font-size:.9rem;font-weight:600}
.pc-plans-foot{margin:28px 0 0;padding-top:20px;border-top:1px solid var(--pc-line);color:var(--pc-text-2);font:400 .78rem/1.6 "DM Sans",system-ui,sans-serif}
.pc-plans-foot a{text-underline-offset:3px}
.pc-checkout{width:min(100%,520px);margin:clamp(40px,10vh,96px) auto 0;padding:28px;border:1px solid var(--pc-line);border-radius:var(--pc-radius-card);background:var(--pc-panel);text-align:center}
.pc-checkout h1{margin:0 0 8px;font-size:1.4rem;letter-spacing:-.03em}
.pc-checkout p{margin:0;color:var(--pc-text-2);font-size:.86rem;line-height:1.55}
.pc-checkout .pc-plans-btn{width:auto;margin-top:20px;padding-inline:16px}
.pc-checkout-spinner{width:28px;height:28px;margin:0 auto 18px;border:3px solid var(--pc-line);border-top-color:#4f7f16;border-radius:50%;animation:pc-spin 0.9s linear infinite}
@keyframes pc-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.pc-checkout-spinner{animation:none}}
@media(max-width:640px){.pc-plans-head{flex-direction:column;align-items:flex-start}.pc-plan-card{padding:18px}}
`;

const page = (title: string, content: string, scripts = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><link rel="icon" type="image/svg+xml" href="/brand/pagecraft-favicon.svg"><title>${esc(title)} — Pagecraft</title>
<style>${CSS}</style></head><body><main class="pc-plans-app">${cloudHeader('Account', '')}${content}</main>${scripts}</body></html>`;

export interface PlanOffer { plan: AccountPlan; intervals: ('monthly' | 'yearly')[] }
export interface PlanSubscriptionView { plan: string; status: string; scheduledChange: string | null; currentPeriodEnd: string | null }

export interface PlansPageInput {
  current: AccountPlan;
  /** Paid plans that can be bought now; empty when checkout is off. */
  offers: PlanOffer[];
  /** False when billing is not configured at all. */
  checkoutReady: boolean;
  subscriptions: PlanSubscriptionView[];
  supportEmail: string;
  notice?: { error?: string; message?: string };
}

const FEATURES = [
  'Drafts count toward your sites',
  'Media storage shared across your sites',
  'Sites you collaborate on never count',
];

const card = (plan: AccountPlan, current: AccountPlan, action: string) => {
  const limits = planEntitlements(plan);
  const isCurrent = plan === current;
  return `<div class="pc-plan-card-head"><h2>${esc(limits.label)}</h2>${isCurrent ? '<span class="pc-plan-badge">Current plan</span>' : ''}</div>
<p class="pc-plan-card-tagline">${esc(TAGLINES[plan] ?? '')}</p>
<div class="pc-plan-card-limits"><strong>${esc(sites(limits.ownedSites))}</strong><span>${esc(size(limits.storageBytes))} of media storage</span></div>
<ul>${FEATURES.map(item => `<li>${checkIcon}<span>${esc(item)}</span></li>`).join('')}</ul>
<div class="pc-plan-card-action">${action}</div>`;
};

export function accountPlansPage(input: PlansPageInput) {
  const { current, offers, subscriptions } = input;
  const notice = input.notice?.error
    ? `<p class="pc-plans-notice error" role="alert">${esc(input.notice.error)}</p>`
    : input.notice?.message ? `<p class="pc-plans-notice" role="status">${esc(input.notice.message)}</p>` : '';

  const subscription = subscriptions.length ? `<section class="pc-plans-subscription" aria-labelledby="plans-subscription">
<h2 id="plans-subscription">Your subscription</h2>
<p>To change or cancel, use the link in your Paddle receipt email, or write to <a href="mailto:${esc(input.supportEmail)}">${esc(input.supportEmail)}</a>.</p>
${subscriptions.map(row => `<dl><div><dt>Plan</dt><dd>${esc(label(row.plan))}</dd></div><div><dt>Status</dt><dd>${esc(label(row.status.replace('_', ' ')))}${row.scheduledChange === 'cancel' ? ', ends at period end' : ''}</dd></div>${row.currentPeriodEnd ? `<div><dt>${row.scheduledChange === 'cancel' ? 'Ends' : 'Renews'}</dt><dd>${esc(row.currentPeriodEnd.slice(0, 10))}</dd></div>` : ''}</dl>`).join('')}
</section>` : '';

  const freeAction = current === 'free'
    ? '<span class="pc-plans-btn" aria-disabled="true">Your current plan</span>'
    : '<span class="pc-plans-btn" aria-disabled="true">Always free</span>';
  const offerCards = offers.map(offer => {
    const id = `interval-${offer.plan}`;
    const interval = offer.intervals.length > 1
      ? `<fieldset class="pc-interval"><legend>Billing for ${esc(label(offer.plan))}</legend>${offer.intervals.map((value, index) => `<label><input type="radio" name="interval" value="${value}" id="${id}-${value}"${index === 0 ? ' checked' : ''}>${value === 'monthly' ? 'Monthly' : 'Yearly'}</label>`).join('')}</fieldset>`
      : `<input type="hidden" name="interval" value="${offer.intervals[0]}"><span class="pc-plan-single">Billed ${offer.intervals[0] === 'monthly' ? 'monthly' : 'yearly'}</span>`;
    return `<form method="post" action="/account/plans/checkout" class="pc-plan-card${offer.plan === current ? ' is-current' : ''}"><input type="hidden" name="plan" value="${esc(offer.plan)}">${card(offer.plan, current, `${interval}<button type="submit" class="pc-plans-btn primary">Choose ${esc(label(offer.plan))}</button>`)}</form>`;
  }).join('');
  const currentPaidCard = current !== 'free' && !offers.some(offer => offer.plan === current)
    ? `<div class="pc-plan-card is-current">${card(current, current, '<span class="pc-plans-btn" aria-disabled="true">Your current plan</span>')}</div>`
    : '';
  const grid = `<div class="pc-plans-grid"><div class="pc-plan-card${current === 'free' ? ' is-current' : ''}">${card('free', current, freeAction)}</div>${currentPaidCard}${offerCards}</div>`;

  const foot = !input.checkoutReady
    ? `Paid plans are not available yet. Free stays free. Need more room now? Write to <a href="mailto:${esc(input.supportEmail)}">${esc(input.supportEmail)}</a>.`
    : subscriptions.length
      ? 'Each account has one subscription. Plan changes go through support for now.'
      : 'Payments are handled by Paddle, our payment provider. You see the price and any tax in checkout before you pay. Free stays free.';

  const content = `<div class="pc-plans-content"><a class="pc-plans-back" href="/account?tab=plan">${backIcon}Account settings</a>
<header class="pc-plans-head"><div><h1>Plans</h1><p>Every plan includes the full editor, publishing and collaboration. Paid plans add more sites and media storage.</p></div></header>
${notice}${subscription}${grid}<p class="pc-plans-foot">${foot}</p></div>`;
  return page('Plans', content);
}

export function accountCheckoutPage(settings: { token: string; sandbox: boolean }) {
  const json = JSON.stringify(settings).replace(/</g, '\\u003c');
  const content = `<div class="pc-plans-content"><section class="pc-checkout" aria-labelledby="checkout-title"><div class="pc-checkout-spinner" aria-hidden="true"></div><h1 id="checkout-title">Opening secure checkout</h1><p>Paddle, our payment provider, opens checkout on this page. If nothing appears in a few seconds, return to plans and try again.</p><a class="pc-plans-btn" href="/account/plans">Back to plans</a></section></div>`;
  const scripts = `<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
<script>(()=>{const s=${json};if(!window.Paddle)return;if(s.sandbox)Paddle.Environment.set('sandbox');Paddle.Initialize({token:s.token,eventCallback:e=>{if(e.name==='checkout.completed')location.href='/account/plans?message=checkout_complete';if(e.name==='checkout.closed')location.href='/account/plans?message=checkout_closed';}});})();</script>`;
  return page('Checkout', content, scripts);
}
