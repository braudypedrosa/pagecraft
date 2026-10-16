import { cmsChoices } from '../../core/cms-validation';
import type { Collection, Condition, Field, Node as PcNode } from '../../core/types';
import { C } from '../ctx';

type PathMatch = {
  nextPath: string;
  before: Field;
  after: Field;
};

export type ContentSourceChange = {
  changed: boolean;
  cleared: number;
  remapped: number;
  blocked?: {
    component: string;
    additional: number;
  };
};

const semanticKey = (label: string, type: string) => {
  const name = String(label || '').normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
  return name ? `${name}\u0000${type}` : '';
};

function terminalField(collection: Collection, path: string): Field | null {
  const parts = String(path || '').split('.');
  const first = C.findField(collection, parts[0]);
  if (!first || parts.length === 1) return first;
  if (parts.length !== 2 || first.type !== 'ref' || !first.ref) return null;
  return C.findField(C.findCollection(first.ref), parts[1]);
}

/** Match only identities a person could recognize in both schemas. Field ids are deliberately
    absent: ids are local to a collection and may name unrelated values in the next source. */
function pathMatches(before: Collection, after: Collection): Map<string, PathMatch> {
  const oldPaths = C.fieldPaths(before).map(path => ({ ...path, field: terminalField(before, path.path) }));
  const newPaths = C.fieldPaths(after).map(path => ({ ...path, field: terminalField(after, path.path) }));
  const oldCounts = new Map<string, number>();
  const newByKey = new Map<string, typeof newPaths>();
  for (const path of oldPaths) {
    const key = semanticKey(path.label, path.type);
    if (!key) continue;
    oldCounts.set(key, (oldCounts.get(key) || 0) + 1);
  }
  for (const path of newPaths) {
    const key = semanticKey(path.label, path.type);
    if (!key) continue;
    const matches = newByKey.get(key) || [];
    matches.push(path);
    newByKey.set(key, matches);
  }
  const out = new Map<string, PathMatch>();
  for (const path of oldPaths) {
    if (!path.field) continue;
    const key = semanticKey(path.label, path.type);
    if (!key) continue;
    const matches = newByKey.get(key) || [];
    if (oldCounts.get(key) !== 1 || matches.length !== 1 || !matches[0].field) continue;
    out.set(path.path, { nextPath: matches[0].path, before: path.field, after: matches[0].field });
  }
  return out;
}

function directMatches(before: Collection, after: Collection): Map<string, PathMatch> {
  const oldCounts = new Map<string, number>();
  const newByKey = new Map<string, Field[]>();
  for (const field of before.fields || []) {
    const key = semanticKey(field.name, field.type);
    if (!key) continue;
    oldCounts.set(key, (oldCounts.get(key) || 0) + 1);
  }
  for (const field of after.fields || []) {
    const key = semanticKey(field.name, field.type);
    if (!key) continue;
    const matches = newByKey.get(key) || [];
    matches.push(field);
    newByKey.set(key, matches);
  }
  const out = new Map<string, PathMatch>();
  for (const field of before.fields || []) {
    const key = semanticKey(field.name, field.type);
    if (!key) continue;
    const matches = newByKey.get(key) || [];
    if (oldCounts.get(key) !== 1 || matches.length !== 1) continue;
    out.set(field.id, { nextPath: matches[0].id, before: field, after: matches[0] });
  }
  return out;
}

function comparisonSurvives(match: PathMatch, value: unknown): boolean {
  const wanted = String(value == null ? '' : value).trim();
  if (match.before.type === 'option') return wanted !== '' && cmsChoices(match.after.opts).includes(wanted);
  if (match.before.type === 'ref') return (match.before.ref || '') === (match.after.ref || '');
  return true;
}

/** A shared definition cannot be rewritten for one placement: that would change every other
    placement too. It can keep an inherited direct field connection only when the next source
    gives the exact same path the exact same meaning. Property connections are instance-local
    and remain safe, so they are deliberately absent here. */
