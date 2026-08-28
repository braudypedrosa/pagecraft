/* The entry point: read the environment, pick a store, listen.

   Everything decidable is decided here, so `app.ts` stays a function of its arguments and
   the tests can call it without a database, a build or a port. */
import { serve } from '@hono/node-server';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createApp } from './app.ts';
import { MemoryStore, type Store } from './store.ts';
import { MemoryAuthStore, type AuthStore } from './auth.ts';
import { MemoryAssetStore, type AssetStore } from './assets.ts';
import { mailConfig, smtpSender } from './mail.ts';
import { MemoryConnectedStore, type ConnectedStore } from './release-store.ts';
import {
  keyFromRawPublic, rawPublicKey, verifyKeysetEnvelope,
  type KeysetEnvelopeV1, type ReleaseSigningKey
} from './releases.ts';
import { PackageRegistry } from './packages.ts';
import { SupabaseAccountAuth } from './account-auth.ts';
import { SupabaseHumanChallenge, TestHumanChallenge } from './turnstile.ts';
import { GatewayOwnedSiteStore, MemoryOwnedSiteStore, PgOwnedSiteStore, type OwnedSiteStore } from './accounts.ts';
import { FileHostedPublicationStore } from './publications.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

const PORT = Number(process.env.PORT || 8787);
const EDITOR_HOST = process.env.EDITOR_HOST || 'localhost';

/* The builder, as built. `node build.mjs` writes it; the server does not build it, because
   a server that runs a bundler on boot is a server that fails to boot for bundler reasons. */
const editorPath = join(repo, 'index.html');
const editorHtml = existsSync(editorPath) ? readFileSync(editorPath, 'utf8') : undefined;
if (!editorHtml) console.warn(`no editor at ${editorPath} — run \`node build.mjs\``);

/* One connection for all three, because they are one database and a second pool would only be
   a second thing to run out of. Order matters on first run: the auth and asset tables
   reference `sites`, and a foreign key to a table that is not there yet is an error. */
async function pickStores(): Promise<{ store: Store; assets: AssetStore; auth: AuthStore; connected: ConnectedStore; owned: OwnedSiteStore }> {
  const gatewayUrl = process.env.DATABASE_GATEWAY_URL;
  const gatewayKey = process.env.DATABASE_GATEWAY_KEY;
  if (gatewayUrl || gatewayKey) {
    if (!gatewayUrl || !gatewayKey) {
      throw new Error('DATABASE_GATEWAY_URL and DATABASE_GATEWAY_KEY must be set together');
    }
    const {
      PagecraftGateway, GatewayStore, GatewayAssetStore, GatewayAuthStore, GatewayConnectedStore
    } = await import('./store-gateway.ts');
    const gateway = new PagecraftGateway(gatewayUrl, gatewayKey);
    const store = new GatewayStore(gateway);
    /* Make boot prove the HTTPS/database path before Passenger declares the app started. */
    await store.listMeta();
    console.log('store: supabase gateway');
    const auth = new GatewayAuthStore(gateway);
    return { store, assets: new GatewayAssetStore(gateway), auth,
      connected: new GatewayConnectedStore(gateway), owned: new GatewayOwnedSiteStore(gateway, store) };
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('production requires DATABASE_GATEWAY_URL or DATABASE_URL; refusing ephemeral memory storage');
    }
    console.warn('DATABASE_URL is not set — using the in-memory stores. Nothing survives a restart,');
    console.warn('including who is signed in and who has been invited.');
    const store = new MemoryStore(), auth = new MemoryAuthStore();
    return { store, assets: new MemoryAssetStore(), auth, connected: new MemoryConnectedStore(),
      owned: new MemoryOwnedSiteStore(store, auth) };
  }
  /* Imported here rather than at the top so a run without a database needs no driver. */
  const { Pool } = await import('pg');
  const { PgStore, PgAssetStore, PgAuthStore, PgConnectedStore } = await import('./store-pg.ts');
  const pool = new Pool({ connectionString: url });
  const store = new PgStore(pool);
  const auth = new PgAuthStore(pool);
  const assets = new PgAssetStore(pool);
  const connected = new PgConnectedStore(pool);
  await store.init();
  await auth.init();
  await assets.init();
  await connected.init();
  console.log('store: postgres');
  return { store, assets, auth, connected, owned: new PgOwnedSiteStore(pool) };
}

