/* Where documents live.

   An interface with two implementations, for one honest reason: there is no Postgres on the
   machine this was written on, and the render-and-serve path is the part worth proving first.
   `MemoryStore` is what the tests run against. `PgStore` is what production runs against, and
   it is unexercised until a database exists — that is written on it rather than left for
   someone to discover.

   The shape is deliberately small. A site is an id, a host, a document and a version. Nothing
   here assumes there is one site or one owner, which is the whole discipline the plan asks
   for: multi-tenancy is not built, but nothing has to be unpicked to build it. */
import type { Doc } from '../../app/src/core/types.ts';

export interface Site {
  id: string;
  /** the host this site answers on, e.g. `acme.example.com`. Unique. */
  host: string;
  /** The path this site answers on under the editor's own host: `/acme/about`. Unique.

      Why both. A host means DNS, a certificate, and a client who has to change a record before
      they can see anything — worth it for a site that is somebody's front door, and absurd for
      one you want to send a link to this afternoon. A slug is shareable the moment it is saved,
      on the certificate this server already has. So every site gets one, and a host is the
      thing you add later if the site earns a domain. */
  slug: string;
  name: string;
  doc: Doc;
  /** bumped on every save. A save that carries a stale version is rejected rather than
      silently overwriting whatever arrived in between — two people in one document is a
      real case the moment a client edits while you do. */
  version: number;
  updatedAt: string;
}

export interface SaveResult {
  ok: boolean;
  site?: Site;
  /** set when the save was rejected because someone else had already saved */
  conflict?: { yours: number; theirs: number };
}

export interface Store {
  byHost(host: string): Promise<Site | null>;
  /** the site answering under `/<slug>/…` on the editor's host */
  bySlug(slug: string): Promise<Site | null>;
  byId(id: string): Promise<Site | null>;
  list(): Promise<Site[]>;
  create(input: { host: string; slug?: string; name: string; doc: Doc }): Promise<Site>;
  /** `version` is the version the editor loaded. See `Site.version`. */
  save(id: string, doc: Doc, version: number): Promise<SaveResult>;
  /** Move a site to a different domain. Null when the domain is taken. */
  setHost(id: string, host: string): Promise<Site | null>;
  /** Move a site to a different path. Null when the path is taken or reserved. */
  setSlug(id: string, slug: string): Promise<Site | null>;
}

/* ---- slugs -------------------------------------------------------------
   A site's path segment. Narrow on purpose: it appears in every URL the site has, it is typed
   and read aloud, and it shares a namespace with this server's own routes.

   The reserved list is the interesting part. It is not a hand-kept list of names that felt
   risky — `RESERVED_PATHS` is the first segment of every route the editor registers, and
   `app.test.ts` asserts that by reading Hono's own route table. Adding a route without adding
   it here is caught rather than discovered the day a site called `api` stops loading. */
export const RESERVED_PATHS = [
  'api', 'auth', 'internal', 'edit',
  /* not routes, but names a browser or a crawler asks for at the root */
  'assets', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'index.html', '.well-known'
];

/**
 * Is this a path segment a site may live on?
 *
 * Lowercase letters, digits and hyphens; 1 to 40 characters; no leading or trailing hyphen and
 * no run of two. No dots, which keeps `robots.txt` from ever being a site and keeps a slug
 * distinguishable from a host at a glance. Returns the cleaned slug, or null.
 */
export function validSlug(raw: unknown): string | null {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!wellFormed(s)) return null;
  if (RESERVED_PATHS.includes(s)) return null;
  return s;
}

/** The shape half of `validSlug`, without the reserved list. Separate because deriving a slug
    and accepting one want different answers for a *well-formed but reserved* name: a site
    called "API" should land near its name as `api-2`, while a person typing `api` into the
    field should be told no. */
const wellFormed = (s: string) => !!s && s.length <= 40 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

/** A slug from a name, made unique against `taken`. `site` when the name yields nothing usable
    — which is a name like "!!!", not a name like "API". */
