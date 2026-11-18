export function captureSitePreview(
  doc: Document, signal?: AbortSignal, baseUrl?: string,
  /** Replaces the first-screen layout step; tests only. */
  measure?: (body: Element, css: string) => { images: Set<Element>; shown: Set<string> } | null,
): Promise<string>;
export function installSitePreviews(capture: typeof captureSitePreview): void;
export const SITE_PREVIEWS_BOOT_SCRIPT: string;