function blockedDefinitions(nodes: PcNode[], before: Collection | null,
  after: Collection | null): ContentSourceChange['blocked'] {
  if (!after) return undefined; // a true disconnect preserves the definition as recovery data
  if (before?.id === after.id) return undefined; // the effective schema does not change
  const matches = before ? pathMatches(before, after) : new Map<string, PathMatch>();
  const blocked = new Map<string, string>();

  const safe = (path: string, value?: unknown, comparesValue = false) => {
    const match = matches.get(path) || null;
    return !!match && match.nextPath === path
      && (!comparesValue || comparisonSurvives(match, value));
  };

  const scanDefinition = (componentId: string, stack: Set<string>) => {
    if (stack.has(componentId)) return;
    const definition = C.findComponent(componentId);
    if (!definition) return;
    const nextStack = new Set(stack); nextStack.add(componentId);
    const scanNode = (node: PcNode, isDefinitionRoot = false) => {
      /* The first definition root is known to inherit the changed placement. Below it, an
         explicit node source or a nested component's definition source opens another scope. */
      if (!isDefinitionRoot && (node.src || C.findComponent(node.use)?.node.src)) return;
      for (const binding of Object.values(node.bind || {})) {
        if (binding.src === 'field' && !safe(binding.path)) {
          blocked.set(definition.id, definition.name);
          break;
        }
      }
      const condition = node.showIf;
      if (condition?.bind.src === 'field') {
        const comparesValue = condition.op === 'eq' || condition.op === 'ne';
        if (!safe(condition.bind.path, condition.value, comparesValue)) {
          blocked.set(definition.id, definition.name);
        }
      }
      if (node.use) scanDefinition(node.use, nextStack);
      for (const child of node.children || []) scanNode(child);
    };
    scanNode(definition.node, true);
  };

  for (const node of nodes) if (node.use) scanDefinition(node.use, new Set());
  const entries = [...blocked.entries()];
  return entries.length ? { component: entries[0][1], additional: entries.length - 1 } : undefined;
}

/** Nodes which will inherit this source. An explicit source on a nested node or component starts
    another scope and stays untouched even when its collection is temporarily unavailable. */
function scopedNodes(root: PcNode): PcNode[] {
  const out: PcNode[] = [];
  const visit = (node: PcNode, isRoot = false) => {
    const source = node.src || C.findComponent(node.use)?.node.src;
    if (!isRoot && source) return;
    out.push(node);
    (node.children || []).forEach(child => visit(child));
  };
  visit(root, true);
  return out;
}

/** Change one explicit content source and every field-relative choice that belongs to it.
    Planning is read-only; the source and all remaps enter history in one checkpoint. */