export function slugFrom(name: string, taken: readonly string[]): string {
  const base = String(name || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 40)
    .replace(/-+$/, '');
  const stem = wellFormed(base) ? base : 'site';
  let out = stem, k = 2;
  while (taken.includes(out) || RESERVED_PATHS.includes(out)) out = `${stem}-${k++}`;
  return out;
}

/**
 * Is this a domain this server can serve, and is it spelt like one?
 *
 * Checked because a host is not only a label: it is what a request is matched against, what a
 * certificate is issued for, and what gets asked of Let's Encrypt. A malformed one is a site
 * nobody can reach; a wildcard or a bare IP is a request that cannot be certified.
 */
export function validHost(raw: string): string | null {
  const host = String(raw || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host || host.length > 253) return null;
  /* No scheme, no port, no path — a host, not a URL. Somebody pasting `https://acme.com/`
     should be told, not silently given a site at a domain with slashes in it. */
  if (/[:/\\?#@\s]/.test(host)) return null;
  /* An address is not a name, and a certificate cannot be had for one this way. */
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes('[')) return null;
  const labels = host.split('.');
  if (labels.length < 2 && host !== 'localhost' && !host.endsWith('.localhost')) return null;
  for (const l of labels) {
    if (!l || l.length > 63) return null;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(l)) return null;
  }
  return host;
}

export class MemoryStore implements Store {
  private sites = new Map<string, Site>();
  private seq = 0;

  async byHost(host: string) {
    for (const s of this.sites.values()) if (s.host === host) return this.copy(s);
    return null;
  }
  async bySlug(slug: string) {
    for (const s of this.sites.values()) if (s.slug === slug) return this.copy(s);
    return null;
  }
  async byId(id: string) {
    const s = this.sites.get(id);
    return s ? this.copy(s) : null;
  }
  async list() {
    return [...this.sites.values()].map(s => this.copy(s));
  }
  async create(input: { host: string; slug?: string; name: string; doc: Doc }) {
    for (const s of this.sites.values()) {
      if (s.host === input.host) throw new Error(`host already taken: ${input.host}`);
    }
    /* A slug is not optional on a site, only on the *request*: every site is shareable by path
       from the moment it exists, and asking a caller to invent a URL segment before it can have
       one would make the common case the awkward one. */
    const taken = [...this.sites.values()].map(s => s.slug);
    const want = input.slug ? validSlug(input.slug) : null;
    if (input.slug && !want) throw new Error(`not a usable path: ${input.slug}`);
    if (want && taken.includes(want)) throw new Error(`path already taken: ${want}`);
    const site: Site = {
      id: 's' + ++this.seq,
      host: input.host,
      slug: want || slugFrom(input.name || input.host, taken),
      name: input.name,
      doc: structuredClone(input.doc),
      version: 1,
      updatedAt: new Date().toISOString()
    };
    this.sites.set(site.id, site);
    return this.copy(site);
  }
  async setSlug(id: string, slug: string) {
    const s = this.sites.get(id);
    const want = validSlug(slug);
    if (!s || !want) return null;
    for (const other of this.sites.values()) {
      if (other.id !== id && other.slug === want) return null;
    }
    s.slug = want;
    s.updatedAt = new Date().toISOString();
    return this.copy(s);
  }
  async setHost(id: string, host: string) {
    const s = this.sites.get(id);
    if (!s) return null;
    for (const other of this.sites.values()) {
      if (other.id !== id && other.host === host) return null;
    }
    s.host = host;
    s.updatedAt = new Date().toISOString();
    return this.copy(s);
  }
  async save(id: string, doc: Doc, version: number): Promise<SaveResult> {
    const s = this.sites.get(id);
    if (!s) return { ok: false };
    if (s.version !== version) return { ok: false, conflict: { yours: version, theirs: s.version } };
    s.doc = structuredClone(doc);
    s.version += 1;
    s.updatedAt = new Date().toISOString();
    return { ok: true, site: this.copy(s) };
  }

  /* Callers get their own copy. A store that hands out a reference into its own map lets a
     caller mutate stored state by accident, and the memory store would be the only
     implementation where that worked — the bug would appear on the day Postgres arrived. */
  private copy(s: Site): Site {
    return { ...s, doc: structuredClone(s.doc) };
  }
}
