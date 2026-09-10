export function captureSitePreview(doc: Document, signal?: AbortSignal, baseUrl?: string): Promise<string>;
export function installSitePreviews(capture: typeof captureSitePreview): void;
export const SITE_PREVIEWS_BOOT_SCRIPT: string;
