import { beforeEach, describe, expect, test } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index.ts';
import { mediaReferences } from '../app/src/core/media-references.ts';
import { install } from '../app/src/ui/ctx.ts';
import { quickAddChoices } from '../app/src/ui/Add.tsx';
import { blankDoc, renderSite } from '../server/src/render.ts';
import { buildReleaseArtifact } from '../server/src/releases.ts';
import { validateTemplateDraftDocument } from '../server/src/template-draft-validation.ts';
import { buildTemplateStarter } from '../premade-sites/lib/authoring.ts';

const scriptBody = (source: string) => source.replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');

function freshDoc() {
  install(C, { dynamicContentProvider: () => 'pagecraft' } as any);
  C.restore(blankDoc('Test'), false);
}

function domFor(markup: string) {
  return new JSDOM(`<!doctype html><html lang="en"><body>${markup}</body></html>`, {
    runScripts: 'outside-only',
    url: 'https://site.test/',
    pretendToBeVisual: true,
  });
}

describe('extra native widgets (audio, countdown, marquee, filter)', () => {
  beforeEach(() => freshDoc());

  test('DEF, slots, history labels, mediaReferences, and Add palette registration', () => {
    for (const type of ['audio', 'countdown', 'marquee', 'filter'] as const) {
      expect(C.DEF[type]).toBeTruthy();
      expect(C.DEF[type].caps).toContain('animation');
      expect(C.DEF[type].caps).toContain('spacing');
      const node = C.N(type);
      expect(node.type).toBe(type);
      expect(C.nameOf(node)).toBeTruthy();
      expect(C.kindOf(node)).toBeTruthy();
    }

    expect(C.TEXT_SLOTS.audio).toEqual(['title', 'subtitle']);
    expect(C.TEXT_SLOTS.countdown).toEqual(['done', 'lblDays', 'lblHours', 'lblMins', 'lblSecs']);
    expect(C.TEXT_SLOTS.filter).toEqual(['all', 'tags']);
    expect(C.ASSET_SLOTS.audio).toEqual(['src', 'artwork']);

    const doc = blankDoc('Audio refs');
    const au = C.N('audio', { src: 'asset:ep-01', artwork: 'asset:cover-01', title: 'Ep 1', subtitle: 'Sub' });
    doc.pages[0].tree = [C.N('section', {}, {}, [C.N('row', {}, {}, [C.N('column', {}, {}, [au])])])];
    const refs = mediaReferences(doc).map(r => r.assetId);
    expect(refs).toContain('ep-01');
    expect(refs).toContain('cover-01');

    expect(quickAddChoices('audio').map(x => x[0])).toContain('audio');
    expect(quickAddChoices('podcast').map(x => x[0])).toContain('audio');
    expect(quickAddChoices('countdown').map(x => x[0])).toContain('countdown');
    expect(quickAddChoices('timer').map(x => x[0])).toContain('countdown');
    expect(quickAddChoices('marquee').map(x => x[0])).toContain('marquee');
    expect(quickAddChoices('ticker').map(x => x[0])).toContain('marquee');
    expect(quickAddChoices('filter').map(x => x[0])).toContain('filter');
    expect(quickAddChoices('tags').map(x => x[0])).toContain('filter');
  });

  test('audio: source validation, rendering modes, lint, and runtime controls + dispose', () => {
    expect(C.audioSrc({ src: 'https://cdn.example.com/ep.mp3' }).kind).toBe('valid');
    expect(C.audioSrc({ src: 'asset:ep-1' }).kind).toBe('valid');
    expect(C.audioSrc({ src: 'data:audio/wav;base64,AAAA' }).kind).toBe('valid');
    expect(C.audioSrc({ src: '/media/show.mp3' }).kind).toBe('valid');
    expect(C.audioSrc({ src: '' }).kind).toBe('none');
    expect(C.audioSrc({ src: 'javascript:alert(1)' }).kind).toBe('invalid');

    const emptyHtml = C.renderNode(C.N('audio', { src: '', title: 'Unlinked' }), { edit: false });
    expect(emptyHtml).not.toContain('<audio');
    expect(emptyHtml).toContain('disabled');

    const compactHtml = C.renderNode(C.N('audio', {
      src: 'https://cdn.example.com/ep.mp3',
      title: 'Trailer',
      controls: 0,
      artwork: 'https://cdn.example.com/art.jpg',
    }), { edit: false });
    expect(compactHtml).toContain('data-audio-compact');
    expect(compactHtml).toContain('class="pagecraft-audio-art"');
    expect(compactHtml).toContain('<audio class="pagecraft-audio-native"');

    C.state.pages[0].tree = [C.N('section', {}, {}, [C.N('row', {}, {}, [C.N('column', {}, {}, [
      C.N('audio', { src: 'javascript:alert(1)' }),
    ])])])];
    expect(C.lint().some(f => f.code === 'audio-invalid-source')).toBe(true);

    const p1 = C.renderNode(C.N('audio', { src: 'data:audio/wav;base64,AAAA', title: 'Track 1' }), { edit: false });
    const p2 = C.renderNode(C.N('audio', { src: 'data:audio/wav;base64,BBBB', title: 'Track 2' }), { edit: false });
    const dom = domFor(p1 + p2);
    const win = dom.window as any;
    const doc = win.document;

    let disposer: (() => void) | null = null;
    win.__pagecraftRegisterPreviewDispose = (fn: () => void) => { disposer = fn; };

    const audios = Array.from(doc.querySelectorAll('audio')) as any[];
    audios.forEach(el => {
      let paused = true;
      let time = 15;
      Object.defineProperty(el, 'paused', { get: () => paused });
      Object.defineProperty(el, 'ended', { get: () => false });
      Object.defineProperty(el, 'duration', { get: () => 120 });
      Object.defineProperty(el, 'currentTime', {
        get: () => time,
        set: (v: number) => { time = v; },
      });
      el.play = () => {
        paused = false;
        el.dispatchEvent(new win.Event('play'));
        return Promise.resolve();
      };
      el.pause = () => {
        paused = true;
        el.dispatchEvent(new win.Event('pause'));
      };
    });

    win.eval(scriptBody(C.AUDIO_JS));

    const roots = doc.querySelectorAll('.pagecraft-audio');
    const [r1, r2] = Array.from(roots) as HTMLElement[];
    const b1 = r1.querySelector('[data-audio-toggle]') as HTMLButtonElement;
    const b2 = r2.querySelector('[data-audio-toggle]') as HTMLButtonElement;
    const rate1 = r1.querySelector('[data-audio-rate]') as HTMLButtonElement;
    const seek1 = r1.querySelector('[data-audio-seek]') as HTMLInputElement;
    const cur1 = r1.querySelector('[data-audio-cur]') as HTMLElement;
    const dur1 = r1.querySelector('[data-audio-dur]') as HTMLElement;

    expect(dur1.textContent).toBe('2:00');
    expect(cur1.textContent).toBe('0:15');

    b1.click();
    expect(r1.hasAttribute('data-playing')).toBe(true);
    expect(b1.getAttribute('aria-pressed')).toBe('true');

    seek1.value = '50';
    seek1.dispatchEvent(new win.Event('input', { bubbles: true }));
    expect(audios[0].currentTime).toBe(60);
    expect(cur1.textContent).toBe('1:00');

    rate1.click();
    expect(audios[0].playbackRate).toBe(1.25);
    expect(rate1.textContent).toBe('1.25x');
    rate1.click();
    expect(audios[0].playbackRate).toBe(1.5);
    rate1.click();
    expect(audios[0].playbackRate).toBe(2);
    rate1.click();
    expect(audios[0].playbackRate).toBe(1);

    // Playing second player pauses the first.
    b2.click();
    expect(r2.hasAttribute('data-playing')).toBe(true);
    expect(r1.hasAttribute('data-playing')).toBe(false);

    expect(disposer).toBeTruthy();
    disposer!();
    expect(audios[1].paused).toBe(true);
    expect(r2.hasAttribute('data-pc-audio-ready')).toBe(false);
    dom.window.close();
  });

  test('countdown: future/past SSR, layout/seconds options, lint, and runtime tick + dispose', () => {
    const future = C.renderNode(C.N('countdown', {
      target: '2035-06-15T18:00:00Z',
      done: 'Doors open',
      showSeconds: 0,
      display: 'inline',
    }), { edit: false });
    expect(future).toContain('pagecraft-countdown-inline');
    expect(future).not.toContain('data-cd-unit="s"');
    expect(future).toContain('data-cd-ended hidden');

    const past = C.renderNode(C.N('countdown', {
      target: '2020-01-01T00:00:00Z',
      done: 'Completed',
    }), { edit: false });
    expect(past).toContain('data-cd-grid hidden');
    expect(past).toContain('>Completed</div>');

    C.state.pages[0].tree = [C.N('section', {}, {}, [C.N('row', {}, {}, [C.N('column', {}, {}, [
      C.N('countdown', { target: 'not-a-date' }),
    ])])])];
    expect(C.lint().some(f => f.code === 'countdown-invalid-date')).toBe(true);

    const liveHtml = C.renderNode(C.N('countdown', {
      target: new Date(Date.now() + 3665_000).toISOString(),
      done: 'Live now',
    }), { edit: false });
    const dom = domFor(liveHtml);
    const win = dom.window as any;
    let disposer: (() => void) | null = null;
    win.__pagecraftRegisterPreviewDispose = (fn: () => void) => { disposer = fn; };

    win.eval(scriptBody(C.COUNTDOWN_JS));
    const root = win.document.querySelector('.pagecraft-countdown');
    expect(root.hasAttribute('data-pc-cd-ready')).toBe(true);
    expect(win.document.querySelector('[data-cd-ended]').hidden).toBe(true);
    expect(win.document.querySelector('[data-cd-unit="h"]').textContent).toBe('01');

    disposer!();
    expect(root.hasAttribute('data-pc-cd-ready')).toBe(false);
    dom.window.close();
  });

  test('marquee: edit vs public track duplication, ID/tabindex sanitization, reduced motion CSS, and zero JS', () => {
    const childBtn = C.N('button', { text: 'Featured Route', link: '#route' });
    childBtn.adv.htmlId = 'marquee-btn-id';
    const childBox = C.N('box', {}, {}, [childBtn]);
    childBox.adv.htmlId = 'marquee-card-id';
    const mq = C.N('marquee', { dir: 'right', speed: '36s', gap: '40px', pause: 1, fade: 1 }, {}, [childBox]);

    const editHtml = C.renderNode(mq, { edit: true });
    expect(editHtml).toContain('data-marquee-edit');
    expect(editHtml).not.toContain('pagecraft-marquee-dup');
    expect(editHtml).toContain('data-t="box"');

    const pubHtml = C.renderNode(mq, { edit: false });
    expect(pubHtml).toContain('data-marquee-dir="right"');
    expect(pubHtml).toContain('pagecraft-marquee-dup');
    expect(pubHtml).toContain('id="marquee-card-id"');
    const dom = domFor(pubHtml);
    const dup = dom.window.document.querySelector('.pagecraft-marquee-dup')!;
    expect(dup.getAttribute('aria-hidden')).toBe('true');
    expect(dup.querySelectorAll('[id]').length).toBe(0);
    expect(dup.querySelector('a')?.getAttribute('tabindex')).toBe('-1');
    dom.window.close();

    expect(C.MARQUEE_CSS).toContain('prefers-reduced-motion:reduce');

    C.state.pages[0].tree = [C.N('section', {}, {}, [mq])];
    const pageHtml = C.buildPage(C.state.pages[0]);
    expect(pageHtml).toContain('.pagecraft-marquee');
    expect(pageHtml).not.toContain('<script>');
  });

  test('filter + box.tags: auto discovery, conditional attribute omission, filtering, keyboard nav, and dispose', () => {
    const plainBox = C.renderNode(C.N('box', {}, {}), { edit: false });
    expect(plainBox).not.toContain('data-filter-tags');

    const c1 = C.N('box', { tags: 'Bouldering, Beginner' }, {}, [C.N('heading', { text: 'Slab Intro' })]);
    const c2 = C.N('box', { tags: 'Lead, Endurance' }, {}, [C.N('heading', { text: 'Roof Arc' })]);
    const fl = C.N('filter', { group: 'classes', all: 'All sessions', align: 'center' }, {}, [c1, c2]);

    const html = C.renderNode(fl, { edit: false });
    expect(html).toContain('data-filter-tag="Bouldering"');
    expect(html).toContain('data-filter-tag="Lead"');
    expect(html).toContain('data-filter-tags="Bouldering, Beginner"');

    const dom = domFor(html);
    const win = dom.window as any;
    const doc = win.document;
    let disposer: (() => void) | null = null;
    win.__pagecraftRegisterPreviewDispose = (fn: () => void) => { disposer = fn; };

    win.eval(scriptBody(C.FILTER_JS));

    const tabs = Array.from(doc.querySelectorAll('[data-filter-btn]')) as HTMLButtonElement[];
    const boxes = Array.from(doc.querySelectorAll('[data-filter-tags]')) as HTMLElement[];
    expect(tabs.length).toBe(5); // All + 4 auto-discovered tags

    const leadTab = tabs.find(t => t.getAttribute('data-filter-tag') === 'Lead')!;
    leadTab.click();
    expect(boxes[0].hasAttribute('data-filter-hidden')).toBe(true);
    expect(boxes[1].hasAttribute('data-filter-hidden')).toBe(false);
    expect(leadTab.getAttribute('aria-selected')).toBe('true');

    leadTab.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(boxes[0].hasAttribute('data-filter-hidden')).toBe(false);
    expect(boxes[1].hasAttribute('data-filter-hidden')).toBe(false);

    disposer!();
    expect(doc.querySelector('.pagecraft-filter')!.hasAttribute('data-pc-filter-ready')).toBe(false);
    dom.window.close();
  });

  test('zero-drift on pages without new widgets & full template/render/release compatibility', () => {
    const plain = C.buildPage(C.state.pages[0]);
    expect(plain).not.toContain('.pagecraft-audio');
    expect(plain).not.toContain('.pagecraft-countdown');
    expect(plain).not.toContain('.pagecraft-marquee');
    expect(plain).not.toContain('.pagecraft-filter');

    const wpPlain = C.wordpressStyles(C.state.pages[0]);
    expect(wpPlain.global).not.toContain('.pagecraft-audio');
    expect(wpPlain.page).not.toContain('.pagecraft-countdown');

    const doc = buildTemplateStarter('Extra Widgets');
    doc.meta.font = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
    doc.meta.headFont = '';
    for (const style of doc.meta.tokens?.text || []) {
      for (const bp of ['d', 't', 'm'] as const) delete style.css[bp]['font-family'];
    }
    const c1 = C.N('box', { tags: 'Audio, Investigation' }, {}, [
      C.N('audio', {
        src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        title: 'Field Dispatch 04',
      }),
    ]);
    const c2 = C.N('box', { tags: 'Live' }, {}, [
      C.N('countdown', { target: '2030-01-01T00:00:00Z', done: 'Live now' }),
    ]);
    const mq = C.N('marquee', { speed: '24s' }, {}, [
      C.N('heading', { text: 'Partner Studio', level: 'h3' }),
    ]);
    const fl = C.N('filter', { group: 'dispatch' }, {}, [c1, c2]);
    doc.pages[0].tree = [C.N('section', {}, {}, [mq, fl])];

    expect(() => validateTemplateDraftDocument(doc)).not.toThrow();

    const rendered = renderSite(doc, []);
    const errors = rendered.findings.filter(f => f.level === 'error');
    expect(errors).toEqual([]);

    const built = buildReleaseArtifact({
      releaseId: 'release-extra-1',
      siteId: 'site-extra-1',
      sourceVersion: 1,
      document: doc,
      files: rendered.files,
      assets: [],
    });
    expect(built.artifact.routes[0].bodyHtml).toContain('pagecraft-audio');
    expect(built.artifact.routes[0].bodyHtml).toContain('pagecraft-countdown');
    expect(built.artifact.routes[0].bodyHtml).toContain('pagecraft-marquee');
    expect(built.artifact.routes[0].bodyHtml).toContain('pagecraft-filter');
  });
});
