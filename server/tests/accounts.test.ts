import { test } from "vitest";
import a from "node:assert/strict";
import * as Core from "../../app/src/core/index.ts";
import {
  type CloudMutationFastPath,
  createApp,
  type HostedPublishPreparer,
} from "../src/app.ts";
import { MemoryStore } from "../src/store.ts";
import { MemoryAuthStore } from "../src/auth.ts";
import { MemoryOwnedSiteStore } from "../src/accounts.ts";
import { TestHumanChallenge } from "../src/turnstile.ts";
import type { AccountAuth, VerifiedIdentity } from "../src/account-auth.ts";
import type { Context } from "hono";
import { MemoryHostedPublicationStore } from "../src/publications.ts";
import { MemoryAssetStore, type AssetStore } from "../src/assets.ts";
import {
  FileSiteTemplateStore,
  type SiteTemplateStore,
} from "../src/site-templates.ts";
import { resolve } from "node:path";

const doc = () => {
  Core.seed();
  return structuredClone({
    schemaVersion: Core.SCHEMA,
    meta: Core.state.meta,
    header: Core.state.header,
    footer: Core.state.footer,
    pages: Core.state.pages,
  });
};

class FakeAccountAuth implements AccountAuth {
  current: VerifiedIdentity | null = null;
  signup: { email: string; name: string; captchaToken: string } | null = null;
  oauthRedirectTo: string | null = null;
  emailRedirectTo: string | null = null;
  passwordUpdate: { password: string; currentPassword?: string } | null = null;
  async identity(_c: Context) {
    return this.current;
  }
  async oauth(_c: Context, input: { provider: "google"; redirectTo: string }) {
    this.oauthRedirectTo = input.redirectTo;
    return "https://accounts.example.test/google";
  }
  async signUp(
    _c: Context,
    input: {
      email: string;
      password: string;
      name: string;
      captchaToken: string;
    },
  ) {
    this.signup = {
      email: input.email,
      name: input.name,
      captchaToken: input.captchaToken,
    };
    return "confirmation_required" as const;
  }
  async signIn(_c: Context, input: { email: string; password: string }) {
    if (input.password !== "correct horse battery") return null;
    return this.current = {
      authUserId: "auth-1",
      email: input.email,
      name: "Builder",
    };
  }
  async confirm() {
    return this.current;
  }
  async forgot() {}
  async reset(_c: Context, password: string) {
    return password.length >= 12;
  }
  async updateEmail(_c: Context, input: { email: string; redirectTo: string }) {
    if (!this.current) return false;
    this.emailRedirectTo = input.redirectTo;
    this.current = { ...this.current, email: input.email };
    return true;
  }
  async updatePassword(
    _c: Context,
    input: { password: string; currentPassword?: string },
  ) {
    this.passwordUpdate = input;
    return input.password.length >= 12 &&
      input.currentPassword !== "wrong password";
  }
  async signOut() {
    this.current = null;
  }
}

const rig = (
  options: { assets?: AssetStore; siteTemplates?: SiteTemplateStore } = {},
) => {
  const store = new MemoryStore(),
    auth = new MemoryAuthStore(),
    accountAuth = new FakeAccountAuth();
  const app = createApp({
    store,
    auth,
    accountAuth,
    ownedSites: new MemoryOwnedSiteStore(store, auth),
    challenge: new TestHumanChallenge(),
    turnstileSiteKey: "test-site-key",
    editorHost: "admin.test",
    editorOrigin: "http://admin.test",
    editorHtml: "<title>Builder</title>",
    assets: options.assets,
    siteTemplates: options.siteTemplates,
  });
  const request = (path: string, init: RequestInit = {}) =>
    app.request(
      new Request(`http://admin.test${path}`, {
        ...init,
        headers: {
          host: "admin.test",
          origin: "http://admin.test",
          ...(init.headers || {}),
        },
      }),
    );
  return { store, auth, accountAuth, app, request };
};

