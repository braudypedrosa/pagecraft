import './styles.css';
import { mountCrmCharts } from './charts.ts';
import { mountCrmTables } from './tables.ts';

/** Enhance private, server-rendered data without fetching it from another service. */
export function mountFounderCrm(root: Document = document) {
  const cleanups: (() => void)[] = [];
  let failed = false;
  for (const mount of [mountCrmCharts, mountCrmTables]) {
    try { cleanups.push(mount(root)); }
    catch {
      failed = true;
      const message = root.createElement('p');
      message.className = 'notice warning';
      message.setAttribute('role', 'status');
      message.textContent = 'Some interactive controls could not load. Your records and server exports remain available. Refresh to retry.';
      root.querySelector('.workspace')?.prepend(message);
    }
  }
  root.documentElement.dataset.crmLibraries = failed ? 'partial' : 'ready';
  return () => cleanups.forEach(cleanup => cleanup());
}

if (typeof document !== 'undefined' && document.querySelector('.hq-shell')) {
  const cleanup = mountFounderCrm();
  window.addEventListener('pagehide', event => { if (!event.persisted) cleanup(); });
}
