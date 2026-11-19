import type postgres from "npm:postgres@3.4.7";

type Sql = postgres.Sql;
type Row = Record<string, unknown>;

/* Founder CRM contacts. The Node store validates every field first; this module owns the rules
   that need the current rows: optimistic revisions, the one-time account link, and uniqueness. */

const OPS = new Set(["crm.contacts.list", "crm.contacts.put", "crm.contacts.import"]);
export const isCrmOp = (op: string) => OPS.has(op);

const MAX_CONTACTS = 10_000;
const MAX_IMPORT = 2_000;
const STAGES = new Set(["lead", "contacted", "qualified", "customer", "archived"]);
const SOURCES = new Set(["unknown", "direct", "referral", "organic", "social", "paid", "other"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: unknown) => String(value ?? "");
const refuse = (message: string, code: string, status: number): never => {
  throw Object.assign(new Error(message), { status, code });
};
const invalid = (message: string) => refuse(message, "CRM_INVALID", 400);
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : new Date(text(value)).toISOString();

/* Columns are cast so both postgres.js and the test driver return plain strings for uuid and date. */
// deno-lint-ignore no-explicit-any
const listAll = (sql: any) => sql`
  select id::text as id, account_id, name, email, company, stage, source, notes,
    follow_up_on::text as follow_up_on, is_test, created_at, updated_at, revision
  from crm_contacts order by created_at, id
` as Promise<Row[]>;
// deno-lint-ignore no-explicit-any
const findOne = async (sql: any, id: string) => (await sql`
  select id::text as id, account_id, name, email, company, stage, source, notes,
    follow_up_on::text as follow_up_on, is_test, created_at, updated_at, revision
  from crm_contacts where id::text = ${id}
` as Row[])[0];

const wire = (row: Row) => ({
  id: text(row.id),
  accountId: row.account_id === null || row.account_id === undefined ? null : text(row.account_id),
  name: text(row.name),
  email: text(row.email),
  company: text(row.company),
  stage: text(row.stage),
  source: text(row.source),
  notes: text(row.notes),
  followUpOn: row.follow_up_on ? text(row.follow_up_on).slice(0, 10) : null,
  isTest: row.is_test === true,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  revision: Number(row.revision),
});

interface Fields {
  id?: string;
  accountId: string | null;
  name: string;
  email: string;
  company: string;
  stage: string;
  source: string;
  notes: string;
  followUpOn: string | null;
  isTest: boolean;
  expectedRevision?: number;
}

const fields = (raw: unknown): Fields => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) invalid("contact is invalid");
  const input = raw as Record<string, unknown>;
  const string = (key: string, max: number) => {
    if (typeof input[key] !== "string" || (input[key] as string).length > max) invalid(`${key} is invalid`);
    return input[key] as string;
  };
  const id = input.id === undefined ? undefined : string("id", 36);
  if (id !== undefined && !UUID.test(id)) invalid("id is invalid");
  const accountId = input.accountId === null ? null : string("accountId", 200);
  const email = string("email", 254);
  if (!email || email !== email.toLowerCase()) invalid("email is invalid");
  const stage = string("stage", 20), source = string("source", 20);
  if (!STAGES.has(stage)) invalid("stage is invalid");
  if (!SOURCES.has(source)) invalid("source is invalid");
  const followUpOn = input.followUpOn === null ? null : string("followUpOn", 10);
  if (followUpOn !== null && !DATE.test(followUpOn)) invalid("followUpOn is invalid");
  if (typeof input.isTest !== "boolean") invalid("isTest is invalid");
  const expected = input.expectedRevision;
  if (expected !== undefined && (!Number.isSafeInteger(expected) || (expected as number) < 1)) {
    invalid("expectedRevision is invalid");
  }
  return {
    ...(id === undefined ? {} : { id }),
    accountId, name: string("name", 120), email, company: string("company", 160), stage, source,
    notes: string("notes", 5_000), followUpOn, isTest: input.isTest as boolean,
    ...(expected === undefined ? {} : { expectedRevision: expected as number }),
  };
};