test("anonymous visitors are sent to sign in and a verified identity always sees the dashboard", async () => {
  const { request, accountAuth } = rig();
  const root = await request("/");
  a.equal(root.status, 302);
  a.equal(root.headers.get("location"), "/sign-in");

  const anonymous = await request("/edit/unknown");
  a.equal(anonymous.status, 302);
  a.equal(anonymous.headers.get("location"), "/sign-in?next=%2Fedit%2Funknown");

  accountAuth.current = {
    authUserId: "auth-1",
    email: "builder@example.test",
    name: "Builder",
  };
  const dashboard = await request("/");
  a.equal(dashboard.status, 200);
  const html = await dashboard.text();
  a.match(html, /<h1>Sites<\/h1>/);
  a.match(html, /Create your first site/);
  a.match(html, /class="pc-topbar"/);
  a.match(html, /class="pc-rail"/);
  a.match(html, /height:52px/);
  a.match(html, /width:62px/);
  a.match(html, /@media\(max-width:520px\).*\.pc-rail\{width:52px/);
  a.match(
    html,
    /<button type="button" data-site-view="sites" aria-pressed="true">/,
  );
  a.doesNotMatch(html, /data-site-view="recent"/);
  a.doesNotMatch(html, /class="pc-rail-account"/);
  a.doesNotMatch(html, /data-account-open/);
});

test("hosted publishing uses one prepared source instead of serial auth and site reads", async () => {
  const store = new MemoryStore(),
    auth = new MemoryAuthStore(),
    accountAuth = new FakeAccountAuth();
  const fixture = doc();
  const replaceGoogleFonts = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value.replace(/Manrope|DM Sans/g, "Arial");
    }
    if (Array.isArray(value)) return value.map(replaceGoogleFonts);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map((
          [key, child],
        ) => [key, replaceGoogleFonts(child)]),
      );
    }
    return value;
  };
  Object.assign(fixture, replaceGoogleFonts(fixture));
  fixture.meta.font = "Arial, sans-serif";
  fixture.meta.headFont = "Arial, sans-serif";
  const site = await store.create({
    host: "bulk.test",
    name: "Bulk",
    doc: fixture,
  });
  const user = await auth.ensureAuthUser(
    "auth-owner",
    "owner@example.test",
    "Owner",
  );
  await auth.grant(site.id, user.id, "owner");
  const revision = await store.revision(site.id, site.version);
  accountAuth.current = {
    authUserId: "auth-owner",
    email: user.email,
    name: user.name,
  };
  let preparations = 0;
  const hostedPublish: HostedPublishPreparer = {
    async prepare(input) {
      preparations++;
      a.equal(input.siteId, site.id);
      a.equal(input.identity.authUserId, "auth-owner");
      return { status: "ok", user, role: "owner", site, revision, assets: [] };
    },
  };
  store.byId = async () => {
    throw new Error("optimized publish fetched the site separately");
  };
  store.revision = async () => {
    throw new Error("optimized publish fetched the revision separately");
  };
  auth.ensureAuthUser = async () => {
    throw new Error("optimized publish remapped the identity separately");
  };
  auth.membership = async () => {
    throw new Error("optimized publish fetched membership separately");
  };
  const app = createApp({
    store,
    auth,
    accountAuth,
    hostedPublish,
    publications: new MemoryHostedPublicationStore(),
    editorHost: "admin.test",
    editorOrigin: "http://admin.test",
  });
  const response = await app.request(
    new Request(`http://admin.test/api/sites/${site.id}/publish`, {
      method: "POST",
      headers: {
        host: "admin.test",
        origin: "http://admin.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceVersion: site.version,
        acknowledgeWarnings: true,
      }),
    }),
  );
  a.equal(response.status, 200, await response.clone().text());
  a.equal((await response.json() as { status: string }).status, "published");
  a.equal(preparations, 1);
});

test("Cloud save and publish reuse a verified cached source with one atomic write each", async () => {
  const store = new MemoryStore(),
    auth = new MemoryAuthStore(),
    accountAuth = new FakeAccountAuth();
  const fixture = JSON.parse(
    JSON.stringify(doc()).replaceAll("Manrope", "Arial").replaceAll(
      "DM Sans",
      "Arial",
    ),
  ) as ReturnType<typeof doc>;
  fixture.meta.font = "Arial, sans-serif";
  fixture.meta.headFont = "Arial, sans-serif";
  const original = await store.create({
    host: "fast.test",
    name: "Fast",
    doc: fixture,
  });
  const user = await auth.ensureAuthUser(
    "auth-owner",
    "owner@example.test",
    "Owner",
  );
  await auth.grant(original.id, user.id, "owner");
  accountAuth.current = {
    authUserId: "auth-owner",
    email: user.email,
    name: user.name,
  };
  let cachedSite = original;
  let atomicSaves = 0, atomicPublishes = 0;
  const cloudMutations: CloudMutationFastPath = {
    cachedSaveSource(siteId, sourceVersion) {
      return siteId === cachedSite.id && sourceVersion === cachedSite.version
        ? { site: cachedSite, assets: [] }
        : null;
    },
    async saveAuthorized(input) {
      atomicSaves++;
      a.equal(input.identity.authUserId, "auth-owner");
      const saved = await store.save(
        input.siteId,
        input.doc,
        input.sourceVersion,
        user.id,
      );
      if (!saved.ok) {
        return {
          status: "conflict",
          currentVersion: saved.conflict?.theirs || 0,
        };
      }
      cachedSite = saved.site!;
      return { status: "saved", site: cachedSite };
    },
    cachedPublishSource(input) {
      if (
        input.siteId !== cachedSite.id ||
        input.sourceVersion !== cachedSite.version
      ) return null;
      return {
        user,
        site: cachedSite,
        revision: {
          siteId: cachedSite.id,
          version: cachedSite.version,
          doc: cachedSite.doc,
          savedBy: user.id,
          createdAt: cachedSite.updatedAt,
        },
        assets: [],
      };
    },
    async publishAuthorized(input) {
      atomicPublishes++;
      const published = await store.publishHosted({
        id: input.siteId,
        version: input.sourceVersion,
        publicationId: input.publicationId,
        contentHash: input.contentHash,
        createdBy: user.id,
        createdAt: input.createdAt,
      });
      if (!published) {
        return { status: "conflict", currentVersion: cachedSite.version };
      }
      cachedSite = published;
      return { status: "published", site: published };
    },
  };
  const hostedPublish: HostedPublishPreparer = {
    async prepare() {
      throw new Error(
        "cached publish unexpectedly used the preparation round trip",
      );
    },
  };
  const app = createApp({
    store,
    auth,
    accountAuth,
    hostedPublish,
    cloudMutations,
    publications: new MemoryHostedPublicationStore(),
    editorHost: "admin.test",
    editorOrigin: "http://admin.test",
  });
  const save = await app.request(
    new Request(`http://admin.test/api/sites/${original.id}`, {
      method: "PUT",
      headers: {
        host: "admin.test",
        origin: "http://admin.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ doc: fixture, version: original.version }),
    }),
  );
  a.equal(save.status, 200, await save.clone().text());
  const savedVersion = (await save.json() as { version: number }).version;
  const publish = await app.request(
    new Request(`http://admin.test/api/sites/${original.id}/publish`, {
      method: "POST",
      headers: {
        host: "admin.test",
        origin: "http://admin.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceVersion: savedVersion,
        acknowledgeWarnings: true,
      }),
    }),
  );
  a.equal(publish.status, 200, await publish.clone().text());
  a.equal(atomicSaves, 1);
  a.equal(atomicPublishes, 1);
});

