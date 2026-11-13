import { afterEach, test } from 'vitest';
import a from 'node:assert/strict';
import { chmod, mkdtemp, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CrmStoreError,
  FileFounderCrmStore,
  validateCrmContactInput,
} from '../src/founder-crm-store.ts';
import type { CrmContactInput } from '../src/founder-crm-types.ts';

const ACCOUNT_ID = '123e4567-e89b-42d3-a456-426614174000';
const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

const contact = (email: string, input: Partial<CrmContactInput> = {}): CrmContactInput => ({
  accountId: null,
  name: 'Example lead',
  email,
  company: '',
  stage: 'lead',
  source: 'direct',
  notes: '',
  followUpOn: null,
  isTest: false,
  ...input,
});

test('contact validation normalizes email and rejects malformed identifiers, dates, stages and flags', () => {
  a.equal(validateCrmContactInput(contact(' Person@Example.Test ')).email, 'person@example.test');
  a.equal(validateCrmContactInput(contact('linked@example.test', { accountId: ACCOUNT_ID, name: '' })).name, '');
  for (const input of [
    contact('not-an-email'),
    contact('a@example.test', { accountId: 'not-a-uuid' }),
    contact('a@example.test', { followUpOn: '2026-02-30' }),
    contact('a@example.test', { stage: 'won' as 'lead' }),
    contact('a@example.test', { isTest: undefined as unknown as boolean }),
  ]) {
    a.throws(() => validateCrmContactInput(input), (error: unknown) =>
      error instanceof CrmStoreError && error.code === 'invalid' && !error.message.includes('/'));
  }
});

test('file store is private, atomic across instances, deduplicated and revision-safe', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-founder-crm-'));
  roots.push(root);
  const filename = join(root, 'private', 'contacts.json');
  const first = new FileFounderCrmStore(filename);
  const second = new FileFounderCrmStore(filename);
  const made = await Promise.all(Array.from({ length: 24 }, (_, index) =>
    (index % 2 ? first : second).put(contact(`lead-${index}@example.test`))));
  a.equal(made.length, 24);
  a.equal((await first.list()).length, 24);
  a.equal((await stat(filename)).mode & 0o777, 0o600);
  a.equal((await stat(join(root, 'private'))).mode & 0o777, 0o700);

  await a.rejects(
    second.put(contact('LEAD-0@example.test')),
    (error: unknown) => error instanceof CrmStoreError && error.code === 'duplicate',
  );
  const linked = await first.put(contact('linked@example.test', { accountId: ACCOUNT_ID }));
  await a.rejects(
    second.put(contact('other@example.test', { accountId: ACCOUNT_ID })),
    (error: unknown) => error instanceof CrmStoreError && error.code === 'duplicate',
  );

  const archived = await first.put({ ...linked, stage: 'archived', expectedRevision: linked.revision });
  a.equal(archived.stage, 'archived');
  a.equal(archived.revision, 2);
  await a.rejects(
    second.put({ ...linked, notes: 'stale edit', expectedRevision: linked.revision }),
    (error: unknown) => error instanceof CrmStoreError && error.code === 'conflict',
  );
  await a.rejects(
    second.put({ ...archived, accountId: null, expectedRevision: archived.revision }),
    (error: unknown) => error instanceof CrmStoreError && error.code === 'conflict',
  );
  await a.rejects(
    second.put({ ...archived, accountId: '123e4567-e89b-42d3-a456-426614174099', expectedRevision: archived.revision }),
    (error: unknown) => error instanceof CrmStoreError && error.code === 'conflict',
  );
  a.equal((await second.list()).find(row => row.id === linked.id)?.notes, '');
});

test('manual contact can link once to a matching account email but cannot link after changing email', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-founder-crm-link-'));
  roots.push(root);
  const store = new FileFounderCrmStore(join(root, 'contacts.json'));
  const manual = await store.put(contact('Match@Example.Test'));
  const linked = await store.put({
    ...manual,
    accountId: ACCOUNT_ID,
    email: 'match@example.test',
    expectedRevision: manual.revision,
  });
  a.equal(linked.accountId, ACCOUNT_ID);
  a.equal(linked.revision, 2);

  const second = await store.put(contact('other@example.test'));
  await a.rejects(
    store.put({
      ...second,
      accountId: '123e4567-e89b-42d3-a456-426614174098',
      email: 'different@example.test',
      expectedRevision: second.revision,
    }),
    (error: unknown) => error instanceof CrmStoreError && error.code === 'conflict',
  );
  a.equal((await store.list()).find(row => row.id === second.id)?.accountId, null);
});

test('file store refuses symlinks and files readable by group or other users', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-founder-crm-private-'));
  roots.push(root);
  const target = join(root, 'target.json');
  const targetStore = new FileFounderCrmStore(target);
  await targetStore.put(contact('private@example.test'));

  const link = join(root, 'contacts-link.json');
  await symlink(target, link);
  await a.rejects(
    new FileFounderCrmStore(link).list(),
    (error: unknown) => error instanceof CrmStoreError && error.code === 'invalid',
  );

  await chmod(target, 0o640);
  await a.rejects(
    targetStore.list(),
    (error: unknown) => error instanceof CrmStoreError && error.code === 'invalid',
  );
});
