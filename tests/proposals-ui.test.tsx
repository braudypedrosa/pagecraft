// @vitest-environment jsdom
/* Reviewing an assistant's proposal in the editor (Phase 7). The adapter is a fake; the core and
   the proposal engine are the real ones, so applying is the real one-step edit. */
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import { render } from 'preact';
import * as C from '../app/src/core/index';
import type { ComponentDef, Node } from '../app/src/core/types';
import type { WebProposal, WebProposalAdapter } from '../app/src/host/types';
import { ProposalsWorkspace } from '../app/src/ui/ProposalsWorkspace';
import { rig, type Rig } from './ui.setup';

const node = (id: string, type: string, props: Record<string, unknown> = {}, extra: Partial<Node> = {}): Node => ({
  id, type, props, css: { d: {}, t: {}, m: {} }, hide: {}, cls: [], adv: {}, children: [], ...extra,
} as unknown as Node);

let r: Rig;
let decided: [string, string, number | undefined][];
let claimed: string[];
let proposals: WebProposal[];
const api: WebProposalAdapter = {
  async list() { return structuredClone(proposals); },
  async claim(id) {
    // single use, the way the server's claim is
    if (proposals.find(p => p.id === id)?.status !== 'pending') {
      throw Object.assign(new Error('claimed'), { status: 409, payload: { detail: 'This proposal is already being applied, in another tab or window.' } });
    }
    claimed.push(id);
    proposals = proposals.map(p => (p.id === id ? { ...p, status: 'applying' as const } : p));
  },
  async decide(id, status, version) {
    decided.push([id, status, version]);
    proposals = proposals.map(p => (p.id === id ? { ...p, status } : p));
  },
  previewUrl: (id, path, before) => `/preview/${id}/${path}${before ? '?before=1' : ''}`,
  settingsUrl: '/sites/s1/assistants',
};

function seedSite() {
  C.seed(); C.state.ui = C.initUi(); C.blankProject('Acme');
  const card: ComponentDef = { id: 'card', name: 'Card', props: [{ k: 'title', label: 'Title', t: 'text', def: 'Hello' }], node: node('def', 'box') };
  C.state.meta.components = [card];
  C.state.pages[0].tree = [node('sec', 'section', {}, { children: [node('h1', 'heading', { text: 'Welcome' }), node('inst', 'box', {}, { use: 'card' })] })];
}
function proposal(id: string, changes: unknown[], title = 'Clearer welcome'): WebProposal {
  const prepared = C.proposalPrepare(changes, { assets: new Set() });
  expect(prepared.problems).toEqual([]);
  return {
    id, baseVersion: 3, title, summary: 'Say what the site is for.', changes: prepared.changes, regions: [C.state.pages[0].id],
    createdAt: new Date().toISOString(), tokenName: 'Claude Code', status: 'pending', decidedAt: null,
    previews: [{ region: C.state.pages[0].id, label: 'Home', path: 'index.html' }],
  };
}

beforeEach(() => {
  decided = []; claimed = [];
  r = rig({ proposals: api, siteDraft: () => ({ siteId: 's1', version: 4 }) });
  seedSite();
  C.hist.u.length = 0;
  proposals = [proposal('aaaaaaaaaaaaaaaa', [
    { type: 'text', nodeId: 'h1', value: 'Workshops for everyone' },
    { type: 'property', nodeId: 'inst', property: 'title', value: 'Pottery' },
  ])];
});
afterEach(() => { render(null, r.host); r.host.remove(); });

