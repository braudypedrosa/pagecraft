import sanitizeHtml from 'sanitize-html';

/* Rich text is content, but executable markup is not. This allowlist mirrors the controls in
   the editor's rich-text toolbar and deliberately excludes images, embeds, styles and every
   event attribute. Owners still have the separate Embed widget when arbitrary integration
   markup is genuinely required. */
const RICH_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li',
    'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'a', 'div'
  ],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard'
};

export const cleanRichHtml = (html: unknown) => sanitizeHtml(String(html ?? ''), RICH_OPTIONS);

/** Reject instead of silently rewriting: otherwise the editor would keep an unsafe local copy
    after the server stored a different document. */
export const safeRichHtml = (html: unknown) => {
  const raw = String(html ?? '');
  return cleanRichHtml(raw) === raw;
};
