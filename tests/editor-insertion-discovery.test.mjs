import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

test('click insertion reveals the selected element for editing and remains one undo action', async () => {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'http://localhost/', virtualConsole: console
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 800));
    const window = dom.window, document = window.document;
    const core = window.__CORE;
    // Clear the seeded example through its real transaction, then use the visible Add tile.
    core.edit(() => { core.tree().splice(0); core.selSet([]); });
    document.body.classList.add('library-focus');
    const heading = Array.from(document.querySelectorAll('.pitem')).find(button => button.textContent.trim() === 'Heading');
    assert.ok(heading, 'the common Heading tile is available');
    heading.click();
    assert.equal(core.locate(core.state.ui.sel).node.type, 'heading');
    assert.equal(document.body.classList.contains('library-focus'), false,
      'selection must reveal the inspector rather than leave the tablet Add panel in front');
    assert.ok(document.querySelector('textarea[aria-label="Heading text"], #inspector-panel textarea'),
      'the selected content is immediately editable');
    if (document.querySelector('#savedTag').textContent === '—') window.bindTop();
    document.querySelector('#undoBtn').click();
    assert.equal(core.tree().length, 0, 'one Undo removes the heading and its automatically created wrappers');
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
