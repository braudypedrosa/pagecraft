import { describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Control, Node as PcNode } from '../app/src/core/types';

const control = (key: string) => C.DEF.video.controls.content.find(
  (candidate: Control) => candidate.k === key,
)!;
const visible = (candidate: Control, node: PcNode) => !candidate.when || candidate.when(node);

describe('Video control applicability', () => {
  test.each([
    'https://www.youtube.com/watch?feature=shared&v=aqz-KE-bpKQ',
    'https://www.youtube.com/shorts/aqz-KE-bpKQ',
    'https://youtu.be/aqz-KE-bpKQ',
    'https://m.youtube.com/watch?v=aqz-KE-bpKQ',
    'https://music.youtube.com/watch?v=aqz-KE-bpKQ',
  ])('recognizes supported YouTube URL forms regardless of query order: %s', src => {
    expect(C.vidSrc({ src })).toEqual({ kind: 'youtube', id: 'aqz-KE-bpKQ' });
    expect(C.vid({ src })).toContain('https://www.youtube.com/embed/aqz-KE-bpKQ');
  });

  test.each([
    'https://vimeo.com/123456',
    'https://player.vimeo.com/video/123456',
  ])('recognizes supported Vimeo URL forms: %s', src => {
    expect(C.vidSrc({ src })).toEqual({ kind: 'vimeo', id: '123456' });
    expect(C.vid({ src })).toContain('https://player.vimeo.com/video/123456');
  });

  test.each([
    'https://youtube.com.example.test/watch?v=aqz-KE-bpKQ',
    'https://vimeo.com.example.test/123456',
    'https://www.youtube.com/watch?feature=shared',
    'https://youtu.be/short',
  ])('does not recognize malformed or lookalike provider URLs: %s', src => {
    expect(C.vidSrc({ src }).kind).toBe('other');
    expect(C.vid({ src })).toContain(`src="${src}"`);
    expect(C.vid({ src })).not.toContain('youtube.com/embed');
    expect(C.vid({ src })).not.toContain('player.vimeo.com/video');
  });

  test('preserves privacy-enhanced YouTube embeds on their authored host', () => {
    const src = 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?rel=0';

    expect(C.vidSrc({ src })).toEqual({ kind: 'other', id: src });
    expect(C.vid({ src })).toBe(
      '<iframe src="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?rel=0" title="Video" allowfullscreen loading="lazy"></iframe>',
    );
  });

  test('query-reordered YouTube URLs receive the same facade as canonical watch URLs', () => {
    const video = C.N('video', {
      src: 'https://www.youtube.com/watch?feature=shared&v=aqz-KE-bpKQ',
      facade: 1,
      autoplay: 0,
    });

    expect(visible(control('facade'), video)).toBe(true);
    expect(C.renderNode(video, { edit: false })).toContain('data-facade');
    expect(C.renderNode(video, { edit: false })).toContain('data-embed="https://www.youtube.com/embed/aqz-KE-bpKQ?');
  });

  test('canonical provider markup keeps its established parameters and byte order', () => {
    const props = {
      autoplay: 1,
      muted: 0,
      loop: 1,
      controls: 0,
    };

    expect(C.vid({ ...props, src: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' })).toBe(
      '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1&amp;mute=1&amp;muted=1&amp;loop=1&amp;controls=0&amp;playlist=aqz-KE-bpKQ" title="Video" allow="accelerometer;autoplay;clipboard-write;encrypted-media;picture-in-picture" allowfullscreen loading="lazy"></iframe>',
    );
    expect(C.vid({ ...props, src: 'https://vimeo.com/123456' })).toBe(
      '<iframe src="https://player.vimeo.com/video/123456?autoplay=1&amp;mute=1&amp;muted=1&amp;loop=1&amp;controls=0" title="Video" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen loading="lazy"></iframe>',
    );
  });

  test('file, data, empty, and generic sources preserve their existing render paths', () => {
    expect(C.vid({ src: 'https://cdn.example.com/clip.mp4', controls: 1 })).toBe(
      '<video src="https://cdn.example.com/clip.mp4" controls></video>',
    );
    expect(C.vid({ src: 'data:video/mp4;base64,AAAA', muted: 1 })).toBe(
      '<video src="data:video/mp4;base64,AAAA" muted playsinline></video>',
    );
    expect(C.vid({ src: '' })).toContain('Add a video URL');
    expect(C.vid({ src: 'https://example.com/player?a=1&b=2' })).toBe(
      '<iframe src="https://example.com/player?a=1&amp;b=2" title="Video" allowfullscreen loading="lazy"></iframe>',
    );
  });

  test('Load player on click appears only for non-autoplay YouTube and Vimeo sources', () => {
    const facade = control('facade');

    expect(visible(facade, C.N('video', { src: 'https://youtube.com/watch?v=aqz-KE-bpKQ', autoplay: 0 }))).toBe(true);
    expect(visible(facade, C.N('video', { src: 'https://vimeo.com/76979871', autoplay: 0 }))).toBe(true);
    expect(visible(facade, C.N('video', { src: 'https://cdn.example.com/clip.mp4', autoplay: 0 }))).toBe(false);
    expect(visible(facade, C.N('video', { src: 'https://example.com/player', autoplay: 0 }))).toBe(false);
    expect(visible(facade, C.N('video', { src: '', autoplay: 0 }))).toBe(false);
    expect(visible(facade, C.N('video', { src: 'https://youtube.com/watch?v=aqz-KE-bpKQ', autoplay: 1 }))).toBe(false);
  });

  test('Autoplay explains forced silence and hides the ineffective Muted setting', () => {
    const autoplay = control('autoplay');
    const muted = control('muted');
    const video = C.N('video', { autoplay: 0 });

    expect(autoplay.note).toBe('Autoplay videos play without sound.');
    expect(visible(muted, video)).toBe(true);
    video.props.autoplay = 1;
    expect(visible(muted, video)).toBe(false);
  });

  test('autoplay changes effective output without overwriting stored facade or muted preferences', () => {
    const facade = control('facade');
    const muted = control('muted');
    const video = C.N('video', {
      src: 'https://youtube.com/watch?v=aqz-KE-bpKQ',
      autoplay: 0,
      facade: 1,
      muted: 0,
    });

    expect(visible(facade, video)).toBe(true);
    expect(visible(muted, video)).toBe(true);
    expect(C.renderNode(video, { edit: false })).toContain('data-facade');

    video.props.autoplay = 1;
    expect(visible(facade, video)).toBe(false);
    expect(visible(muted, video)).toBe(false);
    expect(video.props.facade).toBe(1);
    expect(video.props.muted).toBe(0);
    const autoplayHtml = C.renderNode(video, { edit: false });
    expect(autoplayHtml).not.toContain('data-facade');
    expect(autoplayHtml).toContain('autoplay=1&amp;mute=1&amp;muted=1');

    video.props.autoplay = 0;
    expect(visible(facade, video)).toBe(true);
    expect(visible(muted, video)).toBe(true);
    expect(video.props.facade).toBe(1);
    expect(video.props.muted).toBe(0);
    expect(C.renderNode(video, { edit: false })).toContain('data-facade');
  });

  test('an MP4 remains eagerly rendered while its inapplicable facade preference is hidden', () => {
    const video = C.N('video', {
      src: 'https://cdn.example.com/clip.mp4',
      facade: 1,
      autoplay: 0,
    });

    expect(visible(control('facade'), video)).toBe(false);
    expect(C.canFacade(video.props)).toBe(false);
    expect(C.renderNode(video, { edit: false })).toContain('<video src="https://cdn.example.com/clip.mp4"');
    expect(video.props.facade).toBe(1);
  });
});
