import { test } from "vitest";
import a from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dashboardPage, siteAssistantsPage } from "../src/account-pages.ts";

const user = { id: "u1", email: "owner@example.invalid", name: "A coordinator with a long display name" } as never;
const site = { id: "s1", name: "Tablet QA", slug: "tablet-qa", role: "owner", version: 2, publishedVersion: 0 } as never;
const page = () => siteAssistantsPage(user, site, { tokens: [], proposals: [], editorUrl: "/edit/s1", mcpUrl: "https://example.invalid/mcp" });

test("the account name never squeezes the page name: capped on desktop, avatar-only up to tablet landscape", () => {
  const html = page();
  a.match(html, /\.pc-account-email\{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;/);
  a.match(html, /@media\(max-width:1024px\)\{\.pc-account-email\{display:none\}\}/);
  a.match(html, /<summary title="owner@example\.invalid">/, "the full identity stays available on hover and in the menu");
});

test("the site grid flexes to several columns on tablets instead of one fixed-width card", () => {
  const html = dashboardPage(user, [], 0, { usedBytes: 0, limitBytes: 100 * 1024 * 1024 });
  a.match(html, /@media\(max-width:1024px\)\{\.pc-site-grid\{grid-template-columns:repeat\(auto-fill,minmax\(min\(100%,260px\),1fr\)\);gap:24px\}\}/);
});

test("the selection breadcrumb truncates to one line instead of wrapping", () => {
  const builder = readFileSync(new URL("../../builder.html", import.meta.url), "utf8");
  a.match(builder, /\.selectionCrumb button\{[^}]*white-space:nowrap;[^}]*text-overflow:ellipsis/);
});
