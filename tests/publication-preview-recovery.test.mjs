import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { JSDOM } from 'jsdom';

const builder = readFileSync(new URL('../builder.html', import.meta.url), 'utf8');
const source = builder.slice(
  builder.indexOf('function renderPublicationPreviewFailure'),
  builder.indexOf('\nasync function preparePublicationReview')
);

test('Show me exits preview and restores the editing toolbar before navigating a Site checks target', () => {
  const dom = new JSDOM(`<body class="preview"><button id="previewBtn" aria-label="Return to editing"></button>
    <div id="publicationChanges"></div></body>`, { runScripts: 'outside-only' });
  const { window: w } = dom;
  const target = { pageId: 'page-home', scope: 'page', nodeId: 'icon-1' };
  const calls = [];
  Object.assign(w, {
    $: selector => w.document.querySelector(selector),
    esc: value => String(value ?? ''),
    state: { pages: [{ slug: 'home' }] },
    showReviewTarget: value => calls.push(value),
    togglePreview: () => {
      w.document.body.classList.remove('preview');
      w.document.querySelector('#previewBtn').setAttribute('aria-label', 'Preview your working draft');
    },
    closeModal: () => calls.push('closeModal'),
    render: () => calls.push('render'),
    select: () => calls.push('select'),
    showPanel: () => calls.push('showPanel'),
    locate: () => ({ node: { id: 'icon-1' } })
  });
  w.eval(source);
  w.renderPublicationPreviewFailure(w.document.querySelector('#publicationChanges'), {
    message: 'Site checks found a problem',
    findings: [{ message: 'Icon has no accessible name', target, where: { slug: 'home', region: 'page' } }]
  });

  w.document.querySelector('[data-publication-finding]').click();
  expect(w.document.body.classList.contains('preview')).toBe(false);
  expect(w.document.querySelector('#previewBtn').getAttribute('aria-label')).toBe('Preview your working draft');
  expect(calls).toEqual([target]);
  dom.window.close();
});
