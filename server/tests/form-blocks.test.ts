import { expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import * as Core from '../../app/src/core/index.ts';
import { blankDoc, renderSite } from '../src/render.ts';
import { FileSubmissionStore, siteForms, submissionValues } from '../src/submissions.ts';
import { submissionRoutes } from '../src/submissions-routes.ts';
import { MemoryStore } from '../src/store.ts';
import { FileHostedPublicationStore } from '../src/publications.ts';

/** The two form-shaped blocks, taken the whole way: rendered page, real POST, saved entry. */
const source = () => {
  const doc = blankDoc('Form blocks');
  const bar = Core.N('dockbar'); bar.id = 'bar';
  Object.assign(bar.props, { aria: 'Quick quote', success: 'We reply <b>today</b>.', fields: [
    { type: 'text', label: 'Company', name: '', required: 1 }, { type: 'email', label: 'Email', name: 'email', required: 1 },
    { type: 'select', label: 'Topic', name: 'topic', opts: 'Sales, Support' }, { type: 'textarea', label: 'Notes', name: 'notes' }] });
  const booking = Core.N('slotpicker'); booking.id = 'booking';
  Object.assign(booking.props, { aria: 'Book a visit', maxGuests: '3', currencySymbol: '€',
    passes: [{ passName: 'Soak, warm', unitPrice: '95.25' }, { passName: 'Suite', unitPrice: '240', fixedTotal: 1 }],
    slots: [{ time: '09:00' }, { time: '15:00' }],
    fields: [{ type: 'date', label: 'Date', name: 'date', required: 1 }, { type: 'email', label: 'Email', name: 'email', required: 1 }, { type: 'text', label: 'Allergies', name: '' }] });
  doc.pages[0].tree = [bar, booking];
  return doc;
};
const formsOf = (html: string) => new JSDOM(html, { url: 'https://site.test/' }).window.document;

test('both blocks render as real forms that post to the site inbox', () => {
  const page = formsOf(renderSite(source(), [], 'https://editor.test/forms/site').files.get('index.html') as string);
  const [bar, booking] = [...page.querySelectorAll('form.pagecraft-form')] as HTMLFormElement[];
  expect(bar.getAttribute('action')).toBe('https://editor.test/forms/site/bar');
  expect(booking.getAttribute('action')).toBe('https://editor.test/forms/site/booking');
  for (const form of [bar, booking]) {
    expect(form.method).toBe('post');
    expect(form.querySelector('[name=_pc_trap]')).toBeTruthy();
    expect(form.querySelector('button[type=submit].pagecraft-form-button')).toBeTruthy();
    expect(form.nextElementSibling?.textContent).toContain('_pc_request');
    for (const label of form.querySelectorAll('label[for]')) expect(page.getElementById(label.getAttribute('for')!), label.textContent!).toBeTruthy();
  }
  expect([...bar.elements].map((e: any) => e.name).filter(Boolean)).toEqual(['company', 'email', 'topic', 'notes', '_pc_trap']);
  expect([...booking.elements].map((e: any) => e.name).filter(Boolean)).toEqual(['booking-service', 'booking-guests', 'booking-time', 'date', 'email', 'allergies', '_pc_trap']);
  expect([...booking.querySelectorAll('[name=booking-guests] option')].map(o => o.textContent)).toEqual(['1', '2', '3']);
  const ids = [...page.querySelectorAll('[id]')].map(e => e.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('without a receiver they are visibly disabled, and WordPress gets its own receiver', () => {
  const plain = formsOf(renderSite(source()).files.get('index.html') as string);
  for (const block of plain.querySelectorAll('.pagecraft-dockbar,.pagecraft-slotpicker')) {
    expect(block.tagName).toBe('DIV');
    expect(block.hasAttribute('data-disabled')).toBe(true);
    expect([...block.querySelectorAll('input,select,textarea,button')].every((e: any) => e.disabled)).toBe(true);
    expect(block.textContent).toContain('not configured to receive submissions');
  }
  const doc = source();
  doc.pages[0].tree.forEach((n: any) => { n.props.mode = 'wordpress'; });
  const html = renderSite(doc).files.get('index.html') as string;
  expect(html).toContain('%%PAGECRAFT_FORM_ENDPOINT:bar%%');
  expect(html).toContain('%%PAGECRAFT_FORM_ENDPOINT:booking%%');
});

test('a real submission is validated, saved with a server-worked total, and confirmed in the author\'s words', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-form-blocks-'));
  try {
    const store = new MemoryStore(), submissions = new FileSubmissionStore(join(root, 'entries'));
    const publications = new FileHostedPublicationStore(join(root, 'published'));
    const site = await store.create({ host: 'blocks.invalid', name: 'QA', doc: source() });
    const app = new Hono();
    submissionRoutes(app, { store, submissions, publications, editorOrigin: 'https://editor.test', requestSource: () => Math.random().toString(), allowed: async () => ({ ok: false, status: 403 }) });
    const pub = await publications.create({ siteId: site.id, slug: site.slug, host: site.host, sourceVersion: site.version, files: [{ path: 'index.html', mediaType: 'text/html', bytes: new TextEncoder().encode('<p>QA</p>') }] } as any);
    await publications.promote(pub);
    const post = (form: string, values: Record<string, string>) => app.request(`https://editor.test/forms/${site.id}/${form}`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'null' }, body: new URLSearchParams(values).toString() });
    const saved = async (form: string) => (await submissions.list(site.id)).filter(e => e.formId === form && e.status === 'success');

    expect((await post('bar', { company: '', email: 'a@b.test' })).status).toBe(422);
    const barResult = await post('bar', { company: 'Acme Ltd', email: 'qa@example.test', topic: 'Support', notes: 'Hello' });
    expect(barResult.status).toBe(303);
    expect(barResult.headers.get('location')).toBe(`/forms/${site.id}/bar/thanks`);
    expect((await saved('bar'))[0].values).toEqual([
      { label: 'Company', value: 'Acme Ltd' }, { label: 'Email', value: 'qa@example.test' }, { label: 'Topic', value: 'Support' }, { label: 'Notes', value: 'Hello' }]);
    const thanks = await (await app.request(`https://editor.test/forms/${site.id}/bar/thanks`)).text();
    expect(thanks).toContain('We reply &lt;b&gt;today&lt;/b&gt;.');
    expect(await (await app.request(`https://editor.test/forms/${site.id}/nope/thanks`)).text()).toContain('Your submission has been received.');

    const good = { 'booking-service': 'Soak warm', 'booking-guests': '2', 'booking-time': '15:00', date: '2027-05-10', email: 'qa@example.test', allergies: 'Nuts', total: '€0.01' };
    const bookingResult = await post('booking', good);
    expect(bookingResult.headers.get('location')).toBe('/forms/thanks');
    expect((await saved('booking'))[0].values).toEqual([
      { label: 'Service', value: 'Soak warm' }, { label: 'Guests', value: '2' }, { label: 'Time', value: '15:00' }, { label: 'Date', value: '2027-05-10' },
      { label: 'Email', value: 'qa@example.test' }, { label: 'Allergies', value: 'Nuts' }, { label: 'Estimated total', value: '€190.50' }]);
    for (const bad of [{ 'booking-service': 'Free' }, { 'booking-guests': '9' }, { 'booking-time': '03:00' }, { email: 'nope' }, { date: '' }])
      expect((await post('booking', { ...good, ...bad })).status, JSON.stringify(bad)).toBe(422);
    expect(await saved('booking')).toHaveLength(1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('every part of a booking request can be changed or turned off', () => {
  const doc = source(), node = doc.pages[0].tree[1] as any;
  const form = () => siteForms(doc).find(f => f.id === 'booking')!;
  const labels = () => form().fields.map(f => f.label);
  Object.assign(node.props, { serviceLabel: 'Treatment', showGuests: 0 });
  expect(labels()).toEqual(['Treatment', 'Time', 'Date', 'Email', 'Allergies']);
  expect(submissionValues(form(), new URLSearchParams({ 'booking-service': 'Suite', 'booking-time': '09:00', date: '2027-01-01', email: 'a@b.test' })).at(-1)).toEqual({ label: 'Estimated total', value: '€240' });
  Object.assign(node.props, { showTimes: 0, showTotal: 0, showPrices: 0 });
  expect(labels()).toEqual(['Treatment', 'Date', 'Email', 'Allergies']);
  const html = Core.renderNode(node, { edit: false });
  expect(html).not.toContain('data-sp-total');
  expect(html).not.toContain('pagecraft-sp-pass-price');
  node.props.passes = []; node.props.fields.push({ type: 'tel', label: 'Phone', name: '' });
  expect(labels()).toEqual(['Date', 'Email', 'Allergies', 'Phone']);
});

test('the first version of each block becomes a form with its content kept', () => {
  const doc = blankDoc('Old');
  const bar: any = Core.N('dockbar'); bar.id = 'old-bar';
  bar.props = { submitLabel: 'Go', destHref: 'x.html', ariaLabel: 'Bar', items: [{ fieldLabel: 'Entity', fieldType: 'text', ph: 'Name' }, { fieldLabel: 'Forum', fieldType: 'select', choices: 'A, B' }] };
  const slot: any = Core.N('slotpicker'); slot.id = 'old-slot';
  slot.props = { currencySymbol: '€', timeSlots: '06:30 Dawn, 19:30', confirmLabel: 'Hold', confirmHref: '#desk', phoneNote: 'Free changes', passes: [{ passName: 'Circuit', unitPrice: '95' }] };
  doc.pages[0].tree = [bar, slot];
  expect(siteForms(doc).map(f => f.fields.map(field => field.label))).toEqual([['Entity', 'Forum'], ['Service', 'Guests', 'Time', 'Date', 'Name', 'Email']]);
  Core.restore(Core.migrate(structuredClone(doc)), false);
  const [newBar, newSlot] = Core.state.pages[0].tree as any[];
  expect(newBar.props).toEqual({ submit: 'Go', aria: 'Bar', fields: [{ type: 'text', label: 'Entity', name: '', required: 0, ph: 'Name' }, { type: 'select', label: 'Forum', name: '', required: 0, opts: 'A, B' }] });
  expect(newSlot.props).toMatchObject({ submit: 'Hold', note: 'Free changes', slots: [{ time: '06:30 Dawn' }, { time: '19:30' }] });
  expect(newSlot.props).not.toHaveProperty('confirmHref');
  const once = JSON.stringify(Core.state.pages);
  Core.restore(Core.migrate(JSON.parse(JSON.stringify(Core.doc()))), false);
  expect(JSON.stringify(Core.state.pages)).toBe(once);
});

test('the site check asks a booking request for a way to reply', () => {
  const doc = source(), node = doc.pages[0].tree[1] as any;
  const found = () => { Core.restore(structuredClone(doc), false); return Core.lint().some((issue: any) => JSON.stringify(issue).includes('booking-no-reply')); };
  expect(found()).toBe(false);
  node.props.fields = [{ type: 'text', label: 'Name', name: 'name' }];
  expect(found()).toBe(true);
});
