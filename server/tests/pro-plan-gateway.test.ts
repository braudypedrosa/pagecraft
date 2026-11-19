import a from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "vitest";
import {
  accountEntitlements,
  isPaidPlan,
  FREE_PLAN,
  planEntitlements,
  PRO_PLAN,
} from "../../supabase/functions/pagecraft-db/plan-entitlements.ts";

test("plan catalog keeps Pro hidden and defaults unknown plans to Free", () => {
  a.deepEqual(FREE_PLAN, {
    id: "free",
    label: "Free",
    ownedSites: 1,
    storageBytes: 100 * 1024 * 1024,
    public: true,
  });
  a.deepEqual(PRO_PLAN, {
    id: "pro",
    label: "Pro",
    ownedSites: null,
    storageBytes: 5 * 1024 * 1024 * 1024,
    public: false,
  });
  a.equal(planEntitlements(), FREE_PLAN);
  a.equal(planEntitlements(null), FREE_PLAN);
  a.equal(planEntitlements("enterprise"), FREE_PLAN);
  a.equal(planEntitlements("pro"), PRO_PLAN);
});

test("only the designated Pagecraft account receives runtime unrestricted entitlements", () => {
  const owner = "328a15d0-0837-4881-8b47-38d316c03f95";
  for (const plan of [null, "free", "pro"]) {
    a.deepEqual(accountEntitlements(owner, plan), {
      id: "unrestricted", label: "Unrestricted", ownedSites: null,
      storageBytes: Number.MAX_SAFE_INTEGER, public: false,
    });
  }
  a.equal(accountEntitlements(undefined, "pro"), PRO_PLAN);
  a.equal(accountEntitlements(owner + "1", "unrestricted"), FREE_PLAN);
  a.equal(planEntitlements("unrestricted"), FREE_PLAN);
  a.equal(isPaidPlan("unrestricted"), false);
});

test("gateway reads plan while holding each quota owner row lock", () => {
  const source = readFileSync(
    join(
      import.meta.dirname,
      "../../supabase/functions/pagecraft-db/index.ts",
    ),
    "utf8",
  );
  const ownerLocks = source.match(
    /select id, plan from users where id = \$\{ownerId\} for update/g,
  ) ?? [];

  a.equal(ownerLocks.length, 3, "site creation and both storage paths lock plan rows");
  a.match(source, /accountEntitlements\(text\(owner\[0\]\.id\), text\(owner\[0\]\.plan\)\)\.ownedSites/);
  a.equal(source.match(/accountEntitlements\(text\(owner\.id\), text\(owner\.plan\)\)\.storageBytes/g)?.length, 2);
  a.match(
    source,
    /ownedSites !== null && integer\(owned\[0\]\?\.count\) >= ownedSites/,
  );
  a.equal(
    source.match(/Math\.min\(requestedLimitBytes, planStorageBytes\)/g)?.length,
    2,
    "site and library uploads clamp caller limits to the stored plan",
  );
  a.doesNotMatch(source, /FREE_STORAGE_BYTES|args\.plan|input\.plan/);
});
