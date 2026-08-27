import type { Role, User } from './auth.ts';

const esc = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const messages: Record<string, string> = {
  invalid: 'Please check the information below and try again.',
  auth: 'We could not sign you in with those details.',
  oauth: 'Google sign-in is unavailable right now. Please use your email and password.',
  verify: 'Confirm your email before signing in.',
  expired: 'That confirmation link is invalid or has expired.',
  reset: 'That reset link is invalid or has expired.',
  mismatch: 'The passwords do not match.',
  password: 'Use at least 12 characters for your password.',
  challenge: 'Please complete the security check and try again.',
  origin: 'That request could not be verified. Refresh the page and try again.',
  limit: 'You can create up to three sites. Collaborator sites do not count toward this limit.'
};

const shell = (title: string, body: string, turnstileSiteKey?: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><link rel="icon" type="image/svg+xml" href="/brand/pagecraft-favicon.svg"><title>${esc(title)} — Pagecraft</title>
<style>
:root{--ink:#172019;--muted:#667067;--paper:#f3f0e7;--surface:#fffefa;--line:#d8d5ca;--green:#b7f34a;--green-dark:#446c13;--danger:#9b2c25;font-family:Manrope,Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--paper)}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--paper);color:var(--ink)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}a{color:inherit}button,input{font:inherit}button,.button{min-height:42px;border:1px solid var(--ink);border-radius:5px;padding:.65rem 1rem;background:var(--ink);color:#fff;font-weight:700;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:.45rem}.primary{background:var(--green);border-color:#91c630;color:var(--ink)}.secondary{background:transparent;color:var(--ink);border-color:var(--line)}button:hover,.button:hover{filter:brightness(.96)}button:disabled{cursor:not-allowed;opacity:.52}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #769f38;outline-offset:3px}.account{width:min(100% - 2rem,430px);margin:0 auto;padding:clamp(3rem,12vh,8rem) 0}.brand{width:max-content;display:inline-flex;align-items:center;background:#111311;padding:.72rem .82rem;margin-bottom:1.4rem;text-decoration:none}.brand img{display:block;width:150px;height:auto}.brand.compact{padding:.5rem .58rem;margin:0}.brand.compact img{width:118px}.panel{background:var(--surface);border:1px solid var(--line);padding:clamp(1.4rem,5vw,2.2rem)}h1{font-size:clamp(1.7rem,5vw,2.25rem);line-height:1.08;letter-spacing:-.04em;margin:0 0 .7rem}p{color:var(--muted);margin:.3rem 0 1.4rem}.field{margin:0 0 1rem}.field label{display:block;font-size:.82rem;font-weight:700;margin-bottom:.4rem}.field input{width:100%;min-height:45px;border:1px solid #b9b7ae;border-radius:4px;background:#fff;padding:.65rem .75rem;color:var(--ink)}.field small{display:block;color:var(--muted);margin-top:.35rem}.stack{display:grid;gap:.75rem}.stack button{width:100%}.oauth{width:100%;background:#fff;color:var(--ink);border-color:#b9b7ae}.oauth svg{width:18px;height:18px;flex:0 0 auto}.divider{display:flex;align-items:center;gap:.75rem;margin:1.15rem 0;color:var(--muted);font-size:.75rem}.divider:before,.divider:after{content:"";height:1px;background:var(--line);flex:1}.foot{font-size:.86rem;text-align:center;margin-top:1.25rem}.sub-foot{font-size:.82rem;text-align:center;margin:.75rem 0 0}.notice{border:1px solid #b9d791;background:#edf4e3;color:var(--ink);padding:.75rem .85rem;margin:0 0 1rem;font-size:.88rem}.notice.error{border-color:#e3aaa5;background:#fff0ed;color:#6f201b}.dashboard{width:min(100% - 2rem,1100px);margin:0 auto;padding:1.25rem 0 4rem}.topbar{min-height:66px;display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--line)}.actions{display:flex;align-items:center;gap:.6rem}.actions form{margin:0}.dashboard-header{display:flex;align-items:end;justify-content:space-between;gap:2rem;padding:clamp(2.5rem,8vw,5rem) 0 1.5rem}.dashboard-header h1{margin:0}.create-control{width:min(100%,46rem);display:grid;grid-template-columns:minmax(16rem,1fr) auto;gap:.5rem 1.25rem;align-items:center}.create-control .limit-note{margin:0}.eyebrow{font-size:.75rem;text-transform:uppercase;letter-spacing:.11em;font-weight:800;color:var(--green-dark);margin-bottom:.55rem}.site-list{border-top:1px solid var(--ink)}.site-row{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(9rem,.8fr) minmax(8rem,.62fr) auto;gap:1.25rem;align-items:center;padding:1.2rem 0;border-bottom:1px solid var(--line)}.site-name{font-size:1rem;font-weight:800;margin-bottom:.18rem}.site-url{font-size:.82rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.meta-label{display:block;font-size:.67rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.22rem}.meta-value{font-size:.83rem}.state{display:inline-flex;align-items:center;gap:.45rem}.state:before{content:"";width:.48rem;height:.48rem;border-radius:50%;background:var(--green-dark)}.state.draft:before{background:#c3781d}.row-actions{display:flex;gap:.5rem}.row-actions .button{white-space:nowrap}.empty{padding:clamp(2rem,8vw,5rem) 0;border-top:1px solid var(--ink);border-bottom:1px solid var(--line);display:grid;grid-template-columns:1.1fr .9fr;gap:3rem;align-items:start}.empty h2{font-size:1.35rem;margin:0 0 .45rem}.new-form{display:flex;gap:.55rem}.new-form input{min-width:0;flex:1;min-height:42px;border:1px solid #b9b7ae;border-radius:4px;padding:.6rem .7rem}.limit-note{max-width:34rem;color:var(--muted);font-size:.85rem;margin:.5rem 0 0}@media(max-width:760px){.dashboard-header{align-items:start;flex-direction:column}.create-control{grid-template-columns:1fr}.site-row{grid-template-columns:1fr 1fr;gap:.9rem}.site-title,.row-actions{grid-column:1/-1}.row-actions .button{flex:1}.empty{grid-template-columns:1fr;gap:1.5rem}.topbar .secondary{padding:.55rem .7rem}.new-form{width:100%;flex-direction:column}}@media(max-width:480px){.account-email{display:none}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>${turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ''}
</head><body>${body}<script>document.addEventListener('submit',event=>{const button=event.target.querySelector('button[type="submit"]');if(!button)return;button.disabled=true;button.setAttribute('aria-busy','true');button.dataset.label=button.textContent;button.textContent='Working…';});</script></body></html>`;

const notice = (code?: string, success?: string) => success
  ? `<div class="notice" role="status">${esc(success)}</div>`
  : code && messages[code] ? `<div class="notice error" role="alert">${esc(messages[code])}</div>` : '';
const nextField = (next?: string) => next ? `<input type="hidden" name="next" value="${esc(next)}">` : '';
const challenge = (siteKey: string, action: string) =>
  `<div class="cf-turnstile" data-sitekey="${esc(siteKey)}" data-action="${esc(action)}"></div>`;
const brand = (compact = false) => `<a class="brand${compact ? ' compact' : ''}" href="/" aria-label="Pagecraft sites"><img src="/brand/pagecraft-logo.svg" width="482" height="95" alt="Pagecraft"></a>`;
const googleMark = `<svg aria-hidden="true" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.614Z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.44 1.345l2.582-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"/></svg>`;

export const signInPage = (siteKey: string, input: { error?: string; next?: string; message?: string } = {}) => shell('Sign in', `
<main class="account">${brand()}<section class="panel" aria-labelledby="title">
<h1 id="title">Sign in to Pagecraft</h1><p>Access your sites and continue building.</p>
${notice(input.error, input.message)}<form method="post" action="/auth/google">
${nextField(input.next)}<button class="oauth" type="submit">${googleMark} Continue with Google</button></form>
<div class="divider"><span>or sign in with email</span></div><form class="stack" method="post" action="/auth/login">
${nextField(input.next)}<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
<div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
${challenge(siteKey, 'login')}<button class="primary" type="submit">Sign in</button></form>
<p class="sub-foot"><a href="/forgot-password">Forgot password?</a></p><p class="foot">New to Pagecraft? <a href="/sign-up">Create account</a></p>
</section></main>`, siteKey);

export const signUpPage = (siteKey: string, input: { error?: string; message?: string } = {}) => shell('Create account', `
<main class="account">${brand()}<section class="panel" aria-labelledby="title">
<h1 id="title">Create your account</h1><p>Confirm your email, then start building from your sites dashboard.</p>
${notice(input.error, input.message)}<form class="stack" method="post" action="/auth/signup">
<div class="field"><label for="name">Name</label><input id="name" name="name" autocomplete="name" maxlength="120" required></div>
<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
<div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="12" required><small>At least 12 characters. Passphrases are welcome.</small></div>
<div class="field"><label for="passwordConfirm">Confirm password</label><input id="passwordConfirm" name="passwordConfirm" type="password" autocomplete="new-password" minlength="12" required></div>
${challenge(siteKey, 'signup')}<button class="primary" type="submit">Create account</button></form>
<p class="foot">Already registered? <a href="/sign-in">Sign in</a></p>
</section></main>`, siteKey);

export const forgotPage = (siteKey: string, input: { error?: string; message?: string } = {}) => shell('Reset password', `
<main class="account">${brand()}<section class="panel" aria-labelledby="title">
<h1 id="title">Reset your password</h1><p>We will send reset instructions if an account matches that email.</p>
${notice(input.error, input.message)}<form class="stack" method="post" action="/auth/forgot-password">
<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
${challenge(siteKey, 'forgot')}<button class="primary" type="submit">Send reset instructions</button></form>
<p class="foot"><a href="/sign-in">Back to sign in</a></p></section></main>`, siteKey);

export const resetPage = (input: { error?: string } = {}) => shell('Choose a password', `
<main class="account">${brand()}<section class="panel" aria-labelledby="title">
<h1 id="title">Choose a new password</h1><p>Use at least 12 characters. Signing in again may be required on other devices.</p>
${notice(input.error)}<form class="stack" method="post" action="/auth/reset-password">
<div class="field"><label for="password">New password</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="12" required></div>
<div class="field"><label for="passwordConfirm">Confirm password</label><input id="passwordConfirm" name="passwordConfirm" type="password" autocomplete="new-password" minlength="12" required></div>
<button class="primary" type="submit">Update password</button></form></section></main>`);

export interface DashboardSite {
  id: string; name: string; url: string; role: Role; updatedAt: string; published: boolean;
}
const relativeTime = (iso: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(iso));
};

export const dashboardPage = (user: User, sites: DashboardSite[], ownerCount: number, error?: string) => {
  const atLimit = ownerCount >= 3;
  const rows = sites.map(site => `<article class="site-row">
    <div class="site-title"><div class="site-name">${esc(site.name)}</div><div class="site-url">${esc(site.url)}</div></div>
    <div><span class="meta-label">Last edited</span><span class="meta-value">${esc(relativeTime(site.updatedAt))}</span></div>
    <div><span class="meta-label">Access</span><span class="meta-value">${site.role === 'owner' ? 'Owner' : 'Content'}</span><br><span class="state ${site.published ? '' : 'draft'} meta-value">${site.published ? 'Published' : 'Draft changes'}</span></div>
    <div class="row-actions"><a class="button primary" href="/edit/${encodeURIComponent(site.id)}">Open builder</a><a class="button secondary" href="${esc(site.url)}" target="_blank" rel="noopener">View site</a></div>
  </article>`).join('');
  const create = `<div class="create-control"><form class="new-form" method="post" action="/api/sites"><label class="sr-only" for="site-name">Site name</label><input id="site-name" name="name" placeholder="Site name" maxlength="120" ${atLimit ? 'disabled' : 'required'}><button class="primary" type="submit" ${atLimit ? 'disabled' : ''}>New site</button></form><p class="limit-note">${atLimit ? messages.limit : `You can create ${3 - ownerCount} more owned ${3 - ownerCount === 1 ? 'site' : 'sites'}.`}</p></div>`;
  return shell('Sites', `<main class="dashboard"><header class="topbar">${brand(true)}<div class="actions"><span class="account-email meta-value">${esc(user.email)}</span><form method="post" action="/auth/logout"><button class="secondary" type="submit">Sign out</button></form></div></header>
  <section class="dashboard-header"><div><div class="eyebrow">Workbench</div><h1>Your sites</h1></div>${sites.length ? create : ''}</section>
  ${notice(error)}${sites.length ? `<section class="site-list" aria-label="Sites">${rows}</section>` : `<section class="empty"><div><h2>Start your first site</h2><p>Your builder opens after the site is created. You will still return here whenever you sign in.</p></div><div>${create}</div></section>`}
  </main>`);
};
