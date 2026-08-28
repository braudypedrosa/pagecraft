import { generateKeyPairSync } from 'node:crypto';
import { test } from 'vitest';
import a from 'node:assert/strict';
import { PackageRegistry } from '../src/packages.ts';
import {
  buildKeysetEnvelope, keyFromRawPublic, verifyKeysetEnvelope, verifyWordPressDistribution
} from '../src/releases.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';

const fixture = () => {
  const root = generateKeyPairSync('ed25519');
  const release = generateKeyPairSync('ed25519');
  const signing = { keyId: 'release-test-v1', privateKey: release.privateKey };
  const keysetEnvelope = buildKeysetEnvelope({
    rootKeyId: 'root-test-v1', rootPrivateKey: root.privateKey,
    generatedAt: '2026-08-28T00:00:00.000Z', expiresAt: '2030-08-28T00:00:00.000Z',
    releaseKeys: [{
      key: signing, notBefore: '2026-08-28T00:00:00.000Z', notAfter: '2029-08-28T00:00:00.000Z'
    }]
  }).envelope;
  const registry = new PackageRegistry();
  for (const name of ['importer', 'builder', 'theme'] as const) {
    registry.add({
      slug: `pagecraft-${name}`, version: '0.2.0',
      bytes: new TextEncoder().encode(`verified-${name}-archive`),
      generatedAt: '2026-08-28T00:00:00.000Z', signing, keysetEnvelope
    });
  }
  return { registry, root, release };
};

test('stable WordPress distribution is root-verifiable and package URLs are content-addressed', async () => {
  const { registry, root } = fixture();
  const app = createApp({
    store: new MemoryStore(), auth: new MemoryAuthStore(), packages: registry,
    editorHost: 'build.test', editorOrigin: 'https://build.test'
  });
  const stableResponse = await app.request(new Request(
    'https://build.test/v1/wordpress-distribution/stable', { headers: { host: 'build.test' } }
  ));
  a.equal(stableResponse.status, 200);
  const stable = await stableResponse.json() as ReturnType<PackageRegistry['stable']> & {
    products: Record<string, { downloadUrl: string; sha256: string; size: number }>;
  };
  a.ok(stable);
  const keyset = verifyKeysetEnvelope({
    envelope: stable!.keysetEnvelope,
    rootPublicKey: root.publicKey,
    now: '2026-08-29T00:00:00.000Z'
  });
  const releaseKey = keyset.keys.find(key => key.id === stable!.keyId);
  a.ok(releaseKey);
  const manifest = verifyWordPressDistribution({
    manifest: stable!.manifest, signature: stable!.signature,
    publicKey: keyFromRawPublic(releaseKey!.publicKey)
  });
  a.equal(manifest.products.builder.requirements.theme, '=0.2.0');
  a.equal(manifest.compatibility.builderTheme[0].theme, '0.2.0');

  const importer = stable!.products.importer;
  a.match(importer.downloadUrl, new RegExp(`${importer.sha256}\\.zip$`));
  const archive = await app.request(new Request(importer.downloadUrl, { headers: { host: 'build.test' } }));
  a.equal(archive.status, 200);
  a.equal(archive.headers.get('x-pagecraft-content-sha256'), importer.sha256);
  a.equal(Number(archive.headers.get('content-length')), importer.size);
  a.match(archive.headers.get('cache-control') || '', /immutable/);

  const tampered = stable!.manifest.slice(0, -1) + (stable!.manifest.endsWith('A') ? 'B' : 'A');
  a.throws(() => verifyWordPressDistribution({
    manifest: tampered, signature: stable!.signature, publicKey: keyFromRawPublic(releaseKey!.publicKey)
  }), /signature/i);
});

test('stable distribution fails closed until all three products are present', () => {
  const { registry } = fixture();
  const incomplete = new PackageRegistry();
  const importer = registry.get('pagecraft-importer')!;
  a.ok(importer);
  a.equal(incomplete.stable('https://build.test'), null);
});
