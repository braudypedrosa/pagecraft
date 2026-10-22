import { expect, test } from 'vitest';
import * as C from '../app/src/core/index';

test.each([
  ['YouTube', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'youtube'],
  ['Vimeo', 'https://vimeo.com/123456', 'vimeo'],
  ['absolute MP4', 'https://cdn.example.com/media/clip.mp4?rev=2', 'file'],
  ['root-relative WebM', '/media/clip.webm#intro', 'file'],
  ['document-relative Ogg', '../media/clip.ogg', 'file'],
  ['encoded filename space', 'media/my%20clip.mp4', 'file'],
  ['Pagecraft asset', 'asset:video-123', 'file'],
  ['video data URL', 'data:video/mp4;base64,AAAA', 'file'],
  ['HTTPS custom player', 'https://player.example.com/embed/42?theme=dark', 'other'],
  ['HTTP custom player', 'http://player.example.test/embed/42', 'other'],
])('preserves the existing valid %s source contract', (_label, src, kind) => {
  expect(C.vidSrc({ src })).toMatchObject({ kind });
  const html = C.vid({ src, controls: 1 });
  expect(html).not.toContain('Unsupported video URL');
  expect(html).toMatch(/<(?:iframe|video)\b/i);
  if (kind === 'file' || kind === 'other') {
    expect(html).toContain(`src="${src.replace(/&/g, '&amp;')}"`);
  }
});

test.each([
  ['plain text', 'not a video'],
  ['protocol-relative embed', '//evil.example/player'],
  ['protocol-relative file', '//evil.example/clip.mp4'],
  ['backslash network path', String.raw`\\evil.example\clip.mp4`],
  ['backslash-slash network path', String.raw`\/evil.example/clip.mp4`],
  ['slash-backslash network path', String.raw`/\evil.example/clip.mp4`],
  ['JavaScript URL', 'javascript:alert(1)'],
  ['JavaScript disguised as a file', 'javascript:alert(1).mp4'],
  ['tab-normalized JavaScript scheme', 'java\tscript:alert(1).mp4'],
  ['newline-normalized JavaScript scheme', 'java\nscript:alert(1).mp4'],
  ['percent-encoded tab prefix', '%09javascript:alert(1).mp4'],
  ['percent-encoded newline prefix', '%0Ajavascript:alert(1).mp4'],
  ['VBScript URL', 'vbscript:msgbox(1)'],
  ['HTML data URL', 'data:text/html,<script>alert(1)</script>'],
  ['SVG data URL', 'data:image/svg+xml,<svg onload=alert(1)>'],
  ['credentialed embed', 'https://user:secret@example.com/player'],
  ['credentialed file', 'https://user:secret@example.com/clip.mp4'],
  ['FTP file', 'ftp://example.com/clip.mp4'],
  ['local file URL', 'file:///tmp/clip.mp4'],
  ['non-portable blob URL', 'blob:https://example.com/abcd'],
  ['unsupported source scheme', 'mailto:video@example.com'],
  ['malformed absolute URL', 'https://'],
])('rejects %s without echoing it into edit or public media markup', (_label, src) => {
  expect(C.vidSrc({ src })).toEqual({ kind: 'invalid', id: '' });
  expect(C.vid({ src })).toContain('Unsupported video URL');
  const node = C.N('video', { src, facade: 1, autoplay: 0 });

  for (const edit of [true, false]) {
    const html = C.renderNode(node, { edit });
    expect(html).toContain('Unsupported video URL');
    expect(html).not.toMatch(/<(?:iframe|video)\b/i);
    expect(html).not.toContain(src);
  }
  expect(node.props.src).toBe(src);
});

test('empty and invalid sources have distinct guidance while both avoid media requests', () => {
  expect(C.vidSrc({ src: '   ' })).toEqual({ kind: 'none', id: '' });
  expect(C.vid({ src: '   ' })).toContain('Add a video URL');
  expect(C.vid({ src: 'not a video' })).toContain('Unsupported video URL');
});
