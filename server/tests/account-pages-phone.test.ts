import { test } from "vitest";
import a from "node:assert/strict";
import { siteAssistantsPage, siteReviewsPage } from "../src/account-pages.ts";

const user = { id: "u1", email: "owner@example.invalid", name: "Owner" } as never;
const site = { id: "s1", name: "Phone QA", slug: "phone-qa", role: "owner", version: 2, publishedVersion: 0 } as never;

test("an empty review list is a sentence, not a row inside a wide table", () => {
  const html = siteReviewsPage(user, site, { links: [] });
  a.match(html, /<p class="pc-review-empty">No review links yet\. Create a review link to open the annotating tool\.<\/p>/);
  a.doesNotMatch(html, /aria-label="Live review links"/, "no empty table to scroll sideways on a phone");
});

test("review links still render as a table", () => {
  const html = siteReviewsPage(user, site, {
    links: [{ id: "l1", token: "tok", access: "public", createdAt: "2026-11-19T00:00:00Z" } as never],
  });
  a.match(html, /aria-label="Live review links"/);
  a.doesNotMatch(html, /pc-review-empty">No review links yet/);
});

test("on phones the site rail is icon-only and keeps each link's name for assistive technology", () => {
  const html = siteAssistantsPage(user, site, { tokens: [], proposals: [], editorUrl: "/edit/s1", mcpUrl: "https://example.invalid/mcp" });
  const phone = html.match(/@media\(max-width:520px\)\{[^@]*\.pc-rail\{[^@]*/)?.[0] ?? "";
  a.match(phone, /\.pc-rail\{width:56px;flex-basis:56px\}/);
  a.match(phone, /\.pc-rail a>span,\.pc-rail button>span\{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset\(50%\)/);
  a.doesNotMatch(phone, /\.pc-rail[^{]*span\{display:none/, "labels stay in the accessibility tree");
  a.match(html, /<a href="\/sites\/s1\/assistants" aria-current="page">[^]*?<span>Assistants<\/span><\/a>/);
});

test("assistant sections let a long address shrink on a phone instead of widening the column", () => {
  const html = siteAssistantsPage(user, site, {
    tokens: [], proposals: [], editorUrl: "/edit/s1",
    mcpUrl: "https://staging.itspagecraft.com/mcp/with/a/long/address/that/does/not/wrap",
  });
  a.match(html, /@media\(max-width:760px\)\{\.pc-as-section\{grid-template-columns:minmax\(0,1fr\)/);
});
