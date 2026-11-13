/** Loopback-only managed-form recovery fixture. Never deploy this entrypoint.
 *
 * Server:
 *   printf 'normal\n' > /tmp/pagecraft-form-fault-mode
 *   node tools/managed-form-fault-qa.mjs --local-only --mode-file /tmp/pagecraft-form-fault-mode
 *
 * Contract check:
 *   node tools/managed-form-fault-qa.mjs --local-only --contract-check
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { serve } from "@hono/node-server";
import * as Core from "../app/src/core/index.ts";
import { createApp } from "../server/src/app.ts";
import { MemoryStore } from "../server/src/store.ts";
import { MemoryAuthStore } from "../server/src/auth.ts";
import { MemoryAssetStore } from "../server/src/assets.ts";
import { MemoryOwnedSiteStore } from "../server/src/accounts.ts";
import { MemoryHostedPublicationStore } from "../server/src/publications.ts";
import { FileSiteTemplateStore } from "../server/src/site-templates.ts";
import { TestHumanChallenge } from "../server/src/turnstile.ts";
import { FileSubmissionStore } from "../server/src/submissions.ts";
import { blankDoc } from "../server/src/render.ts";

if (
  !process.argv.includes("--local-only") ||
  process.env.NODE_ENV === "production"
) {
  throw new Error(
    "Explicit --local-only required; this is never a production server",
  );
}

const PORT = 4918;
const MODES = new Set(["normal", "before-once", "after-once"]);
const argument = (name) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? "" : String(process.argv[at + 1] || "");
};

class FixtureAuth extends MemoryAuthStore {
  pro(user) {
    return user ? { ...user, plan: "pro" } : null;
  }
  async userByEmail(email) {
    return this.pro(await super.userByEmail(email));
  }
  async userById(id) {
    return this.pro(await super.userById(id));
  }
  async userByAuthId(id) {
    return this.pro(await super.userByAuthId(id));
  }
  async ensureAuthUser(id, email, name = "") {
    return this.pro(await super.ensureAuthUser(id, email, name));
  }
}

class FaultSubmissionStore extends FileSubmissionStore {
  constructor(root, modeFile) {
    super(root);
    this.modeFile = modeFile;
    this.lastMode = "normal";
    this.armed = false;
    this.sequence = 0;
    this.requests = [];
    this.sites = new Set();
  }

  async mode() {
    const mode = (await readFile(this.modeFile, "utf8")).trim();
    if (!MODES.has(mode))
      throw new Error(`Fault mode must be one of: ${[...MODES].join(", ")}`);
    if (mode !== this.lastMode) {
      this.lastMode = mode;
      this.armed = mode !== "normal";
    }
    return mode;
  }

  async count(site) {
    return (await this.overview(site)).length;
  }

  async add(site, entry) {
    const mode = await this.mode();
    this.sites.add(site);
    const inject = this.armed && mode !== "normal";
    if (inject) this.armed = false;
    if (inject && mode === "before-once") {
      this.requests.push({
        sequence: ++this.sequence,
        uuid: entry.id,
        mode,
        injectedPhase: "before-store",
        entryCount: await this.count(site),
      });
      throw new Error("Local QA fault before submission storage");
    }
    const created = await super.add(site, entry);
    this.requests.push({
      sequence: ++this.sequence,
      uuid: entry.id,
      mode,
      injectedPhase: inject ? "after-store" : null,
      entryCount: await this.count(site),
    });
    if (inject && mode === "after-once") {
      throw new Error("Local QA fault after submission storage");
    }
    return created;
  }

  async audit() {
    const mode = await this.mode();
    let entryCount = 0;
    for (const site of this.sites) entryCount += await this.count(site);
    return {
      fixture: "pagecraft-managed-form-fault-qa",
      localOnly: true,
      mode,
      entryCount,
      requests: structuredClone(this.requests),
    };
  }
}

const unavailable = async () => {
  throw new Error("Real account operations are disabled in this local fixture");
};
async function fixture(scratch, modeFile) {
  const identity = {
    authUserId: "managed-form-fault-qa",
    email: "managed-form-fault@example.invalid",
    name: "Managed form fault QA",
  };
  const accountAuth = {
    identity: async () => identity,
    oauth: unavailable,
    signUp: unavailable,
    signIn: unavailable,
    confirm: unavailable,
    forgot: unavailable,
    reset: unavailable,
    updateEmail: unavailable,
    updatePassword: unavailable,
    signOut: unavailable,
  };
  const auth = new FixtureAuth();
  await auth.ensureAuthUser(identity.authUserId, identity.email, identity.name);
  const store = new MemoryStore();
  const submissions = new FaultSubmissionStore(
    join(scratch, "submissions"),
    modeFile,
  );
  const publications = new MemoryHostedPublicationStore();
  const app = createApp({
    store,
    auth,
    assets: new MemoryAssetStore(),
    accountAuth,
    ownedSites: new MemoryOwnedSiteStore(store, auth),
    publications,
    siteTemplates: new FileSiteTemplateStore(
      new URL("../premade-sites/", import.meta.url).pathname,
    ),
    submissions,
    challenge: new TestHumanChallenge(),
    turnstileSiteKey: "local-managed-form-fault-test-only",
    editorHost: "localhost",
    editorOrigin: `http://localhost:${PORT}`,
    editorHtml: await readFile(
      new URL("../index.html", import.meta.url),
      "utf8",
    ),
  });
  return { app, store, submissions, publications };
}

function formDocument() {
  const doc = blankDoc("Managed form recovery contract");
  const form = Core.N("form");
  form.id = "fault-contract-form";
  form.props.aria = "Recovery contract";
  form.props.fields = [
    { name: "email", label: "Email", type: "email", required: 1 },
    { name: "message", label: "Message", type: "textarea" },
  ];
  doc.pages[0].tree = [form];
  return doc;
}

async function contractScenario(mode, uuid) {
  const scratch = await mkdtemp(join(tmpdir(), `pagecraft-form-${mode}-`));
  const modeFile = join(scratch, "mode");
  await writeFile(modeFile, "normal\n", { mode: 0o600 });
  try {
    const { app, store, submissions, publications } = await fixture(
      scratch,
      modeFile,
    );
    const site = await store.create({
      host: `${mode}.invalid`,
      name: `Managed form ${mode}`,
      doc: formDocument(),
    });
    const publication = await publications.create({
      siteId: site.id,
      slug: site.slug,
      host: site.host,
      sourceVersion: site.version,
      files: [
        {
          path: "index.html",
          mediaType: "text/html; charset=utf-8",
          bytes: new TextEncoder().encode(
            "<!doctype html><title>Managed form contract</title>",
          ),
        },
      ],
    });
    await publications.promote(publication);
    await submissions.audit();
    await writeFile(modeFile, mode + "\n", { mode: 0o600 });
    const body = new URLSearchParams({
      _pc_request: uuid,
      email: "synthetic@example.invalid",
      message: "Synthetic contract value",
    });
    const post = () =>
      app.request(
        `http://localhost:${PORT}/forms/${site.id}/fault-contract-form`,
        {
          method: "POST",
          headers: {
            origin: `http://localhost:${PORT}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        },
      );
    const first = await post();
    const retry = await post();
    const entries = await submissions.list(site.id);
    if (
      first.status !== 503 ||
      retry.status !== 303 ||
      entries.length !== 1 ||
      entries[0].id !== uuid
    ) {
      throw new Error(
        `${mode} contract failed: first=${first.status}, retry=${retry.status}, entries=${entries.length}`,
      );
    }
    return {
      mode,
      firstStatus: first.status,
      retryStatus: retry.status,
      entryCount: entries.length,
      uuidPreserved: entries[0].id === uuid,
      audit: await submissions.audit(),
    };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function contractCheck() {
  const scenarios = [
    await contractScenario(
      "before-once",
      "11111111-1111-4111-8111-111111111111",
    ),
    await contractScenario(
      "after-once",
      "22222222-2222-4222-8222-222222222222",
    ),
  ];
  console.log(
    JSON.stringify(
      { contract: "managed-form-fault-recovery", passed: true, scenarios },
      null,
      2,
    ),
  );
}

if (process.argv.includes("--contract-check")) {
  await contractCheck();
} else {
  const suppliedModeFile = argument("--mode-file");
  if (!suppliedModeFile)
    throw new Error("Server mode requires --mode-file <path>");
  const modeFile = resolve(suppliedModeFile);
  const initialMode = (await readFile(modeFile, "utf8")).trim();
  if (!MODES.has(initialMode))
    throw new Error(`Fault mode must be one of: ${[...MODES].join(", ")}`);
  const scratch = await mkdtemp(
    join(tmpdir(), "pagecraft-managed-form-fault-"),
  );
  const { app, submissions } = await fixture(scratch, modeFile);
  const server = serve(
    {
      hostname: "127.0.0.1",
      port: PORT,
      async fetch(request) {
        const url = new URL(request.url);
        if (!["127.0.0.1", "localhost"].includes(url.hostname))
          return new Response("Loopback only", { status: 403 });
        if (
          request.method === "GET" &&
          url.pathname === "/__qa/managed-form-fault"
        ) {
          try {
            return Response.json(await submissions.audit(), {
              headers: { "cache-control": "no-store" },
            });
          } catch (error) {
            return Response.json(
              {
                fixture: "pagecraft-managed-form-fault-qa",
                localOnly: true,
                error: String(error.message || error),
              },
              { status: 500 },
            );
          }
        }
        const headers = new Headers(request.headers);
        headers.set("host", `localhost:${PORT}`);
        if (headers.get("origin") === `http://127.0.0.1:${PORT}`)
          headers.set("origin", `http://localhost:${PORT}`);
        const referer = headers.get("referer");
        if (referer?.startsWith(`http://127.0.0.1:${PORT}`))
          headers.set("referer", referer.replace("127.0.0.1", "localhost"));
        return app.fetch(new Request(request, { headers }));
      },
    },
    () =>
      console.log(
        `Managed form fault QA: http://127.0.0.1:${PORT}/ — fictional Pro account; data resets on restart`,
      ),
  );
  let closing = false;
  const close = (signal) => {
    if (closing) return;
    closing = true;
    server.close(async () => {
      await rm(scratch, { recursive: true, force: true });
      process.exit(signal ? 0 : 1);
    });
  };
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => close(signal));
}
