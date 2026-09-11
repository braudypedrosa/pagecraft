import { afterEach, expect, test, vi } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";
import { ACTION_FEEDBACK_BOOT_SCRIPT } from "../shared/action-feedback.js";
import { ACCOUNT_ACTIONS_BOOT_SCRIPT } from "../shared/account-actions.js";
import { submissionsNavigation } from "../server/src/submissions-navigation";
const windows = [];
afterEach(() => {
  for (const dom of windows.splice(0)) {
    dom.window.__pcFeedback?.destroy();
    dom.window.close();
  }
});
function setup(body = '<form method="post" action="/account/profile"><input name="name" value="Keep my changes"><input name="locked" disabled><button type="submit">Save profile</button></form><button id="other">Other action</button>', url = "https://example.test/account") {
  const dom = new JSDOM(body, { url, runScripts: "outside-only", virtualConsole: new VirtualConsole() });
  windows.push(dom);
  dom.window.eval(ACTION_FEEDBACK_BOOT_SCRIPT);
  dom.window.eval(ACCOUNT_ACTIONS_BOOT_SCRIPT);
  dom.window.HTMLElement.prototype.scrollTo = () => {
  };
  const w = dom.window, form = w.document.querySelector("form"), button = form?.querySelector("button");
  const submit = () => form.dispatchEvent(new w.SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: button }));
  return { w, form, button, submit };
}
function response(html, url, status = 200) {
  return { ok: status < 400, status, url, text: async () => html };
}
test("native POST waits for acknowledgement, prevents repeats, preserves input and restores a retry after failure", async () => {
  const { w, form, button, submit } = setup();
  let reject;
  const fetch = vi.fn(() => new Promise((_, no) => {
    reject = no;
  }));
  w.fetch = fetch;
  submit();
  submit();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(button.disabled).toBe(true);
  expect(button.textContent).toBe("Saving changes\u2026");
  expect(w.document.querySelector("#other").disabled).toBe(false);
  expect(fetch.mock.calls[0][1].body.get("name")).toBe("Keep my changes");
  expect(w.sessionStorage.getItem("pc-action-result")).toBeNull();
  reject(new Error("Offline"));
  await vi.waitFor(() => expect(button.disabled).toBe(false));
  expect(form.querySelector("input").value).toBe("Keep my changes");
  expect(form.querySelector("[name=locked]").disabled).toBe(true);
  expect(form.querySelector("[data-action-error]")?.textContent).toBe("Offline");
  expect(w.document.activeElement).toBe(form.querySelector("[data-action-error]"));
  w.fetch = vi.fn(async () => response('<p class="notice" role="status">Profile saved.</p>', "https://example.test/account"));
  submit();
  await vi.waitFor(() => expect(w.sessionStorage.getItem("pc-action-result")).toContain("Profile saved."));
  expect(form.querySelector("[data-action-error]")).toBeNull();
});
test("validation errors from redirect HTML remain on the original form without reporting success", async () => {
  const { w, form, button, submit } = setup();
  w.fetch = vi.fn(async () => response('<p class="notice error" role="alert">That name is invalid.</p>', "https://example.test/account?error=invalid"));
  submit();
  await vi.waitFor(() => expect(form.querySelector("[data-action-error]")?.textContent).toBe("That name is invalid."));
  expect(button.disabled).toBe(false);
  expect(w.sessionStorage.getItem("pc-action-result")).toBeNull();
});
test("custom async forms retain their handlers and OAuth remains native with a restored back-button state", () => {
  const { w, form, button, submit } = setup();
  w.fetch = vi.fn();
  form.addEventListener("submit", (e) => e.preventDefault(), { once: true });
  submit();
  expect(w.fetch).not.toHaveBeenCalled();
  expect(button.disabled).toBe(false);
  form.action = "/auth/google";
  expect(submit()).toBe(true);
  expect(button.textContent).toBe("Opening Google sign-in\u2026");
  expect(w.fetch).not.toHaveBeenCalled();
  expect(submit()).toBe(false);
  w.dispatchEvent(new w.PageTransitionEvent("pageshow", { persisted: true }));
  expect(button.disabled).toBe(false);
  expect(button.textContent).toBe("Save profile");
});
test("submissions refresh bypasses cached content; export failures preserve the download action", async () => {
  const { w } = setup('<section class="pc-workspace"><div class="pc-manage-content"><h1>Old entries</h1><a href="/sites/qa/submissions" data-inbox-refresh>Refresh</a><a href="/sites/qa/submissions/export.csv" class="pc-sub-export">Export CSV</a></div></section>', "https://example.test/sites/qa/submissions");
  w.eval(submissionsNavigation({}).replace(/^<script>|<\/script>$/g, ""));
  let resolve;
  w.fetch = vi.fn(() => new Promise((yes) => {
    resolve = yes;
  }));
  const refresh = w.document.querySelector("[data-inbox-refresh]");
  refresh.click();
  expect(w.fetch).toHaveBeenCalledTimes(1);
  expect(refresh.textContent).toBe("Refreshing submissions\u2026");
  resolve(response('<div class="pc-manage-content"><h1>Fresh entries</h1><a href="/sites/qa/submissions/export.csv" class="pc-sub-export">Export CSV</a></div>', w.location.href));
  await vi.waitFor(() => expect(w.document.querySelector("h1")?.textContent).toBe("Fresh entries"));
  w.fetch = vi.fn(async () => ({ ok: false, status: 500 }));
  const csv = w.document.querySelector(".pc-sub-export");
  csv.click();
  csv.click();
  await vi.waitFor(() => expect(w.document.querySelector("[role=alert]")?.textContent).toContain("CSV export failed"));
  expect(w.fetch).toHaveBeenCalledTimes(1);
  expect(csv.getAttribute("aria-busy")).toBeNull();
  expect(csv.textContent).toBe("Export CSV");
});
test('an expired-session redirect does not falsely confirm a mutation', async () => {
  const { w, form, button, submit } = setup();
  w.fetch = vi.fn(async () => response('<h1>Sign in</h1>', 'https://example.test/login'));
  submit();
  await vi.waitFor(() => expect(form.querySelector('[data-action-error]')?.textContent).toContain('session expired'));
  expect(button.disabled).toBe(false);
  expect(w.sessionStorage.getItem('pc-action-result')).toBeNull();
});
test('WordPress connection consent preserves the clicked choice and uses native navigation',()=>{
 const {w,form,button,submit}=setup('<form method="post" action="/v1/oauth/authorize"><input name="state" value="qa-state"><button type="submit" name="decision" value="approve">Connect</button></form>');
 w.fetch=vi.fn();
 expect(submit()).toBe(true);expect(w.fetch).not.toHaveBeenCalled();
 expect(button.disabled).toBe(true);
 expect(new w.FormData(form).get('decision')).toBe('approve');
 expect(submit()).toBe(false);
 w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));
 expect(button.disabled).toBe(false);
 expect(form.querySelector('input[name=decision]')).toBeNull();
});

