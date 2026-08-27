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
<meta name="color-scheme" content="dark"><link rel="icon" type="image/svg+xml" href="/brand/pagecraft-favicon.svg"><title>${esc(title)} — Pagecraft</title>
<style>
:root{--ink:#f6f4ec;--muted:#aeb5ad;--paper:#080a08;--surface:#121512;--field:#0c100c;--line:rgba(246,244,236,.16);--green:#b7f34a;--green-dark:#91c630;--on-green:#111311;--danger:#ffb4ac;font-family:Manrope,Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--paper);color-scheme:dark}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--paper);color:var(--ink)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}a{color:inherit}button,input{font:inherit}button,.button{min-height:42px;border:1px solid var(--ink);border-radius:5px;padding:.65rem 1rem;background:var(--ink);color:#fff;font-weight:700;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:.45rem}.primary{background:var(--green);border-color:#91c630;color:var(--ink)}.secondary{background:transparent;color:var(--ink);border-color:var(--line)}button:hover,.button:hover{filter:brightness(.96)}button:disabled{cursor:not-allowed;opacity:.52}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #769f38;outline-offset:3px}.account{width:min(100% - 2rem,430px);margin:0 auto;padding:clamp(3rem,12vh,8rem) 0}.brand{width:max-content;display:inline-flex;align-items:center;background:transparent;padding:0;text-decoration:none}.account>.brand{display:flex;margin:0 auto 1.65rem}.brand img{display:block;width:190px;height:auto}.brand.compact{margin:0}.brand.compact img{width:140px}.panel{background:var(--surface);border:1px solid var(--line);padding:clamp(1.4rem,5vw,2.2rem)}h1{font-size:clamp(1.7rem,5vw,2.25rem);line-height:1.08;letter-spacing:-.04em;margin:0 0 .7rem}p{color:var(--muted);margin:.3rem 0 1.4rem}.field{margin:0 0 1rem}.field label{display:block;font-size:.82rem;font-weight:700;margin-bottom:.4rem}.field input{width:100%;min-height:45px;border:1px solid #b9b7ae;border-radius:4px;background:#fff;padding:.65rem .75rem;color:var(--ink)}.field small{display:block;color:var(--muted);margin-top:.35rem}.stack{display:grid;gap:.75rem}.stack button{width:100%}.oauth{width:100%;background:#fff;color:var(--ink);border-color:#b9b7ae}.oauth svg{width:18px;height:18px;flex:0 0 auto}.divider{display:flex;align-items:center;gap:.75rem;margin:1.15rem 0;color:var(--muted);font-size:.75rem}.divider:before,.divider:after{content:"";height:1px;background:var(--line);flex:1}.foot{font-size:.86rem;text-align:center;margin-top:1.25rem}.sub-foot{font-size:.82rem;text-align:center;margin:.75rem 0 0}.notice{border:1px solid #b9d791;background:#edf4e3;color:var(--ink);padding:.75rem .85rem;margin:0 0 1rem;font-size:.88rem}.notice.error{border-color:#e3aaa5;background:#fff0ed;color:#6f201b}.dashboard{width:min(100% - 2rem,1100px);margin:0 auto;padding:1.25rem 0 4rem}.topbar{min-height:66px;display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--line)}.actions{display:flex;align-items:center;gap:.6rem}.actions form{margin:0}.dashboard-header{display:flex;align-items:end;justify-content:space-between;gap:2rem;padding:clamp(2.5rem,8vw,5rem) 0 1.5rem}.dashboard-header h1{margin:0}.create-control{width:min(100%,46rem);display:grid;grid-template-columns:minmax(16rem,1fr) auto;gap:.5rem 1.25rem;align-items:center}.create-control .limit-note{margin:0}.eyebrow{font-size:.75rem;text-transform:uppercase;letter-spacing:.11em;font-weight:800;color:var(--green-dark);margin-bottom:.55rem}.site-list{border-top:1px solid var(--ink)}.site-row{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(9rem,.8fr) minmax(8rem,.62fr) auto;gap:1.25rem;align-items:center;padding:1.2rem 0;border-bottom:1px solid var(--line)}.site-name{font-size:1rem;font-weight:800;margin-bottom:.18rem}.site-url{font-size:.82rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.meta-label{display:block;font-size:.67rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.22rem}.meta-value{font-size:.83rem}.state{display:inline-flex;align-items:center;gap:.45rem}.state:before{content:"";width:.48rem;height:.48rem;border-radius:50%;background:var(--green-dark)}.state.draft:before{background:#c3781d}.row-actions{display:flex;gap:.5rem}.row-actions .button{white-space:nowrap}.empty{padding:clamp(2rem,8vw,5rem) 0;border-top:1px solid var(--ink);border-bottom:1px solid var(--line);display:grid;grid-template-columns:1.1fr .9fr;gap:3rem;align-items:start}.empty h2{font-size:1.35rem;margin:0 0 .45rem}.new-form{display:flex;gap:.55rem}.new-form input{min-width:0;flex:1;min-height:42px;border:1px solid #b9b7ae;border-radius:4px;padding:.6rem .7rem}.limit-note{max-width:34rem;color:var(--muted);font-size:.85rem;margin:.5rem 0 0}@media(max-width:760px){.dashboard-header{align-items:start;flex-direction:column}.create-control{grid-template-columns:1fr}.site-row{grid-template-columns:1fr 1fr;gap:.9rem}.site-title,.row-actions{grid-column:1/-1}.row-actions .button{flex:1}.empty{grid-template-columns:1fr;gap:1.5rem}.topbar .secondary{padding:.55rem .7rem}.new-form{width:100%;flex-direction:column}}@media(max-width:480px){.account-email{display:none}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
.field input,.new-form input{background:var(--field);border-color:var(--line);color:var(--ink)}.oauth{background:rgba(246,244,236,.03);border-color:var(--line);color:var(--ink)}button,.button,.primary{color:var(--on-green)}.secondary{color:var(--ink)}.notice{border-color:#3c5a2a;background:#172417;color:var(--ink)}.notice.error{border-color:#6f302b;background:#2a1513;color:#ffcbc5}.state.draft:before{background:#f1a54e}.account h1{font-size:clamp(1.55rem,4vw,1.9rem)}
.legal-links{display:flex;justify-content:center;gap:1rem;margin:1.15rem 0 0;color:var(--muted);font-size:.72rem}.legal-links a{text-underline-offset:.2em}.legal{width:min(100% - 2rem,960px);margin:0 auto;padding:0 0 4rem}.legal-header{min-height:82px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.legal-back{font-size:.84rem;color:var(--muted);text-underline-offset:.25em;transition:color .16s ease}.legal-back:hover{color:var(--ink)}.legal article{display:grid;grid-template-columns:minmax(14rem,.62fr) minmax(0,1.38fr);gap:clamp(2.5rem,8vw,7rem);padding:clamp(3.5rem,9vw,7rem) 0}.legal-intro{position:sticky;top:2rem;align-self:start}.legal-intro h1{font-size:clamp(2.35rem,6vw,4.75rem);max-width:8ch}.legal-intro>p{font-size:1rem;line-height:1.65;max-width:29rem}.legal-date{font-size:.76rem!important;text-transform:uppercase;letter-spacing:.08em}.legal-copy{border-top:1px solid var(--ink)}.legal-copy section{padding:1.5rem 0 1.7rem;border-bottom:1px solid var(--line)}.legal-copy h2{font-size:1rem;line-height:1.35;margin:0 0 .75rem}.legal-copy p{font-size:.94rem;line-height:1.72;margin:0 0 .8rem}.legal-copy p:last-child{margin-bottom:0}.legal-copy a,.legal-footer a{color:var(--ink);text-underline-offset:.2em}.legal-footer{display:flex;justify-content:space-between;gap:1rem;padding:1.4rem 0;border-top:1px solid var(--line);color:var(--muted);font-size:.78rem}@media(max-width:720px){.legal article{grid-template-columns:1fr;gap:2rem;padding:3rem 0}.legal-intro{position:static}.legal-intro h1{max-width:none}.legal-footer{flex-direction:column}.legal-header{min-height:72px}}
</style>${turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ''}
</head><body>${body}<script>document.addEventListener('submit',event=>{const button=event.target.querySelector('button[type="submit"]');if(!button)return;button.disabled=true;button.setAttribute('aria-busy','true');button.dataset.label=button.textContent;button.textContent='Working…';});</script></body></html>`;

const notice = (code?: string, success?: string) => success
  ? `<div class="notice" role="status">${esc(success)}</div>`
  : code && messages[code] ? `<div class="notice error" role="alert">${esc(messages[code])}</div>` : '';
const nextField = (next?: string) => next ? `<input type="hidden" name="next" value="${esc(next)}">` : '';
const challenge = (siteKey: string, action: string) =>
  `<div class="cf-turnstile" data-sitekey="${esc(siteKey)}" data-action="${esc(action)}" data-theme="dark"></div>`;
const brand = (compact = false) => `<a class="brand${compact ? ' compact' : ''}" href="/" aria-label="Pagecraft sites"><img src="/brand/pagecraft-logo.svg?v=dark-2" width="488" height="106" alt="Pagecraft"></a>`;
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
<nav class="legal-links" aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
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
<nav class="legal-links" aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
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

const legalShell = (title: string, intro: string, body: string) => shell(title, `
<main class="legal"><header class="legal-header">${brand(true)}<a class="legal-back" href="/sign-in">Sign in</a></header>
<article aria-labelledby="title"><div class="legal-intro"><div class="eyebrow">Legal</div><h1 id="title">${esc(title)}</h1><p>${esc(intro)}</p><p class="legal-date">Last updated August 27, 2026</p></div>
<div class="legal-copy">${body}</div></article>
<footer class="legal-footer"><span>Pagecraft is personally operated by Braudy Pedrosa in the Philippines.</span><a href="mailto:hello@braudyp.dev">hello@braudyp.dev</a></footer></main>`);

export const privacyPage = () => legalShell('Privacy Policy',
  'This policy explains what Pagecraft collects, why it is used, and the choices available to you.', `
<section><h2>1. Who operates Pagecraft</h2><p>Pagecraft is personally operated by Braudy Pedrosa in the Philippines. For privacy questions or requests, email <a href="mailto:hello@braudyp.dev">hello@braudyp.dev</a>.</p></section>
<section><h2>2. Information we collect</h2><p>We collect information you provide when you create or use an account, including your name, email address, authentication details, and profile information supplied by Google if you choose Google sign-in. Passwords are handled by our authentication provider and are not visible to Pagecraft.</p><p>We also store the websites, pages, text, images, design settings, collaborator memberships, publishing information, and WordPress connection details you choose to create or connect through Pagecraft.</p><p>Our systems may receive limited technical information needed to operate and secure the service, such as IP address, browser and device information, request timestamps, security events, and session cookies.</p></section>
<section><h2>3. How we use information</h2><p>We use this information to create and secure accounts, provide the builder and dashboard, save and publish your work, connect services you request, respond to support, prevent abuse, diagnose faults, and meet legal obligations.</p><p>We do not sell your personal information or use your private site content for advertising.</p></section>
<section><h2>4. Cookies and account sessions</h2><p>Pagecraft uses essential cookies to keep you signed in and protect authenticated requests. Cloudflare Turnstile may also process technical signals to distinguish people from automated abuse. Pagecraft does not currently use advertising cookies.</p></section>
<section><h2>5. Service providers and disclosures</h2><p>We use service providers only where needed to run Pagecraft. These currently include Supabase for authentication and database services, Google for optional sign-in, Cloudflare for security and network delivery, and Namecheap infrastructure for application hosting. If you connect WordPress or another publishing destination, information is also sent to that destination at your direction.</p><p>We may disclose information when required by law, to protect Pagecraft or others from harm, or as part of a business transfer. We do not give service providers permission to use your information for their own advertising.</p></section>
<section><h2>6. International processing</h2><p>Pagecraft and its providers may process information outside your country. We take reasonable steps to use providers and safeguards appropriate to the information and the service.</p></section>
<section><h2>7. Retention and security</h2><p>We keep account and site information while your account is active and for a reasonable period afterward when needed for recovery, security, disputes, or legal compliance. Security logs and backups may remain for a limited period. We use access controls, encrypted connections, and other reasonable safeguards, but no online service can guarantee absolute security.</p></section>
<section><h2>8. Your choices and rights</h2><p>You may ask to access, correct, export, or delete personal information associated with your account, or object to or restrict certain processing where applicable. You may also withdraw consent where consent is the basis for processing. Email <a href="mailto:hello@braudyp.dev">hello@braudyp.dev</a> from your account address so we can verify the request.</p><p>Depending on where you live, additional rights may apply. People in the Philippines may also contact the National Privacy Commission if a privacy concern cannot be resolved directly.</p></section>
<section><h2>9. Children</h2><p>Pagecraft is not directed to children under 13, and we do not knowingly collect personal information from them.</p></section>
<section><h2>10. Changes to this policy</h2><p>We may update this policy as Pagecraft changes. The date at the top shows the latest revision. Material changes will be communicated through the service or by email when appropriate.</p></section>`);

export const termsPage = () => legalShell('Terms of Service',
  'These terms govern your access to Pagecraft and the websites you create with it.', `
<section><h2>1. Agreement</h2><p>By creating an account or using Pagecraft, you agree to these Terms of Service and the <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the service.</p></section>
<section><h2>2. Accounts</h2><p>You must provide accurate information, protect your sign-in credentials, and promptly report suspected unauthorized access. You are responsible for activity under your account. You must be at least 13 years old and legally able to agree to these terms.</p></section>
<section><h2>3. Your content</h2><p>You keep ownership of the text, images, code, designs, and other content you submit. You grant Pagecraft a limited, non-exclusive license to host, process, reproduce, and transmit that content only as needed to provide, secure, and improve the service and to publish or connect destinations you request.</p><p>You are responsible for your content and must have the rights and permissions needed to use and publish it. Publicly published sites may be viewed and copied by visitors outside Pagecraft's control.</p></section>
<section><h2>4. Acceptable use</h2><p>You may not use Pagecraft to break the law; infringe intellectual property or privacy rights; distribute malware, spam, fraud, or deceptive content; exploit or disrupt the service; bypass security or usage limits; access another person's account or content without permission; or publish content that creates a credible risk of harm.</p></section>
<section><h2>5. Service limits and changes</h2><p>Pagecraft may apply reasonable technical and usage limits, including limits shown in the product. Features may be added, changed, suspended, or discontinued. We aim to provide a reliable service but do not promise uninterrupted or error-free operation.</p></section>
<section><h2>6. Third-party services</h2><p>Pagecraft can interact with services such as Google, Supabase, Cloudflare, and WordPress. Those services have their own terms and privacy practices. Pagecraft is not responsible for third-party services, content, or changes outside our control.</p></section>
<section><h2>7. Suspension and termination</h2><p>You may stop using Pagecraft at any time. We may restrict or terminate access when reasonably necessary to protect the service or others, respond to legal requirements, address nonpayment if paid plans are introduced, or enforce these terms. Where practical, we will provide notice and an opportunity to export content.</p></section>
<section><h2>8. Disclaimers</h2><p>Pagecraft is provided “as is” and “as available.” To the fullest extent permitted by law, we disclaim implied warranties, including merchantability, fitness for a particular purpose, and non-infringement. You are responsible for reviewing your site before publishing and maintaining copies of important content.</p></section>
<section><h2>9. Limitation of liability</h2><p>To the fullest extent permitted by law, Braudy Pedrosa will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, data, goodwill, or business opportunities arising from Pagecraft. Nothing in these terms excludes liability that cannot legally be excluded.</p></section>
<section><h2>10. Governing law</h2><p>These terms are governed by the laws of the Philippines, without regard to conflict-of-law rules. Before starting formal proceedings, you agree to contact us and make a good-faith effort to resolve the concern informally.</p></section>
<section><h2>11. Changes and contact</h2><p>We may update these terms as Pagecraft changes. Material changes will be communicated through the service or by email when appropriate. Continued use after an update takes effect means you accept the revised terms.</p><p>Questions may be sent to <a href="mailto:hello@braudyp.dev">hello@braudyp.dev</a>.</p></section>`);

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
