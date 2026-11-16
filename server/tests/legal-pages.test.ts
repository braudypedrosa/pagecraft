/* Privacy, Terms and the Refund Policy that Paddle's domain review requires to be public. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import {
  LEGAL_LAST_UPDATED, accountSettingsPage, privacyPage, refundPage, signInPage, signUpPage, termsPage,
} from '../src/account-pages.ts';
import type { User } from '../src/auth.ts';

const app = () => createApp({
  store: new MemoryStore(), auth: new MemoryAuthStore(), editorHtml: '<title>Builder</title>',
  editorHost: 'admin.test', editorOrigin: 'http://admin.test',
});
const get = (path: string, host = 'admin.test') =>
  app().request(new Request(`http://${host}${path}`, { headers: { host } }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('the refund policy is public on the editor host and absent from site hosts', async () => {
  const res = await get('/refunds');
  a.equal(res.status, 200);
  a.match(res.headers.get('content-type') || '', /text\/html/);
  const html = await res.text();
  a.match(html, /<h1 id="title">Refund Policy<\/h1>/);
  a.doesNotMatch(res.headers.get('cache-control') || '', /no-store/, 'a public document, not an account page');
  a.equal((await get('/refunds', 'customer-site.test')).status, 404);
  for (const path of ['/privacy', '/terms']) {
    a.equal((await get(path)).status, 200);
    a.equal((await get(path, 'customer-site.test')).status, 404);
  }
});

test('the refund policy states the draft terms: Paddle, 14 days, renewals, cancellation and content', () => {
  const body = text(refundPage());
  a.match(body, /Paddle\.com, which is the merchant of record/);
  a.match(body, /full refund within 14 days of your first payment/);
  a.match(body, /Annual renewals can be refunded in full if you ask within 14 days/);
  a.match(body, /Monthly renewals are not refunded once charged/);
  a.match(body, /duplicate charges and billing errors/);
  a.match(body, /stays active until the end of the billing period/);
  a.match(body, /never deletes your content/);
  a.match(body, /statutory consumer rights are not affected/);
  a.match(refundPage(), /href="mailto:hello@braudyp\.dev"/);
  a.match(refundPage(), /href="https:\/\/paddle\.net"/);
});

test('every legal page shows the same current date, keeps the operator identity and links to the others', () => {
  a.equal(LEGAL_LAST_UPDATED, 'November 16, 2026');
  for (const page of [privacyPage(), termsPage(), refundPage()]) {
    a.match(page, /Last updated November 16, 2026/);
    a.doesNotMatch(page, /August 27, 2026/);
    a.match(page, /personally operated by Braudy Pedrosa in the Philippines/);
    for (const href of ['/privacy', '/terms', '/refunds']) a.match(page, new RegExp(`href="${href}"`));
    // No invented company identity.
    a.doesNotMatch(page, /\b(?:Inc\.|LLC|Ltd\.?|Corporation|Registration No|SEC Reg|DTI)\b/);
  }
});

test('privacy lists each service provider and what it processes', () => {
  const body = text(privacyPage());
  a.match(body, /Supabase — database and account authentication/);
  a.match(body, /Namecheap — hosting/);
  a.match(body, /Cloudflare — DNS, network delivery and protection, and Cloudflare Turnstile bot protection/);
  a.match(body, /email \(SMTP\) delivery provider — sending account emails/);
  a.match(body, /Paddle — payment processing for paid plans once billing launches\. Paddle acts as the merchant of record/);
  a.match(body, /never sees or stores your full card details/);
  a.match(body, /Server error records[^.]*no cookies, passwords, tokens, form contents, or site content, are kept for up to 14 days/);
});

test('terms describe Paddle billing and link the refund policy', () => {
  const html = termsPage();
  const body = text(html);
  a.match(body, /7\. Paid plans, billing, and refunds/);
  a.match(body, /Paddle\.com, which is the merchant of record/);
  a.match(body, /12\. Changes and contact/);
  a.match(html, /the <a href="\/privacy">Privacy Policy<\/a>, and the <a href="\/refunds">Refund Policy<\/a>/);
  const numbers = [...body.matchAll(/ (\d+)\. [A-Z]/g)].map(m => Number(m[1]));
  a.deepEqual(numbers, Array.from({ length: 12 }, (_, i) => i + 1), 'sections stay numbered in order');
});

test('the refund policy is linked everywhere privacy and terms are linked', () => {
  const user = { id: 'u', email: 'u@example.test', name: 'U' } as unknown as User;
  const pages = {
    signIn: signInPage('key'),
    signUp: signUpPage('key'),
    settings: accountSettingsPage(user, { providers: ['email'], ownerCount: 0, storage: { usedBytes: 0, limitBytes: 1 } }, { tab: 'plan' }),
    privacy: privacyPage(),
    terms: termsPage(),
    refunds: refundPage(),
  };
  for (const [name, html] of Object.entries(pages)) {
    const privacyLinks = html.match(/href="\/privacy"/g)?.length || 0;
    const refundLinks = html.match(/href="\/refunds"/g)?.length || 0;
    a.ok(privacyLinks > 0, `${name} links to privacy`);
    a.ok(refundLinks > 0, `${name} links to the refund policy`);
  }
});
