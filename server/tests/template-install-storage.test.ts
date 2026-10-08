import { createHash } from "node:crypto";
import { resolve } from "node:path";
import a from "node:assert/strict";
import { test } from "vitest";
import { createApp } from "../src/app.ts";
import { MemoryOwnedSiteStore } from "../src/accounts.ts";
import type { AccountAuth, VerifiedIdentity } from "../src/account-auth.ts";
import { MemoryAuthStore } from "../src/auth.ts";
import {
  type Asset,
  type AssetQuota,
  MemoryAssetStore,
  sniff,
} from "../src/assets.ts";
import { blankDoc } from "../src/render.ts";
import {
  FileSiteTemplateStore,
  type SiteTemplateStore,
} from "../src/site-templates.ts";
import { MemoryStore } from "../src/store.ts";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

class StorageCompatibleAssetStore extends MemoryAssetStore {
  active = 0;
  peak = 0;
  writes: Array<{ asset: Omit<Asset, "id"> & { id?: string }; quota?: AssetQuota }> = [];

  constructor(private rejectName?: string) { super(); }

  override async put(...args: Parameters<MemoryAssetStore["put"]>) {
    const [asset, quota] = args;
    this.active++;
    this.peak = Math.max(this.peak, this.active);
    try {
      await new Promise(resolve => setTimeout(resolve, 5));
      if (asset.type === "image/png") throw new Error("mime type image/png is not supported");
      a.equal(sniff(asset.bytes), asset.type, "stored MIME matches the prepared bytes");
      this.writes.push({ asset: structuredClone(asset), quota: quota && { ...quota } });
      if (asset.name === this.rejectName) throw new Error("simulated gateway write failure");
      return await super.put(...args);
    } finally {
      this.active--;
    }
  }
}

const identity: VerifiedIdentity = {
  authUserId: "auth-template-owner",
  email: "template-owner@example.test",
  name: "Template Owner",
};

const rig = async (assets: StorageCompatibleAssetStore, siteTemplates: SiteTemplateStore) => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const owner = await auth.ensureAuthUser(identity.authUserId, identity.email, identity.name);
  const accountAuth = { identity: async () => identity } as unknown as AccountAuth;
  const app = createApp({
    store,
    auth,
    accountAuth,
    ownedSites: new MemoryOwnedSiteStore(store, auth),
    assets,
    siteTemplates,
    editorHost: "admin.test",
    editorOrigin: "http://admin.test",
    editorHtml: "<title>Builder</title>",
  });
  const request = (body: Record<string, unknown>) => app.request(new Request("http://admin.test/api/sites", {
    method: "POST",
    headers: {
      host: "admin.test",
      origin: "http://admin.test",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  }));
  return { store, owner, request };
};

test("Common Ground prepares raw package PNGs for storage and owner accounting", async () => {
  const siteTemplates = new FileSiteTemplateStore(resolve(process.cwd(), "premade-sites"));
  const source = await siteTemplates.instantiate("architecture-studio", "1.0.0");
  a.ok(source);
  a.equal(source.assets.length, 2);
  a.ok(source.assets.every(asset => sniff(asset.bytes) === "image/png"));
  const originals = new Map(source.assets.map(asset => [asset.name.replace(/\.png$/i, ".webp"), asset]));

  const assets = new StorageCompatibleAssetStore();
  const { store, owner, request } = await rig(assets, siteTemplates);
  const response = await request({
    name: "Common Ground",
    templateId: "architecture-studio",
    templateVersion: "1.0.0",
  });
  a.equal(response.status, 201, await response.clone().text());
  const result = await response.json() as { id: string };
  const site = await store.byId(result.id);
  a.ok(site);
  a.equal(assets.writes.length, 2);
  a.ok(assets.peak <= 3, "template storage retains the bounded outer queue");

  for (const write of assets.writes) {
    const original = originals.get(write.asset.name);
    a.ok(original, `prepared asset ${write.asset.name} maps to its package source`);
    a.equal(write.asset.type, "image/webp");
    a.equal(sniff(write.asset.bytes), "image/webp");
    a.ok(write.asset.bytes.byteLength < original.bytes.byteLength);
    a.equal(write.asset.contentHash, digest(original.bytes), "content hash describes the source bytes");
    a.ok(write.asset.id && JSON.stringify(site.doc).includes(`asset:${write.asset.id}`),
      "the package asset id remains the document reference after preparation");
    a.deepEqual(write.quota, {
      ownerId: owner.id,
      limitBytes: 100 * 1024 * 1024,
      originalBytes: original.bytes.byteLength,
      optimized: true,
    });
  }
  const storedBytes = assets.writes.reduce((total, write) => total + write.asset.bytes.byteLength, 0);
  a.deepEqual(await assets.usage(owner.id), {
    usedBytes: storedBytes,
    limitBytes: 100 * 1024 * 1024,
  });
}, 30_000);

