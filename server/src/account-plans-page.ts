import { accountWorkspaceShell, billingDate, renewalForm } from './account-pages.ts';
import type { User } from './auth.ts';
import { PLAN_RANK, planEntitlements, type AccountPlan } from './plans.ts';

const esc = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const size = (bytes: number) => bytes >= 1024 ** 3 ? `${bytes / 1024 ** 3} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
const sites = (count: number | null) => count === null ? 'Unlimited sites' : `${count} site${count === 1 ? '' : 's'}`;

const backIcon = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4 5.5 8l4 4"/></svg>';

const TAGLINES: Record<string, string> = {
  free: 'For trying Pagecraft with one site.',
  launch: 'For a handful of live sites.',
  studio: 'For studios running client sites.',
  pro: 'For teams that need room to grow.',
};

const CSS = `
.pc-plans-body{display:grid;gap:var(--pc-space-6);max-width:1180px}
.pc-plans-body h2,.pc-plans-body h3{margin:0;font-size:var(--pc-section-title)}
.pc-plans-back{display:inline-flex;align-items:center;gap:var(--pc-space-1);margin-bottom:var(--pc-space-2);color:var(--pc-text-2);font:var(--pc-type-label);text-underline-offset:3px}
.pc-plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:var(--pc-space-4);margin-top:var(--pc-space-4)}
.pc-plan-card{display:flex;flex-direction:column;min-width:0;padding:var(--pc-space-5);border:1px solid var(--pc-line);border-radius:var(--pc-radius-card);background:var(--pc-panel)}
.pc-plan-card.is-current{border-color:var(--pc-text)}
.pc-plan-card-head,.pc-plans-actions{display:flex;align-items:center;flex-wrap:wrap;gap:var(--pc-action-gap)}
.pc-plan-card-head{justify-content:space-between;min-height:28px}
.pc-plan-current{padding:3px 9px;border-radius:var(--pc-radius-pill);background:var(--pc-selection-bg);color:var(--pc-selection-text);font:var(--pc-type-table-label)}
.pc-plan-card p{margin:var(--pc-space-1) 0 0;font:var(--pc-type-description)}
.pc-plan-card-limits{display:grid;gap:var(--pc-space-1);margin-top:var(--pc-space-4);padding-top:var(--pc-space-4);border-top:1px solid var(--pc-line)}
.pc-plan-card-limits strong{font-size:var(--pc-text-section)}
.pc-plan-card-limits span{font:var(--pc-type-label);color:var(--pc-text-2)}
.pc-plan-prices{display:grid;gap:var(--pc-space-1);margin:var(--pc-space-3) 0 0}
.pc-plan-prices div{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:var(--pc-space-2)}
.pc-plan-prices dt{color:var(--pc-text-2);font:var(--pc-type-label)}
.pc-plan-prices dd{margin:0;font:var(--pc-type-control);font-variant-numeric:tabular-nums}
.pc-plan-card-action{display:grid;gap:var(--pc-space-2);margin:auto 0 0;padding-top:var(--pc-space-5)}
.pc-plan-card-action .pc-btn{width:100%;min-width:0}
.pc-interval{display:flex;gap:var(--pc-space-1);margin:0;padding:3px;min-width:0;border:1px solid var(--pc-line);border-radius:var(--pc-control-radius);background:var(--pc-surface-muted)}
.pc-interval label{position:relative;display:grid;place-items:center;flex:1;min-height:var(--pc-control-compact);border-radius:var(--pc-radius-inner);color:var(--pc-text-2);font:var(--pc-type-label);cursor:pointer}
.pc-interval label:has(input:checked){background:var(--pc-panel);color:var(--pc-text);box-shadow:0 0 0 1px var(--pc-line-2)}
.pc-interval label:has(input:focus-visible){outline:2px solid var(--pc-text);outline-offset:1px}
.pc-plan-single{font:var(--pc-type-label);color:var(--pc-text-2)}
.pc-plans-summary{border-bottom:1px solid var(--pc-line);padding-bottom:var(--pc-space-5)}
.pc-plans-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:var(--pc-space-4);margin:var(--pc-space-3) 0 0}
.pc-plans-facts dt{color:var(--pc-text-2);font:var(--pc-type-label)}
.pc-plans-facts dd{margin:var(--pc-space-1) 0 0;font:var(--pc-type-control);overflow-wrap:anywhere}
.pc-plans-summary .pc-plans-actions{margin-top:var(--pc-space-4)}
.pc-plans-section-copy,.pc-plans-note{margin:var(--pc-space-2) 0 0;font:var(--pc-type-description)}
.pc-plans-note a{text-underline-offset:3px}
.pc-plans-review{max-width:760px}
.pc-plans-review .pc-plans-actions{margin-top:var(--pc-space-5)}
.pc-plans-body .notice,.pc-plans-actions form{margin:0}
@media(max-width:600px){.pc-plan-card{padding:var(--pc-space-4)}.pc-plans-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.pc-plans-facts>div:has(time){grid-column:1/-1}.pc-interval label{min-height:var(--pc-control-height)}}
`;

function billingPage(user: User, title: string, description: string, content: string, backToPlans = false, scripts = '') {
  const back = backToPlans ? ['/account/plans', 'Plans'] : ['/account?tab=plan', 'Plan &amp; billing'];
  return accountWorkspaceShell(user, title, `<div class="pc-content">
