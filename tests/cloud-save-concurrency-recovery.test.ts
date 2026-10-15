import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as Core from '../app/src/core/index';
import { createWebHostAdapter } from '../app/src/host/web';

const source = readFileSync('builder.html', 'utf8');
const saveStart = source.indexOf('let saving = false, saveAgain = false;');
const saveEnd = source.indexOf('\n// A lock is temporary', saveStart);
const flushStart = source.indexOf('async function flushDraft() {');
const flushEnd = source.indexOf('\n/* The dashboard must never', flushStart);
const explicitStart = source.indexOf('let manualSavePending = false;');
const explicitEnd = source.indexOf('\n/* ================================================================== HUD', explicitStart);
if ([saveStart, saveEnd, flushStart, flushEnd, explicitStart, explicitEnd].some(index => index < 0)) {
  throw new Error('cloud save queue helpers are missing from builder.html');
}
const saveSource = source.slice(saveStart, saveEnd);
const flushSource = source.slice(flushStart, flushEnd);
const explicitSource = source.slice(explicitStart, explicitEnd);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

type SaveInput = { document: Record<string, unknown>; version: number };

function harness(save: (input: SaveInput) => Promise<{ version: number }>, readback: (input?: unknown, init?: RequestInit) => Promise<unknown>) {
  let document: Record<string, any> = { meta: { name: 'Initial' }, pages: [] };
  const stamps: Array<[string, boolean]> = [];
  const warnings = {
    busy: vi.fn(), unconfirmed: vi.fn(), stale: vi.fn(), session: vi.fn(), content: vi.fn(), failed: vi.fn(),
  };
  const actions: string[] = [];
  const factory = new Function(
    'HOST', 'fetch', 'doc', 'stamp', 'warnSaveBusy', 'warnSaveUnconfirmed', 'warnStale',
    'warnSessionExpired', 'warnContentOnly', 'warnSaveFailed', 'feedback', 'toast', 'clone', 'migrate',
    `${String.raw`
      const IS_WORDPRESS = false;
      const SRV = { siteId: 'site-save-qa', version: 99, editorSessionToken: 'scoped-save-qa' };
      let loadBlocked = false, saveState = 'ok', saveWarned = false, dirty = false;
      let lastCloudDocument = JSON.stringify(doc());
      function writeNow() { return writeServer(); }
      ${saveSource}
      ${flushSource}
      ${explicitSource}
      return {
        writeServer, saveExplicitly,
        state: () => ({ saving, saveAgain, saveState, dirty, version: SRV.version, lastCloudDocument, ambiguousCloudSave }),
        saveDocumentKey
      };
    `}`,
  );
  const api = factory(
    { documents: { save } }, readback, () => document,
    (text: string, bad: boolean) => stamps.push([text, !!bad]),
    warnings.busy, warnings.unconfirmed, warnings.stale, warnings.session, warnings.content, warnings.failed,
    () => ({ begin: () => ({ success: (message: string) => actions.push(message), cancel: vi.fn() }) }),
    vi.fn(),
    structuredClone,
    (value: unknown) => value,
  );
  return {
    ...api, stamps, warnings, actions,
    setName(name: string) { document = structuredClone(document); document.meta.name = name; },
    document: () => structuredClone(document),
  };
}

test('manual save queues behind autosave and sends each acknowledged version serially', async () => {
  let active = 0;
  let maxActive = 0;
  const requests: SaveInput[] = [];
  const pending: Array<{ resolve: (value: { version: number }) => void }> = [];
  const h = harness(input => {
    requests.push(structuredClone(input));
    active += 1;
    maxActive = Math.max(maxActive, active);
    return new Promise(resolve => pending.push({ resolve: value => { active -= 1; resolve(value); } }));
  }, async () => { throw new Error('readback should not run'); });

  h.setName('Autosave snapshot');
  const autosave = h.writeServer();
  await tick();
  h.setName('Manual snapshot');
  const manual = h.saveExplicitly();
  await tick();

  expect(requests).toHaveLength(1);
  expect(requests[0].version).toBe(99);
  expect(requests[0].document.meta).toMatchObject({ name: 'Autosave snapshot' });

  pending.shift()!.resolve({ version: 100 });
  await autosave;
  await tick();
  expect(requests).toHaveLength(2);
  expect(requests[1].version).toBe(100);
  expect(requests[1].document.meta).toMatchObject({ name: 'Manual snapshot' });
  expect(maxActive).toBe(1);

  pending.shift()!.resolve({ version: 101 });
  await manual;
  expect(h.state()).toMatchObject({ saving: false, saveAgain: false, saveState: 'ok', version: 101 });
  expect(h.actions).toContain('Draft saved. Publish the site to make it public.');
});

