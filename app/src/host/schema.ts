import { SCHEMA, clone, migrate } from '../core/index';
import type { Doc, UnknownDocumentInput } from '../core/types';

export class DocumentSchemaError extends Error {
  constructor(
    message: string,
    readonly suppliedVersion: number | null,
    readonly supportedVersion: number = SCHEMA
  ) {
    super(message);
    this.name = 'DocumentSchemaError';
  }
}

const versionOf = (input: UnknownDocumentInput): number | null => {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const value = row.schemaVersion ?? row.v;
  return Number.isInteger(value) ? value as number : null;
};

/**
 * The one document-adoption boundary used by every host. `migrate` remains the single
 * migration chain; this wrapper adds cloning and actionable compatibility failures for
 * storage and transport boundaries.
 */
export function adoptHostDocument(input: UnknownDocumentInput): Doc {
  const supplied = versionOf(input);
  if (supplied !== null && supplied > SCHEMA) {
    throw new DocumentSchemaError(
      `This project uses Pagecraft schema ${supplied}, but this host supports schema ${SCHEMA}. `
      + 'Upgrade Pagecraft on this host before opening or saving the project.',
      supplied
    );
  }

  let adopted: Doc | null;
  try {
    adopted = migrate(clone(input)) as Doc | null;
  } catch (error) {
    throw new DocumentSchemaError(
      `This Pagecraft document is invalid and could not be migrated: ${error instanceof Error ? error.message : String(error)}`,
      supplied
    );
  }
  if (!adopted) {
    throw new DocumentSchemaError(
      'This Pagecraft document is incomplete or unsupported. Restore a valid project backup or upgrade Pagecraft.',
      supplied
    );
  }
  return adopted;
}
