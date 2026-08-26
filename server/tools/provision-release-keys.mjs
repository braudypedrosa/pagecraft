#!/usr/bin/env node
/* Run on an offline/admin machine. This prints secrets once; it never writes them to the repo.
 * Keep rootPrivateKey offline, pin rootPublicKey in the connector, and put only the PAGECRAFT_*
 * runtime values in the server's secret manager. */
import { generateKeyPairSync, sign } from 'node:crypto';

const canonical = value => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(Object.is(value, -0) ? 0 : value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().filter(key => value[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError('unsupported canonical JSON value');
};
const b64 = value => Buffer.from(value).toString('base64url');
const rawPublic = key => {
  const der = key.export({ type: 'spki', format: 'der' });
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  if (!der.subarray(0, prefix.length).equals(prefix) || der.length !== prefix.length + 32) {
    throw new Error('generated public key was not Ed25519');
  }
  return b64(der.subarray(prefix.length));
};
const now = new Date();
const notBefore = now.toISOString();
const notAfter = new Date(now.getTime() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
const { privateKey: rootPrivate, publicKey: rootPublic } = generateKeyPairSync('ed25519');
const { privateKey: releasePrivate, publicKey: releasePublic } = generateKeyPairSync('ed25519');
const keyset = {
  format: 'pagecraft.keyset.v1', generatedAt: notBefore, expiresAt: notAfter,
  keys: [{
    id: 'pagecraft-release-v1', algorithm: 'Ed25519', publicKey: rawPublic(releasePublic),
    notBefore, notAfter
  }]
};
const keysetBytes = Buffer.from(canonical(keyset));
const keysetEnvelope = {
  keyset: b64(keysetBytes),
  signature: sign(null, Buffer.concat([Buffer.from('pagecraft-keyset-v1\0'), keysetBytes]), rootPrivate).toString('base64url'),
  rootKeyId: 'pagecraft-root-v1'
};
const output = {
  warning: 'Store rootPrivateKey offline. Never put it in the runtime, connector package, source control, logs, or chat.',
  connector: { rootKeyId: 'pagecraft-root-v1', rootPublicKey: rawPublic(rootPublic) },
  offline: { rootPrivateKey: b64(rootPrivate.export({ type: 'pkcs8', format: 'der' })) },
  runtime: {
    PAGECRAFT_RELEASE_KEY_ID: 'pagecraft-release-v1',
    PAGECRAFT_RELEASE_PRIVATE_KEY: b64(releasePrivate.export({ type: 'pkcs8', format: 'der' })),
    PAGECRAFT_ROOT_PUBLIC_KEY: rawPublic(rootPublic),
    PAGECRAFT_KEYSET_ENVELOPE: JSON.stringify(keysetEnvelope)
  }
};
process.stdout.write(JSON.stringify(output, null, 2) + '\n');