const { store, assets, auth, connected, owned } = await pickStores();

const production = process.env.NODE_ENV === 'production';
const publicationRoot = process.env.PAGECRAFT_PUBLICATION_ROOT
  || (production ? '' : join(tmpdir(), 'pagecraft-publications-development'));
if (!publicationRoot) {
  throw new Error('production requires PAGECRAFT_PUBLICATION_ROOT for immutable hosted publications');
}
const publications = new FileHostedPublicationStore(publicationRoot);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY;
const testAuth = process.env.PAGECRAFT_AUTH_TEST_MODE === '1';
if (!supabaseUrl || !supabaseKey || !turnstileSiteKey) {
  throw new Error('account auth requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and TURNSTILE_SITE_KEY');
}
if (production && testAuth) throw new Error('PAGECRAFT_AUTH_TEST_MODE is forbidden in production');
const accountAuth = new SupabaseAccountAuth({
  url: supabaseUrl, publishableKey: supabaseKey, secureCookies: production
});
const challenge = testAuth ? new TestHumanChallenge() : new SupabaseHumanChallenge();

function releaseSecurity(): { releaseSigning?: ReleaseSigningKey; keysetEnvelope?: KeysetEnvelopeV1 } {
  const privateWire = process.env.PAGECRAFT_RELEASE_PRIVATE_KEY;
  const keyId = process.env.PAGECRAFT_RELEASE_KEY_ID;
  const envelopeJson = process.env.PAGECRAFT_KEYSET_ENVELOPE;
  const envelopeBase64 = process.env.PAGECRAFT_KEYSET_ENVELOPE_BASE64URL;
  if (envelopeJson && envelopeBase64) {
    throw new Error('set only PAGECRAFT_KEYSET_ENVELOPE_BASE64URL or the legacy PAGECRAFT_KEYSET_ENVELOPE, not both');
  }
  if (envelopeBase64 && (!/^[A-Za-z0-9_-]+$/.test(envelopeBase64)
    || Buffer.from(envelopeBase64, 'base64url').toString('base64url') !== envelopeBase64)) {
    throw new Error('PAGECRAFT_KEYSET_ENVELOPE_BASE64URL is malformed');
  }
  const envelopeWire = envelopeBase64
    ? Buffer.from(envelopeBase64, 'base64url').toString('utf8')
    : envelopeJson;
  const rootWire = process.env.PAGECRAFT_ROOT_PUBLIC_KEY;
  const supplied = [privateWire, keyId, envelopeWire, rootWire].filter(Boolean).length;
  if (!supplied) {
    console.warn('Connected WordPress signing is not provisioned — release endpoints fail closed.');
    return {};
  }
  if (supplied !== 4) {
    throw new Error('PAGECRAFT_RELEASE_PRIVATE_KEY, PAGECRAFT_RELEASE_KEY_ID, a keyset envelope, and PAGECRAFT_ROOT_PUBLIC_KEY must be set together');
  }
  let envelope: KeysetEnvelopeV1;
  try { envelope = JSON.parse(envelopeWire!) as KeysetEnvelopeV1; }
  catch (error) {
    const first = envelopeWire!.codePointAt(0) ?? -1;
    const last = envelopeWire!.codePointAt(envelopeWire!.length - 1) ?? -1;
    const reason = error instanceof Error ? error.message.replace(/[\r\n]+/g, ' ') : 'parse failed';
    throw new Error(`PAGECRAFT_KEYSET_ENVELOPE is not valid JSON (length ${envelopeWire!.length}; boundary code points ${first}/${last}; ${reason})`);
  }
  const privateKey = createPrivateKey({
    key: Buffer.from(privateWire!, 'base64url'), format: 'der', type: 'pkcs8'
  });
  const keyset = verifyKeysetEnvelope({
    envelope, rootPublicKey: keyFromRawPublic(rootWire!)
  });
  const active = keyset.keys.find(key => key.id === keyId);
  if (!active || active.publicKey !== rawPublicKey(createPublicKey(privateKey))) {
    throw new Error('release private key does not match its root-signed keyset entry');
  }
  return { releaseSigning: { keyId: keyId!, privateKey }, keysetEnvelope: envelope };
}

