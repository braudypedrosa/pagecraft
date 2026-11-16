import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`../supabase/templates/${name}`, import.meta.url), "utf8");
const confirm = "{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type={{ .EmailActionType }}";
const recover = "{{ .RedirectTo }}&token_hash={{ .TokenHash }}";

test("link templates keep the /auth/confirm formats documented in AUTH_SETUP.md", () => {
  for (const name of ["confirmation", "invite", "magic_link", "email_change"]) {
    const html = read(`${name}.html`);
    expect(html, name).toContain(`href="${confirm}"`);
    expect(html, name).not.toContain("{{ .ConfirmationURL }}");
  }
  const recovery = read("recovery.html");
  expect(recovery).toContain(`href="${recover}"`);
  expect(recovery).not.toContain("type={{ .EmailActionType }}");
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