<header class="pc-workspace-head"><div><a class="pc-plans-back" href="${back[0]}">${backIcon}${back[1]}</a><h1>${esc(title)}</h1><p>${esc(description)}</p></div></header>
<div class="pc-plans-body">${content}</div></div>`, { styles: CSS, scripts, account: 'plan' });
}

type Interval = 'monthly' | 'yearly';
export interface PlanOffer { plan: AccountPlan; intervals: Interval[]; prices?: Partial<Record<Interval, string>> }
export interface PlanSubscriptionView {
  plan: string;
  status: string;
  scheduledChange: string | null;
  currentPeriodEnd: string | null;
  interval?: Interval;
  manageable?: boolean;
}
export interface PlanReview {
  action: 'change' | 'cancel' | 'renew';
  plan: string;
  interval?: Interval;
  immediate?: string;
  nextCharge?: string;
  effectiveDate?: string;
  token: string;
}
export interface PlansPageInput {
  user: User;
  current: AccountPlan;
  unrestricted?: boolean;
  offers: PlanOffer[];
  checkoutReady: boolean;
  subscriptions: PlanSubscriptionView[];
  supportEmail: string;
  notice?: { error?: string; message?: string };
  review?: PlanReview;
}

function subscriptionSummary(input: PlansPageInput) {
  if (!input.subscriptions.length) return '';
  const rows = input.subscriptions.map(row => {
    const ends = row.scheduledChange === 'cancel';
    const renewing = ['active', 'trialing'].includes(row.status) && !row.scheduledChange;
    const date = billingDate(row.currentPeriodEnd);
    const action = row.manageable && (ends || renewing)
      ? renewalForm(ends ? 'renew' : 'cancel', ends ? 'Turn on auto-renew' : 'Turn off auto-renew')
      : '';
    return `<dl class="pc-plans-facts"><div><dt>Plan</dt><dd>${esc(label(row.plan))}</dd></div>
