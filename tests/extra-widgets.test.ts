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
    const cd = C.N('code', { lang: 'ts', title: 'worker.ts', body: 'export const ok = true;\n' });
    const vl = C.N('video', {
      src: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      ratio: '16 / 9',
      facade: 1,
      lightbox: 1,
      muted: 0,
    });
    doc.pages[0].tree = [C.N('section', {}, {}, [mq, fl, cd, vl])];

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
    expect(built.artifact.routes[0].bodyHtml).toContain('pagecraft-code');
    expect(built.artifact.routes[0].bodyHtml).toContain('data-video-lightbox');
  });

  test('video Open in lightbox control, markup, and modal playback/teardown runtime', () => {
    const lightboxCtl = C.DEF.video.controls.content.find(c => c.k === 'lightbox');
    expect(lightboxCtl).toMatchObject({ t: 'toggle', k: 'lightbox', label: 'Open in lightbox' });
    expect(C.DEF.video.make().props.lightbox).toBe(0);

    const yt = C.N('video', {
      src: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      ratio: '16 / 9',
      facade: 1,
      lightbox: 1,
      muted: 0,
    });
    const mp4 = C.N('video', {
      src: 'https://cdn.example.com/tour.mp4',
      ratio: '4 / 3',
      controls: 1,
      lightbox: 1,
      muted: 1,
    });
    C.state.pages[0].tree = [C.N('section', {}, {}, [yt, mp4])];

    const pageHtml = C.buildPage(C.state.pages[0]);
    expect(pageHtml).toContain('data-video-lightbox');
    expect(pageHtml).not.toContain('data-facade');
    expect(pageHtml).toContain('Play video in lightbox');
    expect(pageHtml).toContain('data-video-src="https://cdn.example.com/tour.mp4"');
    expect(pageHtml).toContain('pagecraft-video-lightbox');

    const markup = `${C.renderNode(yt, { edit: false })}${C.renderNode(mp4, { edit: false })}`;
    const dom = domFor(markup);
    const { window: win } = dom;
    win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    win.HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new win.Event('close'));
    };
    win.eval(scriptBody(C.VIDEO_LIGHTBOX_JS));

    const buttons = win.document.querySelectorAll<HTMLButtonElement>('.pagecraft-video-play');
    expect(buttons.length).toBe(2);

    // 1. Open YouTube video in modal lightbox
    buttons[0].click();
    const dlg = win.document.querySelector<HTMLDialogElement>('dialog.pagecraft-video-lightbox')!;
    expect(dlg).not.toBeNull();
    expect(dlg.open).toBe(true);
    const ytFrame = dlg.querySelector<HTMLIFrameElement>('iframe')!;
    expect(ytFrame).not.toBeNull();
    expect(ytFrame.src).toContain('https://www.youtube.com/embed/aqz-KE-bpKQ');
    expect(ytFrame.src).toContain('autoplay=1');
    // Trigger remains intact on the page behind the modal
    expect(buttons[0].isConnected).toBe(true);

    // Closing via close button stops/clears player
    dlg.querySelector<HTMLButtonElement>('.pagecraft-lightbox-close')!.click();
    expect(dlg.open).toBe(false);
    expect(dlg.querySelector('iframe')).toBeNull();

    // 2. Open direct MP4 video in modal lightbox
    buttons[1].click();
    expect(dlg.open).toBe(true);
    const mp4Video = dlg.querySelector<HTMLVideoElement>('video')!;
    expect(mp4Video).not.toBeNull();
    expect(mp4Video.src).toBe('https://cdn.example.com/tour.mp4');
    expect(mp4Video.controls).toBe(true);
    expect(mp4Video.muted).toBe(true);

    // Clicking backdrop stage closes modal and removes video element
    dlg.querySelector<HTMLElement>('.pagecraft-video-lightbox-stage')!.click();
    expect(dlg.open).toBe(false);
    expect(dlg.querySelector('video')).toBeNull();

    dom.window.close();
  });

  test('floating section header, dvh units, compare, timeline, progress, and hotspot widgets', () => {
    expect(C.U.len).toContain('dvh');
    expect(C.U.len).toContain('svh');
    expect(C.parseU('100dvh')).toEqual({ n: '100', u: 'dvh' });

    for (const type of ['compare', 'timeline', 'progress', 'hotspot', 'strips', 'switcher', 'exhibit', 'scrolly', 'clocks', 'roster', 'tiers', 'qapills', 'dockbar', 'arches', 'chapters', 'slotpicker'] as const) {
      expect(C.DEF[type]).toBeTruthy();
      expect(C.DEF[type].caps).toContain('spacing');
      expect(C.DEF[type].caps).toContain('animation');
      const node = C.N(type);
      expect(node.type).toBe(type);
      expect(C.nameOf(node)).toBeTruthy();
      expect(C.kindOf(node)).toBeTruthy();
      expect(quickAddChoices(type).map(x => x[0])).toContain(type);
    }

    const mediaDoc = blankDoc('Asset refs');
    const cmpNode = C.N('compare', { beforeSrc: 'asset:cmp-before', afterSrc: 'asset:cmp-after' });
    const hsNode = C.N('hotspot', { src: 'asset:hs-diagram' });
    const stNode = C.N('strips', { items: [{ src: 'asset:strip-photo', title: 'Panel', detail: 'Detail' }] });
    const swNode = C.N('switcher', { items: [{ label: 'Stage 1', src: 'asset:stage-photo', title: 'Stage', detail: 'Detail' }] });
    const exNode = C.N('exhibit', { items: [{ title: 'Entry 1', src: 'asset:exhibit-photo', alt: 'Exhibit' }] });
    const scNode = C.N('scrolly', { items: [{ title: 'Step 1', src: 'asset:scrolly-photo', alt: 'Scrolly' }] });
    const ckNode = C.N('clocks', { items: [{ city: 'London', tz: 'Europe/London', src: 'asset:clock-office', alt: 'London' }] });
    const rsNode = C.N('roster', { items: [{ name: 'Claire', src: 'asset:roster-partner', alt: 'Claire' }] });
    const arNode = C.N('arches', { items: [{ src: 'asset:arch-frame', alt: 'Arch' }] });
    const chNode = C.N('chapters', { chapters: [{ chapterTitle: 'Ch', src: 'asset:chapter-frame', alt: 'Ch' }] });
    mediaDoc.pages[0].tree = [C.N('section', {}, {}, [C.N('row', {}, {}, [C.N('column', {}, {}, [cmpNode, hsNode, stNode, swNode, exNode, scNode, ckNode, rsNode, arNode, chNode])])])];
    const assetIds = mediaReferences(mediaDoc).map(r => r.assetId);
    expect(assetIds).toContain('cmp-before');
    expect(assetIds).toContain('cmp-after');
    expect(assetIds).toContain('hs-diagram');
    expect(assetIds).toContain('strip-photo');
    expect(assetIds).toContain('stage-photo');
    expect(assetIds).toContain('exhibit-photo');
    expect(assetIds).toContain('scrolly-photo');
    expect(assetIds).toContain('clock-office');
    expect(assetIds).toContain('roster-partner');
    expect(assetIds).toContain('arch-frame');
    expect(assetIds).toContain('chapter-frame');

    // Zero-drift when absent
    const plainHtml = C.buildPage(C.state.pages[0]);
    expect(plainHtml).not.toContain('data-floating="1"');
    expect(plainHtml).not.toContain('.pagecraft-compare');
    expect(plainHtml).not.toContain('.pagecraft-timeline');
    expect(plainHtml).not.toContain('.pagecraft-progress');
    expect(plainHtml).not.toContain('.pagecraft-hotspot');
    expect(plainHtml).not.toContain('.pagecraft-strips');
    expect(plainHtml).not.toContain('.pagecraft-switcher');
    expect(plainHtml).not.toContain('.pagecraft-exhibit');
    expect(plainHtml).not.toContain('.pagecraft-scrolly');
    expect(plainHtml).not.toContain('.pagecraft-clocks');
    expect(plainHtml).not.toContain('.pagecraft-roster');
    expect(plainHtml).not.toContain('.pagecraft-tiers');
    expect(plainHtml).not.toContain('.pagecraft-qapills');
    expect(plainHtml).not.toContain('.pagecraft-dockbar');
    expect(plainHtml).not.toContain('.pagecraft-arches');
    expect(plainHtml).not.toContain('.pagecraft-chapters');
    expect(plainHtml).not.toContain('.pagecraft-slotpicker');

    // Floating header & 100dvh hero
    const hdr = C.N('section', { tag: 'header', width: 'full', floating: 1 }, {}, [C.N('row')]);
    const editHdr = C.renderNode(hdr, { edit: true });
    expect(editHdr).toContain('data-floating="1"');
    expect(editHdr).toContain('data-floating-edit="1"');
    const pubHdr = C.renderNode(hdr, { edit: false });
    expect(pubHdr).toContain('data-floating="1"');
    expect(pubHdr).not.toContain('data-floating-edit');

    // Compare interaction
    const cmpHtml = C.renderNode(cmpNode, { edit: false });
    expect(cmpHtml).toContain('style="--cmp-pos:50%;--cmp-ratio:16 / 9"');
    expect(C.COMPARE_CSS).toContain('clip-path:inset(0 calc(100% - var(--cmp-pos,50%)) 0 0)');
    const cmpDom = domFor(cmpHtml);
    const cmpWin = cmpDom.window as any;
    let cmpDispose: (() => void) | null = null;
    cmpWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { cmpDispose = fn; };
    cmpWin.eval(scriptBody(C.COMPARE_JS));
    const cmpRoot = cmpWin.document.querySelector('.pagecraft-compare') as HTMLElement;
    const range = cmpWin.document.querySelector('[data-compare-range]') as HTMLInputElement;
    range.value = '74';
    range.dispatchEvent(new cmpWin.Event('input', { bubbles: true }));
    expect(cmpRoot.style.getPropertyValue('--cmp-pos')).toBe('74%');
    expect(range.getAttribute('aria-valuetext')).toBe('74%');
    cmpDispose!();
    expect(cmpRoot.hasAttribute('data-pc-cmp-ready')).toBe(false);
    cmpDom.window.close();

    // Progress + Timeline
    const tlHtml = C.renderNode(C.N('timeline', {
      orientation: 'horizontal', marker: 'dots',
      items: [{ tag: 'Day 01', title: 'Intake', detail: 'Site survey.' }]
    }), { edit: false });
    expect(tlHtml).toContain('data-orientation="horizontal"');
    expect(tlHtml).toContain('data-marker="dots"');
    expect(tlHtml).toContain('Intake');

    const pgHtml = C.renderNode(C.N('progress', {
      showValue: 1, rounded: 0,
      items: [{ label: 'Retention', value: '94', unit: '%' }]
    }), { edit: false });
    expect(pgHtml).toContain('data-rounded="0"');
    expect(pgHtml).toContain('<progress');
    expect(pgHtml).toContain('value="94"');
    expect(pgHtml).toContain('94%');

    // Hotspot popover fallback interaction (JSDOM lacks native popover)
    const hsHtml = C.renderNode(C.N('hotspot', {
      src: 'https://example.test/diagram.jpg', alt: 'Chassis anatomy',
      items: [{ label: '01', title: 'Mid-Drive Motor', detail: '110 Nm planetary torque', x: '42', y: '58' }]
    }), { edit: false });
    const hsDom = domFor(hsHtml);
    const hsWin = hsDom.window as any;
    let hsDispose: (() => void) | null = null;
    hsWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { hsDispose = fn; };
    hsWin.eval(scriptBody(C.HOTSPOT_JS));
    const pin = hsWin.document.querySelector('.pagecraft-hotspot-pin') as HTMLButtonElement;
    const card = hsWin.document.querySelector('.pagecraft-hotspot-card') as HTMLElement;
    pin.click();
    expect(card.classList.contains(':popover-open')).toBe(true);
    expect(pin.getAttribute('aria-expanded')).toBe('true');
    (card.querySelector('.pagecraft-hotspot-close') as HTMLButtonElement).click();
    expect(card.classList.contains(':popover-open')).toBe(false);
    expect(pin.getAttribute('aria-expanded')).toBe('false');
    hsDispose!();
    hsDom.window.close();

    // Expanding strips click + keyboard interaction
    const stHtml = C.renderNode(C.N('strips', {
      items: [
        { src: 'https://example.test/one.jpg', alt: 'One', tag: 'First', title: 'Panel One', detail: 'Detail one' },
        { src: 'https://example.test/two.jpg', alt: 'Two', tag: 'Second', title: 'Panel Two', detail: 'Detail two' },
      ]
    }), { edit: false });
    const stDom = domFor(stHtml);
    const stWin = stDom.window as any;
    let stDispose: (() => void) | null = null;
    stWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { stDispose = fn; };
    stWin.eval(scriptBody(C.STRIPS_JS));
    const strips = [...stWin.document.querySelectorAll('.pagecraft-strip')] as HTMLButtonElement[];
    expect(strips[0].getAttribute('aria-expanded')).toBe('true');
    expect(strips[1].getAttribute('aria-expanded')).toBe('false');
    strips[1].click();
    expect(strips[0].getAttribute('aria-expanded')).toBe('false');
    expect(strips[1].getAttribute('aria-expanded')).toBe('true');
    strips[1].dispatchEvent(new stWin.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(strips[0].getAttribute('aria-expanded')).toBe('true');
    stDispose!();
    expect(stWin.document.querySelector('.pagecraft-strips')?.hasAttribute('data-pc-st-ready')).toBe(false);
    stDom.window.close();

    // Stage switcher click + keyboard interaction
    const swHtml = C.renderNode(C.N('switcher', {
      stageLayout: 'rail', ratio: '3 / 2',
      items: [
        { label: 'Step A', meta: '10 min', title: 'Stage A', detail: 'Alpha detail', src: 'https://example.test/a.jpg', alt: 'Stage A photo' },
        { label: 'Step B', meta: '15 min', title: 'Stage B', detail: 'Beta detail', src: 'https://example.test/b.jpg', alt: 'Stage B photo' },
      ]
    }), { edit: false });
    const swDom = domFor(swHtml);
    const swWin = swDom.window as any;
    let swDispose: (() => void) | null = null;
    swWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { swDispose = fn; };
    swWin.eval(scriptBody(C.SWITCHER_JS));
    const swTabs = [...swWin.document.querySelectorAll('.pagecraft-switcher-tab')] as HTMLButtonElement[];
    const swPanels = [...swWin.document.querySelectorAll('.pagecraft-switcher-panel')] as HTMLElement[];
    expect(swTabs[0].getAttribute('aria-selected')).toBe('true');
    expect(swPanels[0].getAttribute('data-active')).toBe('1');
    swTabs[1].click();
    expect(swTabs[0].getAttribute('aria-selected')).toBe('false');
    expect(swTabs[1].getAttribute('aria-selected')).toBe('true');
    expect(swPanels[0].getAttribute('data-active')).toBe('0');
    expect(swPanels[1].getAttribute('data-active')).toBe('1');
    swTabs[1].dispatchEvent(new swWin.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(swTabs[0].getAttribute('aria-selected')).toBe('true');
    expect(swPanels[0].getAttribute('data-active')).toBe('1');
    swDispose!();
    expect(swWin.document.querySelector('.pagecraft-switcher')?.hasAttribute('data-pc-sw-ready')).toBe(false);
    swDom.window.close();

    // Exhibit index hover/focus preview interaction
    const exHtml = C.renderNode(C.N('exhibit', {
      previewRatio: '4 / 3',
      items: [
        { title: 'Headland Ledge', location: 'Cape Elizabeth', scope: '3.4 ac', year: '2025', href: 'https://example.test/a', src: 'https://example.test/a.jpg', alt: 'Headland' },
        { title: 'Estuary Basin', location: 'Astoria', scope: '5.1 ac', year: '2024', href: 'https://example.test/b', src: 'https://example.test/b.jpg', alt: 'Estuary' },
      ]
    }), { edit: false });
    const exDom = domFor(exHtml);
    const exWin = exDom.window as any;
    let exDispose: (() => void) | null = null;
    exWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { exDispose = fn; };
    exWin.eval(scriptBody(C.EXHIBIT_JS));
    const exRows = [...exWin.document.querySelectorAll('.pagecraft-exhibit-row')] as HTMLElement[];
    const exFloat = exWin.document.querySelector('.pagecraft-exhibit-float') as HTMLElement;
    expect(exFloat.getAttribute('data-open')).toBe('0');
    exRows[1].dispatchEvent(new exWin.FocusEvent('focus'));
    expect(exFloat.getAttribute('data-open')).toBe('1');
    expect(exFloat.getAttribute('data-active-idx')).toBe('1');
    exDispose!();
    expect(exWin.document.querySelector('.pagecraft-exhibit')?.hasAttribute('data-pc-ex-ready')).toBe(false);
    exDom.window.close();

    // Scrolly sticky steps click + keyboard activation
    const scHtml = C.renderNode(C.N('scrolly', {
      stickyRatio: '4 / 3',
      items: [
        { title: 'Soil Borings', detail: 'Phase one.', fact: '82 mm/hr', src: 'https://example.test/s1.jpg', alt: 'Phase 1' },
        { title: 'Granite Weirs', detail: 'Phase two.', fact: '0% mortar', src: 'https://example.test/s2.jpg', alt: 'Phase 2' },
      ]
    }), { edit: false });
    const scDom = domFor(scHtml);
    const scWin = scDom.window as any;
    let scDispose: (() => void) | null = null;
    scWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { scDispose = fn; };
    scWin.eval(scriptBody(C.SCROLLY_JS));
    const scSteps = [...scWin.document.querySelectorAll('.pagecraft-scrolly-step')] as HTMLElement[];
    const scPlates = [...scWin.document.querySelectorAll('.pagecraft-scrolly-plate')] as HTMLElement[];
    expect(scSteps[0].getAttribute('data-active')).toBe('1');
    expect(scPlates[0].getAttribute('data-active')).toBe('1');
    scSteps[1].click();
    expect(scSteps[0].getAttribute('data-active')).toBe('0');
    expect(scSteps[1].getAttribute('data-active')).toBe('1');
    expect(scPlates[1].getAttribute('data-active')).toBe('1');
    scDispose!();
    expect(scWin.document.querySelector('.pagecraft-scrolly')?.hasAttribute('data-pc-sc-ready')).toBe(false);
    scDom.window.close();

    // Office clocks live timezone tick + dispose
    const ckHtml = C.renderNode(C.N('clocks', {
      hour12: 0, opens: '0', closes: '24', openLabel: 'Chambers open', closedLabel: 'After hours',
      items: [
        { city: 'Washington, D.C.', tz: 'America/New_York', address: '700 K Street NW', phone: '+1 202 555 0114', href: 'https://maps.example/dc', linkLabel: 'Open in Maps', src: 'https://example.test/dc.jpg', alt: 'Washington office' },
        { city: 'Munich', tz: 'Europe/Berlin', address: 'Maximilianstraße 35a', phone: '+49 89 555 0190' }
      ]
    }), { edit: false });
    const ckDom = domFor(ckHtml);
    const ckWin = ckDom.window as any;
    let ckDispose: (() => void) | null = null;
    ckWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { ckDispose = fn; };
    ckWin.eval(scriptBody(C.CLOCKS_JS));
    const ckTimes = [...ckWin.document.querySelectorAll('[data-clocks-time]')] as HTMLElement[];
    expect(ckTimes).toHaveLength(2);
    expect(ckTimes[0].textContent).toMatch(/^\d{2}:\d{2}$/);
    expect(ckTimes[0].getAttribute('datetime')).toBeTruthy();
    expect(ckWin.document.querySelectorAll('.pagecraft-clocks-img')).toHaveLength(1);
    ckDispose!();
    expect(ckWin.document.querySelector('.pagecraft-clocks')?.hasAttribute('data-pc-ck-ready')).toBe(false);
    ckDom.window.close();

    // Roster partner spotlight switching
    const rsHtml = C.renderNode(C.N('roster', {
      items: [
        { name: 'Claire Mercer', role: 'Partner', seat: 'DC', src: 'https://example.test/p1.jpg', alt: 'Claire' },
        { name: 'David Quinn', role: 'Partner', seat: 'London', src: 'https://example.test/p2.jpg', alt: 'David' }
      ]
    }), { edit: false });
    const rsDom = domFor(rsHtml);
    const rsWin = rsDom.window as any;
    let rsDispose: (() => void) | null = null;
    rsWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { rsDispose = fn; };
    rsWin.eval(scriptBody(C.ROSTER_JS));
    const rsTabs = [...rsWin.document.querySelectorAll('.pagecraft-roster-tab')] as HTMLElement[];
    const rsPanels = [...rsWin.document.querySelectorAll('.pagecraft-roster-panel')] as HTMLElement[];
    rsTabs[1].click();
    expect(rsTabs[1].getAttribute('aria-selected')).toBe('true');
    expect(rsPanels[1].getAttribute('data-active')).toBe('1');
    rsDispose!();
    rsDom.window.close();

    // Tiers currency switching
    const trHtml = C.renderNode(C.N('tiers', {
      defaultCurrency: 'usd',
      items: [{ tierName: 'Audit', priceUsd: '$18,000', priceEur: '€16,500', priceGbp: '£14,200' }]
    }), { edit: false });
    const trDom = domFor(trHtml);
    const trWin = trDom.window as any;
    let trDispose: (() => void) | null = null;
    trWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { trDispose = fn; };
    trWin.eval(scriptBody(C.TIERS_JS));
    const eurBtn = trWin.document.querySelector('[data-tiers-cur="eur"]') as HTMLElement;
    eurBtn.click();
    expect(trWin.document.querySelector('.pagecraft-tiers-price')?.textContent).toBe('€16,500');
    trDispose!();
    trDom.window.close();

    // QApills pill switching
    const qpHtml = C.renderNode(C.N('qapills', {
      items: [{ q: 'Q1?', a: 'A1.' }, { q: 'Q2?', a: 'A2.' }]
    }), { edit: false });
    const qpDom = domFor(qpHtml);
    const qpWin = qpDom.window as any;
    let qpDispose: (() => void) | null = null;
    qpWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { qpDispose = fn; };
    qpWin.eval(scriptBody(C.QAPILLS_JS));
    const qpPills = [...qpWin.document.querySelectorAll('.pagecraft-qapills-pill')] as HTMLElement[];
    const qpPanels = [...qpWin.document.querySelectorAll('.pagecraft-qapills-panel')] as HTMLElement[];
    qpPills[1].click();
    expect(qpPills[1].getAttribute('aria-selected')).toBe('true');
    expect(qpPanels[0].hasAttribute('hidden')).toBe(true);
    expect(qpPanels[1].hasAttribute('hidden')).toBe(false);
    qpDispose!();
    qpDom.window.close();

    // Chapters click switching + Slotpicker guest/pass live calculation
    const chHtml = C.renderNode(C.N('chapters', {
      autoSeconds: '0',
      chapters: [
        { chapterTitle: 'Caldarium', src: 'https://example.test/c1.jpg', alt: 'C1' },
        { chapterTitle: 'Plunge', src: 'https://example.test/c2.jpg', alt: 'C2' }
      ]
    }), { edit: false });
    const chDom = domFor(chHtml);
    const chWin = chDom.window as any;
    let chDispose: (() => void) | null = null;
    chWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { chDispose = fn; };
    chWin.eval(scriptBody(C.CHAPTERS_JS));
    const chBtns = [...chWin.document.querySelectorAll('.pagecraft-chapters-btn')] as HTMLElement[];
    const chSlides = [...chWin.document.querySelectorAll('.pagecraft-chapters-slide')] as HTMLElement[];
    chBtns[1].click();
    expect(chBtns[1].getAttribute('aria-selected')).toBe('true');
    expect(chSlides[1].getAttribute('data-active')).toBe('1');
    chDispose!();
    chDom.window.close();

    C.setCloudFormEndpoint('https://editor.test/forms/s');
    const spHtml = C.renderNode(C.N('slotpicker', {
      currencySymbol: '€',
      slots: [{ time: '06:30 Dawn' }, { time: '19:30 Nocturne' }],
      passes: [
        { passName: 'Contrast Circuit', unitPrice: '95', fixedTotal: 0 },
        { passName: 'Private Suite', unitPrice: '240', fixedTotal: 1 }
      ]
    }), { edit: false });
    const spDom = domFor(spHtml);
    const spWin = spDom.window as any;
    let spDispose: (() => void) | null = null;
    spWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { spDispose = fn; };
    spWin.eval(scriptBody(C.SLOTPICKER_JS));
    (spWin.document.querySelector('[data-sp-choice=guests] [data-sp-value="2"]') as HTMLElement).click();
    expect(spWin.document.querySelector('[data-sp-total]')?.textContent).toBe('€190');
    (spWin.document.querySelector('[data-sp-value="Private Suite"]') as HTMLElement).click();
    expect(spWin.document.querySelector('[data-sp-total]')?.textContent).toBe('€240');
    expect(spWin.document.querySelector('select[name=booking-service]').value).toBe('Private Suite');
    spDispose!();
    spDom.window.close();
    C.setCloudFormEndpoint('');
  });

  test('audit fixes: zero compare position, stable clock output, unique ids, honest prices and links', () => {
    const win = (html: string, js: string) => { const d = domFor(html); (d.window as any).eval(scriptBody(js)); return d; };

    const cmp = win(C.renderNode(C.N('compare', { position: '0' }), { edit: false }), C.COMPARE_JS);
    expect((cmp.window.document.querySelector('.pagecraft-compare') as HTMLElement).style.getPropertyValue('--cmp-pos')).toBe('0%');

    const clocks = C.N('clocks');
    const RealDate = globalThis.Date;
    const at = (iso: string) => class extends RealDate {
      constructor(...args: any[]) { args.length ? super(...args as [any]) : super(iso); }
      static now() { return new RealDate(iso).getTime(); }
    } as any;
    const build = (iso: string) => { globalThis.Date = at(iso); try { return C.renderNode(clocks, { edit: false }); } finally { globalThis.Date = RealDate; } };
    expect(build('2026-11-25T03:00:00Z')).toBe(build('2026-11-25T19:30:00Z'));

    const overnight = (iso: string) => {
      const d = domFor(C.renderNode(C.N('clocks', { opens: '22', closes: '6', openLabel: 'Open', closedLabel: 'Closed', items: [{ city: 'UTC', tz: 'UTC' }] }), { edit: false }));
      const w = d.window as any, WD = w.Date;
      w.Date = class extends WD { constructor(...args: any[]) { args.length ? super(...args) : super(iso); } };
      w.Intl = { DateTimeFormat: Intl.DateTimeFormat };
      w.eval(scriptBody(C.CLOCKS_JS));
      const state = w.document.querySelector('[data-clocks-state]');
      const result = [state.hidden, state.textContent];
      w.close();
      return result;
    };
    expect(overnight('2026-11-25T23:00:00Z')).toEqual([false, 'Open']);      // Wednesday night
    expect(overnight('2026-11-28T03:00:00Z')).toEqual([false, 'Open']);      // Friday's shift, Saturday 3 am
    expect(overnight('2026-11-30T03:00:00Z')).toEqual([false, 'Closed']);    // Sunday's shift, Monday 3 am
    expect(overnight('2026-11-25T12:00:00Z')).toEqual([false, 'Closed']);

    for (const type of ['roster', 'qapills', 'chapters', 'typemask', 'dragstrip'] as const) {
      const node = C.N(type);
      node.adv = { ...(node.adv || {}), htmlId: 'team' } as any;
      const html = C.renderNode(node, { edit: false });
      expect(html).toContain('id="team-');
      const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
      expect(new Set(ids).size).toBe(ids.length);
    }

    const noEuro = C.renderNode(C.N('tiers', { defaultCurrency: 'usd', items: [{ tierName: 'A', priceUsd: '$10', priceGbp: '£8' }, { tierName: 'B', priceUsd: '$20', priceGbp: '£16', priceEur: '€18' }] }), { edit: false });
    expect(noEuro).not.toContain('data-tiers-cur="eur"');
    expect(noEuro).toContain('data-tiers-cur="gbp"');
    expect(noEuro).not.toContain('href="#"');

    C.setCloudFormEndpoint('https://editor.test/forms/s');
    const sp = win(C.renderNode(C.N('slotpicker', { currencySymbol: '$', passes: [{ passName: 'A', unitPrice: '95.25' }] }), { edit: false }), C.SLOTPICKER_JS);
    expect(sp.window.document.querySelector('[data-sp-total]')?.textContent).toBe('$95.25');
    (sp.window.document.querySelector('[data-sp-choice=guests] [data-sp-value="2"]') as HTMLElement).click();
    expect(sp.window.document.querySelector('[data-sp-total]')?.textContent).toBe('$190.50');
    C.setCloudFormEndpoint('');

    // Words that were fixed in the code stay for documents that predate the controls.
    expect(C.renderNode({ ...C.N('roster'), props: { items: [{ name: 'A', seat: 'DC', credential: 'X' }] } } as any, { edit: false })).toContain('Chambers:');
    expect(C.renderNode(C.N('roster'), { edit: false })).not.toContain('Chambers');
  });

  test('audit fixes: chapters hold while focused and can be paused', async () => {
    const d = domFor(C.renderNode(C.N('chapters', { autoSeconds: '0.05' }), { edit: false }));
    const w = d.window as any;
    w.eval(scriptBody(C.CHAPTERS_JS));
    const active = () => [...w.document.querySelectorAll('[data-ch-slide]')].findIndex((s: any) => s.dataset.active === '1');
    const wait = (ms: number) => new Promise(done => setTimeout(done, ms));
    const pause = w.document.querySelector('[data-ch-pause]');
    expect(pause.hidden).toBe(false);
    pause.click();
    const held = active();
    await wait(180);
    expect(active()).toBe(held);
    pause.click();
    const button = w.document.querySelector('[data-ch-btn]');
    button.focus();
    const focused = active();
    await wait(180);
    expect(active()).toBe(focused);
    button.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(active()).toBe(2);
    w.close();
  });

  test('typemask, fullmenu, swatchshop, snaprail and scrollsteps render neutral defaults and run interactively', () => {
    for (const type of ['typemask', 'fullmenu', 'swatchshop', 'snaprail', 'scrollsteps'] as const) {
      const starter = C.renderNode(C.N(type), { edit: false });
      expect(starter).not.toMatch(/SKARVEN|Tromsø|Lyngen|Røst/);
    }

    const swpHtml = C.renderNode(C.N('swatchshop', {
      products: [{
        prodName: 'Storm Shell', prodPrice: '$420', prodSpec: '310 g',
        c1Name: 'Obsidian', c1Hex: '#1D2421', c1Src: 'https://example.test/s1.webp',
        c2Name: 'Spruce', c2Hex: '#145C3E', c2Src: 'https://example.test/s2.webp',
        href: ''
      }]
    }), { edit: false });
    expect(swpHtml).not.toContain('href="#"');
    const swpDom = domFor(swpHtml);
    const swpWin = swpDom.window as any;
    let swpDispose: (() => void) | null = null;
    swpWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { swpDispose = fn; };
    swpWin.eval(scriptBody(C.SWATCHSHOP_JS));
    const dots = swpWin.document.querySelectorAll('.pagecraft-swatch-dot');
    (dots[1] as HTMLElement).click();
    expect(swpWin.document.querySelector('.pagecraft-swatch-img')?.getAttribute('src')).toBe('https://example.test/s2.webp');
    expect(swpWin.document.querySelector('[data-swp-active]')?.textContent).toBe('Spruce · 310 g');
    swpDispose!();
    swpDom.window.close();

    const fmDom = domFor(C.renderNode(C.N('fullmenu', {
      menuItems: [
        { label: 'Overview', href: 'index.html', src: 'https://example.test/m1.webp' },
        { label: 'Catalog', href: 'shells.html', src: 'https://example.test/m2.webp' }
      ]
    }), { edit: false }));
    const fmWin = fmDom.window as any;
    let fmDispose: (() => void) | null = null;
    fmWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { fmDispose = fn; };
    fmWin.eval(scriptBody(C.FULLMENU_JS));
    (fmWin.document.querySelector('.pagecraft-fullmenu-btn') as HTMLElement).click();
    expect(fmWin.document.querySelector('.pagecraft-fullmenu-dlg')?.getAttribute('data-open')).toBe('1');
    expect(fmWin.document.documentElement.style.overflow).toBe('');
    fmWin.document.querySelectorAll('.pagecraft-fullmenu-link')[1].dispatchEvent(new fmWin.Event('mouseenter'));
    expect(fmWin.document.querySelector('[data-fm-plate="1"]')?.getAttribute('data-active')).toBe('1');
    fmDispose!();
    fmDom.window.close();

    const ssDom = domFor(C.renderNode(C.N('scrollsteps'), { edit: false }));
    const ssWin = ssDom.window as any;
    ssWin.eval(scriptBody(C.SCROLLSTEPS_JS));
    const stepItems = ssWin.document.querySelectorAll('.pagecraft-scrollsteps-item');
    stepItems[2].dispatchEvent(new ssWin.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(stepItems[2].getAttribute('data-active')).toBe('1');
    ssDom.window.close();

    const dsDom = domFor(C.renderNode(C.N('dragstrip'), { edit: false }));
    const dsWin = dsDom.window as any;
    let dsDispose: (() => void) | null = null;
    dsWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { dsDispose = fn; };
    dsWin.eval(scriptBody(C.DRAGSTRIP_JS));
    expect(dsWin.document.querySelector('[data-ds-track]')?.getAttribute('aria-valuenow')).toBe('0');
    dsDispose!();
    dsDom.window.close();

    const sfDom = domFor(C.renderNode(C.N('stayfilter', {
      currencySymbol: '€', defaultGuests: '2', maxGuests: '8', singularLabel: 'villa', unitLabel: 'villas',
      stays: [
        { stayName: 'Cove Suite', sleeps: '2', lowRate: '380', midRate: '490', highRate: '640' },
        { stayName: 'Cliff House', sleeps: '6', lowRate: '620', midRate: '790', highRate: '980' }
      ]
    }), { edit: false }));
    const sfWin = sfDom.window as any;
    let sfDispose: (() => void) | null = null;
    sfWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { sfDispose = fn; };
    sfWin.eval(scriptBody(C.STAYFILTER_JS));
    expect(sfWin.document.querySelector('[data-sf-result]')?.textContent).toBe('2 villas');
    (sfWin.document.querySelectorAll('[data-sf-step]')[1] as HTMLElement).click();
    expect(sfWin.document.querySelector('[data-sf-guests]')?.textContent).toBe('3');
    expect(sfWin.document.querySelector('[data-sf-result]')?.textContent).toBe('1 villa');
    (sfWin.document.querySelector('[data-sf-season="high"]') as HTMLElement).click();
    expect(sfWin.document.querySelectorAll('[data-sf-price]')[1]?.textContent).toBe('€980');
    sfDispose!();
    sfDom.window.close();

    const rcDom = domFor(C.renderNode(C.N('roicalc', {
      slider1Value: '10', slider2Value: '200', baseFactor: '1000', savingsPct: '30', co2Factor: '4', currencySymbol: '€'
    }), { edit: false }));
    const rcWin = rcDom.window as any;
    let rcDispose: (() => void) | null = null;
    rcWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { rcDispose = fn; };
    rcWin.eval(scriptBody(C.ROICALC_JS));
    expect(rcWin.document.querySelector('[data-rc-savings]')?.textContent).toBe('€600,000');
    const rcIn1 = rcWin.document.querySelector('[data-rc-in="1"]') as HTMLInputElement;
    rcIn1.value = '20';
    rcIn1.dispatchEvent(new rcWin.Event('input', { bubbles: true }));
    expect(rcWin.document.querySelector('[data-rc-savings]')?.textContent).toBe('€1,200,000');
    rcDispose!();
    rcDom.window.close();

    const scHtml = C.renderNode(C.N('stackcards'), { edit: false });
    expect(scHtml).toContain('pagecraft-stackcards');
    expect(scHtml).toContain('--sc-i:1');

    const sbDom = domFor(C.renderNode(C.N('showbill'), { edit: false }));
    const sbWin = sbDom.window as any;
    let sbDispose: (() => void) | null = null;
    sbWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { sbDispose = fn; };
    sbWin.eval(scriptBody(C.SHOWBILL_JS));
    (sbWin.document.querySelector('[data-sb-filter="Vault B2"]') as HTMLElement).click();
    expect((sbWin.document.querySelector('[data-sb-room="Turbine Hall"]') as HTMLElement).hidden).toBe(true);
    expect((sbWin.document.querySelector('[data-sb-room="Vault B2"]') as HTMLElement).hidden).toBe(false);
    sbDispose!();
    sbDom.window.close();

    const msDom = domFor(C.renderNode(C.N('masonry'), { edit: false }));
    const msWin = msDom.window as any;
    let msDispose: (() => void) | null = null;
    msWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { msDispose = fn; };
    msWin.eval(scriptBody(C.MASONRY_JS));
    (msWin.document.querySelector('[data-ms-open="1"]') as HTMLElement).click();
    expect(msWin.document.querySelector('.pagecraft-masonry-dlg')?.getAttribute('data-open')).toBe('1');
    expect(msWin.document.querySelector('[data-ms-dtitle]')?.textContent).toContain('SUB-015');
    msDispose!();
    msDom.window.close();

    const mlDom = domFor(C.renderNode(C.N('maplist'), { edit: false }));
    const mlWin = mlDom.window as any;
    let mlDispose: (() => void) | null = null;
    mlWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { mlDispose = fn; };
    mlWin.eval(scriptBody(C.MAPLIST_JS));
    (mlWin.document.querySelector('[data-ml-pin="1"]') as HTMLElement).click();
    expect(mlWin.document.querySelector('[data-ml-pick="1"]')?.getAttribute('data-selected')).toBe('1');
    expect(mlWin.document.querySelector('[data-ml-pick="0"]')?.getAttribute('data-selected')).toBe('0');
    expect(mlWin.document.querySelector('[data-ml-active-title]')?.textContent).toContain('Lockkeeper');
    mlDispose!();
    mlDom.window.close();

    const tvDom = domFor(C.renderNode(C.N('thumbviewer'), { edit: false }));
    const tvWin = tvDom.window as any;
    let tvDispose: (() => void) | null = null;
    tvWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { tvDispose = fn; };
    tvWin.eval(scriptBody(C.THUMBVIEWER_JS));
    (tvWin.document.querySelector('[data-tv-next]') as HTMLElement).click();
    expect(tvWin.document.querySelector('[data-tv-count]')?.textContent).toBe('02 / 02');
    expect(tvWin.document.querySelector('[data-tv-thumb="1"]')?.getAttribute('data-active')).toBe('1');
    expect(tvWin.document.querySelector('[data-tv-title]')?.textContent).toContain('Kitchen');
    tvDispose!();
    tvDom.window.close();

    const fsDom = domFor(C.renderNode(C.N('financeswitch'), { edit: false }));
    const fsWin = fsDom.window as any;
    let fsDispose: (() => void) | null = null;
    fsWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { fsDispose = fn; };
    fsWin.eval(scriptBody(C.FINANCESWITCH_JS));
    expect(fsWin.document.querySelector('[data-fs-price]')?.textContent).toContain('/ mo');
    (fsWin.document.querySelector('[data-fs-mode="cash"]') as HTMLElement).click();
    expect(fsWin.document.querySelector('[data-financeswitch]')?.getAttribute('data-fs-active')).toBe('cash');
    expect(fsWin.document.querySelector('[data-fs-mode="cash"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(fsWin.document.querySelector('[data-fs-price]')?.textContent).toBe('€56,900');
    fsDispose!();
    fsDom.window.close();

    const rsDom = domFor(C.renderNode(C.N('rangeslider'), { edit: false }));
    const rsWin = rsDom.window as any;
    let rsDispose: (() => void) | null = null;
    rsWin.__pagecraftRegisterPreviewDispose = (fn: () => void) => { rsDispose = fn; };
    rsWin.eval(scriptBody(C.RANGESLIDER_JS));
    const rsRangeBefore = rsWin.document.querySelector('[data-rs-range]')?.textContent;
    const rsInput = rsWin.document.querySelector('[data-rs-temp]') as HTMLInputElement;
    rsInput.value = '-25';
    rsInput.dispatchEvent(new rsWin.Event('input', { bubbles: true }));
    expect(rsWin.document.querySelector('[data-rs-temp-out]')?.textContent).toBe('-25°C');
    const rsAfterCold = parseInt(rsWin.document.querySelector('[data-rs-range]')?.textContent || '0', 10);
    expect(rsAfterCold).toBeLessThan(parseInt(rsRangeBefore || '0', 10));
    const wheels = rsWin.document.querySelectorAll('[data-rs-wheel]');
    (wheels[2] as HTMLElement).click();
    expect(parseInt(rsWin.document.querySelector('[data-rs-range]')?.textContent || '0', 10)).toBeLessThan(rsAfterCold);
    rsDispose!();
    rsDom.window.close();
  });
});