test("a prepared template asset write failure rolls back the site and completed media", async () => {
  const assets = new StorageCompatibleAssetStore("reading-room.webp");
  const { store, request } = await rig(
    assets,
    new FileSiteTemplateStore(resolve(process.cwd(), "premade-sites")),
  );
  const response = await request({
    name: "Rolled Back Common Ground",
    templateId: "architecture-studio",
    templateVersion: "1.0.0",
  });
  a.equal(response.status, 500);
  a.equal((await response.json() as { error: string }).error, "site_template_install_failed");
  a.deepEqual(await store.list(), []);
  a.ok(assets.peak <= 3);
  for (const siteId of new Set(assets.writes.map(write => write.asset.siteId))) {
    a.deepEqual(await assets.list(siteId), []);
  }
}, 30_000);

test("template SVG logos use the same sanitized storage path without changing their id", async () => {
  const document = blankDoc("Logo Site");
  document.meta.ogImage = "asset:logo-source";
  const svg = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><script>alert(1)</script><path d="M0 0h120v40H0z"/></svg>',
  );
  const customTemplates: SiteTemplateStore = {
    async list() { return []; },
    async preview() { return null; },
    async instantiate(id, version) {
      if (id !== "logo-template" || version !== "1.0.0") return null;
      return {
        template: {
          format: "pagecraft.site-template.v1", id, version, name: "Logo", sampleName: "Logo Site",
          description: "SVG storage coverage", categories: ["test"],
          pages: document.pages.map(page => ({ id: page.id, name: page.name, slug: page.slug })),
          packageFile: "site.pagecraft-site.zip", packageSha256: "0".repeat(64),
          previewPage: "index.html", assetCount: 1, assetBytes: svg.byteLength,
        },
        document: structuredClone(document),
        assets: [{
          id: "logo-source", siteId: "", name: "brand-logo.svg", type: "image/svg+xml",
          w: 120, h: 40, bytes: svg, contentHash: digest(svg),
        }],
      };
    },
  };
  const assets = new StorageCompatibleAssetStore();
  const { store, owner, request } = await rig(assets, customTemplates);
  const response = await request({
    name: "Logo Site", templateId: "logo-template", templateVersion: "1.0.0",
  });
  a.equal(response.status, 201, await response.clone().text());
  const result = await response.json() as { id: string };
  const site = await store.byId(result.id);
  a.ok(site);
  a.equal(site.doc.meta.ogImage, "asset:logo-source");
  a.equal(assets.writes[0]?.asset.id, "logo-source");
  a.equal(assets.writes[0]?.asset.type, "image/svg+xml");
  a.equal(assets.writes[0]?.asset.name, "brand-logo.svg");
  a.doesNotMatch(new TextDecoder().decode(assets.writes[0]?.asset.bytes), /script/i);
  a.deepEqual(assets.writes[0]?.quota, {
    ownerId: owner.id,
    limitBytes: 100 * 1024 * 1024,
    originalBytes: svg.byteLength,
    optimized: true,
  });
});