const signing = releaseSecurity();

function packageRegistry() {
  const configured = [
    {
      slug: 'pagecraft-connector' as const,
      path: process.env.PAGECRAFT_CONNECTOR_PACKAGE_PATH,
      version: process.env.PAGECRAFT_CONNECTOR_PACKAGE_VERSION
    },
    {
      slug: 'pagecraft-importer' as const,
      path: process.env.PAGECRAFT_IMPORTER_PACKAGE_PATH,
      version: process.env.PAGECRAFT_IMPORTER_PACKAGE_VERSION
    },
    {
      slug: 'pagecraft-builder' as const,
      path: process.env.PAGECRAFT_BUILDER_PACKAGE_PATH,
      version: process.env.PAGECRAFT_BUILDER_PACKAGE_VERSION
    },
    {
      slug: 'pagecraft-theme' as const,
      path: process.env.PAGECRAFT_THEME_PACKAGE_PATH,
      version: process.env.PAGECRAFT_THEME_PACKAGE_VERSION
    }
  ].filter(item => item.path || item.version);
  if (!configured.length) return undefined;
  if (!signing.releaseSigning || !signing.keysetEnvelope) {
    throw new Error('signed package updates require provisioned release signing');
  }
  const registry = new PackageRegistry();
  for (const item of configured) {
    if (!item.path || !item.version) throw new Error(`${item.slug} package path and version must be set together`);
    if (!existsSync(item.path)) throw new Error(`${item.slug} archive does not exist: ${item.path}`);
    registry.add({
      slug: item.slug, version: item.version,
      bytes: new Uint8Array(readFileSync(item.path)), generatedAt: statSync(item.path).mtime.toISOString(),
      signing: signing.releaseSigning, keysetEnvelope: signing.keysetEnvelope
    });
  }
  return registry;
}
const packages = packageRegistry();

const webhookWorker = `pagecraft-${process.pid}-${crypto.randomUUID()}`;
let webhookDrainRunning = false;
async function drainWordPressWebhooks() {
  if (webhookDrainRunning) return;
  webhookDrainRunning = true;
  try {
    for (const event of await connected.claimWebhooks(webhookWorker, 10)) {
      let delivered = false, error = '';
      try {
        const payload = JSON.parse(event.payload) as { occurredAt?: string };
        const response = await fetch(event.webhookUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-pagecraft-timestamp': String(payload.occurredAt || event.createdAt),
            'x-pagecraft-event-id': event.eventId,
            'x-pagecraft-key-id': event.keyId,
            'x-pagecraft-signature': event.signature,
            'x-pagecraft-content-sha256': event.bodyHash
          },
          body: event.payload,
          signal: AbortSignal.timeout(10_000)
        });
        delivered = response.ok;
        if (!response.ok) error = `HTTP ${response.status}`;
      } catch (caught) {
        error = String((caught as Error).message || caught);
      }
      const delay = Math.min(6 * 60 * 60 * 1000, 15_000 * 2 ** Math.min(event.attempts, 8));
      await connected.settleWebhook(
        event.eventId, delivered, new Date(Date.now() + delay).toISOString(), error || undefined
      );
    }
  } catch (caught) {
    console.error('WordPress webhook outbox could not be drained:', (caught as Error).message);
  } finally {
    webhookDrainRunning = false;
  }
}
const webhookTimer = setInterval(drainWordPressWebhooks, 15_000);
webhookTimer.unref();
void drainWordPressWebhooks();

const invitationWorker = `pagecraft-invites-${process.pid}-${crypto.randomUUID()}`;
let invitationDrainRunning = false;
async function drainCollaboratorInvitations() {
  if (invitationDrainRunning) return;
  invitationDrainRunning = true;
  try {
    await auth.drainInvitationOutbox(invitationWorker, 10);
  } catch (caught) {
    console.error('Collaborator invitation outbox could not be drained:', (caught as Error).message);
  } finally {
    invitationDrainRunning = false;
  }
}
const invitationTimer = setInterval(drainCollaboratorInvitations, 60_000);
invitationTimer.unref();
void drainCollaboratorInvitations();