<div><dt>Status</dt><dd>${esc(label(row.status.replaceAll('_', ' ')))}</dd></div>
${row.interval ? `<div><dt>Billing</dt><dd>${esc(label(row.interval))}</dd></div>` : ''}
${ends || renewing ? `<div><dt>Auto-renew</dt><dd>${ends ? 'Off' : 'On'}</dd></div>` : ''}
${date ? `<div><dt>${ends ? 'Ends' : renewing ? 'Renews' : 'Period ends'}</dt><dd>${date}</dd></div>` : ''}</dl>
${action ? `<div class="pc-plans-actions">${action}</div><p class="pc-plans-note">${ends ? 'You can restart automatic billing before the subscription ends.' : 'Turning off auto-renew cancels the subscription at the end of the paid period.'}</p>` : ''}`;
  }).join('');
  const help = input.subscriptions.some(row => !row.manageable)
    ? `<p class="pc-plans-note">For help with this subscription, <a href="mailto:${esc(input.supportEmail)}">contact support</a>.</p>` : '';
  return `<section class="pc-plans-summary" aria-labelledby="plans-subscription"><h2 id="plans-subscription">Your subscription</h2>${rows}${help}</section>`;
}

function intervalFields(intervals: Interval[], plan: string, preferred?: Interval) {
  if (intervals.length === 1) return `<input type="hidden" name="interval" value="${intervals[0]}"><span class="pc-plan-single">Billed ${intervals[0]}</span>`;
  const selected = preferred && intervals.includes(preferred) ? preferred : intervals[0];
  return `<fieldset class="pc-interval"><legend class="sr-only">Billing for ${esc(plan)}</legend>${intervals.map(value =>
    `<label><input class="sr-only" type="radio" name="interval" value="${value}"${selected === value ? ' checked' : ''}>${label(value)}</label>`).join('')}</fieldset>`;
}

function cardAction(plan: AccountPlan, input: PlansPageInput, offer?: PlanOffer) {
  const sub = input.subscriptions.length === 1 ? input.subscriptions[0] : undefined;
  if (plan === 'free') {
    if (sub?.manageable && !sub.scheduledChange && sub.plan === input.current) return renewalForm('cancel', 'Downgrade to Free');
    return '';
  }

  if (!offer || !offer.intervals.length || (input.subscriptions.length && (!sub?.manageable || sub.scheduledChange))) return '';
  const subscribed = sub?.plan === plan;
  const hasGrant = !sub && input.current !== 'free';
  if (hasGrant && PLAN_RANK[plan] <= PLAN_RANK[input.current]) return '';
  const intervals = subscribed ? offer.intervals.filter(value => sub.interval && value !== sub.interval) : offer.intervals;
  if (!intervals.length) return '';

  const downgrade = PLAN_RANK[plan] < PLAN_RANK[planEntitlements(sub?.plan ?? input.current).id];
  const text = subscribed ? `Switch to ${intervals[0]} billing` : `${downgrade ? 'Downgrade' : 'Upgrade'} to ${label(plan)}`;
  return `<form class="pc-plan-card-action" method="post" action="/account/plans/${sub ? 'review' : 'checkout'}">
${sub ? '<input type="hidden" name="action" value="change">' : ''}<input type="hidden" name="plan" value="${esc(plan)}">
${subscribed ? `<input type="hidden" name="interval" value="${intervals[0]}">` : intervalFields(intervals, label(plan), sub?.interval)}
<button class="pc-btn${subscribed || downgrade ? '' : ' primary'}" type="submit">${esc(text)}</button></form>`;
}

function planCard(plan: AccountPlan, input: PlansPageInput) {
  const limits = planEntitlements(plan);
  const current = plan === input.current;
  const offer = input.offers.find(item => item.plan === plan);
  const prices = plan === 'free' ? '<div><dt>Price</dt><dd>$0</dd></div>' : offer?.intervals.map(interval =>
    offer.prices?.[interval] ? `<div><dt>${label(interval)}</dt><dd>${esc(offer.prices[interval])}</dd></div>` : '').join('');
  const action = cardAction(plan, input, offer);
  return `<article class="pc-plan-card${current ? ' is-current' : ''}" aria-labelledby="plan-${plan}">
<div class="pc-plan-card-head"><h3 id="plan-${plan}">${esc(limits.label)}</h3>${current ? '<span class="pc-plan-current">Current plan</span>' : ''}</div>
<p>${esc(TAGLINES[plan])}</p><div class="pc-plan-card-limits"><strong>${esc(sites(limits.ownedSites))}</strong><span>${esc(size(limits.storageBytes))} of media storage</span></div>
${prices ? `<dl class="pc-plan-prices">${prices}</dl>` : ''}
${plan === 'free' && action ? `<div class="pc-plan-card-action">${action}</div>` : action}</article>`;
}

function reviewChange(input: PlansPageInput, review: PlanReview) {
  const plan = esc(label(review.plan));
  const date = billingDate(review.effectiveDate);
  let title: string, description: string, confirm: string, details: string;
  if (review.action === 'change') {
    title = 'Review plan change';
    description = 'Check the billing adjustment before switching plans.';
    confirm = 'Confirm plan change';
    const limits = planEntitlements(review.plan);
    details = `<h2>${plan}${review.interval ? ` · ${label(review.interval)}` : ''}</h2>
