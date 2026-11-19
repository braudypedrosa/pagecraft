/* The pre-export review: what is wrong with the project, and a way to each problem.

   Mounted into `#exReview` in the export dialog, which nothing else writes. The rest of
   that dialog is asynchronous orchestration — building HTML, zipping, saving — and stays
   imperative, because that is what it is. This part is a list with a disclosure and a
   jump button, which is what a component is for.

   Problems open the list themselves. A host may also request an initially open list when
   review is the primary task, such as Site checks. */
import { useId, useState } from 'preact/hooks';
import { C, L } from './ctx';
import type { Finding } from '../core/types';
import { MotionPresence } from './MotionPresence';

const REGION_MODE: Record<string, string> = {
  page: 'page', 'global header': 'header', 'global footer': 'footer', 'page header': 'header', 'page footer': 'footer'
};

export function ReviewList({ defaultOpen = false, findings: supplied }: { defaultOpen?: boolean; findings?: Finding[] }) {
  const findings = supplied ?? C.lint();
  const counts = C.lintCounts(findings);
  const [open, setOpen] = useState(defaultOpen || counts.error > 0);
  /* Which place "Show me" visits next, per repeated finding. */
  const [step, setStep] = useState<Record<string, number>>({});
  const listId = useId();
  const clean = !findings.length;
  const groups = new Map<string, { key: string; name: string; rows: Finding[] }>();
  findings.forEach(finding => {
    const key = finding.where.slug ?? finding.where.page ?? '';
    if (!groups.has(key)) groups.set(key, { key, name: finding.where.page || 'Project', rows: [] });
    groups.get(key)!.rows.push(finding);
  });
  const orderedGroups = [...groups.values()].sort((a, b) =>
    Number(b.rows.some(row => row.level === 'error')) - Number(a.rows.some(row => row.level === 'error')));

  /* Jumping to a finding may cross a page or a global region, so the scope moves first
     and the canvas is repainted before anything is selected. */
  const goTo = (f: Finding) => {
    L.exitPreview();
    if (f.target) {
      L.showReviewTarget(f.target);
      return;
    }
    if (!f.nodeId) return;
    const pi = C.state.pages.findIndex(p => p.slug === f.where.slug);
    if (pi > -1) C.state.cur = pi;
    C.state.ui.mode = (REGION_MODE[(f.where.region || '').split(',')[0]] || 'page') as 'page' | 'header' | 'footer';
    const shown = C.locate(f.nodeId);
    if (!shown) C.state.ui.mode = 'page';
    L.closeReviewSurface();
    L.appRender();
    if (shown) L.select(f.nodeId, { scroll: true });
    else L.toast('That element is no longer shown on this page');
  };

  /* A finding inside a component is fixed in the component, once, for every use. */
  const editComponent = (id: string) => {
    L.exitPreview();
    if (!C.findComponent(id)) { L.toast('That component is no longer in the project'); return; }
    L.closeReviewSurface();
    L.editComponent(id);
  };
  const showNext = (key: string, rows: Finding[]) => {
    const at = (step[key] ?? 0) % rows.length;
    setStep({ ...step, [key]: at + 1 });
    goTo(rows[at]);
  };

  const summary = clean ? 'No problems found' : [
    counts.error ? counts.error + (counts.error === 1 ? ' problem' : ' problems') : '',
    counts.warn ? counts.warn + (counts.warn === 1 ? ' suggestion' : ' suggestions') : ''
  ].filter(Boolean).join(' · ');

  return (
    <>
      <div class="rh">
        <span class={'dot ' + (clean ? 'ok' : counts.error ? 'bad' : 'warn')} />
        <span>{summary}</span>
        <span class="spacer" />
        {clean ? null : (
          <button class="reset" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'Show'} details
          </button>
        )}
      </div>
      <div id={listId}>
        <MotionPresence show={!clean && open} kind="panel">
          {orderedGroups.map(group => {
            const totals = C.lintCounts(group.rows);
            const rows = C.lintGroups(group.rows)
              .sort((a, b) => Number(b[0].level === 'error') - Number(a[0].level === 'error'));
            const label = [totals.error ? `${totals.error} ${totals.error === 1 ? 'problem' : 'problems'}` : '',
              totals.warn ? `${totals.warn} ${totals.warn === 1 ? 'suggestion' : 'suggestions'}` : ''].filter(Boolean).join(' · ');
            return <details class="review-group" key={group.key} open={orderedGroups.length === 1 || totals.error > 0}>
              <summary><span class="review-group-name">{group.name}</span><span class="review-count">{label}</span></summary>
              <ul>
                {rows.map((same, i) => {
                  const f = same[0], key = group.key + '|' + i, places = same.length;
                  const jumpable = same.filter(row => row.target || row.nodeId);
                  const next = ((step[key] ?? 0) % Math.max(1, jumpable.length)) + 1;
                  return (
                    <li key={i}>
                      <span class={'review-level ' + f.level}>{f.level === 'error' ? 'Problem' : 'Suggestion'}</span>
                      <span class="msg">{f.msg}
                        {f.where.region || f.where.node || places > 1 ? <em>{[f.where.region, f.where.node,
                          places > 1 ? `${places} places` : ''].filter(Boolean).join(' · ')}</em> : null}
                        {f.component ? <em class="review-fix">Fix it once in the “{f.component.name}” component to fix every use.</em> : null}
                      </span>
                      {f.component ? <button type="button" class="go" onClick={() => editComponent(f.component!.id)}>Edit component</button> : null}
                      {jumpable.length ? <button type="button" class="go"
                        aria-label={jumpable.length > 1 ? `Show place ${next} of ${jumpable.length}` : undefined}
                        onClick={() => showNext(key, jumpable)}>
                        {jumpable.length > 1 ? `Show me ${next}/${jumpable.length}` : 'Show me'}
                      </button> : null}
                    </li>
                  );
                })}
              </ul>
            </details>;
          })}
        </MotionPresence>
      </div>
    </>
  );
}
