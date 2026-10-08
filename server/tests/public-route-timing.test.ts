import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { createApp } from "../src/app.ts";
import { MemoryAuthStore } from "../src/auth.ts";
import {
  FileHostedPublicationStore,
  MemoryHostedPublicationStore,
} from "../src/publications.ts";
import {
  newRequestTiming,
  recordTiming,
  requestTiming,
} from "../src/request-timing.ts";
import { MemoryStore } from "../src/store.ts";

const publicationInput = () => ({
  siteId: "public-timing-site",
  slug: "public-timing",
  host: "public-timing.test",
  sourceVersion: 1,
  files: [
    {
      path: "index.html",
      mediaType: "text/html; charset=utf-8",
      bytes: new TextEncoder().encode(
        '<!doctype html><link rel="stylesheet" href="assets/site.css"><h1>Published timing</h1>',
      ),
    },
    {
      path: "assets/site.css",
      mediaType: "text/css; charset=utf-8",
      bytes: new TextEncoder().encode("h1{color:green}"),
    },
    {
      path: "assets/hero.webp",
      mediaType: "image/webp",
      bytes: Uint8Array.of(82, 73, 70, 70),
    },
  ],
});

const appFor = (publications: FileHostedPublicationStore | MemoryHostedPublicationStore) =>
  createApp({
    store: new MemoryStore(),
    auth: new MemoryAuthStore(),
    publications,
    editorHost: "staging.test",
  });

const request = (app: ReturnType<typeof createApp>, path: string) =>
  app.request(new Request(`http://staging.test${path}`, {
    headers: { host: "staging.test" },
  }));

test("real file publications expose fixed public route and file timings", async () => {
  const root = await mkdtemp(join(tmpdir(), "pagecraft-public-route-timing-"));
  try {
    const publications = new FileHostedPublicationStore(root, {
      timing: ({ name, durationMs, outcome }) =>
        recordTiming(`publication.${name}.${outcome}`, durationMs),
    });
    const publication = await publications.create(publicationInput());
    await publications.promote(publication);
    const app = appFor(publications);

    const html = await request(app, "/public-timing/");
    assert.equal(html.status, 200);
    assert.match(await html.text(), /Published timing/);
    const htmlTiming = html.headers.get("server-timing") || "";
    for (const span of [
      "publication.route.pointer.read.ok",
      "publication.route.alias.read.ok",
      "publication.route.deleted.stat.missing",
      "publication.manifest.read.ok",
      "publication.file.stat.ok",
      "publication.file.read.ok",
      "publication.file.hash.ok",
      "server;dur=",
    ]) assert.ok(htmlTiming.includes(span), `missing ${span}: ${htmlTiming}`);
    assert.doesNotMatch(
      htmlTiming,
      /public-timing|timing\.test|index\.html|site\.css|hero\.webp/i,
    );
    assert.equal(html.headers.get("x-request-id"), null);

    const css = await request(app, "/public-timing/assets/site.css");
    assert.equal(css.status, 200);
    assert.equal(await css.text(), "h1{color:green}");
    assert.match(css.headers.get("server-timing") || "", /publication\.file\.read\.ok/);

    const image = await request(app, "/public-timing/assets/hero.webp");
    assert.equal(image.status, 200);
    assert.deepEqual(
      new Uint8Array(await image.arrayBuffer()),
      Uint8Array.of(82, 73, 70, 70),
    );
    assert.match(image.headers.get("server-timing") || "", /publication\.file\.hash\.ok/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("memory publications do not expose public timing and editor timing is unchanged", async () => {
  const publications = new MemoryHostedPublicationStore();
  const publication = await publications.create(publicationInput());
  await publications.promote(publication);
  const app = appFor(publications);

  const published = await request(app, "/public-timing/");
  assert.equal(published.status, 200);
  assert.equal(published.headers.get("server-timing"), null);
  assert.equal(published.headers.get("x-request-id"), null);

  const editor = await request(app, "/api/sites");
  assert.ok(editor.headers.get("server-timing"));
  assert.ok(editor.headers.get("x-request-id"));
});

test("recordTiming accepts only finite nonnegative durations", async () => {
  const trace = newRequestTiming();
  await requestTiming.run(trace, async () => {
    recordTiming("publication.file.read.ok", 4);
    recordTiming("publication.file.read.error", -1);
    recordTiming("publication.file.read.error", Number.NaN);
    recordTiming("publication.file.read.error", Number.POSITIVE_INFINITY);
  });
  assert.equal(trace.spans.length, 1);
  assert.equal(trace.spans[0].name, "publication.file.read.ok");
  assert.equal(trace.spans[0].duration, 4);
  assert.ok(trace.spans[0].start >= 0);
});
