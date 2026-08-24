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
  byId(id: string): Promise<Site | null>;
  list(): Promise<Site[]>;
  create(input: { host: string; name: string; doc: Doc }): Promise<Site>;
  /** `version` is the version the editor loaded. See `Site.version`. */
  save(id: string, doc: Doc, version: number): Promise<SaveResult>;
  /** Move a site to a different domain. Null when the domain is taken. */
  setHost(id: string, host: string): Promise<Site | null>;
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
  async byId(id: string) {
    const s = this.sites.get(id);
    return s ? this.copy(s) : null;
  }
  async list() {
    return [...this.sites.values()].map(s => this.copy(s));
  }
  async create(input: { host: string; name: string; doc: Doc }) {
    for (const s of this.sites.values()) {
      if (s.host === input.host) throw new Error(`host already taken: ${input.host}`);
    }
    const site: Site = {
      id: 's' + ++this.seq,
      host: input.host,
      name: input.name,
      doc: structuredClone(input.doc),
      version: 1,
      updatedAt: new Date().toISOString()
    };
    this.sites.set(site.id, site);
    return this.copy(site);
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