test('immediate exact readback acknowledges the commit and queues edits made during readback', async () => {
  let remoteDocument: Record<string, unknown> = {};
  const requests: SaveInput[] = [];
  let resolveReadback!: (response: unknown) => void;
  let readbackRequest: [unknown?, RequestInit?] | null = null;
  const h = harness(async input => {
    requests.push(structuredClone(input));
    if (requests.length === 1) {
      remoteDocument = structuredClone(input.document);
      throw new TypeError('Failed to fetch');
    }
    expect(input.version).toBe(100);
    return { version: 101 };
  }, async (input, init) => {
    readbackRequest = [input, init];
    return new Promise(resolve => { resolveReadback = resolve; });
  });

  h.setName('Committed before immediate readback');
  const first = h.writeServer();
  await tick();
  h.setName('Edited while readback was pending');
  await h.writeServer();
  expect(requests).toHaveLength(1);

  resolveReadback({
    ok: true,
    status: 200,
    json: async () => ({ version: 100, doc: structuredClone(remoteDocument) }),
  });
  await first;
  await tick();

  expect(readbackRequest).not.toBeNull();
  const [readbackUrl, readbackInit] = readbackRequest as unknown as [unknown, RequestInit];
  expect(readbackUrl).toBe('/api/sites/site-save-qa');
  expect(readbackInit.headers).toMatchObject({ 'X-Pagecraft-Editor-Session': 'scoped-save-qa' });
  expect(requests).toHaveLength(2);
  expect(requests[1].version).toBe(100);
  expect(requests[1].document.meta).toMatchObject({ name: 'Edited while readback was pending' });
  expect(h.state()).toMatchObject({ saveState: 'ok', version: 101, ambiguousCloudSave: null });
});

test('a retry conflict accepts only an exact readback of the ambiguous committed request', async () => {
  let remoteVersion = 99;
  let remoteDocument: Record<string, unknown> = { meta: { name: 'Initial' }, pages: [] };
  let request = 0;
  let readbackOnline = false;
  const requests: SaveInput[] = [];
  const conflict = () => Object.assign(new Error('stale'), {
    status: 409, payload: { error: 'stale', conflict: { yours: 99, theirs: 100 } },
  });
  const h = harness(async input => {
    requests.push(structuredClone(input));
    request += 1;
    if (request === 1) {
      remoteDocument = structuredClone(input.document);
      remoteVersion = 100;
      throw new TypeError('Failed to fetch');
    }
    if (request === 2) throw conflict();
    expect(input.version).toBe(remoteVersion);
    remoteDocument = structuredClone(input.document);
    remoteVersion += 1;
    return { version: remoteVersion };
  }, async () => {
    if (!readbackOnline) throw new TypeError('Failed to fetch');
    return {
      ok: true,
      status: 200,
      json: async () => ({ version: remoteVersion, doc: structuredClone(remoteDocument) }),
    };
  });

  h.setName('Committed before response loss');
  await h.writeServer();
  expect(h.warnings.failed).toHaveBeenCalledTimes(1);
  expect(h.state()).toMatchObject({ saveState: 'failed', version: 99 });

  readbackOnline = true;
  await h.writeServer();
  expect(requests[1].version).toBe(99);
  expect(h.warnings.stale).not.toHaveBeenCalled();
  expect(h.warnings.unconfirmed).not.toHaveBeenCalled();
  expect(h.state()).toMatchObject({ saveState: 'ok', dirty: false, version: 100, ambiguousCloudSave: null });
  expect(h.stamps.at(-1)?.[0]).toMatch(/Draft saved/);

  h.setName('Saved after exact recovery');
  await h.writeServer();
  expect(requests[2].version).toBe(100);
  expect(h.state()).toMatchObject({ saveState: 'ok', version: 101 });
});