export async function dispatchCrm(sql: Sql, op: string, args: Record<string, unknown>): Promise<unknown> {
  if (op === "crm.contacts.list") {
    return (await listAll(sql)).map(wire);
  }

  if (op === "crm.contacts.put") {
    const input = fields(args.contact);
    return await sql.begin(async (transaction) => {
      // One lock serialises every contact write, matching the file store's queue.
      await transaction`lock table crm_contacts in share row exclusive mode`;
      const current = input.id ? await findOne(transaction, input.id) : undefined;
      if (input.id && !current) refuse("CRM contact no longer exists", "CRM_CONFLICT", 409);
      if (current && input.expectedRevision !== Number(current.revision)) {
        refuse("CRM contact changed; reload and try again", "CRM_CONFLICT", 409);
      }
      if (!current && input.expectedRevision !== undefined) {
        refuse("CRM contact no longer exists", "CRM_CONFLICT", 409);
      }
      const currentAccount = current?.account_id === null || current?.account_id === undefined
        ? null : text(current.account_id);
      if (current && input.accountId !== currentAccount) {
        const firstLink = currentAccount === null && input.accountId !== null;
        if (!firstLink || input.email !== text(current.email)) {
          refuse(firstLink
            ? "CRM account email does not match contact email"
            : "CRM account link cannot be changed", "CRM_CONFLICT", 409);
        }
      }
      const duplicate = await transaction`
        select 1 from crm_contacts
        where (email = ${input.email} or (${input.accountId}::text is not null and account_id = ${input.accountId}))
          and id::text <> ${input.id ?? ""}
        limit 1
      `;
      if (duplicate.length) refuse("CRM contact already exists", "CRM_DUPLICATE", 409);
      if (input.accountId !== null) {
        const account = await transaction`select 1 from users where id = ${input.accountId}`;
        if (!account.length) invalid("That account is unavailable. Reload the customer list.");
      }
      if (current) {
        await transaction`
          update crm_contacts set account_id = ${input.accountId}, name = ${input.name},
            email = ${input.email}, company = ${input.company}, stage = ${input.stage},
            source = ${input.source}, notes = ${input.notes}, follow_up_on = ${input.followUpOn}::date,
            is_test = ${input.isTest}, updated_at = now(), revision = revision + 1
          where id::text = ${input.id!}
        `;
        return wire(await findOne(transaction, input.id!));
      }
      const total = await transaction`select count(*)::integer as n from crm_contacts`;
      if (Number(total[0]?.n) >= MAX_CONTACTS) invalid("CRM contact limit reached");
      const id = input.id ?? crypto.randomUUID();
      await transaction`
        insert into crm_contacts (id, account_id, name, email, company, stage, source, notes, follow_up_on, is_test)
        values (${id}::uuid, ${input.accountId}, ${input.name}, ${input.email}, ${input.company},
          ${input.stage}, ${input.source}, ${input.notes}, ${input.followUpOn}::date, ${input.isTest})
      `;
      return wire(await findOne(transaction, id));
    });
  }

  if (op === "crm.contacts.import") {
    /* One-time move of the Reports host's contacts file. Rows keep their ids, timestamps and
       revisions. A row whose id, email or account already exists is skipped, so a repeated or
       interrupted import never overwrites edits made after the move. Links to accounts that no
       longer exist are dropped rather than refusing the row. */
    if (!Array.isArray(args.contacts) || args.contacts.length > MAX_IMPORT) invalid("contacts are invalid");
    const rows = (args.contacts as unknown[]).map((raw) => {
      const contact = raw as Record<string, unknown>;
      const valid = fields({ ...contact, expectedRevision: undefined });
      if (!valid.id) invalid("imported contacts need an id");
      const revision = Number(contact.revision);
      if (!Number.isSafeInteger(revision) || revision < 1) invalid("revision is invalid");
      const createdAt = Date.parse(text(contact.createdAt)), updatedAt = Date.parse(text(contact.updatedAt));
      if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) invalid("timestamps are invalid");
      return { ...valid, revision, createdAt: new Date(createdAt).toISOString(), updatedAt: new Date(updatedAt).toISOString() };
    });
    return await sql.begin(async (transaction) => {
      await transaction`lock table crm_contacts in share row exclusive mode`;
      let imported = 0, skipped = 0;
      for (const row of rows) {
        const clash = await transaction`
          select 1 from crm_contacts
          where id::text = ${row.id!} or email = ${row.email}
            or (${row.accountId}::text is not null and account_id = ${row.accountId})
          limit 1
        `;
        if (clash.length) { skipped++; continue; }
        const accountId = row.accountId !== null &&
            (await transaction`select 1 from users where id = ${row.accountId}`).length
          ? row.accountId : null;
        await transaction`
          insert into crm_contacts (id, account_id, name, email, company, stage, source, notes,
            follow_up_on, is_test, created_at, updated_at, revision)
          values (${row.id!}::uuid, ${accountId}, ${row.name}, ${row.email}, ${row.company},
            ${row.stage}, ${row.source}, ${row.notes}, ${row.followUpOn}::date, ${row.isTest},
            ${row.createdAt}::timestamptz, ${row.updatedAt}::timestamptz, ${row.revision})
        `;
        imported++;
      }
      return { imported, skipped };
    });
  }

  return refuse("unknown gateway operation", "UNKNOWN_OPERATION", 400);
}
