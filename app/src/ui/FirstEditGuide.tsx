import { useState } from 'preact/hooks';
import { C, L } from './ctx';
import { Icon } from './Icon';

type Node = { id: string; type: string; props?: Record<string, unknown>; children?: Node[]; bind?: unknown; use?: string; src?: string; showIf?: unknown; hide?: Record<string, unknown> };
type Document = { pages: { id: string; tree: Node[] }[] };
type Task = { id: string; pageId: string; type: string; before: string };
type Guide = { version: 1; dismissed: boolean; tasks: Task[] };
const STEPS = [
  { type: 'heading', title: 'Make the headline yours', action: 'Edit heading', copy: 'Describe what this site offers. Edit Heading text in the Content panel.' },
  { type: 'image', title: 'Replace a template image', action: 'Choose image', copy: 'Choose your own image in Content. Give it useful alternative text.' },
  { type: 'button', title: 'Personalize a button', action: 'Edit button', copy: 'Update the button text or destination in Content. Check that the link goes where you expect.' }
];
const keys: Record<string, string[]> = { heading: ['text'], image: ['src'], button: ['text', 'link'] };

// Store only stable target IDs and change fingerprints, never the user's copy or image URLs.
export function guideFingerprint(node: Node): string {
  const value = JSON.stringify((keys[node.type] || []).map(key => node.props?.[key] ?? ''));
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function guideNodes(nodes: Node[]): Node[] {
  return nodes.flatMap(node => {
    // Dynamic/hidden content and component internals need their own editing workflow.
    if (node.bind && Object.keys(node.bind as object).length || node.type === 'list' || node.use || node.src || node.showIf
      || node.hide && Object.values(node.hide).some(Boolean)) return [];
    return [node, ...guideNodes(node.children || [])];
  });
}
export function createFirstEditGuide(document: Document): Guide {
  const page = document.pages.find(page => guideNodes(page.tree).some(node => node.type === 'heading')) || document.pages[0];
  const nodes = page ? guideNodes(page.tree) : [];
  return { version: 1, dismissed: false, tasks: STEPS.flatMap(step => {
    const node = nodes.find(node => node.type === step.type);
    return node ? [{ id: node.id, pageId: page.id, type: step.type, before: guideFingerprint(node) }] : [];
  }) };
}
export function guideTaskState(task: Task, document: Document): 'pending' | 'saved' | 'missing' {
  const page = document.pages.find(page => page.id === task.pageId);
  const node = page && guideNodes(page.tree).find(node => node.id === task.id && node.type === task.type);
  return !node ? 'missing' : guideFingerprint(node) === task.before ? 'pending' : 'saved';
}

export function FirstEditGuide() {
  const site = L.siteDraft();
  const storageKey = site ? `pagecraft:first-edit:v1:${site.siteId}` : '';
  const [guide, setGuide] = useState<Guide | null>(() => {
    if (!site || !L.canStructure()) return null;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (stored?.version === 1 && typeof stored.dismissed === 'boolean' && Array.isArray(stored.tasks)
        && stored.tasks.length <= STEPS.length
        && new Set(stored.tasks.map((task: Task) => task?.type)).size === stored.tasks.length
        && stored.tasks.every((task: Task) => task && typeof task.id === 'string' && task.id.length > 0 && task.id.length <= 256
          && typeof task.pageId === 'string' && task.pageId.length > 0 && task.pageId.length <= 256
          && typeof task.before === 'string' && /^[a-f0-9]{1,8}$/.test(task.before)
          && STEPS.some(step => step.type === task.type))) return stored;
    } catch { /* Storage can be disabled without blocking editing. */ }
    if (new URLSearchParams(location.search).get('start') !== 'template') return null;
    const next = createFirstEditGuide(C.doc() as Document);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Optional guidance. */ }
    return next;
  });
  if (!site || !guide || guide.dismissed || !L.canStructure()) return null;
  const saved = L.guideSavedDocument() as Document | null;
  const states = guide.tasks.map(task => saved ? guideTaskState(task, saved) : 'pending');
  const currentIndex = states.findIndex(state => state === 'pending');
  const task = guide.tasks[currentIndex];
  const step = task && STEPS.find(step => step.type === task.type)!;
  const completed = states.filter(state => state === 'saved').length;
  const missing = states.filter(state => state === 'missing').length;
  const dismiss = () => {
    const next = { ...guide, dismissed: true };
    setGuide(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Optional guidance. */ }
  };
  const open = () => {
    const index = C.state.pages.findIndex(page => page.id === task.pageId);
    if (index < 0 || !guideNodes(C.state.pages[index].tree).some(node => node.id === task.id)) {
      L.toast('That template element is no longer here. Choose another element on the canvas.'); return;
    }
    L.guideSelect(index, task.id);
  };
  return <section class="pc-first-edit" aria-label="Personalize your template">
    <div class="pc-first-edit-head"><strong>Personalize your template</strong>
      <button type="button" class="bx" aria-label="Dismiss template guide" onClick={dismiss}><Icon name="close" size={12} /></button></div>
    <span class="note" role="status">{completed} of {guide.tasks.length} changes saved{missing ? ` · ${missing} targets unavailable` : ''}</span>
    {step ? <><b>{step.title}</b><p>{step.copy}</p><button type="button" class="btn" onClick={open}>{step.action}</button></>
      : <><b>{missing || !guide.tasks.length ? 'Continue with your page' : 'Your first edits are saved'}</b>
        <p>{missing || !guide.tasks.length ? 'Choose content directly on the canvas to personalize this template. ' : ''}Preview the result at each screen size. Configure any form destination before publishing.</p>
        <button type="button" class="btn" onClick={() => L.guidePreview()}>Preview your page</button></>}
    <small>Progress reflects saved changes. Undoing a change can reopen its step.</small>
  </section>;
}
