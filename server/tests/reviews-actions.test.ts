import { test } from "vitest";
import a from "node:assert/strict";
import { siteReviewsPage } from "../src/account-pages.ts";

/* S3: Reviews offers an action only when there is something for it to act on. */
const user = { id: "u1", email: "owner@example.invalid", name: "Owner" } as never;
const site = { id: "s1", name: "Reviews QA", slug: "reviews-qa", role: "owner", version: 2, publishedVersion: 0 } as never;
const head = (html: string) => html.match(/<div class="pc-sub-actions">[^]*?<\/div>/)?.[0] ?? "";
const link = (access: string) => ({ id: "l-" + access, token: "tok-" + access, access, createdAt: "2026-11-19T00:00:00Z" }) as never;

test("with no review links or snapshots, only Create review link is offered", () => {
  const actions = head(siteReviewsPage(user, site, { links: [] }));
  a.match(actions, />Create review link</);
  a.doesNotMatch(actions, /Assign snapshot/);
  a.doesNotMatch(actions, /Assign access/);
});

test("a public link alone has no access to assign", () => {
  a.doesNotMatch(head(siteReviewsPage(user, site, { links: [link("public")] })), /Assign access/);
});

test("a private or developer link offers Assign access", () => {
  a.match(head(siteReviewsPage(user, site, { links: [link("private")] })), /data-open-dialog="assign-review-dialog">Assign access</);
  a.match(head(siteReviewsPage(user, site, { links: [link("developer")] })), /Assign access/);
});

test("a review snapshot offers Assign snapshot", () => {
  const html = siteReviewsPage(user, site, { links: [], snapshots: [{ id: "p1234567", sourceVersion: 3, createdAt: "2026-11-19T00:00:00Z" }] });
  a.match(head(html), /data-open-dialog="assign-snapshot-dialog">Assign snapshot</);
});