test('an exact version-plus-one conflict readback acknowledges identical host bytes without a prior network error', async () => {
  let remoteDocument: Record<string, unknown> = {};
  const conflict = Object.assign(new Error('stale'), {
    status: 409, payload: { error: 'stale', conflict: { yours: 99, theirs: 100 } },
  });
  const h = harness(async input => {
    remoteDocument = structuredClone(input.document);
    throw conflict;
  }, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ version: 100, doc: structuredClone(remoteDocument) }),
  }));

  h.setName('Already stored exact draft');
  await h.writeServer();

  expect(h.warnings.stale).not.toHaveBeenCalled();
  expect(h.warnings.unconfirmed).not.toHaveBeenCalled();
  expect(h.state()).toMatchObject({
    saving: false, saveState: 'ok', dirty: false, version: 100, ambiguousCloudSave: null,
  });
});

test.each([
  ['different document at version plus one', 100, { meta: { name: 'Other writer' }, pages: [] }],
  ['identical document at version plus two', 101, null],
])('a conflict readback stays blocked for %s', async (_label, remoteVersion, differentDocument) => {
  let attempted: Record<string, unknown> = {};
  const conflict = Object.assign(new Error('stale'), {
    status: 409, payload: { error: 'stale', conflict: { yours: 99, theirs: remoteVersion } },
  });
  const h = harness(async input => {
    attempted = structuredClone(input.document);
    throw conflict;
  }, async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      version: remoteVersion,
      doc: differentDocument || structuredClone(attempted),
    }),
  }));

  h.setName('Local conflicting draft');
  await h.writeServer();

  expect(h.warnings.stale).toHaveBeenCalledTimes(1);
  expect(h.warnings.unconfirmed).not.toHaveBeenCalled();
  expect(h.state()).toMatchObject({ saveState: 'failed', dirty: true, version: 99 });
});

test('an HTTP 502 after commit reconciles exact bytes and queues a newer local edit', async () => {
  let remoteDocument: Record<string, unknown> = {};
  const requests: SaveInput[] = [];
  let resolveReadback!: (response: unknown) => void;
  const h = harness(async input => {
    requests.push(structuredClone(input));
    if (requests.length === 1) {
      remoteDocument = structuredClone(input.document);
      throw Object.assign(new Error('gateway answered 502'), { status: 502, payload: null });
    }
    expect(input.version).toBe(100);
    return { version: 101 };
  }, async () => new Promise(resolve => { resolveReadback = resolve; }));

  h.setName('Committed before gateway failure');
  const first = h.writeServer();
  await tick();
  h.setName('Edited during 502 readback');
  await h.writeServer();
  expect(requests).toHaveLength(1);

  resolveReadback({
    ok: true,
    status: 200,
    json: async () => ({ version: 100, doc: structuredClone(remoteDocument) }),
  });
  await first;
  await tick();

  expect(requests).toHaveLength(2);
  expect(requests[1].document.meta).toMatchObject({ name: 'Edited during 502 readback' });
  expect(h.warnings.failed).not.toHaveBeenCalled();
  expect(h.state()).toMatchObject({ saveState: 'ok', version: 101, ambiguousCloudSave: null });
});

test('an unavailable exact-conflict readback remains blocked as unconfirmed', async () => {
  const conflict = Object.assign(new Error('stale'), {
    status: 409, payload: { error: 'stale', conflict: { yours: 99, theirs: 100 } },
  });
  const h = harness(async () => { throw conflict; }, async () => { throw new TypeError('Failed to fetch'); });

  h.setName('Cannot confirm matching host bytes');
  await h.writeServer();

  expect(h.warnings.unconfirmed).toHaveBeenCalledTimes(1);
  expect(h.warnings.stale).not.toHaveBeenCalled();
  expect(h.state()).toMatchObject({ saveState: 'failed', dirty: true, version: 99 });
});

