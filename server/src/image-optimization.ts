import sharp from 'sharp';
import { optimize as optimizeSvg } from 'svgo';
import { dimensions } from './assets.ts';

export const MAX_IMAGE_EDGE = 2560;
export const WEBP_QUALITY = 82;
export const MAX_INPUT_PIXELS = 50_000_000;

export interface OptimizedImage {
  bytes: Uint8Array;
  type: string;
  w: number;
  h: number;
  extension: string;
}

/** Free accounts keep only this canonical output. The source upload is never persisted. */
export async function optimizeImage(bytes: Uint8Array, type: string): Promise<OptimizedImage> {
  if (type === 'image/svg+xml') {
    const source = new TextDecoder().decode(bytes);
    const result = optimizeSvg(source, {
      multipass: true,
      plugins: ['preset-default', 'removeScripts']
    });
    const output = new TextEncoder().encode(result.data);
    return { bytes: output, type, ...dimensions(output, type), extension: 'svg' };
  }

  const output = await sharp(bytes, {
    animated: true,
    limitInputPixels: MAX_INPUT_PIXELS
  })
    .rotate()
    .resize({
      width: MAX_IMAGE_EDGE,
      height: MAX_IMAGE_EDGE,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: WEBP_QUALITY, effort: 4, smartSubsample: true })
    .toBuffer();
  const metadata = await sharp(output, { animated: true }).metadata();
  return {
    bytes: new Uint8Array(output),
    type: 'image/webp',
    w: metadata.width || 0,
    h: metadata.pageHeight || metadata.height || 0,
    extension: 'webp'
  };
}

export const optimizedName = (name: string, extension: string) => {
  const safe = String(name || 'image').replace(/\.[^.]*$/, '').trim() || 'image';
  return `${safe}.${extension}`;
};
