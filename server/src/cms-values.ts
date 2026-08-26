import type { Collection, Doc, Field, Item } from '../../app/src/core/types.ts';
import { safeRichHtml } from './safe-html.ts';

const utf8 = new TextEncoder();
const BOOLEAN_VALUES = new Set(['0', '1', 'true', 'false', 'yes', 'no']);
const TRUE_VALUES = new Set(['1', 'true', 'yes']);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LINK = /^(?:https?:\/\/|\/|#|mailto:)/i;
const IMAGE = /^asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@\d+)?$/;

export interface CmsWriteTarget {
  collection: Collection;
  item: Item;
}

/**
 * Validate a WordPress CMS write against the current canonical Pagecraft schema.
 *
 * WordPress receives this schema from a signed release, but the write endpoint must still
 * treat the current Pagecraft draft as authoritative. This closes the gap where a stale or
 * forged connector could otherwise store arbitrary strings in typed fields. Values are
 * rejected rather than sanitized so WordPress and Pagecraft never believe different bytes
 * were accepted under the same idempotency key.
 */
export function assertTypedCmsWrite(
  document: Doc,
  collectionId: string,
  itemId: string,
  values: Record<string, string>,
  assetIds: ReadonlySet<string>
): CmsWriteTarget {
  const matchingCollections = (document.meta.collections || [])
    .filter(collection => collection.id === collectionId);
  if (matchingCollections.length !== 1) throw new Error('CMS write refers to an unknown or ambiguous collection');
  const collection = matchingCollections[0];
  const matchingItems = collection.items.filter(item => item.id === itemId);
  if (matchingItems.length !== 1) throw new Error('CMS write refers to an unknown or ambiguous item');
  const item = matchingItems[0];
  const fields = new Map<string, Field>();
  for (const field of collection.fields) {
    if (fields.has(field.id)) throw new Error('CMS collection contains a duplicate field ID');
    fields.set(field.id, field);
  }

  for (const [fieldId, value] of Object.entries(values)) {
    const field = fields.get(fieldId);
    if (!field) throw new Error(`CMS write contains unknown field ${fieldId}`);
    assertFieldValue(document, field, value, assetIds);
  }

  const prospective = { ...item.values, ...values };
  for (const field of fields.values()) {
    if (!field.required) continue;
    const value = String(prospective[field.id] ?? '');
    const present = field.type === 'bool'
      ? TRUE_VALUES.has(value.toLowerCase())
      : value.trim() !== '';
    if (!present) throw new Error(`CMS write leaves required field ${field.id} empty`);
  }
  return { collection, item };
}

function assertFieldValue(
  document: Doc,
  field: Field,
  value: string,
  assetIds: ReadonlySet<string>
) {
  const limit = field.type === 'rich' ? 100_000 : 5_000;
  if (utf8.encode(value).byteLength > limit) {
    throw new Error(`CMS field ${field.id} exceeds its ${limit}-byte limit`);
  }
  if (field.type === 'rich') {
    if (!safeRichHtml(value)) throw new Error(`CMS field ${field.id} contains unsafe rich text`);
  } else if (CONTROL_CHARACTERS.test(value)) {
    throw new Error(`CMS field ${field.id} contains unsupported control characters`);
  }
  if (value === '') return;

  let valid = true;
  switch (field.type) {
    case 'number':
      valid = DECIMAL_NUMBER.test(value.trim()) && Number.isFinite(Number(value));
      break;
    case 'date':
      valid = DATE.test(value);
      break;
    case 'option': {
      const choices = String(field.opts || '').split(',').map(choice => choice.trim()).filter(Boolean);
      valid = choices.includes(value);
      break;
    }
    case 'bool':
      valid = BOOLEAN_VALUES.has(value.toLowerCase());
      break;
    case 'ref': {
      const target = (document.meta.collections || []).find(collection => collection.id === field.ref);
      valid = !!target?.items.some(item => item.id === value);
      break;
    }
    case 'image': {
      const match = value.match(IMAGE);
      valid = !!match && assetIds.has(match[1]);
      break;
    }
    case 'link':
      valid = LINK.test(value);
      break;
    case 'text':
    case 'rich':
      break;
    default: {
      const neverType: never = field.type;
      throw new Error(`CMS field ${field.id} has unsupported type ${neverType}`);
    }
  }
  if (!valid) throw new Error(`CMS field ${field.id} has an invalid ${field.type} value`);
}