test('an unmatched readback remains a blocking foreign-version conflict', async () => {
  let request = 0;
  let readbackOnline = false;
  const conflict = Object.assign(new Error('stale'), {
    status: 409, payload: { error: 'stale', conflict: { yours: 99, theirs: 100 } },
  });
  const h = harness(async () => {
    request += 1;
    if (request === 1) throw new TypeError('Failed to fetch');
    throw conflict;
  }, async () => {
    if (!readbackOnline) throw new TypeError('Failed to fetch');
    return {
      ok: true,
      status: 200,
      json: async () => ({ version: 100, doc: { meta: { name: 'Different editor' }, pages: [] } }),
    };
  });

  h.setName('My interrupted save');
  await h.writeServer();
  readbackOnline = true;
  await h.writeServer();

  expect(h.warnings.stale).toHaveBeenCalledTimes(1);
  expect(h.state()).toMatchObject({ saveState: 'failed', dirty: true, version: 99 });
});

test('an unavailable conflict readback stays blocked without blaming another editor', async () => {
  let request = 0;
  const conflict = Object.assign(new Error('stale'), {
    status: 409, payload: { error: 'stale', conflict: { yours: 99, theirs: 100 } },
  });
  const h = harness(async () => {
    request += 1;
    if (request === 1) throw new TypeError('Failed to fetch');
    throw conflict;
  }, async () => { throw new TypeError('Failed to fetch'); });

  h.setName('Unconfirmed interrupted save');
  await h.writeServer();
  await h.writeServer();

  expect(h.warnings.unconfirmed).toHaveBeenCalledTimes(1);
  expect(h.warnings.stale).not.toHaveBeenCalled();
  expect(h.state()).toMatchObject({ saveState: 'failed', dirty: true, version: 99 });
});

test('identical content at attempted version plus two remains blocked', async () => {
  let remoteDocument: Record<string, unknown> = {};
  let request = 0;
  const conflict = Object.assign(new Error('stale'), {
    status: 409, payload: { error: 'stale', conflict: { yours: 99, theirs: 101 } },
  });
  const h = harness(async input => {
    request += 1;
    if (request === 1) {
      remoteDocument = structuredClone(input.document);
      throw new TypeError('Failed to fetch');
    }
    throw conflict;
  }, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ version: 101, doc: structuredClone(remoteDocument) }),
  }));

  h.setName('Same bytes at an unsafe version');
  await h.writeServer();
  await h.writeServer();

  expect(h.warnings.stale).toHaveBeenCalledTimes(1);
  expect(h.state()).toMatchObject({ saveState: 'failed', dirty: true, version: 99 });
});

test('canonical save comparison preserves __proto__ as ordinary JSON data', async () => {
  const h = harness(async () => ({ version: 100 }), async () => { throw new Error('unused'); });
  const left = JSON.parse('{"nested":{"__proto__":{"owner":"one"}}}');
  const right = JSON.parse('{"nested":{"__proto__":{"owner":"two"}}}');

  expect(h.saveDocumentKey(left)).not.toBe(h.saveDocumentKey(right));
  expect(JSON.parse(h.saveDocumentKey(left)).nested.__proto__).toEqual({ owner: 'one' });
  expect(({} as Record<string, unknown>).owner).toBeUndefined();
});

test('builder cloud snapshot is exactly the document serialized by the real Web adapter', async () => {
  Core.seed();
  Core.state.ui = Core.initUi();
  const live = Core.clone(Core.doc());
  const builderSnapshot = Core.migrate(Core.clone(live));
  expect(builderSnapshot).not.toBeNull();
  let wire: any = null;
  const host = createWebHostAdapter({
    siteId: 'site-save-qa', role: 'owner', sessionToken: 'scoped-save-qa',
    fetch: async (_input, init = {}) => {
      wire = { body: JSON.parse(String(init.body)), headers: init.headers };
      return new Response(JSON.stringify({ version: 100 }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
  });

  await host.documents.save({ document: builderSnapshot!, version: 99 });
  expect(wire.body).toEqual({ doc: builderSnapshot, version: 99 });
  expect(wire.headers).toMatchObject({ 'X-Pagecraft-Editor-Session': 'scoped-save-qa' });
  expect({ version: 100, doc: wire.body.doc }).toEqual({ version: 100, doc: builderSnapshot });
});
