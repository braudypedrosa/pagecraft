import { afterEach, expect, test } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";
import { PASSWORD_TOGGLE_SCRIPT } from "../server/src/password-toggle";
import { forgotPage, resetPage, signInPage, signUpPage } from "../server/src/account-pages";
import { founderCrmSignInPage } from "../server/src/founder-crm-page";

const windows = [];
afterEach(() => {
  for (const dom of windows.splice(0)) dom.window.close();
});

async function boot(html) {
  const dom = new JSDOM(html, { url: "https://example.test/", runScripts: "outside-only", virtualConsole: new VirtualConsole() });
  windows.push(dom);
  dom.window.eval(PASSWORD_TOGGLE_SCRIPT);
  if (dom.window.document.readyState === "loading") {
    await new Promise((resolve) => dom.window.addEventListener("DOMContentLoaded", resolve));
  }
  return dom.window;
}

test("every password page ships the show/hide control, and pages without passwords do not", () => {
  const pages = {
    signIn: signInPage("key"),
    signUp: signUpPage("key"),
    reset: resetPage(),
    founder: founderCrmSignInPage({ dataEnvironment: "staging" }),
  };
  for (const [name, html] of Object.entries(pages)) {
    expect(html, name).toContain('type="password"');
    expect(html, name).toContain("pc-password-toggle");
    expect(html, name).toContain("Show password");
  }
  expect(forgotPage("key")).not.toContain("pc-password-toggle");
});

test("each password field gets its own accessible toggle that reveals and hides the value", async () => {
  const w = await boot(resetPage());
  const fields = [...w.document.querySelectorAll("input[data-password-toggle]")];
  expect(fields.map((field) => field.id)).toEqual(["password", "passwordConfirm"]);
  const buttons = [...w.document.querySelectorAll(".pc-password-toggle")];
  expect(buttons).toHaveLength(2);
  for (const [index, button] of buttons.entries()) {
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-controls")).toBe(fields[index].id);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Show password");
  }
  fields[0].value = "correct horse battery";
  buttons[0].click();
  expect(fields[0].type).toBe("text");
  expect(fields[0].value).toBe("correct horse battery");
  expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
  expect(buttons[0].getAttribute("aria-label")).toBe("Hide password");
  expect(fields[1].type).toBe("password");
  buttons[0].click();
  expect(fields[0].type).toBe("password");
  expect(buttons[0].getAttribute("aria-label")).toBe("Show password");
});

test("the toggle never submits the form and submitting hides revealed passwords again", async () => {
  const w = await boot('<form method="post" action="/auth/sign-in"><input id="email" name="email"><input id="pw" name="password" type="password"><button type="submit">Sign in</button></form>');
  const form = w.document.querySelector("form");
  let submits = 0;
  form.addEventListener("submit", (event) => { submits += 1; event.preventDefault(); });
  const toggle = w.document.querySelector(".pc-password-toggle");
  toggle.click();
  expect(submits).toBe(0);
  expect(w.document.querySelector("#pw").type).toBe("text");
  form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  expect(submits).toBe(1);
  expect(w.document.querySelector("#pw").type).toBe("password");
  expect(new w.FormData(form).get("password")).toBe("");
});

test("running the boot script twice does not add duplicate toggles", async () => {
  const w = await boot('<input id="pw" type="password">');
  w.eval(PASSWORD_TOGGLE_SCRIPT);
  expect(w.document.querySelectorAll(".pc-password-toggle")).toHaveLength(1);
});
