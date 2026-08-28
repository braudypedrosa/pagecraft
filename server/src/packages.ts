import {
  sha256, signPackageManifest, signWordPressDistribution,
  type KeysetEnvelopeV1, type PackageManifestV1, type ReleaseSigningKey,
  type WordPressDistributionManifestV1
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
  private signing: ReleaseSigningKey | null = null;
  private keysetEnvelope: KeysetEnvelopeV1 | null = null;

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
        : input.slug === 'pagecraft-importer'
          ? { wordpress: '>=6.6', php: '>=8.1' }
          : input.slug === 'pagecraft-builder'
            ? { wordpress: '>=6.6', php: '>=8.1', importer: `>=${input.version}`, theme: `=${input.version}` }
            : { wordpress: '>=6.6', php: '>=8.1', importer: `>=${input.version}` },
      generatedAt: new Date(input.generatedAt).toISOString()
    };
    const signed = signPackageManifest(manifest, input.signing);
    const entry: SignedPackage = {
      slug: input.slug, version: input.version, bytes: new Uint8Array(input.bytes),
      hash: manifest.packageHash, ...signed, keysetEnvelope: structuredClone(input.keysetEnvelope)
    };
    if (this.signing && this.signing.keyId !== input.signing.keyId) {
      throw new Error('one package registry cannot mix release signing keys');
    }
    this.signing = input.signing;
    this.keysetEnvelope = structuredClone(input.keysetEnvelope);
    this.packages.set(input.slug, entry);
    return this.copy(entry);
  }

  get(slug: string) {
    const entry = this.packages.get(slug as PackageSlug);
    return entry ? this.copy(entry) : null;
  }

  stable(origin: string) {
    if (!this.signing || !this.keysetEnvelope) return null;
    const names = ['importer', 'builder', 'theme'] as const;
    const entries = names.map(name => this.packages.get(`pagecraft-${name}` as PackageSlug));
    if (entries.some(entry => !entry)) return null;
    const products = Object.fromEntries(entries.map((entry, index) => {
      const metadata = JSON.parse(Buffer.from(entry!.manifest, 'base64url').toString('utf8')) as PackageManifestV1;
      const downloadPath = `/v1/wordpress-distribution/packages/${entry!.slug}/${entry!.hash}.zip`;
      return [names[index], {
        slug: entry!.slug, version: entry!.version, sha256: entry!.hash,
        size: entry!.bytes.byteLength, downloadPath, requirements: metadata.requirements
      }];
    })) as WordPressDistributionManifestV1['products'];
    const generatedAt = entries.map(entry => JSON.parse(
      Buffer.from(entry!.manifest, 'base64url').toString('utf8')
    ) as PackageManifestV1).map(metadata => metadata.generatedAt).sort().at(-1)!;
    const manifest: WordPressDistributionManifestV1 = {
      format: 'pagecraft.wordpress-distribution.v1', channel: 'stable', generatedAt, products,
      compatibility: { builderTheme: [{ builder: products.builder.version, theme: products.theme.version }] }
    };
    const signed = signWordPressDistribution(manifest, this.signing);
    return {
      ...signed, keysetEnvelope: structuredClone(this.keysetEnvelope),
      products: Object.fromEntries(Object.entries(products).map(([name, product]) => [name, {
        ...product, downloadUrl: new URL(product.downloadPath, origin).href
      }]))
    };
  }

  private copy(entry: SignedPackage): SignedPackage {
    return { ...structuredClone(entry), bytes: new Uint8Array(entry.bytes) };
  }
}
