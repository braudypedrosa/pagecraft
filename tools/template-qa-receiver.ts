/** Loopback-only form receiver. Records receipt, never sends mail or claims delivery. */
import { createServer } from 'node:https';
import { readFile, mkdir, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';

if (!process.argv.includes('--local-only') || process.env.NODE_ENV === 'production') {
  throw new Error('Explicit --local-only required; never run in production');
}
const cert = process.env.TEMPLATE_QA_CERT;
const key = process.env.TEMPLATE_QA_KEY;
if (!cert || !key) throw new Error('Provide an already trusted local certificate through TEMPLATE_QA_CERT and TEMPLATE_QA_KEY; this tool does not alter trust.');
const scratch = resolve(import.meta.dirname, '../.pagecraft-local/template-qa');
await mkdir(scratch, { recursive: true });
createServer({ cert: await readFile(cert), key: await readFile(key) }, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.end('<!doctype html><title>Local form QA receiver</title><h1>Local form QA receiver</h1><p>Test submissions are stored locally. No email is sent.</p>');
    return;
  }
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16384) { res.writeHead(413); res.end('Test submission too large.'); return; }
    }
    const fields = Object.fromEntries(new URLSearchParams(body));
    if (!fields.name?.trim() || !fields.email?.includes('@') || !(fields.project || fields.stay)?.trim()) {
      res.writeHead(422); res.end('<h1>Submission rejected</h1><p>Name, email and stay or project details are required. Nothing was stored.</p>'); return;
    }
    await appendFile(resolve(scratch, 'form-receipts.jsonl'), JSON.stringify({ at: new Date().toISOString(), fields }) + '\n');
    res.end('<!doctype html><title>Test inquiry received locally</title><h1>Test inquiry received locally</h1><p>The local QA receiver stored this submission. No email was sent. This is a local test inquiry.</p>');
  } catch {
    res.writeHead(500); res.end('<h1>Submission could not be stored</h1><p>No success has been recorded. Please retry.</p>');
  }
}).listen(4891, '127.0.0.1', () => console.log('Local HTTPS form QA receiver on loopback port 4891. No email delivery.'));
