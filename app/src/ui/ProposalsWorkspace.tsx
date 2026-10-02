/* Assistant proposals, reviewed by the site's owner (Phase 7).

   An assistant connected over MCP files a proposal on the server, which has already checked it
   against the draft and recorded what every change replaces. Here the owner reads each change
   before and after, previews the affected pages, and applies or declines. Applying runs the
   core's own commands inside one edit(), so it is one Undo step, and only after proposalCheck
   says everything it replaces is still there: a proposal whose targets moved is refused whole.
   See docs/phase7-assistant-proposals-design.md. */
import { useEffect, useState } from 'preact/hooks';
import type { ProposalChange } from '../core/index';
import type { WebProposal, WebProposalAdapter } from '../host/types';
import { C, L } from './ctx';
import { Icon } from './Icon';

const plain = (v: string) => String(v || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const when = (iso: string) => {
  const t = Date.parse(iso);
  if (!t) return '';
  const minutes = Math.round((Date.now() - t) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};
function problem(error: unknown) {
  const e = error as { payload?: { detail?: string }; message?: string } | null;
  const detail = e?.payload?.detail || String(e?.message || '').trim();
  return detail && !/^[a-z][a-z0-9_ -]*$/i.test(detail) ? detail : 'That did not work. Try again.';
}

/** An image token as a small picture, or its text when the site doesn't have it any more. */
function Picture({ value }: { value: string }) {
  const id = String(value || '').replace(/^asset:/, '').split('@')[0];
  const asset = id ? L.asset(id) : null;
  if (!value) return <span class="pw-none">None</span>;
  return asset ? <img class="pw-pic" src={asset.url} alt={asset.name} /> : <span class="pw-none">{value}</span>;
}

function Value({ change, side }: { change: ProposalChange; side: 'before' | 'after' }) {
  const value = side === 'before' ? change.before : change.value;
  const image = change.type === 'image' || (change.type === 'property' && /^asset:/.test(value));
  if (image) return <Picture value={value} />;
  const text = plain(value);
  return text ? <span class="pw-text">{text}</span> : <span class="pw-none">Empty</span>;
}

const STATUS: Record<string, string> = {
  stale: 'Changed in the editor since the proposal was made',
  missing: 'No longer on the site',
};

function ChangeRow({ change, status }: { change: ProposalChange; status: 'ok' | 'stale' | 'missing' }) {
  if (change.type === 'insert') {
    const def = C.findComponent(change.componentId || '');
    const values = Object.entries(change.values || {});
    return (
      <li class={'pw-change' + (status === 'ok' ? '' : ' off')}>
        <div class="pw-change-head"><Icon name="plus" size={12} /><b>{change.label}</b></div>
        {values.length > 0 && (
          <dl class="pw-values">{values.map(([k, v]) => (
            <div key={k}><dt>{C.findProp(def, k)?.label || k}</dt><dd>{/^asset:/.test(v) ? <Picture value={v} /> : plain(v) || '—'}</dd></div>
          ))}</dl>
        )}
        {status !== 'ok' && <p class="pw-warn">{STATUS[status]}</p>}
      </li>
    );
  }
  return (
    <li class={'pw-change' + (status === 'ok' ? '' : ' off')}>
      <div class="pw-change-head"><Icon name={change.type === 'image' ? 'image' : change.type === 'property' ? 'component' : 'text'} size={12} /><b>{change.label}</b></div>
      <div class="pw-diff">
        <div><span class="pw-side">Now</span><Value change={change} side="before" /></div>
        <div><span class="pw-side">Proposed</span><Value change={change} side="after" /></div>
      </div>
      {status !== 'ok' && <p class="pw-warn">{STATUS[status]}</p>}
    </li>
  );
}

function Detail({ api, proposal, busy, apply, decline }: {
  api: WebProposalAdapter; proposal: WebProposal; busy: boolean;
  apply: (p: WebProposal) => void; decline: (p: WebProposal) => void;
}) {
  const [tab, setTab] = useState(0);
  const [side, setSide] = useState<'after' | 'before'>('after');
  useEffect(() => { setTab(0); setSide('after'); }, [proposal.id]);
  const pending = proposal.status === 'pending';
  // Whether a change still matches only means something while it waits; once applied, it won't.
  const statuses = pending ? C.proposalCheck(proposal.changes) : proposal.changes.map(() => 'ok' as const);
  const blocked = statuses.filter(s => s !== 'ok').length;
  const preview = proposal.previews[Math.min(tab, proposal.previews.length - 1)];
  return (
    <section class="pw-detail" aria-labelledby="pw-title">
      <header class="pw-detail-head">
        <div>
          <h2 id="pw-title">{proposal.title}</h2>
          <p class="pw-meta">From {proposal.tokenName} · {when(proposal.createdAt)} · {proposal.changes.length} {proposal.changes.length === 1 ? 'change' : 'changes'}</p>
          {proposal.summary && <p class="pw-summary">{proposal.summary}</p>}
        </div>
        {pending ? (
          <div class="pw-actions">
            <button type="button" class="btn" disabled={busy} onClick={() => decline(proposal)}>Decline</button>
            <button type="button" class="btn primary" disabled={busy || blocked > 0} onClick={() => apply(proposal)}>
              {busy ? 'Applying…' : 'Apply to draft'}
            </button>
          </div>
        ) : (
          <span class={'pw-chip ' + proposal.status}>{proposal.status === 'applied' ? 'Applied' : 'Declined'}</span>
        )}
      </header>
      {pending && blocked > 0 && (
        <p class="pw-blocked" role="status">
          {blocked === 1 ? 'One change no longer matches' : `${blocked} changes no longer match`} the draft, so this proposal can’t be
          applied as it is. Decline it and ask the assistant to read the site again and propose afresh.
        </p>
      )}
      <div class="pw-body">
        <ol class="pw-changes">{proposal.changes.map((change, i) => <ChangeRow key={i} change={change} status={statuses[i]} />)}</ol>
        {preview && (
          <div class="pw-preview">
            <div class="pw-preview-bar">
              {proposal.previews.length > 1 ? (
                <div class="pw-tabs" role="tablist" aria-label="Affected pages">
                  {proposal.previews.map((v, i) => (
                    <button key={v.region} type="button" role="tab" aria-selected={i === tab ? 'true' : 'false'} class={i === tab ? 'on' : ''}
                      onClick={() => setTab(i)}>{v.label}</button>
                  ))}
                </div>
              ) : <b class="pw-preview-name">{preview.label}</b>}
              <div class="pw-tabs" role="group" aria-label="Preview">
                <button type="button" aria-pressed={side === 'after' ? 'true' : 'false'} class={side === 'after' ? 'on' : ''} onClick={() => setSide('after')}>Proposed</button>
                <button type="button" aria-pressed={side === 'before' ? 'true' : 'false'} class={side === 'before' ? 'on' : ''} onClick={() => setSide('before')}>Now</button>
              </div>
            </div>
            <iframe class="pw-frame" title={`${preview.label}, ${side === 'after' ? 'with the proposal' : 'as it is now'}`}
              src={api.previewUrl(proposal.id, preview.path, side === 'before')} sandbox="allow-same-origin" loading="lazy" />
          </div>
        )}
      </div>
    </section>
  );
}

export function ProposalsWorkspace({ focus, close, changed }: { focus?: string; close: () => void; changed?: () => void }) {
  const api = L.proposals();
  const [list, setList] = useState<WebProposal[] | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(focus || null);
  const [busy, setBusy] = useState(false);

  const load = async (keep?: string | null) => {
    if (!api) return;
    try {
      const all = await api.list();
      setList(all);
      setError('');
      changed?.();
      const want = keep ?? selected;
      setSelected(want && all.some(p => p.id === want) ? want : all.find(p => p.status === 'pending')?.id || all[0]?.id || null);
    } catch (e) {
      setError(problem(e));
    }
  };
  useEffect(() => { void load(focus || null); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy]);

  const apply = async (p: WebProposal) => {
    if (C.proposalCheck(p.changes).some(s => s !== 'ok')) { L.toast('This proposal no longer matches the draft.', { tone: 'error' }); return; }
    setBusy(true);
    try {
      C.edit(() => { C.proposalApply(p.changes); });
      L.appRender();
      try {
        await L.flushDraft();
      } catch (e) {
        L.toast(`Applied in the editor, but the draft was not saved: ${problem(e)}`, { tone: 'error' });
        return;
      }
      await api!.decide(p.id, 'applied', L.siteDraft()?.version);
      L.toast(`Applied “${p.title}” to the draft. Undo reverses it; publish when you’re ready.`);
      await load(p.id);
    } catch (e) {
      L.toast(problem(e), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const decline = async (p: WebProposal) => {
    const ok = await L.askConfirm('Decline this proposal?', 'Nothing on the site changes. The assistant can see that it was declined.', { ok: 'Decline' });
    if (!ok) return;
    setBusy(true);
    try {
      await api!.decide(p.id, 'declined');
      L.toast(`Declined “${p.title}”.`);
      await load(p.id);
    } catch (e) {
      L.toast(problem(e), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const current = list?.find(p => p.id === selected) || null;
  const pending = list?.filter(p => p.status === 'pending').length || 0;
  return (
    <div class="pw" role="region" aria-label="Assistant proposals">
      <header class="pw-head">
        <div>
          <h1>Proposals</h1>
          <p>Changes AI assistants suggested for this site. Nothing changes until you apply it.</p>
        </div>
        <div class="pw-head-actions">
          {api && <a class="btn ghost" href={api.settingsUrl} target="_blank" rel="noopener">Assistants and tokens</a>}
          <button type="button" class="btn" onClick={close} disabled={busy}>Back to editor</button>
        </div>
      </header>
      {!api ? (
        <p class="pw-empty">Proposals are available in the hosted editor, for the site’s owner.</p>
      ) : error && !list ? (
        <p class="pw-empty" role="alert">{error} <button type="button" class="btn tiny" onClick={() => load()}>Try again</button></p>
      ) : !list ? (
        <p class="pw-empty" aria-busy="true">Loading proposals…</p>
      ) : !list.length ? (
        <div class="pw-empty">
          <p><b>No proposals yet.</b> Create a token on the Assistants page and add it to an MCP assistant such as Claude Code. Its proposals appear here for you to review.</p>
          <a class="btn primary" href={api.settingsUrl} target="_blank" rel="noopener">Set up an assistant</a>
        </div>
      ) : (
        <div class="pw-main">
          <nav class="pw-list" aria-label={`${pending} waiting for review`}>
            {list.map(p => (
              <button key={p.id} type="button" class={'pw-item' + (p.id === selected ? ' on' : '')} aria-current={p.id === selected ? 'true' : undefined}
                onClick={() => setSelected(p.id)}>
                <b>{p.title}</b>
                <small>{p.tokenName} · {when(p.createdAt)}</small>
                <span class={'pw-chip ' + p.status}>{p.status === 'pending' ? 'Waiting' : p.status === 'applied' ? 'Applied' : 'Declined'}</span>
              </button>
            ))}
          </nav>
          {current ? <Detail api={api} proposal={current} busy={busy} apply={apply} decline={decline} /> : null}
        </div>
      )}
    </div>
  );
}
