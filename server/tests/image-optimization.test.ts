import { test } from 'vitest';
import a from 'node:assert/strict';
import sharp from 'sharp';
import { optimizeImage, optimizedName, MAX_IMAGE_EDGE } from '../src/image-optimization.ts';

test('raster uploads become bounded metadata-free WebP files', async () => {
  const source = await sharp({
    create: { width: 3200, height: 1800, channels: 3, background: '#b7f34a' }
  }).jpeg({ quality: 96 }).withMetadata({ orientation: 1 }).toBuffer();

  const result = await optimizeImage(new Uint8Array(source), 'image/jpeg');
  const metadata = await sharp(result.bytes).metadata();

  a.equal(result.type, 'image/webp');
  a.equal(result.extension, 'webp');
  a.equal(result.w, MAX_IMAGE_EDGE);
  a.equal(result.h, 1440);
  a.equal(metadata.format, 'webp');
  a.equal(metadata.exif, undefined);
  a.equal(metadata.icc, undefined);
  a.ok(result.bytes.byteLength < source.byteLength);
  a.equal(optimizedName('Campaign.HERO.JPG', result.extension), 'Campaign.HERO.webp');
});

test('SVG uploads stay SVG while scripts are permanently removed', async () => {
  const source = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><script>alert(1)</script><rect width="80" height="40" fill="#b7f34a"/></svg>'
  );
  const result = await optimizeImage(source, 'image/svg+xml');
  const output = new TextDecoder().decode(result.bytes);

  a.equal(result.type, 'image/svg+xml');
  a.deepEqual([result.w, result.h], [80, 40]);
  a.doesNotMatch(output, /<script|alert\(/i);
  a.match(output, /<svg/);
});
