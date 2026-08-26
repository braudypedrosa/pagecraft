import {
  sha256, signPackageManifest, type KeysetEnvelopeV1, type PackageManifestV1,
  type ReleaseSigningKey
} from './releases.ts';

export type PackageSlug = PackageManifestV1['slug'];
export interface SignedPackage {
  slug: PackageSlug;
  version: string;
  bytes: Uint8Array;
  hash: string;
  manifest: string;
  signature: string;
  keyId: string;
  keysetEnvelope: KeysetEnvelopeV1;
}

export class PackageRegistry {
  private packages = new Map<PackageSlug, SignedPackage>();

  add(input: {
    slug: PackageSlug; version: string; bytes: Uint8Array; generatedAt: string;
    signing: ReleaseSigningKey; keysetEnvelope: KeysetEnvelopeV1;
  }) {
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(input.version)) {
      throw new Error(`invalid ${input.slug} package version`);
    }
    if (input.bytes.byteLength < 1) throw new Error(`${input.slug} package is empty`);
    const manifest: PackageManifestV1 = {
      format: 'pagecraft.package.v1', slug: input.slug, version: input.version,
      packageHash: sha256(input.bytes), packageBytes: input.bytes.byteLength,
      license: 'GPL-3.0-or-later',
      requirements: input.slug === 'pagecraft-connector'
        ? { wordpress: '>=6.6', php: '>=8.1' }
        : { wordpress: '>=6.6', php: '>=8.1', connector: '>=0.1.0' },
      generatedAt: new Date(input.generatedAt).toISOString()
    };
    const signed = signPackageManifest(manifest, input.signing);
    const entry: SignedPackage = {
      slug: input.slug, version: input.version, bytes: new Uint8Array(input.bytes),
      hash: manifest.packageHash, ...signed, keysetEnvelope: structuredClone(input.keysetEnvelope)
    };
    this.packages.set(input.slug, entry);
    return this.copy(entry);
  }

  get(slug: string) {
    const entry = this.packages.get(slug as PackageSlug);
    return entry ? this.copy(entry) : null;
  }

  private copy(entry: SignedPackage): SignedPackage {
    return { ...structuredClone(entry), bytes: new Uint8Array(entry.bytes) };
  }
}