test("dashboard renders searchable builder-style site cards and the owner quota", async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: "auth-1",
    email: "builder@example.test",
    name: "Builder",
  };
  await auth.ensureAuthUser("auth-1", "builder@example.test", "Builder");
  const created = await request("/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Braudy", doc: doc() }),
  });
  a.equal(created.status, 201);

  const dashboard = await request("/");
  a.equal(dashboard.status, 200);
  const html = await dashboard.text();
  a.match(html, /placeholder="Search sites"/);
  a.match(html, /<option value="updated">Last edited<\/option>/);
  a.match(html, /class="pc-site-card"/);
  a.match(html, /class="pc-site-preview"/);
  a.match(html, /class="pc-preview-fallback"/);
  a.match(html, /data-copy-site/);
  a.match(html, />Manage site<\/a>/);
  a.match(html, />Braudy<\/div>/);
  a.match(html, /class="pc-site-url"/);
  a.match(html, />admin\.test\/braudy<\/a>/);
  a.match(html, />Edit<\/a>/);
  a.match(html, />View site<\/a>/);
  a.match(html, />Owner<\/div>/);
  a.match(html, /2 sites remaining/);
  a.match(html, /1 of 3 owned sites · 0 KB of 100 MB media used/);
  a.match(html, /data-site-view="owned"/);
  a.match(html, /data-filter-empty/);
  a.match(html, /No sites match your search/);
  a.match(html, /No shared sites yet/);
  a.match(html, /No owned sites yet/);
  a.match(html, />Add new site<\/a>/);
  a.match(html, /href="\/account">Account settings<\/a>/);
  a.match(html, /name="slug"/);
  a.match(html, /data-create-error/);
  a.match(html, /background-position:right 14px center/);
  a.match(html, /pc-custom-select-trigger/);
  a.match(html, /pc-custom-select-popover/);
  a.match(html, /\.pc-site-grid\{align-items:stretch\}/);
  a.match(html, /\.pc-site-card,\.pc-create-card\{height:100%\}/);
});

test("a curated site installs all pages and remapped media without charging the owner quota", async () => {
  const assets = new MemoryAssetStore();
  const siteTemplates = new FileSiteTemplateStore(
    resolve(process.cwd(), "premade-sites"),
  );
  const { request, accountAuth, auth, store } = rig({ assets, siteTemplates });
  accountAuth.current = {
    authUserId: "auth-1",
    email: "builder@example.test",
    name: "Builder",
  };
  const owner = await auth.ensureAuthUser(
    "auth-1",
    "builder@example.test",
    "Builder",
  );

  const created = await request("/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Client Studio",
      templateId: "independent-studio",
      templateVersion: "2.0.3",
    }),
  });
  a.equal(created.status, 201, await created.clone().text());
  const result = await created.json() as { id: string; files: string[] };
  const site = await store.byId(result.id);
  a.ok(site);
  a.equal(site.name, "Client Studio");
  a.equal(site.doc.meta.name, "Client Studio");
  a.deepEqual(site.doc.pages.map((page) => page.name), [
    "Home",
    "About",
    "Services",
    "Contact",
  ]);
  a.ok(result.files.includes("index.html"));
  a.ok(result.files.includes("about.html"));
  const installed = await assets.list(site.id);
  a.equal(installed.length, 5);
  a.ok(installed.every((asset) => !asset.id.startsWith("northline-")));
  const serialized = JSON.stringify(site.doc);
  a.ok(installed.every((asset) => serialized.includes(`asset:${asset.id}`)));
  a.deepEqual(await assets.usage(owner.id), {
    usedBytes: 0,
    limitBytes: 100 * 1024 * 1024,
  });

  const dashboard = await request("/");
  const html = await dashboard.text();
  a.match(html, /Independent Studio/);
  a.match(html, /name="siteTemplate" value="independent-studio@2\.0\.3"/);
  a.doesNotMatch(html, /name="siteTemplate" value="independent-studio@2\.0\.2"/);
  a.doesNotMatch(html, /name="siteTemplate" value="independent-studio@2\.0\.1"/);
  a.doesNotMatch(html, /name="siteTemplate" value="independent-studio@2\.0\.0"/);
  a.doesNotMatch(html, /name="siteTemplate" value="independent-studio@1\.0\.1"/);
  a.doesNotMatch(html, /name="siteTemplate" value="independent-studio@1\.0\.0"/);
  a.match(
    html,
    /\/templates\/independent-studio\/2\.0\.3\/preview\/index\.html/,
  );
  a.match(html, /Blank site/);

  const preview = await request(
    "/templates/independent-studio/2.0.3/preview/index.html",
  );
  a.equal(preview.status, 200);
  a.match(preview.headers.get("content-security-policy") || "", /script-src/);
  const previewHtml = await preview.text();
  a.match(previewHtml, /scrollbar-width:none/);
  a.match(previewHtml, /Direction is made in the open\./);
  a.match(previewHtml, /nl-loop-editorial/);
  a.doesNotMatch(previewHtml, /class="[^"]*\bnl-loop-card\b/);
  const packagedAsset = previewHtml.match(/src="(assets\/[^"]+\.webp)"/);
  a.ok(packagedAsset);
  const media = await request(
    `/templates/independent-studio/2.0.3/preview/${packagedAsset[1]}`,
  );
  a.equal(media.status, 200);
  a.equal(media.headers.get("content-type"), "image/webp");
  a.match(media.headers.get("cache-control") || "", /immutable/);

  const v202 = await request(
    "/templates/independent-studio/2.0.2/preview/index.html",
  );
  a.equal(v202.status, 200);

  const v201 = await request(
    "/templates/independent-studio/2.0.1/preview/index.html",
  );
  a.equal(v201.status, 200);

  const v200 = await request(
    "/templates/independent-studio/2.0.0/preview/index.html",
  );
  a.equal(v200.status, 200);

  const previousVersion = await request(
    "/templates/independent-studio/1.0.1/preview/index.html",
  );
  a.equal(previousVersion.status, 200);

  const priorVersion = await request(
    "/templates/independent-studio/1.0.0/preview/index.html",
  );
  a.equal(priorVersion.status, 200);
});