<p class="pc-plans-section-copy">The subscription changes immediately. This plan includes ${esc(sites(limits.ownedSites).toLowerCase())} and ${esc(size(limits.storageBytes))} of media storage. Existing sites and media stay in your account.</p>
<dl class="pc-plans-facts">${review.immediate ? `<div><dt>Prorated adjustment</dt><dd>${esc(review.immediate)}</dd></div>` : ''}
${review.nextCharge ? `<div><dt>Next charge</dt><dd>${esc(review.nextCharge)}</dd></div>` : ''}
${date ? `<div><dt>Next billing date</dt><dd>${date}</dd></div>` : ''}</dl>`;
  } else if (review.action === 'cancel') {
    title = 'Cancel subscription';
    description = 'Turning off auto-renew cancels your subscription at the end of this billing period.';
    confirm = 'Confirm cancellation';
    details = `<h2>Keep ${plan} until ${date || 'the end of this billing period'}</h2>
<p class="pc-plans-section-copy">${input.unrestricted ? 'Your account keeps unrestricted access.' : 'Your published sites stay online and your sites and media remain in your account.'} You can turn auto-renew back on before the subscription ends.</p>`;
  } else {
    title = 'Turn on auto-renew';
    description = 'Resume automatic billing for your subscription.';
    confirm = 'Confirm auto-renew';
    details = `<h2>Keep ${plan}</h2><p class="pc-plans-section-copy">Your subscription will renew ${date ? `on ${date}` : 'at the end of this billing period'}.</p>`;
  }
  const content = `<section class="pc-plans-review">${details}<form class="pc-plans-actions" method="post" action="/account/plans/confirm">
<input type="hidden" name="token" value="${esc(review.token)}"><button type="submit" class="pc-btn${review.action === 'cancel' ? ' danger' : ' primary'}">${confirm}</button>
<a class="pc-btn" href="/account/plans">Back to plans</a></form></section>`;
  return billingPage(input.user, title, description, content, true);
}

export function accountPlansPage(input: PlansPageInput) {
  if (input.review) return reviewChange(input, input.review);
  const notice = input.notice?.error ? `<div class="notice error" role="alert">${esc(input.notice.error)}</div>`
    : input.notice?.message ? `<div class="notice" role="status">${esc(input.notice.message)}</div>` : '';
  const subscription = subscriptionSummary(input);
  if (input.unrestricted) return billingPage(input.user, 'Unrestricted', 'Your account has unlimited sites and media storage.', notice + subscription);

  const plans = [...new Set<AccountPlan>(['free', input.current, ...input.offers.map(offer => offer.plan)])].sort((a, b) => PLAN_RANK[a] - PLAN_RANK[b]);
  const comparison = `<section aria-labelledby="plans-compare"><h2 id="plans-compare">Compare plans</h2>
<p class="pc-plans-section-copy">Drafts count toward your site limit. Storage is shared across your sites. Sites you collaborate on are excluded.</p>
<div class="pc-plans-grid">${plans.map(plan => planCard(plan, input)).join('')}</div>
${input.offers.length ? `<p class="pc-plans-note">${input.subscriptions.length ? 'Review your total, including any tax and prorated adjustment, before confirming a plan change.' : 'Paddle shows your total, including any tax, in checkout.'}</p>` : ''}</section>`;
  const foot = !input.checkoutReady
    ? `Paid plans are unavailable right now. <a href="mailto:${esc(input.supportEmail)}">Contact support</a> for help.`
    : '';
  return billingPage(input.user, 'Plans', 'Every plan includes the full editor, publishing and collaboration. Paid plans add more sites and media storage.',
    notice + subscription + comparison + (foot ? `<p class="pc-plans-note">${foot}</p>` : ''));
}

export function accountCheckoutPage(settings: { token: string; sandbox: boolean; user: User }) {
  const json = JSON.stringify({ token: settings.token, sandbox: settings.sandbox }).replace(/</g, '\\u003c');
  const content = '<div class="pc-plans-actions"><a class="pc-btn" href="/account/plans">Back to plans</a></div>';
  const scripts = `<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
<script>(()=>{const s=${json};if(!window.Paddle)return;if(s.sandbox)Paddle.Environment.set('sandbox');Paddle.Initialize({token:s.token,eventCallback:e=>{if(e.name==='checkout.completed')location.href='/account/plans?message=checkout_complete';if(e.name==='checkout.closed')location.href='/account/plans?message=checkout_closed';}});})();</script>`;
  return billingPage(settings.user, 'Opening secure checkout', 'Paddle opens checkout on this page. If it does not appear, return to plans and try again.', content, true, scripts);
}
