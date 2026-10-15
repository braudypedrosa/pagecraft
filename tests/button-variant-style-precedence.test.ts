import { beforeEach, describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import * as C from '../app/src/core/index';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: any };

const mediaBlocks = (css: string) => {
  const tabletAt = css.indexOf(C.MQ.t);
  const mobileAt = css.indexOf(C.MQ.m);
  return {
    base: css.slice(0, tabletAt < 0 ? (mobileAt < 0 ? undefined : mobileAt) : tabletAt),
    tablet: tabletAt < 0 ? '' : css.slice(tabletAt, mobileAt < 0 ? undefined : mobileAt),
    mobile: mobileAt < 0 ? '' : css.slice(mobileAt),
  };
};

const buttonRule = (button: ReturnType<typeof C.N>, css: string) => {
  const selector = `.${C.nodeClass(button)}.pagecraft-button{`;
  const start = css.indexOf(selector);
  return start < 0 ? '' : css.slice(start + selector.length, css.indexOf('}', start));
};

const computedButton = (button: ReturnType<typeof C.N>, css = C.treeCss([[button]], false)) => {
  const dom = new JSDOM(`<style>${css}</style>${C.renderNode(button, { edit: false })}`, { pretendToBeVisual: true });
  const style = dom.window.getComputedStyle(dom.window.document.querySelector('.pagecraft-button')!);
  return { style, close: () => dom.window.close() };
};

beforeEach(() => C.blankProject('Button variant style precedence'));

describe('button variant style precedence', () => {
  test('solid semantic foreground beats the inherited base while transparent variants inherit', () => {
    const css = C.baseCss(false).replace('var(--pc-solid-fg,inherit)', '#fffaf0');
    expect(css).not.toMatch(/\.pagecraft-button\{[^}]*color:/);
    expect(css.indexOf(':where(.pagecraft-button){max-width:100%;color:inherit}')).toBeLessThan(
      css.indexOf(':where(.pagecraft-button[data-variant=solid]){color:#fffaf0}')
    );

    const dom = new JSDOM(`<style>${css}</style><div style="color:rgb(52,70,59)">
      <a id="solid" class="pagecraft-button" data-variant="solid">Solid</a>
      <a id="outline" class="pagecraft-button" data-variant="outline">Outline</a>
    </div>`, { pretendToBeVisual: true });
    expect(dom.window.getComputedStyle(dom.window.document.querySelector('#solid')!).color).toBe('rgb(255, 250, 240)');
    expect(dom.window.getComputedStyle(dom.window.document.querySelector('#outline')!).color).toBe('rgb(52, 70, 59)');
    dom.window.close();
  });

  test.each([
    ['outline', 'border-width:1px', 'background-color:transparent'],
    ['link', 'border-width:0', 'padding:0'],
  ])('untouched %s Buttons retain their variant defaults', (variant, first, second) => {
    const button = C.N('button', { variant });
    const css = C.treeCss([[button]], false);

    expect(buttonRule(button, mediaBlocks(css).base)).toBe('');
    const variantRule = css.match(new RegExp(`\\.pagecraft-button\\[data-variant=${variant}\\]\\{([^}]*)}`))?.[1] || '';
    expect(variantRule).toContain(first);
    expect(variantRule).toContain(second);
    if (variant === 'link') expect(variantRule).toContain('border-radius:0');
    const rendered = computedButton(button, css);
    if (variant === 'outline') expect(rendered.style.borderTopWidth).toBe('1px');
    else {
      expect(rendered.style.paddingTop).toBe('0px');
      expect(rendered.style.borderRadius).toBe('0px');
    }
    rendered.close();
  });

  test('explicit local and responsive edge values outrank variant rules', () => {
    const button = C.N('button', { variant: 'outline' });
    button.css.d['border-width'] = '0px';
    button.css.d['background-color'] = '#ffeecc';
    button.css.d['border-radius'] = '22px';
    button.css.d['padding-left'] = '31px';
    button.css.t['border-left-width'] = '7px';
    button.css.m['padding-top'] = '3px';
    const css = C.treeCss([[button]], false);
    const blocks = mediaBlocks(css);

    expect(css.indexOf('.pagecraft-button[data-variant=outline]{')).toBeLessThan(css.indexOf(`.${C.nodeClass(button)}.pagecraft-button{`));
    expect(buttonRule(button, blocks.base)).toContain('border-width:0px');
    expect(buttonRule(button, blocks.base)).toContain('background-color:#ffeecc');
    expect(buttonRule(button, blocks.base)).toContain('border-radius:22px');
    expect(buttonRule(button, blocks.base)).toContain('padding-left:31px');
    expect(buttonRule(button, blocks.tablet)).toContain('border-left-width:7px');
    expect(buttonRule(button, blocks.mobile)).toContain('padding-top:3px');
    const rendered = computedButton(button, css);
    expect(rendered.style.borderTopWidth).toBe('0px');
    expect(rendered.style.backgroundColor).toBe('rgb(255, 238, 204)');
    expect(rendered.style.borderRadius).toBe('22px');
    expect(rendered.style.paddingLeft).toBe('31px');
    rendered.close();
  });

  test('reusable class Button styling receives the same specificity bridge at every breakpoint', () => {
    const id = C.classAdd('Flat action', {
      d: { 'border-top-width': '0px', 'background-color': '#223344' },
      t: { 'border-right-width': '5px' },
      m: { padding: '2px' },
    });
    const button = C.N('button', { variant: 'outline' });
    C.classApply(button, id);
    const css = C.treeCss([[button]], false);
    const blocks = mediaBlocks(css);

    expect(css.indexOf('.pagecraft-button[data-variant=outline]{')).toBeLessThan(css.indexOf(`.c-${id}.pagecraft-button{`));
    expect(blocks.base).toContain(`.c-${id}.pagecraft-button{border-top-width:0px;background-color:#223344;}`);
    expect(blocks.tablet).toContain(`.c-${id}.pagecraft-button{border-right-width:5px;}`);
    expect(blocks.mobile).toContain(`.c-${id}.pagecraft-button{padding:2px;}`);
    expect(C.renderNode(button, { edit: false })).toContain(`c-${id}`);
  });
});
