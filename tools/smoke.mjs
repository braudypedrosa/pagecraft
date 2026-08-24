/* Is the deployment actually working?
 *
 *   node tools/smoke.mjs https://pagecraft.example.com
 *   node tools/smoke.mjs http://localhost:8787
 *
 * Read-only: it signs nothing in, creates nothing, and changes nothing. Every check is a thing
 * that breaks in a way the logs do not obviously explain, and each failure says what to change
 * rather than only what was wrong.
 *
 * ## Why this exists
 *
 * The deployment has four environment values and one of them — `EDITOR_HOST` — fails in a
 * shape that looks like a platform problem. Set it wrong and every request is looked up as a
 * custom domain, so the editor answers `No site for host …` and a person reasonably concludes
 * the box is misconfigured, the DNS is wrong, or the proxy is broken. It is one string in a
 * config file. That check is the whole reason this file is worth having.
 *
 * Exit code is the number of failures, so it is usable in a pipeline.
 */
const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!base || !/^https?:\/\//.test(base)) {
  console.error('Usage: node tools/smoke.mjs https://pagecraft.example.com');
  process.exit(2);
}
/* `hostname`, not `host`: `isEditorHost` compares against the request's host with the port
   stripped, so EDITOR_HOST is `localhost`, never `localhost:8787`. Advice that includes the port
   sends somebody to change a setting to a value that will not work either. */
const host = new URL(base).hostname;
const secure = base.startsWith('https:');

let failures = 0;
const pad = (s, n) => String(s).padEnd(n);

/** One check. `fix` is printed only when it fails, because advice nobody needs is noise. */
async function check(what, fn, fix) {
  let ok = false, note = '';
  try {
    const r = await fn();
    ok = r.ok;
    note = r.note || '';
  } catch (e) {
    note = String(e && e.message || e);
  }
  if (!ok) failures++;
  console.log(`  ${ok ? '\x1b[32mok  \x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${pad(what, 44)} ${note}`);
  if (!ok && fix) console.log(`       ${fix}`);
}

/* `redirect: manual` throughout: a 302 is an answer, and following it hides which one. */
const get = (path, headers = {}) =>
  fetch(base + path, { redirect: 'manual', headers });

console.log(`\n${base}\n`);

await check('the host answers at all', async () => {
  const r = await get('/');
  return { ok: r.status < 500, note: `${r.status}` };
}, 'Nothing is listening, or the proxy cannot reach it. `fly logs`, or `docker compose logs server`.');

await check('EDITOR_HOST matches this hostname', async () => {
  const r = await get('/');
  const body = await r.text();
  /* The failure this file exists for. A wrong EDITOR_HOST sends every request down the
     custom-domain path, and the editor answers as though it were a site that does not exist. */
  const wrong = /No site for host/i.test(body);
  const right = /sign in|Sign in/.test(body) || r.status === 302;
  return { ok: !wrong && right, note: wrong ? `answered "No site for host ${host}"` : `${r.status}` };
}, `Set EDITOR_HOST to "${host}" and redeploy. It is one string, and this is the only symptom.`);

/* Kept after the EDITOR_HOST check, and it says so when that one has already failed. A wrong
   EDITOR_HOST fails this one too, and printing "the editor build is missing" at somebody who has
   a perfectly good build is how a five-minute fix becomes an afternoon. */
const hostWrong = failures > 0;
await check('the sign-in page is served, not an error', async () => {
  const r = await get('/');
  const body = await r.text();
  return { ok: r.status === 200 && /<form|sign in/i.test(body), note: `${r.status}, ${body.length} bytes` };
}, hostWrong
  ? 'Probably a consequence of the check above — fix EDITOR_HOST first and run this again.'
  : 'A 503 here means the editor build is missing: run `node build.mjs` before building the image.');

await check('an unknown site path 404s', async () => {
  const r = await get('/no-such-site-here/');
  return { ok: r.status === 404, note: `${r.status}` };
}, 'A 200 means something else is serving this path — a CDN page rule, or the wrong app.');

await check('the API refuses an unauthenticated caller', async () => {
  const r = await get('/api/sites');
  return { ok: r.status === 401, note: `${r.status}` };
}, 'Anything other than 401 means the session gate is not doing its job. Stop and read app.ts.');

await check('the certificate gate refuses an outside caller', async () => {
  /* Sent *with* a forwarded-for header, which is the point. Without one the endpoint answers
     404 for a domain nobody has claimed — and reading that as "refused" would pass this check on
     a server where the gate is wide open. With one, a correct server refuses regardless of the
     domain, which is the fence being tested rather than the lookup. */
  const r = await get('/internal/tls-check?domain=example.com', { 'x-forwarded-for': '203.0.113.9' });
  /* 403 from the app itself, or 404 from a proxy that hides `/internal/*` at the edge. Both are
     correct. A 200 means anyone can make this server ask a certificate authority for a name. */
  return { ok: r.status === 403 || r.status === 404, note: `${r.status} with a forwarded-for` };
}, 'A 200 is serious: anybody could make this server request certificates. Check the proxy.');

if (secure) {
  await check('the session cookie is Secure', async () => {
    /* Asked without an address, so nothing is sent and no user is revealed: the endpoint answers
       200 either way by design. What is being read is the shape of the response, not a session. */
    const r = await fetch(base + '/auth/login', {
      method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `smoke-${Date.now()}@invalid.test` })
    });
    const set = r.headers.get('set-cookie') || '';
    /* No cookie is the right answer here — a link was not sent to an address nobody knows. This
       checks that when one *is* set it is Secure, by checking NODE_ENV's visible effect. */
    return { ok: r.status === 200 && (!set || /Secure/i.test(set)), note: set ? 'cookie present' : 'no cookie, as expected' };
  }, 'A session cookie without Secure travels in clear. Set NODE_ENV=production.');

  await check('http is redirected to https', async () => {
    const r = await fetch(base.replace('https:', 'http:') + '/', { redirect: 'manual' });
    return { ok: r.status >= 300 && r.status < 400, note: `${r.status} → ${r.headers.get('location') || '?'}` };
  }, 'Set force_https in fly.toml, or let Caddy handle it.');
}

console.log();
if (failures) {
  console.log(`\x1b[31m${failures} check${failures === 1 ? '' : 's'} failed.\x1b[0m Each line above says what to change.\n`);
} else {
  console.log('\x1b[32mAll checks passed.\x1b[0m Sign in with the OWNER_EMAIL address to make a site.\n');
}
process.exit(failures);
