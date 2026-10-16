import { afterEach, expect, test } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import * as Core from '../app/src/core/index.ts';
import { blankDoc, renderSite } from '../server/src/render.ts';

const windows = [];
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function renderedForms() {
  const doc = blankDoc('Managed form request recovery');
  const first = Core.N('form');
  first.id = 'contact';
  first.props.fields = [{ name: 'email', label: 'Email', type: 'email', required: 1 }];
  const second = Core.N('form');
  second.id = 'enquiry';
  second.props.fields = [{ name: 'message', label: 'Message', type: 'textarea' }];
  doc.pages[0].tree = [first, second];
  return renderSite(doc, [], 'https://cloud.test/forms/site').files.get('index.html');
}

function runtime(options = {}) {
  let next = options.firstUuid ?? 1;
  let calls = 0;
  const dom = new JSDOM(renderedForms(), {
    url: 'https://published.test/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      if ('state' in options) window.history.replaceState(options.state, '');
      if (options.randomUuid === false) {
        Object.defineProperty(window.crypto, 'randomUUID', { configurable: true, value: undefined });
      } else {
        Object.defineProperty(window.crypto, 'randomUUID', {
          configurable: true,
          value: () => {
            calls++;
            return uuid(next++);
          },
        });
      }
      if (options.replaceStateThrows) {
        window.history.replaceState = () => { throw new Error('history state unavailable'); };
      }
    },
  });
  windows.push(dom);
  return { dom, calls: () => calls };
}

function forms(dom) {
  return Array.from(dom.window.document.querySelectorAll('form'));
}

function token(form) {
  return form.querySelector('input[name="_pc_request"]').value;
}

afterEach(() => {
  while (windows.length) windows.pop().window.close();
});

test('a reconstructed or BFCache-restored history entry keeps each managed form request identity', async () => {
  const first = runtime({ state: { router: 'kept' }, firstUuid: 1 });
  const [contact, enquiry] = forms(first.dom);
  expect(token(contact)).toBe(uuid(1));
  expect(token(enquiry)).toBe(uuid(2));
  expect(first.calls()).toBe(2);
  expect(first.dom.window.history.state.router).toBe('kept');
  expect(JSON.stringify(first.dom.window.history.state)).toContain(uuid(1));
  expect(JSON.stringify(first.dom.window.history.state)).toContain(uuid(2));

  for (const form of [contact, enquiry]) {
    const button = form.querySelector('button[type="submit"]');
    form.dispatchEvent(new first.dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => first.dom.window.setTimeout(resolve, 0));
    expect(button.disabled).toBe(true);
  }
  first.dom.window.dispatchEvent(new first.dom.window.Event('pageshow'));
  expect(contact.querySelector('button[type="submit"]').disabled).toBe(false);
  expect(enquiry.querySelector('button[type="submit"]').disabled).toBe(false);
  expect(token(contact)).toBe(uuid(1));
  expect(token(enquiry)).toBe(uuid(2));

  const savedEntryState = structuredClone(first.dom.window.history.state);
  const reconstructed = runtime({ state: savedEntryState, firstUuid: 20 });
  const [reconstructedContact, reconstructedEnquiry] = forms(reconstructed.dom);
  expect(token(reconstructedContact)).toBe(uuid(1));
  expect(token(reconstructedEnquiry)).toBe(uuid(2));
  expect(reconstructed.calls()).toBe(0);
  expect(reconstructed.dom.window.history.state.router).toBe('kept');
});

test('editing starts a new intent without persisting field values, while a fresh entry gets new identities', () => {
  const initial = runtime({ state: { router: 'kept' }, firstUuid: 30 });
  const [contact, enquiry] = forms(initial.dom);
  const oldContact = token(contact);
  const oldEnquiry = token(enquiry);
  const email = contact.elements.namedItem('email');
  email.value = 'private@example.test';
  email.dispatchEvent(new initial.dom.window.Event('input', { bubbles: true }));

  expect(token(contact)).toBe(uuid(32));
  expect(token(contact)).not.toBe(oldContact);
  expect(token(enquiry)).toBe(oldEnquiry);
  expect(JSON.stringify(initial.dom.window.history.state)).not.toContain('private@example.test');
  expect(initial.dom.window.history.state.router).toBe('kept');

  const reconstructed = runtime({ state: structuredClone(initial.dom.window.history.state), firstUuid: 40 });
  expect(token(forms(reconstructed.dom)[0])).toBe(uuid(32));
  expect(reconstructed.calls()).toBe(0);

  const freshEntry = runtime({ firstUuid: 50 });
  expect(token(forms(freshEntry.dom)[0])).toBe(uuid(50));
  expect(token(forms(freshEntry.dom)[0])).not.toBe(uuid(32));
  expect(token(forms(freshEntry.dom)[1])).toBe(uuid(51));
});

test('UUID or history persistence limitations degrade without breaking native form behavior', () => {
  const noRandomUuid = runtime({ randomUuid: false });
  const fallbackToken = token(forms(noRandomUuid.dom)[0]);
  expect(fallbackToken).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);

  const unavailableHistory = runtime({ state: { router: 'kept' }, firstUuid: 60, replaceStateThrows: true });
  const form = forms(unavailableHistory.dom)[0];
  expect(token(form)).toBe(uuid(60));
  expect(unavailableHistory.dom.window.history.state).toEqual({ router: 'kept' });
  const email = form.elements.namedItem('email');
  expect(email.required).toBe(true);
  expect(form.checkValidity()).toBe(false);
  email.value = 'qa@example.test';
  email.dispatchEvent(new unavailableHistory.dom.window.Event('input', { bubbles: true }));
  expect(token(form)).toBe(uuid(62));
  expect(form.checkValidity()).toBe(true);

  const primitiveState = runtime({ state: 'router-state', firstUuid: 70 });
  expect(token(forms(primitiveState.dom)[0])).toBe(uuid(70));
  expect(primitiveState.dom.window.history.state).toBe('router-state');
});
