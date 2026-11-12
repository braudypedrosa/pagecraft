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
  page: 'page', 'global header': 'header', 'global footer': 'footer'
};

export function ReviewList({ defaultOpen = false, findings: supplied }: { defaultOpen?: boolean; findings?: Finding[] }) {
  const findings = supplied ?? C.lint();
  const counts = C.lintCounts(findings);
  const [open, setOpen] = useState(defaultOpen || counts.error > 0);
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
    C.state.ui.mode = (REGION_MODE[f.where.region || ''] || 'page') as 'page' | 'header' | 'footer';
    L.closeReviewSurface();
    L.appRender();
    L.select(f.nodeId, { scroll: true });
    if (!C.locate(f.nodeId)) L.toast('That element is no longer in the project');
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
            const label = [totals.error ? `${totals.error} ${totals.error === 1 ? 'problem' : 'problems'}` : '',
              totals.warn ? `${totals.warn} ${totals.warn === 1 ? 'suggestion' : 'suggestions'}` : ''].filter(Boolean).join(' · ');
            return <details class="review-group" key={group.key} open={orderedGroups.length === 1 || totals.error > 0}>
              <summary><span class="review-group-name">{group.name}</span><span class="review-count">{label}</span></summary>
              <ul>
                {[...group.rows].sort((a, b) => Number(b.level === 'error') - Number(a.level === 'error')).map((f, i) => (
                  <li key={i}>
                    <span class={'review-level ' + f.level}>{f.level === 'error' ? 'Problem' : 'Suggestion'}</span>
                    <span class="msg">{f.msg}
                      {f.where.region || f.where.node ? <em>{[f.where.region, f.where.node].filter(Boolean).join(' · ')}</em> : null}
                    </span>
                    {f.target || f.nodeId ? <button type="button" class="go" onClick={() => goTo(f)}>Show me</button> : null}
                  </li>
                ))}
              </ul>
            </details>;
          })}
        </MotionPresence>
      </div>
    </>
  );
}
