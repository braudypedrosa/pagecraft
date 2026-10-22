import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Finding } from '../app/src/core/types';

const videoFindings = () => C.lint().filter((finding: Finding) =>
  ['video-no-source', 'video-invalid-source', 'eager-video'].includes(finding.code));

beforeEach(() => {
  C.blankProject('Video lint');
  C.ensureTokens();
  C.state.header = [];
  C.state.footer = [];
  C.state.meta.components = [];
});

test('invalid, empty and corrected page video sources produce one actionable finding', () => {
  const video = C.N('video', { src: 'not a video', facade: 1, autoplay: 0 });
  C.state.pages[0].tree = [C.N('section', {}, {}, [video])];

  expect(videoFindings()).toMatchObject([{
    level: 'error', code: 'video-invalid-source', nodeId: video.id,
    target: { pageId: C.state.pages[0].id, scope: 'page', nodeId: video.id },
  }]);

  video.props.src = '';
  expect(videoFindings()).toMatchObject([{
    level: 'warn', code: 'video-no-source', nodeId: video.id,
  }]);

  video.props.src = 'https://cdn.example.com/video/launch.mp4';
  expect(videoFindings()).toEqual([]);
});

test('empty and invalid video placeholders use WordPress-safe physical edges', () => {
  for (const src of ['', 'not a video']) {
    const html = C.vid({ src });
    expect(html).toContain('position:absolute;top:0;right:0;bottom:0;left:0;display:flex');
    expect(html).not.toContain('inset:0');
  }
});

test('valid providers, custom HTTP embeds and relative files keep the eager warning contract', () => {
  const video = C.N('video', { facade: 1, autoplay: 0 });
  C.state.pages[0].tree = [video];
  for (const src of [
    'https://youtube.com/watch?v=aqz-KE-bpKQ',
    'https://vimeo.com/123456',
    'https://player.example.com/embed/42',
    '/media/launch.webm',
  ]) {
    video.props.src = src;
    expect(videoFindings()).toEqual([]);
  }

  video.props.src = 'https://youtube.com/watch?v=aqz-KE-bpKQ';
  video.props.facade = 0;
  expect(videoFindings()).toMatchObject([{
    level: 'warn', code: 'eager-video', nodeId: video.id,
  }]);
});

test('global video findings retain the real node and header scope', () => {
  const video = C.N('video', { src: 'not a video' });
  C.state.header = [video];

  expect(videoFindings()).toMatchObject([{
    level: 'error', code: 'video-invalid-source', nodeId: video.id,
    target: { pageId: C.state.pages[0].id, scope: 'header', nodeId: video.id },
  }]);
});

test('collection-bound videos lint rendered row values instead of the authored fallback', () => {
  const collection = C.collectionAdd('Sessions');
  const source = C.fieldAdd(collection.id, 'Video', 'text')!;
  const add = (title: string, src: string) => {
    const item = C.itemAdd(collection.id)!;
    C.itemSet(collection.id, item.id, 'title', title);
    C.itemSet(collection.id, item.id, source.id, src);
    return item;
  };
  add('Valid session', 'https://cdn.example.com/session.mp4');
  const invalid = add('Invalid session', 'not a video');
  const empty = add('Empty session', '');
  const video = C.N('video', { src: 'javascript:alert(1)', facade: 1, autoplay: 0 });
  C.bindSet(video, 'src', C.bindField(source.id));
  const list = C.N('list', {}, {}, [C.N('column', {}, {}, [video])]);
  C.srcSet(list, collection.id);
  C.state.pages[0].tree = [list];

  const findings = videoFindings();
  expect(findings).toHaveLength(2);
  const invalidFinding = findings.find(finding => finding.code === 'video-invalid-source')!;
  expect(invalidFinding.msg).toContain('Invalid session');
  expect(invalidFinding.msg).not.toContain('Valid session');
  expect(invalidFinding.target?.repeatPath).toEqual([
    { collectionId: collection.id, itemId: invalid.id },
  ]);
  const emptyFinding = findings.find(finding => finding.code === 'video-no-source')!;
  expect(emptyFinding.msg).toContain('Empty session');
  expect(emptyFinding.target?.repeatPath).toEqual([
    { collectionId: collection.id, itemId: empty.id },
  ]);
});

test('component property and CMS overrides replace an invalid definition source', () => {
  const definitionVideo = C.N('video', { src: 'not a video', facade: 1, autoplay: 0 });
  C.bindSet(definitionVideo, 'src', { src: 'prop', path: 'media' });
  C.state.meta.components!.push({
    id: 'feature-video', name: 'Feature video', node: definitionVideo,
    props: [{ k: 'media', label: 'Media', t: 'text', def: 'not a video' }],
  });

  const validInstance = C.N('video');
  validInstance.use = 'feature-video';
  validInstance.vals = { media: 'https://player.example.com/embed/valid' };
  const invalidInstance = C.N('video');
  invalidInstance.use = 'feature-video';
  invalidInstance.vals = { media: 'still not a video' };
  C.state.pages[0].tree = [validInstance, invalidInstance];

  let findings = videoFindings();
  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    code: 'video-invalid-source', nodeId: invalidInstance.id,
    target: { nodeId: invalidInstance.id },
  });

  const collection = C.collectionAdd('Features');
  const source = C.fieldAdd(collection.id, 'Video', 'text')!;
  const valid = C.itemAdd(collection.id)!;
  C.itemSet(collection.id, valid.id, 'title', 'Valid feature');
  C.itemSet(collection.id, valid.id, source.id, '/media/feature.mp4');
  const invalid = C.itemAdd(collection.id)!;
  C.itemSet(collection.id, invalid.id, 'title', 'Invalid feature');
  C.itemSet(collection.id, invalid.id, source.id, 'bad source');
  const boundInstance = C.N('video');
  boundInstance.use = 'feature-video';
  C.bindSet(boundInstance, C.VAL + 'media', C.bindField(source.id));
  const list = C.N('list', {}, {}, [boundInstance]);
  C.srcSet(list, collection.id);
  C.state.pages[0].tree = [list];

  findings = videoFindings();
  expect(findings).toHaveLength(1);
  expect(findings[0].nodeId).toBe(boundInstance.id);
  expect(findings[0].msg).toContain('Invalid feature');
  expect(findings[0].msg).not.toContain('Valid feature');
});
