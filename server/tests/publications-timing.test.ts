import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import {
  FileHostedPublicationStore,
  type PublicationStoreTimingEvent,
} from "../src/publications.ts";

const input = () => ({
  siteId: "timing-site",
  slug: "timing-site",
  host: "timing.test",
  sourceVersion: 1,
  files: [
    {
      path: "index.html",
      mediaType: "text/html; charset=utf-8",
      bytes: new TextEncoder().encode("<h1>Timing</h1>"),
    },
    {
      path: "assets/logo.png",
      mediaType: "image/png",
      bytes: Uint8Array.of(1, 2, 3),
    },
  ],
});

test("publication timing reports only fixed filesystem boundaries", async () => {
  const root = await mkdtemp(join(tmpdir(), "pagecraft-publication-timing-"));
  const events: PublicationStoreTimingEvent[] = [];
  let clock = 0;
  try {
    const store = new FileHostedPublicationStore(root, {
      timing: (event) => events.push(event),
      now: () => {
        clock += 5;
        return clock;
      },
    });
    const publication = await store.create(input());
    await store.promote(publication);
    events.length = 0;

    const current = await store.currentBySlug("timing-site");
    assert.equal(current?.id, publication.id);
    assert.deepEqual(
      events,
      [
        ["route.pointer.read", "ok"],
        ["route.pointer.decode", "ok"],
        ["route.alias.read", "ok"],
        ["route.alias.decode", "ok"],
        ["route.deleted.stat", "missing"],
        ["manifest.read", "ok"],
        ["manifest.decode", "ok"],
      ].map(([name, outcome]) => ({ name, durationMs: 5, outcome })),
    );

    events.length = 0;
    assert.deepEqual(
      await store.file(current!, "assets/logo.png"),
      Uint8Array.of(1, 2, 3),
    );
    assert.deepEqual(events, [
      { name: "file.stat", durationMs: 5, outcome: "ok" },
      { name: "file.read", durationMs: 5, outcome: "ok" },
      { name: "file.hash", durationMs: 5, outcome: "ok" },
    ]);
    for (const event of events) {
      assert.deepEqual(Object.keys(event).sort(), ["durationMs", "name", "outcome"]);
      assert.doesNotMatch(JSON.stringify(event), /timing-site|timing\.test|logo|index/i);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("timing preserves route lifecycle and reports integrity rejection", async () => {
  const root = await mkdtemp(join(tmpdir(), "pagecraft-publication-timing-lifecycle-"));
  const events: PublicationStoreTimingEvent[] = [];
  try {
    const store = new FileHostedPublicationStore(root, {
      timing: (event) => events.push(event),
      now: (() => {
        let clock = 0;
        return () => ++clock;
      })(),
    });
    const publication = await store.create(input());
    await store.promote(publication);
    await store.relocate(publication.siteId, "renamed", "renamed.test");
    assert.equal(await store.currentBySlug("timing-site"), null);
    const current = await store.currentBySlug("renamed");
    assert.equal(current?.id, publication.id);

    const siteKey = createHash("sha256").update(publication.siteId).digest("hex");
    await writeFile(
      join(
        root,
        "publications",
        siteKey,
        publication.id,
        "files",
        "assets",
        "logo.png",
      ),
      Uint8Array.of(9, 9, 9),
    );
    events.length = 0;
    assert.equal(await store.file(current!, "assets/logo.png"), null);
    assert.deepEqual(events, [
      { name: "file.stat", durationMs: 1, outcome: "ok" },
      { name: "file.read", durationMs: 1, outcome: "ok" },
      { name: "file.hash", durationMs: 1, outcome: "invalid" },
    ]);

    await store.removeSite(publication.siteId);
    assert.equal(await store.currentBySlug("renamed"), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("disabled or failing timing sinks cannot affect publication reads", async () => {
  const root = await mkdtemp(join(tmpdir(), "pagecraft-publication-timing-safe-"));
  try {
    const writer = new FileHostedPublicationStore(root);
    const publication = await writer.create(input());
    await writer.promote(publication);
    const reader = new FileHostedPublicationStore(root, {
      timing: () => {
        throw new Error("diagnostic sink failed");
      },
    });
    const current = await reader.currentByHost("timing.test");
    assert.equal(current?.id, publication.id);
    assert.deepEqual(
      await reader.file(current!, "assets/logo.png"),
      Uint8Array.of(1, 2, 3),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
