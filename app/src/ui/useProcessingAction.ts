import { useEffect, useRef, useState } from 'preact/hooks';
import { installActionFeedback, type ProcessingOptions, type Notice, type ProcessingResult } from '../../../shared/action-feedback.js';

/** Preact owns its controls; the shared runner owns the promise and notification. */
export function useProcessingAction(key: string) {
  const [label, setLabel] = useState('');
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async <T>(options: Omit<ProcessingOptions<T>, 'button' | 'key'>,
    work: (action: {update: Notice['update']}) => T | false | Promise<T | false>): Promise<ProcessingResult<T>> => {
    if (pending.current) return {status:'busy'};
    pending.current = true; setLabel(options.pending);
    try { return await installActionFeedback().run({...options, key}, work); }
    finally { pending.current = false; if (mounted.current) setLabel(''); }
  };
  return {busy: !!label, label, run, isPending: () => pending.current};
}
