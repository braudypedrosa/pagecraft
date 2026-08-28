#!/usr/bin/env node
/* Run on an offline/admin machine. Keep rootPrivateKey offline, pin rootPublicKey in Importer,
 * and put only the PAGECRAFT_* runtime values in the server's secret manager. Passing --output
 * writes a new mode-0600 file without ever printing its secrets and refuses to overwrite it. */
import { generateKeyPairSync, sign } from 'node:crypto';
import { writeFileSync } from 'node:fs';

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
const args = process.argv.slice(2);
const valueAfter = flag => {
  const index = args.indexOf(flag);
  if (index < 0) return '';
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
};
const profile = valueAfter('--profile') || 'production';
const outputPath = valueAfter('--output');
if (!['production', 'test'].includes(profile)) throw new Error('--profile must be production or test');
if (!outputPath) throw new Error('--output is required so secret key material is never printed');
const idPrefix = profile === 'test' ? 'pagecraft-test' : 'pagecraft';
const now = new Date();
const notBefore = now.toISOString();
const lifetimeDays = profile === 'test' ? 180 : 2 * 365;
const notAfter = new Date(now.getTime() + lifetimeDays * 24 * 60 * 60 * 1000).toISOString();
const { privateKey: rootPrivate, publicKey: rootPublic } = generateKeyPairSync('ed25519');
const { privateKey: releasePrivate, publicKey: releasePublic } = generateKeyPairSync('ed25519');
const keyset = {
  format: 'pagecraft.keyset.v1', generatedAt: notBefore, expiresAt: notAfter,
  keys: [{
    id: `${idPrefix}-release-v1`, algorithm: 'Ed25519', publicKey: rawPublic(releasePublic),
    notBefore, notAfter
  }]
};
const keysetBytes = Buffer.from(canonical(keyset));
const keysetEnvelope = {
  keyset: b64(keysetBytes),
  signature: sign(null, Buffer.concat([Buffer.from('pagecraft-keyset-v1\0'), keysetBytes]), rootPrivate).toString('base64url'),
  rootKeyId: `${idPrefix}-root-v1`
};
const output = {
  profile,
  warning: 'Store rootPrivateKey offline. Never put it in the runtime, Importer package, source control, logs, or chat.',
  importer: { rootKeyId: `${idPrefix}-root-v1`, rootPublicKey: rawPublic(rootPublic) },
  offline: { rootPrivateKey: b64(rootPrivate.export({ type: 'pkcs8', format: 'der' })) },
  runtime: {
    PAGECRAFT_RELEASE_KEY_ID: `${idPrefix}-release-v1`,
    PAGECRAFT_RELEASE_PRIVATE_KEY: b64(releasePrivate.export({ type: 'pkcs8', format: 'der' })),
    PAGECRAFT_ROOT_PUBLIC_KEY: rawPublic(rootPublic),
    PAGECRAFT_KEYSET_ENVELOPE_BASE64URL: b64(Buffer.from(JSON.stringify(keysetEnvelope)))
  }
};
const encoded = JSON.stringify(output, null, 2) + '\n';
writeFileSync(outputPath, encoded, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
process.stdout.write(`Release trust material written securely for the ${profile} profile.\n`);