test("site overview is protected, membership-scoped, and exposes working management actions", async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: "auth-owner",
    email: "owner@example.test",
    name: "Owner",
  };
  const owner = await auth.ensureAuthUser(
    "auth-owner",
    "owner@example.test",
    "Owner",
  );
  const created = await request("/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Studio site", doc: doc() }),
  });
  a.equal(created.status, 201);
  const site = await created.json() as { id: string };

  const response = await request(`/sites/${site.id}`);
  a.equal(response.status, 200);
  const html = await response.text();
  a.match(html, /<h1>Studio site<\/h1>/);
  a.match(html, /aria-label="Site management"/);
  a.match(html, /aria-current="page"/);
  a.match(html, />Published<\/span>/);
  a.match(html, />Owner<\/dd>/);
  a.match(html, new RegExp(`href="/edit/${site.id}">Edit site<\\/a>`));
  a.match(
    html,
    new RegExp(
      `href="/v1/sites/${site.id}/packages/site">Download project<\\/a>`,
    ),
  );
  a.match(html, new RegExp(`href="/sites/${site.id}/settings"`));
  a.match(html, /This site is available on its Pagecraft address/);

  accountAuth.current = null;
  const anonymous = await request(`/sites/${site.id}`);
  a.equal(anonymous.status, 302);
  a.equal(
    anonymous.headers.get("location"),
    `/sign-in?next=%2Fsites%2F${site.id}`,
  );

  accountAuth.current = {
    authUserId: "auth-content",
    email: "content@example.test",
    name: "Content",
  };
  const content = await auth.ensureAuthUser(
    "auth-content",
    "content@example.test",
    "Content",
  );
  await auth.grant(site.id, content.id, "content");
  const collaborator = await request(`/sites/${site.id}`);
  a.equal(collaborator.status, 200);
  const collaboratorHtml = await collaborator.text();
  a.match(collaboratorHtml, />Content editor<\/dd>/);
  a.doesNotMatch(collaboratorHtml, /Settings<\/span>/);

  accountAuth.current = {
    authUserId: "auth-stranger",
    email: "stranger@example.test",
    name: "Stranger",
  };
  await auth.ensureAuthUser(
    "auth-stranger",
    "stranger@example.test",
    "Stranger",
  );
  a.equal((await request(`/sites/${site.id}`)).status, 404);
  a.equal((await request("/sites/does-not-exist")).status, 404);
  a.ok(owner.id);
});

