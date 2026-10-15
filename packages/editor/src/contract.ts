import { SCHEMA } from '../../../app/src/core/index.ts';
import {
  PORTABLE_RENDERER_REVISION, portableRendererVersionForSchema
} from '../../../app/src/package/renderer-version.ts';

declare const __PAGECRAFT_EDITOR_VERSION__: string;
export const EDITOR_VERSION = typeof __PAGECRAFT_EDITOR_VERSION__ === 'string'
  ? __PAGECRAFT_EDITOR_VERSION__
  : '0.2.17';

/** The identity embedded into every sealed editor and compiler asset. */
export const COMPILER_DESCRIPTOR = Object.freeze({
  format: 'pagecraft.editor-contract.v1' as const,
  editorVersion: EDITOR_VERSION,
  schemaVersion: SCHEMA,
  rendererVersion: portableRendererVersionForSchema(SCHEMA),
  rendererRevision: PORTABLE_RENDERER_REVISION
});

export type CompilerDescriptor = typeof COMPILER_DESCRIPTOR;
export const COMPILER_RESULT_FORMAT = 'pagecraft.wordpress-compile.v1' as const;