const settle = async () => {
  for (let i = 0; i < 4; i++) await act(async () => { for (let j = 0; j < 4; j++) await new Promise(res => setTimeout(res, 0)); });
};
const draw = async (focus?: string) => {
  await act(async () => { r.draw(() => <ProposalsWorkspace focus={focus} close={() => r.calls.push(['close'])} />); });
  await settle();
};
const button = (text: string) => r.$$('button').find(b => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
const toasts = () => r.calls.filter(c => c[0] === 'toast').map(c => String(c[1]));

test('a proposal shows each change now and proposed, and previews the page it lands on', async () => {
  await draw();
  expect(r.$('#pw-title')?.textContent).toBe('Clearer welcome');
  expect(r.$('.pw-meta')?.textContent).toMatch(/From Claude Code · just now · 2 changes/);
  const rows = r.$$('.pw-change');
  expect(rows.map(row => row.querySelector('b')?.textContent)).toEqual(['Heading “Welcome” · Text', 'Card · Title']);
  expect([...rows[0].querySelectorAll('.pw-text')].map(t => t.textContent)).toEqual(['Welcome', 'Workshops for everyone']);
  expect(r.$('.pw-frame')?.getAttribute('src')).toBe('/preview/aaaaaaaaaaaaaaaa/index.html');
  await act(async () => { r.click(button('Now')!); });
  expect(r.$('.pw-frame')?.getAttribute('src')).toBe('/preview/aaaaaaaaaaaaaaaa/index.html?before=1');
});

test('applying writes every change in one Undo step, saves, and records it as applied', async () => {
  await draw();
  await act(async () => { r.click(button('Apply to draft')!); });
  await settle();
  expect((C.locateAny('h1').node.props as { text: string }).text).toBe('Workshops for everyone');
  expect(C.locateAny('inst').node.vals).toEqual({ title: 'Pottery' });
  expect(C.hist.u.length).toBe(1);
  expect(r.names()).toContain('flushDraft');
  expect(r.names().indexOf('appRender')).toBeLessThan(r.names().indexOf('flushDraft'));
  expect(claimed).toEqual(['aaaaaaaaaaaaaaaa']); // claimed on the server before anything was written
  expect(decided).toEqual([['aaaaaaaaaaaaaaaa', 'applied', 4]]);
  expect(toasts().at(-1)).toMatch(/Applied “Clearer welcome” to the draft/);
  expect(r.$('.pw-detail-head .pw-chip')?.textContent).toBe('Applied');
  expect(r.$$('.pw-warn')).toEqual([]); // an applied proposal is not flagged as stale
  C.undo();
  expect((C.locateAny('h1').node.props as { text: string }).text).toBe('Welcome');
});

test('a proposal whose target changed in the editor cannot be applied, and says why', async () => {
  (C.locateAny('h1').node.props as { text: string }).text = 'Edited by the owner';
  await draw();
  expect(button('Apply to draft')!.disabled).toBe(true);
  expect(r.$('.pw-blocked')?.textContent).toMatch(/One change no longer matches the draft/);
  expect(r.$('.pw-change .pw-warn')?.textContent).toBe('Changed in the editor since the proposal was made');
  expect(decided).toEqual([]);
});

test('declining asks first, changes nothing, and records it', async () => {
  await draw();
  await act(async () => { r.click(button('Decline')!); });
  await settle();
  expect(r.arg('askConfirm')![0]).toBe('Decline this proposal?');
  expect(decided).toEqual([['aaaaaaaaaaaaaaaa', 'declined', undefined]]);
  expect((C.locateAny('h1').node.props as { text: string }).text).toBe('Welcome');
  expect(C.hist.u.length).toBe(0);
});

test('a link from the assistant opens its proposal, and with none there is a way to set one up', async () => {
  proposals = [...proposals, proposal('bbbbbbbbbbbbbbbb', [{ type: 'text', nodeId: 'h1', value: 'Other' }], 'Another idea')];
  await draw('bbbbbbbbbbbbbbbb');
  expect(r.$('#pw-title')?.textContent).toBe('Another idea');
  render(null, r.host);
  proposals = [];
  await draw();
  expect(r.$('.pw-empty')?.textContent).toMatch(/No proposals yet/);
  expect(r.$$('a').find(a => a.textContent === 'Set up an assistant')?.getAttribute('href')).toBe('/sites/s1/assistants');
});

test('a proposal another tab already claimed is refused before anything is written', async () => {
  await draw();
  proposals = proposals.map(p => ({ ...p, status: 'applying' as const }));   // claimed elsewhere meanwhile
  await act(async () => { r.click(button('Apply to draft')!); });
  await settle();
  expect(toasts().at(-1)).toMatch(/already being applied/);
  expect((C.locateAny('h1').node.props as { text: string }).text).toBe('Welcome');
  expect(C.hist.u.length).toBe(0);
  expect(decided).toEqual([]);
  expect(r.$$('.pw-item .pw-chip').map(c => c.textContent)).toEqual(['Being applied']);
});

test('a plain slot whose text looks like markup reads as that text, not as Empty', async () => {
  (C.locateAny('h1').node.props as { text: string }).text = '<img src=x onerror=alert(1)>';
  proposals = [proposal('cccccccccccccccc', [{ type: 'text', nodeId: 'h1', value: 'Safe words' }])];
  await draw();
  const now = r.$('.pw-change .pw-diff .pw-text');
  expect(now?.textContent).toBe('<img src=x onerror=alert(1)>');
  expect(r.$('.pw-change img')).toBe(null);
});

test('an insert already in the draft says so, and cannot be applied a second time', async () => {
  proposals = [proposal('dddddddddddddddd', [{ type: 'insert', componentId: 'card', region: C.state.pages[0].id, values: { title: 'Visit us' } }], 'Add a card')];
  await draw();
  await act(async () => { r.click(button('Apply to draft')!); });
  await settle();
  expect(decided).toEqual([['dddddddddddddddd', 'applied', 4]]);
  // The same proposal shown pending again — a stale list in another tab — is blocked by the draft itself.
  proposals = proposals.map(p => ({ ...p, status: 'pending' as const }));
  render(null, r.host);
  await draw();
  expect(button('Apply to draft')!.disabled).toBe(true);
  expect(r.$('.pw-change .pw-warn')?.textContent).toBe('Already in the draft — this was applied before');
});
