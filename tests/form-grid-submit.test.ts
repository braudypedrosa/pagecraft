import { afterEach, beforeEach, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import * as C from '../app/src/core/index';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: any };
const doms: any[] = [];
beforeEach(() => C.blankProject('Form grid submit regression'));
afterEach(() => { for (const dom of doms.splice(0)) dom.window.close(); });

for (const editing of [false, true]) {
  test.each([1, 2, 3, 4])(`Grid %i keeps the submit and disabled status across the row (editing=${editing})`, columns => {
    const tracks = columns === 1 ? '1fr' : `repeat(${columns},minmax(0,1fr))`;
    const form = C.N('form', {
      action: '', submit: 'Send request',
      fields: [100, 50, 33, 25, 20].map(width => ({ type: 'text', label: `Width ${width}`, width })),
    }, { d: { '--f-layout': 'grid', '--f-columns': tracks, '--f-gap': '20px' }, t: {}, m: {} });
    const before = JSON.stringify(form);
    const css = C.treeCss([[form]], editing);
    const dom = new JSDOM(`<style>${css}</style>${C.renderNode(form, { edit: editing })}`);
    doms.push(dom);
    const root = dom.window.document.querySelector('.pagecraft-form')!;
    const button = root.querySelector('.pagecraft-form-button')!;
    const status = root.querySelector('.pagecraft-form-status')!;
    expect(dom.window.getComputedStyle(root).getPropertyValue('--f-columns')).toBe(tracks);
    expect(root.querySelectorAll('.pagecraft-field')).toHaveLength(5);
    expect(dom.window.getComputedStyle(button).gridColumn).toMatch(/^1\s*\/\s*-1$/);
    expect(dom.window.getComputedStyle(status).gridColumn).toMatch(/^1\s*\/\s*-1$/);

    expect(JSON.stringify(form)).toBe(before);
    form.props.action = 'https://example.invalid/pagecraft-qa';
    form.props.method = 'get';
    const active = new JSDOM(`<style>${css}</style>${C.renderNode(form, { edit: editing })}`);
    doms.push(active);
    const activeForm = active.window.document.querySelector('form')!;
    expect(activeForm.getAttribute('method')).toBe('get');
    expect(activeForm.querySelector('.pagecraft-form-button').disabled).toBe(false);
    expect(active.window.getComputedStyle(activeForm.querySelector('.pagecraft-form-button')).gridColumn)
      .toMatch(/^1\s*\/\s*-1$/);
  });
}

test('the grid span leaves wrapped fields, button flex sizing and responsive track choices intact', () => {
  const form = C.N('form', { fields: [{ type: 'text', width: 50 }, { type: 'text', width: 50 }] }, {
    d: { '--f-layout': 'grid', '--f-columns': 'repeat(4,minmax(0,1fr))' },
    t: { '--f-columns': 'repeat(2,minmax(0,1fr))' }, m: { '--f-columns': '1fr' },
  });
  const before = JSON.stringify(form);
  const css = C.treeCss([[form]], false);
  const tabletAt = css.indexOf(C.MQ.t);
  const mobileAt = css.indexOf(C.MQ.m);
  expect(css.slice(0, tabletAt)).toContain('--f-columns:repeat(4,minmax(0,1fr))');
  expect(css.slice(tabletAt, mobileAt)).toContain('--f-columns:repeat(2,minmax(0,1fr))');
  expect(css.slice(mobileAt)).toContain('--f-columns:1fr');
  expect(C.cssAt(form, 't', '--f-columns')).toBe('repeat(2,minmax(0,1fr))');
  expect(C.cssAt(form, 'm', '--f-columns')).toBe('1fr');
  expect(JSON.stringify(form)).toBe(before);

  form.css.d['--f-layout'] = 'flex';
  const wrapped = C.treeCss([[form]], false);
  expect(wrapped).toContain('display:var(--f-layout,flex)');
  expect(wrapped).toContain('flex-basis:calc((100% - var(--f-gap,16px) * 1) / 2)');
  const buttonRule = wrapped.match(/\.pagecraft-form-button\{([^}]+)\}/)![1];
  expect(buttonRule).toContain('flex:0 0 auto');
  expect(buttonRule).toContain('align-self:var(--f-button-align,flex-start)');
  expect(buttonRule).not.toMatch(/(?:^|;)width:100%/);
});
