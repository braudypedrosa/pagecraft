import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`../supabase/templates/${name}`, import.meta.url), "utf8");
const origin = "https://editor.example.test";
test.each([
  ["confirmation", "", "signup"],
  ["magic_link", "", "magiclink"],
  ["invite", "?type=invite&next=%2Fsites%2Fexample%3Ftab%3Dpeople", "invite"],
  ["email_change", "?next=%2Faccount", "email_change"],
  ["recovery", "?type=recovery", "recovery"],
])("%s email preserves the callback and confirmation parameters in both links", (name, query, type) => {
  const redirect = origin + "/auth/confirm" + query;
  const html = read(name + ".html")
    .replaceAll("{{ .RedirectTo }}", redirect)
    .replaceAll("{{ .TokenHash }}", "sample-hash")
    .replaceAll("&amp;", "&");
  const links = Array.from(html.matchAll(/<a href="([^"]+)"/g), match => match[1])
    .filter(href => href.startsWith(redirect));
  expect(links).toHaveLength(2);
  expect(html).toContain(">" + links[1] + "</a>");
  for (const href of links) {
    const url = new URL(href);
    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.getAll("token_hash")).toEqual(["sample-hash"]);
    expect(url.searchParams.getAll("type")).toEqual([type]);
    expect(url.searchParams.get("next")).toBe(new URL(redirect).searchParams.get("next"));
  }
});
test("reauthentication supplies the one-time code", () => {
  expect(read("reauthentication.html")).toContain("{{ .Token }}");
});

test("every template is branded, has a subject and uses a hosted PNG logo", () => {
  const subjects = JSON.parse(read("subjects.json"));
  expect(Object.keys(subjects).sort()).toEqual(["confirmation", "email_change", "invite", "magic_link", "reauthentication", "recovery"]);
  for (const [name, subject] of Object.entries(subjects)) {
    expect(subject, name).toMatch(/Pagecraft/);
    const html = read(`${name}.html`);
    expect(html, name).toContain('src="https://itspagecraft.com/images/email/pagecraft-logo.png"');
    expect(html, name).toContain('alt="Pagecraft"');
    expect(html, name).not.toMatch(/<script|\.svg/);
  }
});