test("site People lets owners invite and manage collaborators while content sees only itself", async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: "auth-owner",
    email: "owner@example.test",
    name: "Owner",
  };
  await auth.ensureAuthUser("auth-owner", "owner@example.test", "Owner");
  const created = await request("/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "People site", doc: doc() }),
  });
  const site = await created.json() as { id: string };
  const form = (path: string, values: Record<string, string>) =>
    request(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(values),
    });

  const page = await request(`/sites/${site.id}/people`);
  a.equal(page.status, 200);
  const ownerHtml = await page.text();
  a.match(ownerHtml, /<h1>People<\/h1>/);
  a.match(ownerHtml, /Invite someone/);
  a.match(ownerHtml, /Content editor/);
  a.match(ownerHtml, /owner@example\.test/);
  a.match(ownerHtml, /Active account/);
  a.match(ownerHtml, /aria-current="page"[^>]*>.*People/s);

  const invited = await form(`/sites/${site.id}/people/invite`, {
    email: "Collaborator@Example.test",
    role: "content",
  });
  a.equal(invited.status, 303);
  const genericInvite =
    `/sites/${site.id}/people?message=Access+updated.+An+invitation+was+sent+if+needed.`;
  a.equal(invited.headers.get("location"), genericInvite);
  const collaborator = await auth.userByEmail("collaborator@example.test");
  a.ok(collaborator);
  a.equal((await auth.membership(site.id, collaborator!.id))?.role, "content");

  const pending = await request(`/sites/${site.id}/people`);
  a.match(await pending.text(), /Invitation pending/);
  const promoted = await form(
    `/sites/${site.id}/people/${collaborator!.id}/role`,
    { role: "owner" },
  );
  a.equal(promoted.status, 303);
  a.equal((await auth.membership(site.id, collaborator!.id))?.role, "owner");
  const demoted = await form(
    `/sites/${site.id}/people/${collaborator!.id}/role`,
    { role: "content" },
  );
  a.equal(demoted.status, 303);

  const repeated = await form(`/sites/${site.id}/people/invite`, {
    email: "collaborator@example.test",
    role: "content",
  });
  a.equal(repeated.status, 303);
  a.equal(
    repeated.headers.get("location"),
    `/sites/${site.id}/people?error=people_rate`,
  );
  a.equal(repeated.headers.get("retry-after"), "60");

  const active = await auth.ensureAuthUser(
    "auth-active",
    "active@example.test",
    "Active",
  );
  const activeInvite = await form(`/sites/${site.id}/people/invite`, {
    email: active.email,
    role: "content",
  });
  a.equal(
    activeInvite.headers.get("location"),
    genericInvite,
    "the response does not disclose whether an address already has an account",
  );

  accountAuth.current = {
    authUserId: "auth-collaborator",
    email: "collaborator@example.test",
    name: "Collaborator",
  };
  await auth.ensureAuthUser(
    "auth-collaborator",
    "collaborator@example.test",
    "Collaborator",
  );
  const contentPage = await request(`/sites/${site.id}/people`);
  a.equal(contentPage.status, 200);
  const contentHtml = await contentPage.text();
  a.match(contentHtml, /Your membership/);
  a.match(contentHtml, /collaborator@example\.test/);
  a.doesNotMatch(contentHtml, /owner@example\.test/);
  a.doesNotMatch(contentHtml, /Invite someone/);
  a.doesNotMatch(contentHtml, /Send invitation/);

  accountAuth.current = {
    authUserId: "auth-owner",
    email: "owner@example.test",
    name: "Owner",
  };
  const removed = await form(
    `/sites/${site.id}/people/${collaborator!.id}/remove`,
    {},
  );
  a.equal(removed.status, 303);
  a.equal(await auth.membership(site.id, collaborator!.id), null);
});

test("invitation confirmation requires a password and preserves the safe People destination", async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: "auth-invitee",
    email: "invitee@example.test",
    name: "Invitee",
  };
  await auth.ensureAuthUser("auth-invitee", "invitee@example.test", "Invitee");

  const confirmed = await request(
    "/auth/confirm?type=invite&next=%2Fsites%2Fsite-one%2Fpeople",
  );
  a.equal(confirmed.status, 303);
  a.equal(
    confirmed.headers.get("location"),
    "/reset-password?next=%2Fsites%2Fsite-one%2Fpeople",
  );
  const reset = await request(
    "/reset-password?next=%2Fsites%2Fsite-one%2Fpeople",
  );
  a.equal(reset.status, 200);
  a.match(await reset.text(), /name="next" value="\/sites\/site-one\/people"/);

  const updated = await request("/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      next: "/sites/site-one/people",
      password: "correct horse battery",
      passwordConfirm: "correct horse battery",
    }),
  });
  a.equal(updated.status, 303);
  a.equal(
    updated.headers.get("location"),
    "/sites/site-one/people?message=Password+updated.",
  );
});

