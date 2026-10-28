import type { SlideElement } from './types';

/**
 * Element tree helpers (P1-1.5).
 *
 * Groups own their children (`GroupElement.children`, child coordinates relative to the group
 * origin), so every editor action that used to walk the top-level array needs a depth-aware
 * variant once a group can be entered. These helpers return the *same* array reference when
 * nothing changed, which lets the store keep reference equality for untouched nodes.
 */

/** Depth-first flatten: parents before their children */
export function flattenElements(elements: SlideElement[]): SlideElement[] {
  const out: SlideElement[] = [];
  const walk = (list: SlideElement[]): void => {
    for (const element of list) {
      out.push(element);
      if (element.type === 'group') walk(element.children);
    }
  };
  walk(elements);
  return out;
}

export function findElementDeep(elements: SlideElement[], id: string): SlideElement | undefined {
  for (const element of elements) {
    if (element.id === id) return element;
    if (element.type === 'group') {
      const hit = findElementDeep(element.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Apply id → patch at any depth */
export function patchElementsDeep(
  elements: SlideElement[],
  patches: Map<string, Partial<SlideElement>>,
): SlideElement[] {
  let changed = false;
  const next = elements.map((element) => {
    const patch = patches.get(element.id);
    let result = element;
    if (patch) {
      result = { ...element, ...patch } as SlideElement;
      changed = true;
    }
    if (result.type === 'group') {
      const children = patchElementsDeep(result.children, patches);
      if (children !== result.children) {
        result = { ...result, children };
        changed = true;
      }
    }
    return result;
  });
  return changed ? next : elements;
}

/** Remove every matching id, including children inside groups */
export function removeElementsDeep(elements: SlideElement[], ids: string[]): SlideElement[] {
  let changed = false;
  const next: SlideElement[] = [];
  for (const element of elements) {
    if (ids.includes(element.id)) {
      changed = true;
      continue;
    }
    if (element.type === 'group') {
      const children = removeElementsDeep(element.children, ids);
      if (children !== element.children) {
        changed = true;
        next.push({ ...element, children });
        continue;
      }
    }
    next.push(element);
  }
  return changed ? next : elements;
}

/** Move every selected element; `offset` gets the element and returns its new local position */
export function offsetElementsDeep(
  elements: SlideElement[],
  ids: string[],
  offset: (element: SlideElement) => { x: number; y: number } | null,
): SlideElement[] {
  let changed = false;
  const next = elements.map((element) => {
    if (ids.includes(element.id)) {
      const position = offset(element);
      if (!position) return element;
      changed = true;
      return { ...element, x: position.x, y: position.y } as SlideElement;
    }
    if (element.type === 'group') {
      const children = offsetElementsDeep(element.children, ids, offset);
      if (children !== element.children) {
        changed = true;
        return { ...element, children };
      }
    }
    return element;
  });
  return changed ? next : elements;
}

/** Elements at the level reached by `path` (entered group ids, top-down); top level for [] */
export function elementsAtPath(elements: SlideElement[], path: string[]): SlideElement[] {
  let level = elements;
  for (const id of path) {
    const group = level.find((element) => element.id === id);
    if (!group || group.type !== 'group') return level;
    level = group.children;
  }
  return level;
}
