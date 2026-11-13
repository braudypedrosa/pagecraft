/* Signed-in pages pay for persistence twice over: in production every store method is one HTTPS
   round trip to the database gateway (about half a second from the server), and every identity
   check is one Supabase Auth request (about 0.35 s). These tests count both per request, and
   count how many of them have to wait for one another, so a route that starts repeating a
   lookup or serialising independent reads is caught here rather than by timing staging. */
import { test } from "vitest";
import a from "node:assert/strict";
import type { Context } from "hono";
import * as Core from "../../app/src/core/index.ts";
import { createApp } from "../src/app.ts";
import { MemoryStore, type Store } from "../src/store.ts";
import { MemoryAuthStore, type AuthStore, type Role } from "../src/auth.ts";
import { MemoryAssetStore, type AssetStore } from "../src/assets.ts";
import type { AccountAuth, VerifiedIdentity } from "../src/account-auth.ts";
import type { Doc } from "../../app/src/core/types.ts";

const doc = (): Doc => {
  Core.seed();
  return structuredClone({
    schemaVersion: Core.SCHEMA,
    meta: Core.state.meta,
    header: Core.state.header,
    footer: Core.state.footer,
    pages: Core.state.pages,
  }) as Doc;
};

/* A virtual network. Every remote call waits for the next tick, and a tick releases every call
   waiting at that moment, so the tick count is the number of sequential round trips: calls
   made together cost one, calls that wait for each other cost one each. */
class Network {
  calls: string[] = [];
  private waiting: (() => void)[] = [];
  hop(name: string) {
    this.calls.push(name);
    return new Promise<void>(resolve => this.waiting.push(resolve));
  }
  async run<T>(work: () => Promise<T>) {
    this.calls = [];
    let finished = false, ticks = 0;
    const result = work().finally(() => { finished = true; });
    while (!finished) {
      await new Promise(resolve => setImmediate(resolve));
      if (this.waiting.length) {
        ticks++;
        for (const release of this.waiting.splice(0)) release();
      }
    }
    return { result: await result, ticks, calls: [...this.calls] };
  }
}

function remote<T extends object>(target: T, label: string, network: Network): T {
  return new Proxy(target, {
    get(object, key, receiver) {
      const value = Reflect.get(object, key, receiver);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        await network.hop(`${label}.${String(key)}`);
        return value.apply(object, args);
      };
    },
  });
}

class RemoteAccountAuth implements Partial<AccountAuth> {
  current: VerifiedIdentity | null = null;
  constructor(private network: Network) {}
  async identity(_c: Context) {
    await this.network.hop("identity");
    return this.current;
  }
}

async function rig(role: Role) {
  const network = new Network();
  const memoryStore = new MemoryStore();
  const memoryAuth = new MemoryAuthStore();
  const accountAuth = new RemoteAccountAuth(network);
  const owner = await memoryAuth.ensureAuthUser("auth-owner", "owner@example.test", "Owner");
  const member = role === "owner"
    ? owner
    : await memoryAuth.ensureAuthUser("auth-member", "member@example.test", "Member");
  const site = await memoryStore.create({ host: "count.test", slug: "count", name: "Count", doc: doc() });
  await memoryAuth.grant(site.id, owner.id, "owner");
  if (member !== owner) await memoryAuth.grant(site.id, member.id, role);
  accountAuth.current = {
    authUserId: member === owner ? "auth-owner" : "auth-member",
    email: member.email,
    name: member.name || "",
  };
  const app = createApp({
    store: remote(memoryStore as Store, "store", network),
    auth: remote(memoryAuth as AuthStore, "auth", network),
    assets: remote(new MemoryAssetStore() as AssetStore, "assets", network),
    accountAuth: accountAuth as unknown as AccountAuth,
    editorHost: "admin.test",
    editorOrigin: "http://admin.test",
    editorHtml: "<title>Builder</title>",
  });
  const get = async (path: string) => {
    const run = await network.run(async () =>
      app.request(new Request(`http://admin.test${path}`, { headers: { host: "admin.test" } })));
    return {
      status: run.result.status,
      identity: run.calls.filter(call => call === "identity").length,
      gateway: run.calls.filter(call => call !== "identity").length,
      ticks: run.ticks,
      calls: run.calls,
    };
  };
  return { site, get };
}

const ROUTES = ["/", "/api/sites", "/api/sites/:id", "/sites/:id", "/edit/:id"];

test("signed-in routes verify identity once and look membership up once, whatever the role", async () => {
  for (const role of ["owner", "content", "reviewer"] as const) {
    const { site, get } = await rig(role);
    for (const route of ROUTES) {
      const result = await get(route.replace(":id", site.id));
      if (role === "reviewer" && route.startsWith("/api/sites/")) {
        a.equal(result.status, 403, "a reviewer still may not read the document");
      } else a.ok(result.status < 400, `${role} ${route} answered ${result.status}`);
      a.equal(result.identity, 1, `${role} ${route} verified identity ${result.identity} times`);
      a.ok(result.calls.filter(call => call === "auth.membership").length <= 1,
        `${role} ${route} repeated its membership lookup: ${result.calls.join(", ")}`);
    }
  }
});

test("signed-in routes keep their gateway calls and sequential round trips bounded", async () => {
  /* [gateway calls, sequential round trips including the identity check]. ensureAuthUser is
     counted although production reuses it for 30 s, and so is site.byId, which the gateway
     store caches for an editing session: these are cold figures. */
  const expected: Record<string, Record<string, [number, number]>> = {
    owner: {
      "/": [4, 3], "/api/sites": [3, 3], "/api/sites/:id": [3, 3],
      "/sites/:id": [4, 3], "/edit/:id": [4, 4],
    },
    content: {
      "/": [4, 3], "/api/sites": [3, 3], "/api/sites/:id": [3, 3],
      // Resolve the owner's plan beside usage; this adds a call, not a sequential trip.
      "/sites/:id": [4, 3], "/edit/:id": [6, 5],
    },
    reviewer: {
      "/": [4, 3], "/api/sites": [3, 3], "/api/sites/:id": [3, 3],
      "/sites/:id": [4, 3], "/edit/:id": [3, 3],
    },
  };
  for (const role of ["owner", "content", "reviewer"] as const) {
    const { site, get } = await rig(role);
    for (const route of ROUTES) {
      const result = await get(route.replace(":id", site.id));
      const seen = `${role} ${route}: ${result.gateway} gateway calls, ${result.ticks} round trips`
        + ` (identity, ${result.calls.filter(call => call !== "identity").join(", ")})`;
      a.deepEqual([result.gateway, result.ticks], expected[role][route], seen);
    }
  }
});