test('cached inbox navigation paints immediately, revalidates, rejects superseded results and recovers after failure', async () => {
  const base='/sites/qa/submissions';
  const body='<h1>Cached entries</h1><a href="'+base+'?form=test&status=success&order=asc&page=2">Inbox</a><a data-inbox-refresh href="'+base+'?form=test&status=success&order=asc&page=2">Refresh</a>';
  const {w}=setup('<section class="pc-workspace"><div class="pc-manage-content">'+body+'</div></section>','https://example.test'+base);
  const target=base+'?form=test&status=success&order=asc&page=2';
  w.eval(submissionsNavigation({[target]:body}).replace(/^<script>|<\/script>$/g,''));
  const pending=[];
  w.fetch=vi.fn((url,opts)=>new Promise((resolve,reject)=>pending.push({url,opts,resolve,reject})));
  w.document.querySelector('a').click();
  expect(w.document.querySelector('h1').textContent).toBe('Cached entries');
  expect(pending).toHaveLength(1);
  expect(w.location.search).toContain('page=2');
  w.document.querySelector('[data-inbox-refresh]').click();
  expect(pending[0].opts.signal.aborted).toBe(true);
  pending[0].resolve(response('<div class="pc-manage-content"><h1>Obsolete</h1></div>',pending[0].url));
  await Promise.resolve(); await Promise.resolve();
  expect(w.document.querySelector('h1').textContent).toBe('Cached entries');
  pending[1].reject(new Error('Failed to fetch'));
  await vi.waitFor(()=>expect(w.document.querySelector('[data-refresh-status]').getAttribute('role')).toBe('alert'));
  expect(w.document.querySelector('h1').textContent).toBe('Cached entries');
  expect(w.document.querySelector('[data-refresh-status]').textContent).toContain('Showing the last loaded entries');
  expect(w.document.querySelector('[data-refresh-status]').hidden).toBe(false);
  expect(w.document.querySelectorAll('[role=alert]')).toHaveLength(1);
  expect(w.document.querySelector('[data-refresh-status]').previousElementSibling.tagName).toBe('H1');
  expect(w.document.querySelector('.pc-manage-content').getAttribute('aria-busy')).toBeNull();
  w.document.querySelector('[data-inbox-refresh]').click();
  pending[2].resolve(response('<div class="pc-manage-content"><h1>Fresh entries</h1></div>',pending[2].url));
  await vi.waitFor(()=>expect(w.document.querySelector('h1').textContent).toBe('Fresh entries'));
  expect(w.document.querySelector('[data-refresh-status]').hidden).toBe(true);
  expect(w.document.querySelector('[data-refresh-status]').textContent).toBe('');
  expect(w.location.search).toContain('status=success');expect(w.location.search).toContain('order=asc');expect(w.location.search).toContain('page=2');
});