test("site settings let only owners rename, change the Pagecraft address, and delete by typed confirmation", async () => {
  const { request, accountAuth, auth, store } = rig();
  accountAuth.current = {
    authUserId: "auth-owner",
    email: "owner@example.test",
    name: "Owner",
  };
  const owner = await auth.ensureAuthUser(
    "auth-owner",
    "owner@example.test",
    "Owner",
  );
  const create = async (name: string) => {
    const response = await request("/api/sites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, doc: doc() }),
    });
    a.equal(response.status, 201);
    return await response.json() as { id: string; slug: string };
  };
  const site = await create("Studio site");
  const other = await create("Second site");
  const form = (path: string, values: Record<string, string>) =>
    request(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(values),
    });

  const settings = await request(`/sites/${site.id}/settings`);
  a.equal(settings.status, 200);
  const html = await settings.text();
  a.match(html, /<h1>Site settings<\/h1>/);
  a.match(html, /action="\/sites\/.+\/settings\/name"/);
  a.match(html, /action="\/sites\/.+\/settings\/slug"/);
  a.match(html, /Support ID/);
  a.match(html, new RegExp(`<code>${site.id}<\\/code>`));
  a.match(html, /data-delete-submit disabled/);
  a.match(html, /Settings<\/span>/);

  accountAuth.current = {
    authUserId: "auth-content",
    email: "content@example.test",
    name: "Content",
  };
  const content = await auth.ensureAuthUser(
    "auth-content",
    "content@example.test",
    "Content",
  );
  await auth.grant(site.id, content.id, "content");
  a.equal((await request(`/sites/${site.id}/settings`)).status, 403);
  a.equal(
    (await form(`/sites/${site.id}/settings/name`, { name: "Not allowed" }))
      .status,
    403,
  );

  accountAuth.current = {
    authUserId: "auth-owner",
    email: "owner@example.test",
    name: "Owner",
  };
  const renamed = await form(`/sites/${site.id}/settings/name`, {
    name: "Renamed studio",
  });
  a.equal(renamed.status, 303);
  a.equal((await store.byId(site.id))?.name, "Renamed studio");

  const invalid = await form(`/sites/${site.id}/settings/slug`, {
    slug: "Not Valid",
  });
  a.equal(invalid.status, 303);
  a.match(invalid.headers.get("location") || "", /error=site_slug/);
  const collision = await form(`/sites/${site.id}/settings/slug`, {
    slug: other.slug,
  });
  a.equal(collision.status, 303);
  a.match(collision.headers.get("location") || "", /error=site_slug_taken/);
  const moved = await form(`/sites/${site.id}/settings/slug`, {
    slug: "renamed-studio",
  });
  a.equal(moved.status, 303);
  a.equal((await store.byId(site.id))?.slug, "renamed-studio");

  const mismatch = await form(`/sites/${site.id}/settings/delete`, {
    confirmation: "Studio site",
  });
  a.equal(mismatch.status, 303);
  a.ok(await store.byId(site.id));
  const deleted = await form(`/sites/${site.id}/settings/delete`, {
    confirmation: "Renamed studio",
  });
  a.equal(deleted.status, 303);
  a.equal(deleted.headers.get("location"), "/?message=Site+deleted.");
  a.equal(await store.byId(site.id), null);
  a.equal(await auth.membership(site.id, owner.id), null);
  a.equal(await auth.membership(site.id, content.id), null);
  a.equal((await request(`/sites/${site.id}/settings`)).status, 404);
});

test("account settings shows profile, security, providers, and real free-plan usage", async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: "auth-1",
    email: "builder@example.test",
    name: "Builder",
    providers: ["email", "google"],
    createdAt: "2026-01-12T00:00:00.000Z",
  };
  await auth.ensureAuthUser("auth-1", "builder@example.test", "Builder");

  const response = await request("/account");
  a.equal(response.status, 200);
  const html = await response.text();
  a.match(html, /<h1>Account settings<\/h1>/);
  a.match(html, /action="\/account\/profile"/);
  a.match(html, /value="Builder"/);
  a.match(html, /value="builder@example\.test"/);
  a.match(html, /Email and password<\/strong><span>Connected/);
  a.match(html, /Google<\/strong><span>Connected/);
  a.match(html, /action="\/account\/password"/);
  a.match(html, /Current password/);
  a.match(html, /Plan &amp; billing/);
  a.match(html, /<span class="pc-plan-badge">Free<\/span>/);
  a.match(html, /0 of 3 used/);
  a.match(html, /0 KB of 100 MB/);
  a.match(html, /Paid plans are not available yet/);
  a.match(html, /Joined Jan 12, 2026/);
  a.match(html, /role="tablist" aria-label="Account settings"/);
  a.match(
    html,
    /role="tab" aria-controls="settings-panel-profile" data-settings-tab="profile" aria-selected="true" tabindex="0"/,
  );
  a.match(
    html,
    /role="tabpanel" aria-labelledby="settings-tab-security" tabindex="0" data-settings-panel="security"/,
  );
  a.match(html, /event\.key==='ArrowRight'/);
  a.match(html, /panel\.hidden=panel\.dataset\.settingsPanel!==name/);
  a.match(
    html,
    /\.pc-settings-links\{margin-top:auto;padding-top:24px;border-top:1px solid var\(--pc-line\)\}/,
  );

  const planResponse = await request("/account?tab=plan");
  const planHtml = await planResponse.text();
  a.match(
    planHtml,
    /data-settings-tab="plan" aria-selected="true" tabindex="0"/,
  );
});

test("account profile updates the local name and starts verified email change", async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: "auth-1",
    email: "old@example.test",
    name: "Old Name",
    providers: ["email"],
  };
  const user = await auth.ensureAuthUser(
    "auth-1",
    "old@example.test",
    "Old Name",
  );
  const response = await request("/account/profile", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name: "New Name", email: "new@example.test" }),
  });
  a.equal(response.status, 303);
  a.match(response.headers.get("location") || "", /Confirm\+the\+new\+email/);
  a.equal(
    accountAuth.emailRedirectTo,
    "http://admin.test/auth/confirm?next=%2Faccount",
  );
  a.equal((await auth.userById(user.id))?.name, "New Name");

  const page = await request("/account");
  a.equal(page.status, 200);
  a.equal((await auth.userById(user.id))?.email, "new@example.test");
});