/* One site, seeded, when the store is empty and we are running on memory. Without it the
   first thing a new checkout shows is "No site for host localhost", which reads as broken
   rather than as empty. */
if (!accountAuth && !process.env.DATABASE_URL && !process.env.DATABASE_GATEWAY_URL && !(await store.listMeta()).length) {
  const Core = await import('../../app/src/core/index.ts');
  Core.seed();
  await store.create({
    host: EDITOR_HOST === 'localhost' ? 'site.localhost' : 'site.' + EDITOR_HOST,
    name: 'Demo',
    doc: {
      schemaVersion: Core.SCHEMA,
      meta: Core.state.meta, header: Core.state.header,
      footer: Core.state.footer, pages: Core.state.pages
    }
  });
  console.log('seeded one demo site');
}

/* The first owner. Somebody has to be able to sign in before anybody can be invited, and
   there is no route into an empty database otherwise — `/auth/login` answers 200 to an address
   it has never heard of, which is correct and useless.

   Idempotent, so setting it on every boot is harmless: `createUser` upserts on the address and
   `grant` upserts on the pair. Once there is an owner, everybody else arrives through
   `POST /api/sites/:id/people`, which is the flow this replaced. */
const OWNER = accountAuth ? undefined : process.env.OWNER_EMAIL;
if (OWNER) {
  const user = await auth.createUser(OWNER, 'Owner');
  for (const s of await store.listMeta()) await auth.grant(s.id, user.id, 'owner');
  console.log(`owner    ${OWNER} — POST /auth/login for a link`);
} else if (!accountAuth) {
  console.warn('OWNER_EMAIL is not set — nobody can sign in. The sites still serve.');
}

/* Kept for trying the content role on a throwaway run. Inviting is the real route now, and on
   a database this is the one thing here that a restart would re-grant after a revoke — so it
   is a development convenience and says so. */
const CLIENT = accountAuth ? undefined : process.env.CLIENT_EMAIL;
if (CLIENT) {
  const user = await auth.createUser(CLIENT, 'Client');
  for (const s of await store.listMeta()) await auth.grant(s.id, user.id, 'content');
  console.log(`client   ${CLIENT} — content only (a shortcut; invite instead)`);
}

/* Real mail when it is configured, the console when it is not. Said out loud either way,
   because "the link was sent" and "the link was printed in a log you are not reading" look
   identical from the sign-in form. */
const mail = accountAuth ? null : mailConfig(process.env);
if (mail) {
  const who = mail.user ? ` as ${mail.user}` : ' with no credentials';
  console.log(`mail     ${mail.host}:${mail.port}${who}, from ${mail.from}`);
} else {
  if (!accountAuth && process.env.NODE_ENV === 'production') {
    throw new Error('production requires complete SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM settings; refusing to log sign-in tokens');
  }
  if (!accountAuth) {
    console.warn('SMTP is not configured — development login links are printed here instead of emailed.');
    console.warn('Set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM to send them.');
  }
}

const app = createApp({
  store, auth, assets, editorHtml, editorHost: EDITOR_HOST,
  editorOrigin: process.env.EDITOR_ORIGIN
    || (process.env.NODE_ENV === 'production' ? `https://${EDITOR_HOST}` : undefined),
  sendLink: mail ? smtpSender(mail) : undefined,
  secureCookies: process.env.NODE_ENV === 'production',
  connected,
  packages,
  accountAuth,
  ownedSites: owned,
  challenge,
  turnstileSiteKey,
  publications,
  ...signing
});

serve({ fetch: app.fetch, port: PORT }, info => {
  console.log(`editor   http://${EDITOR_HOST}:${info.port}/`);
  console.log(`api      http://${EDITOR_HOST}:${info.port}/api/sites`);
  store.listMeta().then(sites => sites.forEach(s => console.log(`site     http://${s.host}:${info.port}/  (${s.name})`)));
});
