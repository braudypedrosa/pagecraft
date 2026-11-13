import type { Bp, Control, Decls, Node as PcNode, StateKey, StyleClass } from '../../core/types';

const BOX_SIDES = ['top', 'right', 'bottom', 'left'];

/** The declarations owned by one exact inspector scope. No responsive fallback is read here:
 * the modified filter and bulk reset must describe only the layer currently being edited. */
export function scopeDeclarations(owner: PcNode | StyleClass, breakpoint: Bp, state: StateKey | ''): Decls {
  const css = state ? owner.st?.[state] : owner.css;
  return css?.[breakpoint] || {};
}

export function controlIsModified(control: Control, declarations: Decls): boolean {
  if (control.t === 'border') {
    return Object.keys(declarations).some(key => /^border(?:-(?:top|right|bottom|left))?-(?:style|width|color)$/.test(key));
  }
  if (!control.c) return false;
  if (control.t === 'box') {
    return declarations[control.c] !== undefined
      || BOX_SIDES.some(side => declarations[`${control.c}-${side}`] !== undefined);
  }
  if (control.paint) {
    return declarations[control.c] !== undefined
      || /^linear-gradient\(/i.test(String(declarations['background-image'] || ''))
      || /^linear-gradient\(/i.test(String(declarations.background || ''));
  }
  return declarations[control.c] !== undefined;
}

export function advancedControlIsModified(control: Control, node: PcNode, declarations: Decls): boolean {
  if (control.c) return controlIsModified(control, declarations);
  if (control.k === '_id') return !!node.adv.htmlId;
  if (control.k === '_cls') return !!node.adv.cls;
  if (control.k === '_css') return !!node.adv.css;
  return false;
}

export function hasOwnBreakpointChanges(node: PcNode, breakpoint: Bp, state: StateKey | ''): boolean {
  return Object.keys(scopeDeclarations(node, breakpoint, state)).length > 0;
}

export function clearOwnBreakpointChanges(node: PcNode, breakpoint: Bp, state: StateKey | ''): void {
  const css = state ? node.st?.[state] : node.css;
  if (!css) return;
  css[breakpoint] = {};
}

const PRIORITY = [
  /^(text|label|heading|quotation|image source|video url)$/i,
  /^(size|width|height|measure|min height|slides in view)$/i,
  /align|distribution|distribute|position/i,
  /^(padding|margin|gap|spacing|link spacing)$/i,
  /colour|color|background/i,
  /link/i,
];

/** Stable sort: frequent visual adjustments rise, while every unclassified control keeps its
 * authored order. Content itself stays first, ahead of the controls that format or link it. */
export function commonControlsFirst(controls: Control[]): Control[] {
  return controls.map((control, index) => ({
    control,
    index,
    rank: control.k && control.t !== 'link' ? -1 : PRIORITY.findIndex(rule => rule.test(control.label || ''))
  }))
    .sort((a, b) => {
      const ar = a.control.k && a.control.t !== 'link' ? 0 : a.rank < 0 ? PRIORITY.length + 1 : a.rank + 1;
      const br = b.control.k && b.control.t !== 'link' ? 0 : b.rank < 0 ? PRIORITY.length + 1 : b.rank + 1;
      return ar - br || a.index - b.index;
    })
    .map(item => item.control);
}