test("account profile refuses an email already owned by another Pagecraft identity", async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: "auth-1",
    email: "first@example.test",
    name: "First",
    providers: ["email"],
  };
  await auth.ensureAuthUser("auth-1", "first@example.test", "First");
  await auth.ensureAuthUser("auth-2", "taken@example.test", "Second");
  const response = await request("/account/profile", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name: "First", email: "taken@example.test" }),
  });
  a.equal(response.status, 303);
  a.equal(
    response.headers.get("location"),
    "/account?tab=profile&error=email_conflict",
  );
});

test("password accounts require the current password while Google-only accounts can set one", async () => {
  const { request, accountAuth } = rig();
  accountAuth.current = {
    authUserId: "auth-1",
    email: "builder@example.test",
    name: "Builder",
    providers: ["email"],
  };
  const wrong = await request("/account/password", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      currentPassword: "wrong password",
      password: "a long replacement passphrase",
      passwordConfirm: "a long replacement passphrase",
    }),
  });
  a.equal(
    wrong.headers.get("location"),
    "/account?tab=security&error=password_current",
  );

  accountAuth.current = {
    authUserId: "auth-2",
    email: "google@example.test",
    name: "Google",
    providers: ["google"],
  };
  const set = await request("/account/password", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      password: "a long replacement passphrase",
      passwordConfirm: "a long replacement passphrase",
    }),
  });
  a.equal(
    set.headers.get("location"),
    "/account?tab=security&message=Password+updated.",
  );
  a.deepEqual(accountAuth.passwordUpdate, {
    password: "a long replacement passphrase",
  });
});

test("account mutations enforce the browser origin check", async () => {
  const { request, accountAuth } = rig();
  accountAuth.current = {
    authUserId: "auth-1",
    email: "builder@example.test",
    name: "Builder",
    providers: ["email"],
  };
  const response = await request("/account/profile", {
    method: "POST",
    headers: {
      origin: "https://elsewhere.test",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      name: "Changed",
      email: "builder@example.test",
    }),
  });
  a.equal(response.status, 403);
  a.deepEqual(await response.json(), { error: "origin_not_allowed" });
});

test("site management mutations require a trusted browser origin", async () => {
  const { app, request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: "auth-owner",
    email: "owner@example.test",
    name: "Owner",
    providers: ["email"],
  };
  await auth.ensureAuthUser("auth-owner", "owner@example.test", "Owner");
  const created = await request("/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Protected site", doc: doc() }),
  });
  const site = await created.json() as { id: string };

  const crossOrigin = await request(`/sites/${site.id}/settings/name`, {
    method: "POST",
    headers: {
      origin: "https://attacker.itspagecraft.com",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ name: "Taken over" }),
  });
  a.equal(crossOrigin.status, 403);
  a.deepEqual(await crossOrigin.json(), { error: "origin_not_allowed" });

  const missingOrigin = await app.request(
    new Request(
      `http://admin.test/sites/${site.id}/settings/name`,
      {
        method: "POST",
        headers: {
          host: "admin.test",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ name: "Unverified" }),
      },
    ),
  );
  a.equal(missingOrigin.status, 403);
  a.deepEqual(await missingOrigin.json(), { error: "origin_not_allowed" });

  const refererFallback = await app.request(
    new Request(
      `http://admin.test/sites/${site.id}/settings/name`,
      {
        method: "POST",
        headers: {
          host: "admin.test",
          referer: `http://admin.test/sites/${site.id}/settings`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ name: "Verified" }),
      },
    ),
  );
  a.equal(refererFallback.status, 303);
});

test("site management forms reject oversized bodies before parsing", async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: "auth-owner",
    email: "owner@example.test",
    name: "Owner",
  };
  await auth.ensureAuthUser("auth-owner", "owner@example.test", "Owner");
  const created = await request("/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Bounded site", doc: doc() }),
  });
  const site = await created.json() as { id: string };
  const response = await request(`/sites/${site.id}/people/invite`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email: `${"a".repeat(17 * 1024)}@example.test`,
      role: "content",
    }),
  });
  a.equal(response.status, 413);
  a.equal(await response.text(), "Request too large");
});

test("site creation reports usable slug errors to JSON and redirects form submissions safely", async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: "auth-1",
    email: "builder@example.test",
    name: "Builder",
  };
  await auth.ensureAuthUser("auth-1", "builder@example.test", "Builder");

  const invalid = await request("/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Invalid", slug: "Not A Slug" }),
  });
  a.equal(invalid.status, 422);
  a.deepEqual(await invalid.json(), {
    error: "invalid_slug",
    detail:
      "Use lowercase letters, numbers, and single hyphens. Maximum 40 characters.",
  });

  const invalidForm = await request("/api/sites", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name: "Invalid", slug: "Not A Slug" }),
  });
  a.equal(invalidForm.status, 303);
  a.equal(invalidForm.headers.get("location"), "/?error=slug");

  const first = await request("/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "First", slug: "reserved-address" }),
  });
  a.equal(first.status, 201);
  const duplicate = await request("/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Second", slug: "reserved-address" }),
  });
  a.equal(duplicate.status, 409);
  a.deepEqual(await duplicate.json(), {
    error: "slug_taken",
    detail: "That site address is already in use. Choose another.",
  });
});

