import type { MapNode } from './types';

export interface NodeSize {
  width: number;
  height: number;
}

const RANK_SEP = 90; // horizontal gap between depth columns
const NODE_SEP = 14; // vertical gap between siblings
const MARGIN = 40;

export function nodeSize(node: MapNode, depth: number): NodeSize {
  const base = depth === 0 ? 30 : depth === 1 ? 24 : 18;
  const perChar = depth === 0 ? 11 : depth === 1 ? 9 : 8;
  const width = Math.min(300, Math.max(depth === 0 ? 220 : 150, base + node.title.length * perChar));
  const height = depth === 0 ? 64 : depth === 1 ? 52 : 44;
  return { width, height };
}

/** Depth of each node (root = 0). */
export function computeDepths(
  childrenOf: Map<string | null, MapNode[]>
): Map<string, number> {
  const depths = new Map<string, number>();
  const roots = childrenOf.get(null) ?? [];
  const stack = roots.map((r) => ({ id: r.id, d: 0 }));
  while (stack.length) {
    const { id, d } = stack.pop()!;
    depths.set(id, d);
    (childrenOf.get(id) ?? []).forEach((c) => stack.push({ id: c.id, d: d + 1 }));
  }
  return depths;
}

export function buildChildrenIndex(nodes: MapNode[]): Map<string | null, MapNode[]> {
  const childrenOf = new Map<string | null, MapNode[]>();
  for (const n of nodes) {
    const key = n.parent_id ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(n);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title));
  }
  return childrenOf;
}

/** IDs visible after applying collapsed flags (children of a collapsed node are hidden). */
export function computeVisibleIds(childrenOf: Map<string | null, MapNode[]>): Set<string> {
  const visible = new Set<string>();
  const roots = childrenOf.get(null) ?? [];
  const stack = [...roots];
  while (stack.length) {
    const n = stack.pop()!;
    visible.add(n.id);
    if (!n.collapsed) {
      (childrenOf.get(n.id) ?? []).forEach((c) => stack.push(c));
    }
  }
  return visible;
}

/**
 * Automatic left-to-right tidy tree layout, O(n).
 * Nodes with manually stored positions keep them (unless ignoreManual).
 */
export function computeLayout(
  childrenOf: Map<string | null, MapNode[]>,
  visible: Set<string>,
  depths: Map<string, number>,
  ignoreManual = false
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  const visibleChildren = (id: string) =>
    (childrenOf.get(id) ?? []).filter((c) => visible.has(c.id));

  // Column x offsets from the widest node of each depth.
  const colWidth = new Map<number, number>();
  for (const list of childrenOf.values()) {
    for (const n of list) {
      if (!visible.has(n.id)) continue;
      const d = depths.get(n.id) ?? 0;
      const w = nodeSize(n, d).width;
      if (w > (colWidth.get(d) ?? 0)) colWidth.set(d, w);
    }
  }
  const colX = new Map<number, number>();
  let acc = MARGIN;
  const maxDepth = colWidth.size ? Math.max(...colWidth.keys()) : 0;
  for (let d = 0; d <= maxDepth; d++) {
    colX.set(d, acc);
    acc += (colWidth.get(d) ?? 160) + RANK_SEP;
  }

  let cursorY = MARGIN;

  // Post-order placement: leaves stack vertically, parents center on their children.
  const place = (node: MapNode, depth: number): number => {
    const size = nodeSize(node, depth);
    const kids = node.collapsed ? [] : visibleChildren(node.id);
    let centerY: number;

    if (kids.length === 0) {
      centerY = cursorY + size.height / 2;
      cursorY += size.height + NODE_SEP;
    } else {
      const startY = cursorY;
      const centers = kids.map((k) => place(k, depth + 1));
      centerY = (centers[0] + centers[centers.length - 1]) / 2;
      // Guarantee the parent itself never overlaps the next sibling subtree.
      const bottom = Math.max(cursorY, centerY + size.height / 2 + NODE_SEP);
      cursorY = Math.max(cursorY, bottom, startY + size.height + NODE_SEP);
    }

    positions.set(node.id, { x: colX.get(depth) ?? MARGIN, y: centerY - size.height / 2 });
    return centerY;
  };

  for (const root of childrenOf.get(null) ?? []) {
    if (visible.has(root.id)) place(root, 0);
  }

  // Manual positions override the computed ones.
  if (!ignoreManual) {
    for (const list of childrenOf.values()) {
      for (const n of list) {
        if (visible.has(n.id) && n.position_x != null && n.position_y != null) {
          positions.set(n.id, { x: n.position_x, y: n.position_y });
        }
      }
    }
  }
  return positions;
}