export function changeContentSource(root: PcNode, requestedId: string): ContentSourceChange {
  const definitionSource = C.findComponent(root.use)?.node.src || '';
  const currentExplicitId = root.src && C.findCollection(root.src) ? root.src : '';
  const nextExplicit = requestedId ? C.findCollection(requestedId) : null;
  const nextExplicitId = nextExplicit?.id || '';
  if (currentExplicitId === nextExplicitId) return { changed: false, cleared: 0, remapped: 0 };

  /* A component definition's root source is the fallback when its placement has no override.
     Removing an override can therefore be a source change rather than a move to None. */
  const before = C.findCollection(currentExplicitId || definitionSource);
  const after = C.findCollection(nextExplicitId || definitionSource);
  const nextId = nextExplicitId;
  const sameEffectiveSource = !!before && before.id === after?.id;

  const nodes = scopedNodes(root);
  const blocked = blockedDefinitions(nodes, before, after);
  if (blocked) return { changed: false, cleared: 0, remapped: 0, blocked };
  const paths = before && after ? pathMatches(before, after) : new Map<string, PathMatch>();
  const direct = before && after ? directMatches(before, after) : new Map<string, PathMatch>();
  const bindingPlans: { node: PcNode; key: string; nextPath: string }[] = [];
  const conditionPlans: { node: PcNode; condition: Condition | null }[] = [];
  let cleared = 0;
  let remapped = 0;

  /* Clearing a source deliberately leaves its bindings and conditions visible as disconnected
     recovery choices. A later source selection cannot prove their origin, so it clears them. */
  if (after && !sameEffectiveSource) for (const node of nodes) {
    for (const [key, binding] of Object.entries(node.bind || {})) {
      if (binding.src !== 'field') continue;
      const match = paths.get(binding.path);
      const nextPath = match?.nextPath || '';
      if (!nextPath) cleared++;
      else if (nextPath !== binding.path) remapped++;
      bindingPlans.push({ node, key, nextPath });
    }
    const condition = node.showIf;
    if (!condition || condition.bind.src !== 'field') continue;
    const match = paths.get(condition.bind.path);
    const comparesValue = condition.op === 'eq' || condition.op === 'ne';
    if (!match || (comparesValue && !comparisonSurvives(match, condition.value))) {
      conditionPlans.push({ node, condition: null });
      cleared++;
    } else {
      if (match.nextPath !== condition.bind.path) remapped++;
      conditionPlans.push({ node, condition: {
        ...condition, bind: { src: 'field', path: match.nextPath }
      } });
    }
  }

  let nextSort: string | null = null;
  let nextWhere: string | null = null;
  let clearFilterValue = false;
  if (root.type === 'list') {
    const sort = String(root.props.sort || '');
    const where = String(root.props.where || '');
    if (!after) {
      nextSort = '';
      if (sort) cleared++;
    } else if (!sameEffectiveSource) {
      const sortMatch = direct.get(sort);
      nextSort = sort ? sortMatch?.nextPath || '' : '';
      if (sort && !nextSort) cleared++;
      else if (sort && nextSort !== sort) remapped++;

      const whereMatch = direct.get(where);
      const comparesValue = !['set', 'unset'].includes(String(root.props.op || ''));
      const comparisonSafe = !!whereMatch && comparisonSurvives(whereMatch, root.props.val);
      const safeValue = !!whereMatch && (!comparesValue || comparisonSafe);
      nextWhere = where && safeValue ? whereMatch!.nextPath : '';
      if (where && !nextWhere) cleared++;
      else if (where && nextWhere !== where) remapped++;
      /* Presence filters do not use their saved comparison value, but retaining an option no
         longer offered or an item id from another reference target would let a later operator
         change reactivate unrelated data. Keep the presence test and remove only that value. */
      if (nextWhere && !comparesValue && root.props.val && !comparisonSafe) {
        clearFilterValue = true;
        cleared++;
      }
    }
  }

  C.edit(() => {
    for (const plan of bindingPlans) C.bindSet(plan.node, plan.key, C.bindField(plan.nextPath));
    for (const plan of conditionPlans) C.condSet(plan.node, plan.condition);
    if (nextSort !== null) root.props.sort = nextSort;
    if (nextWhere !== null) {
      root.props.where = nextWhere;
      if (!nextWhere) {
        root.props.op = 'is';
        delete root.props.val;
      }
    }
    if (clearFilterValue) delete root.props.val;
    C.srcSet(root, nextId);
  }, 'Change content source');
  return { changed: true, cleared, remapped };
}

export function sourceChangeSuffix(result: ContentSourceChange): string {
  if (!result.cleared) return '';
  return ` · ${result.cleared} incompatible ${result.cleared === 1 ? 'connection or setting' : 'connections or settings'} cleared`;
}

export function sourceChangeBlocked(result: ContentSourceChange): string {
  return result.blocked
    ? `Content source unchanged · “${result.blocked.component}” needs its CMS fields connected through component properties first.`
    : '';
}
