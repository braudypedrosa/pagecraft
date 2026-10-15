import { beforeEach, describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Item } from '../app/src/core/types';

const reset = () => {
  C.blankProject('Partial CMS reference import');
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.meta.collections = [];
  C.hist.u.length = 0;
  C.hist.r.length = 0;
};

beforeEach(reset);

describe('partial CMS reference imports', () => {
  test('unresolved external references preserve updated rows and stay absent from new rows', () => {
    const authors = C.collectionAdd('Authors');
    const keptAuthor = C.itemAdd(authors.id)!;
    const authorTitle = C.titleField(authors)!;
    C.itemSet(authors.id, keptAuthor.id, authorTitle.id, 'Kept author');

    const posts = C.collectionAdd('Posts');
    const postTitle = C.titleField(posts)!;
    const author = C.fieldAdd(posts.id, 'Author', 'ref')!;
    author.ref = authors.id;
    const existing = C.itemAdd(posts.id)!;
    C.itemSet(posts.id, existing.id, postTitle.id, 'Existing post');
    C.itemSet(posts.id, existing.id, author.id, keptAuthor.id);

    const report = C.contentImport({
      collections: [{
        id: posts.id,
        name: posts.name,
        slug: posts.slug,
        fields: [
          { id: postTitle.id, name: postTitle.name, type: postTitle.type },
          { id: author.id, name: author.name, type: author.type, ref: 'source-authors' },
        ],
        items: [
          {
            id: 'source-existing-post',
            slug: existing.slug,
            values: { [postTitle.id]: 'Updated post', [author.id]: 'missing-author-one' },
          },
          {
            id: 'source-new-post',
            slug: 'new-post',
            values: { [postTitle.id]: 'New post', [author.id]: 'missing-author-two' },
          },
        ],
      }],
    })!;

    expect(existing.values[postTitle.id]).toBe('Updated post');
    expect(existing.values[author.id]).toBe(keptAuthor.id);
    const created = posts.items.find((item: Item) => item.slug === 'new-post')!;
    expect(Object.prototype.hasOwnProperty.call(created.values, author.id)).toBe(false);
    expect(report.notes.some(note => /Author.*skipped 2 unresolved reference values/i.test(note))).toBe(true);
  });

  test('external reference fields accept exact existing ids and skip only unresolved values', () => {
    const people = C.collectionAdd('People');
    const person = C.itemAdd(people.id)!;
    C.itemSet(people.id, person.id, C.titleField(people)!.id, 'Ada');
    const topics = C.collectionAdd('Topics');
    const topic = C.itemAdd(topics.id)!;
    C.itemSet(topics.id, topic.id, C.titleField(topics)!.id, 'Computing');

    const posts = C.collectionAdd('Posts');
    const postTitle = C.titleField(posts)!;
    const author = C.fieldAdd(posts.id, 'Author', 'ref')!;
    const subject = C.fieldAdd(posts.id, 'Subject', 'ref')!;
    author.ref = people.id;
    subject.ref = topics.id;

    const report = C.contentImport({
      collections: [{
        id: posts.id,
        name: posts.name,
        slug: posts.slug,
        fields: [
          { id: postTitle.id, name: postTitle.name, type: postTitle.type },
          { id: author.id, name: author.name, type: author.type, ref: 'source-people' },
          { id: subject.id, name: subject.name, type: subject.type, ref: 'source-topics' },
        ],
        items: [
          {
            id: 'source-post',
            slug: 'source-post',
            values: {
              [postTitle.id]: 'Source post',
              [author.id]: person.id,
              [subject.id]: topic.id,
            },
          },
          {
            id: 'second-source-post',
            slug: 'second-source-post',
            values: {
              [postTitle.id]: 'Second source post',
              [author.id]: person.id,
              [subject.id]: 'missing-topic',
            },
          },
        ],
      }],
    })!;

    expect(posts.items[0].values[author.id]).toBe(person.id);
    expect(posts.items[0].values[subject.id]).toBe(topic.id);
    expect(posts.items[1].values[author.id]).toBe(person.id);
    expect(Object.prototype.hasOwnProperty.call(posts.items[1].values, subject.id)).toBe(false);
    expect(report.notes.some(note => /Subject.*skipped 1 unresolved reference value/i.test(note))).toBe(true);
    expect(report.notes.some(note => /Author.*skipped/i.test(note))).toBe(false);
  });

  test('included target collections still remap imported reference ids', () => {
    const authors = C.collectionAdd('Authors');
    const localAuthor = C.itemAdd(authors.id)!;
    C.itemSet(authors.id, localAuthor.id, C.titleField(authors)!.id, 'Local Ada');
    localAuthor.slug = 'ada';
    const posts = C.collectionAdd('Posts');
    const author = C.fieldAdd(posts.id, 'Author', 'ref')!;
    author.ref = authors.id;

    C.contentImport({
      collections: [
        {
          id: 'source-posts', name: posts.name, slug: posts.slug,
          fields: [{ id: author.id, name: author.name, type: author.type, ref: 'source-authors' }],
          items: [{ id: 'source-post', slug: 'source-post', values: { [author.id]: 'source-author' } }],
        },
        {
          id: 'source-authors', name: authors.name, slug: authors.slug,
          fields: [{ id: 'title', name: 'Title', type: 'text' }],
          items: [{ id: 'source-author', slug: 'ada', values: { title: 'Imported Ada' } }],
        },
      ],
    });

    expect(posts.items[0].values[author.id]).toBe(localAuthor.id);
  });
});