test('only the expected parent may refresh; replacement waits for details to close', async () => {
  const {w}=setup('<section class="pc-workspace"><div class="pc-manage-content"><h1>Old</h1><dialog open><input value="Preserved details"></dialog></div></section>','https://example.test/sites/qa/submissions?form=test');
  w.eval(submissionsNavigation({}).replace(/^<script>|<\/script>$/g,''));
  w.fetch=vi.fn(async()=>response('<div class="pc-manage-content"><h1>New</h1></div>',w.location.href));
  const message=(origin,source)=>w.dispatchEvent(new w.MessageEvent('message',{origin,source,data:'pagecraft:refresh-submissions'}));
  message('https://evil.test',w.parent);message(w.location.origin,null);expect(w.fetch).not.toHaveBeenCalled();
  const dialog=w.document.querySelector('dialog');message(w.location.origin,w.parent);
  await vi.waitFor(()=>expect(w.document.querySelector('.pc-manage-content').hasAttribute('aria-busy')).toBe(false));
  expect(w.document.querySelector('[data-refresh-status]').hidden).toBe(true);
  expect(w.document.querySelector('[data-refresh-status]').textContent).toBe('');
  expect(w.document.querySelector('dialog')).toBe(dialog);expect(dialog.querySelector('input').value).toBe('Preserved details');
  dialog.removeAttribute('open');dialog.dispatchEvent(new w.Event('close'));
  await vi.waitFor(()=>expect(w.document.querySelector('h1').textContent).toBe('New'));
});

test('background inbox refresh is silent while explicit Refresh retains its processing state', async () => {
  const base='/sites/qa/submissions';
  const body='<h1>Entries</h1><a data-inbox-refresh href="'+base+'">Refresh</a>';
  const {w}=setup('<section class="pc-workspace"><div class="pc-manage-content">'+body+'</div></section>','https://example.test'+base);
  w.eval(submissionsNavigation({}).replace(/^<script>|<\/script>$/g,''));
  const pending=[];
  w.fetch=vi.fn((url)=>new Promise(resolve=>pending.push(()=>resolve(response('<div class="pc-manage-content">'+body+'</div>',url)))));
  const status=()=>w.document.querySelector('[data-refresh-status]');
  w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:w.parent,data:'pagecraft:refresh-submissions'}));
  expect(pending).toHaveLength(1);
  expect(status().hidden).toBe(true);expect(status().textContent).toBe('');
  expect(w.document.querySelector('[data-inbox-refresh]').textContent).toBe('Refresh');
  pending[0]();
  await vi.waitFor(()=>expect(w.document.querySelector('.pc-manage-content').hasAttribute('aria-busy')).toBe(false));
  expect(status().hidden).toBe(true);expect(status().textContent).toBe('');
  const button=w.document.querySelector('[data-inbox-refresh]');button.click();
  expect(pending).toHaveLength(2);
  expect(button.getAttribute('aria-busy')).toBe('true');
  expect(button.textContent).toContain('Refreshing submissions');
  expect(status().hidden).toBe(true);
  pending[1]();
  await vi.waitFor(()=>expect(w.document.querySelector('[data-inbox-refresh]').textContent).toBe('Refresh'));
  expect(status().hidden).toBe(true);expect(status().textContent).toBe('');
  expect(w.document.querySelector('[role=alert]')).toBeNull();
});
