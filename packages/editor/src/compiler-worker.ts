import { compileDocument, PagecraftCompilerError, type CompileOptions } from './compiler.ts';
import type { UnknownDocumentInput } from '../../../app/src/core/types.ts';

interface CompileRequest {
  id: number;
  document: UnknownDocumentInput;
  options: CompileOptions;
}

const scope = self as DedicatedWorkerGlobalScope;
let workerQueue: Promise<unknown> = Promise.resolve();

scope.addEventListener('message', event => {
  const request = event.data as CompileRequest;
  const run = async () => {
    try {
      const result = await compileDocument(request.document, request.options);
      scope.postMessage({ id: request.id, ok: true, result });
    } catch (error) {
      scope.postMessage({
        id: request.id,
        ok: false,
        error: {
          name: error instanceof Error ? error.name : 'Error',
          code: error instanceof PagecraftCompilerError ? error.code : 'compile_failed',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };
  workerQueue = workerQueue.then(run, run);
});
