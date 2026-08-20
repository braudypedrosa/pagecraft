/* The pre-export review: what is wrong with the project, and a way to each problem.

   Mounted into `#exReview` in the export dialog, which nothing else writes. The rest of
   that dialog is asynchronous orchestration — building HTML, zipping, saving — and stays
   imperative, because that is what it is. This part is a list with a disclosure and a
   jump button, which is what a component is for.

   Problems open the list themselves and suggestions do not: an error you have not seen
   is worth interrupting for, a suggestion is not. */
import { useState } from 'preact/hooks';
import { C, L } from './ctx';
import type { Finding } from '../core/types';

const REGION_MODE: Record<string, string> = {
  page: 'page', 'global header': 'header', 'global footer': 'footer'
};

export function ReviewList() {
  const findings = C.lint();
  const counts = C.lintCounts(findings);
  const [open, setOpen] = useState(counts.error > 0);
  const clean = !findings.length;

  /* Jumping to a finding may cross a page or a global region, so the scope moves first
     and the canvas is repainted before anything is selected. */
  const goTo = (f: Finding) => {
    if (!f.nodeId) return;
    const pi = C.state.pages.findIndex(p => p.slug === f.where.slug);
    if (pi > -1) C.state.cur = pi;
    C.state.ui.mode = (REGION_MODE[f.where.region || ''] || 'page') as 'page' | 'header' | 'footer';
    L.closeModal();
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
          <button class="reset" onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'Show'} details
          </button>
        )}
      </div>
      {clean || !open ? null : (
        <ul>
          {findings.map((f, i) => (
            <li key={i}>
              <span class={'lv ' + f.level} />
              <span class="msg">{f.msg}
                <em>{f.where.page || ''}{f.where.region ? ' · ' + f.where.region : ''}</em>
              </span>
              {f.nodeId ? <button class="go" onClick={() => goTo(f)}>Show me</button> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
