/* Can Node import this, or only Vitest?

   Three times in one session, Vitest resolved or transformed something Node will not:

     · extensionless imports — bundler resolution accepts `./app`, Node's ESM resolver does
       not, and sixteen tests passed against a server that could not boot;
     · `A_RE` declared in two files that share one scope, which only shows up when the built
       page runs;
     · a parameter property in `store-pg.ts` — `constructor(private db)` generates an
       assignment rather than erasing, so Node's strip-only mode refuses the whole module.
       That one was worse than it looks: the Postgres path is dynamically imported, so it is
       reached only when DATABASE_URL is set, which no test does. Sixteen tests passed against
       a file the server could never load, and the first sign of it would have been a
       production boot.

   Vitest is a compiler; the server is Node. So this asks Node, in its own process, with its
   own resolver and its own type stripping. It is the server's answer to `boot.test.mjs`. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

test('node can import every server module, not only vitest', async () => {
  const files = readdirSync(srcDir).filter(f => f.endsWith('.ts')).sort();
  a.ok(files.length >= 6, `only found ${files.length} modules — this test is looking in the wrong place`);

  /* One process, importing each in turn, so a failure names the file. `index.ts` is left out
     deliberately: it listens on a port and seeds a store, which is a different question that
     `npm run dev` answers. */
  const list = files.filter(f => f !== 'index.ts');
  const script = list.map(f =>
    `try { await import(${JSON.stringify(join(srcDir, f))}); }` +
    ` catch (e) { console.log('FAILED ${f}: ' + (e.code || '') + ' ' + e.message.split('\\n')[0]); bad = true; }`
  ).join('\n');

  const { stdout } = await run(process.execPath, [
    '--input-type=module', '-e', `let bad = false;\n${script}\nif (!bad) console.log('OK');`
  ], { cwd: join(here, '..', '..') });

  a.match(stdout, /OK/, `node refused a module:\n${stdout}`);
});

test('no module reaches for a TypeScript feature that has to be compiled', async () => {
  /* The failure above is one instance of a class. `enum`, `namespace`, a parameter property
     and a decorator all need code generation rather than erasure, and every one of them
     compiles under Vitest and dies under Node. Cheaper to grep than to wait for a boot. */
  const { readFileSync } = await import('node:fs');
  const files = readdirSync(srcDir).filter(f => f.endsWith('.ts'));
  const bad: string[] = [];
  for (const f of files) {
    /* Comments stripped first. The guard's own first run flagged `store-pg.ts`, because the
       comment there explaining why parameter properties are banned contains the words. A
       checker that reads prose reports prose. */
    const src = readFileSync(join(srcDir, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    if (/constructor\s*\([^)]*\b(private|public|protected|readonly)\b/.test(src)) bad.push(`${f}: parameter property`);
    if (/^\s*(export\s+)?enum\s/m.test(src)) bad.push(`${f}: enum`);
    if (/^\s*(export\s+)?namespace\s/m.test(src)) bad.push(`${f}: namespace`);
    if (/^\s*@[A-Za-z]/m.test(src)) bad.push(`${f}: decorator`);
  }
  a.deepEqual(bad, [], 'these need a compiler, and the server only has Node');
});

test('production refuses to boot without durable storage', async () => {
  const entry = join(srcDir, 'index.ts');
  await a.rejects(() => run(process.execPath, ['--experimental-strip-types', entry], {
    cwd: join(here, '..', '..'),
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: '', DATABASE_GATEWAY_URL: '', DATABASE_GATEWAY_KEY: '' }
  }), error => /production requires DATABASE_GATEWAY_URL or DATABASE_URL/.test(
    String((error as { stderr?: string }).stderr || error)
  ));
});

test('production refuses to boot without Supabase Auth and Turnstile configuration', async () => {
  const gateway = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data: [] }));
  });
  await new Promise<void>(resolve => gateway.listen(0, '127.0.0.1', resolve));
  const address = gateway.address();
  a.ok(address && typeof address === 'object');
  const entry = join(srcDir, 'index.ts');
  try {
    await a.rejects(() => run(process.execPath, ['--experimental-strip-types', entry], {
      cwd: join(here, '..', '..'),
      env: {
        ...process.env, NODE_ENV: 'production', DATABASE_URL: '',
        DATABASE_GATEWAY_URL: `http://127.0.0.1:${address.port}`, DATABASE_GATEWAY_KEY: 'test-only',
        PAGECRAFT_PUBLICATION_ROOT: '/tmp/pagecraft-publications-loadable-test',
        OWNER_EMAIL: '', CLIENT_EMAIL: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', MAIL_FROM: ''
      }
    }), error => /account auth requires SUPABASE_URL/.test(
      String((error as { stderr?: string }).stderr || error)
    ));
  } finally {
    await new Promise<void>((resolve, reject) => gateway.close(error => error ? reject(error) : resolve()));
  }
});