test("sign in offers Google and email, links to registration, and uses the Pagecraft logo", async () => {
  const { request } = rig();
  const response = await request("/sign-in");
  a.equal(response.status, 200);
  const html = await response.text();
  a.match(html, /Continue with Google/);
  a.match(html, /action="\/auth\/login"/);
  a.match(html, /href="\/sign-up"/);
  a.match(html, /href="\/privacy"/);
  a.match(html, /href="\/terms"/);
  a.match(html, /src="\/brand\/pagecraft-logo\.svg\?v=dark-2"/);
  a.match(html, /data-theme="dark"/);
  a.match(
    html,
    /rel="icon" type="image\/svg\+xml" href="\/brand\/pagecraft-favicon\.svg"/,
  );

  const logo = await request("/brand/pagecraft-logo.svg");
  a.equal(logo.status, 200);
  a.match(logo.headers.get("content-type") || "", /image\/svg\+xml/);
  const logoSvg = await logo.text();
  a.match(logoSvg, /Pagecraft primary logo for dark backgrounds/);
  a.match(logoSvg, /fill="#F8F6EF"/);

  const favicon = await request("/brand/pagecraft-favicon.svg");
  a.equal(favicon.status, 200);
  a.match(favicon.headers.get("content-type") || "", /image\/svg\+xml/);
  a.match(await favicon.text(), /Pagecraft favicon/);
});

test("privacy and terms are public on the editor host", async () => {
  const { request } = rig();
  const privacy = await request("/privacy");
  a.equal(privacy.status, 200);
  const privacyHtml = await privacy.text();
  a.match(privacyHtml, /Privacy Policy/);
  a.match(privacyHtml, /Braudy Pedrosa/);
  a.match(privacyHtml, /hello@braudyp\.dev/);
  a.match(privacyHtml, /Supabase/);

  const terms = await request("/terms");
  a.equal(terms.status, 200);
  const termsHtml = await terms.text();
  a.match(termsHtml, /Terms of Service/);
  a.match(termsHtml, /laws of the Philippines/);
});

test("Google sign in uses the Supabase PKCE callback and preserves only a safe local destination", async () => {
  const { request, accountAuth, auth } = rig();
  const start = await request("/auth/google", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ next: "/edit/site-1" }),
  });
  a.equal(start.status, 303);
  a.equal(
    start.headers.get("location"),
    "https://accounts.example.test/google",
  );
  a.equal(
    accountAuth.oauthRedirectTo,
    "http://admin.test/auth/confirm?next=%2Fedit%2Fsite-1",
  );

  accountAuth.current = {
    authUserId: "google-auth-1",
    email: "google@example.test",
    name: "Google Builder",
  };
  const callback = await request(
    "/auth/confirm?code=valid&next=%2Fedit%2Fsite-1",
  );
  a.equal(callback.status, 303);
  a.equal(callback.headers.get("location"), "/edit/site-1");
  a.ok(await auth.userByEmail("google@example.test"));

  const unsafe = await request(
    "/auth/confirm?code=valid&next=https%3A%2F%2Fevil.test",
  );
  a.equal(unsafe.headers.get("location"), "/");
});

test("signup validates a human challenge and does not provision an unconfirmed profile", async () => {
  const { request, auth, accountAuth } = rig();
  const body = new URLSearchParams({
    name: "Builder",
    email: "Builder@Example.test",
    password: "correct horse battery",
    passwordConfirm: "correct horse battery",
    "cf-turnstile-response": "pagecraft-test-human",
  });
  const response = await request("/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  a.equal(response.status, 303);
  a.match(response.headers.get("location") || "", /^\/sign-in\?message=/);
  a.deepEqual(accountAuth.signup, {
    email: "builder@example.test",
    name: "Builder",
    captchaToken: "pagecraft-test-human",
  });
  a.equal(await auth.userByEmail("builder@example.test"), null);
});

test("three concurrent owned sites succeed and the fourth is rejected atomically", async () => {
  const { request, accountAuth, auth } = rig();
  accountAuth.current = {
    authUserId: "auth-1",
    email: "builder@example.test",
    name: "Builder",
  };
  await auth.ensureAuthUser("auth-1", "builder@example.test", "Builder");
  const make = (name: string) =>
    request("/api/sites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, doc: doc() }),
    });
  const responses = await Promise.all(
    ["One", "Two", "Three", "Four"].map(make),
  );
  a.deepEqual(responses.map((response) => response.status).sort(), [
    201,
    201,
    201,
    409,
  ]);
  const limited = responses.find((response) => response.status === 409)!;
  a.deepEqual(await limited.json(), { error: "site_limit_reached", limit: 3 });
});

test("cross-origin cookie-backed mutations are refused", async () => {
  const { app, accountAuth } = rig();
  accountAuth.current = {
    authUserId: "auth-1",
    email: "builder@example.test",
    name: "Builder",
  };
  const response = await app.request(
    new Request("http://admin.test/api/sites", {
      method: "POST",
      headers: {
        host: "admin.test",
        origin: "https://attacker.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Nope" }),
    }),
  );
  a.equal(response.status, 403);
  a.deepEqual(await response.json(), { error: "origin_not_allowed" });
});
