import dagre from 'dagre';
import type { MapNode } from './types';

export interface NodeSize {
  width: number;
  height: number;
}

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
 * Automatic left-to-right tree layout via dagre.
 * Nodes with manually stored positions keep them (unless ignoreManual).
 */
export function computeLayout(
  childrenOf: Map<string | null, MapNode[]>,
  visible: Set<string>,
  depths: Map<string, number>,
  ignoreManual = false
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 18, ranksep: 90, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  const ordered: MapNode[] = [];
  const walk = (parent: string | null) => {
    for (const c of childrenOf.get(parent) ?? []) {
      if (!visible.has(c.id)) continue;
      ordered.push(c);
      if (!c.collapsed) walk(c.id);
    }
  };
  walk(null);

  for (const n of ordered) {
    const size = nodeSize(n, depths.get(n.id) ?? 0);
    g.setNode(n.id, { width: size.width, height: size.height });
  }
  for (const n of ordered) {
    if (n.parent_id && visible.has(n.parent_id)) {
      g.setEdge(n.parent_id, n.id);
    }
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const n of ordered) {
    const manual = !ignoreManual && n.position_x != null && n.position_y != null;
    if (manual) {
      positions.set(n.id, { x: n.position_x!, y: n.position_y! });
    } else {
      const p = g.node(n.id);
      const size = nodeSize(n, depths.get(n.id) ?? 0);
      positions.set(n.id, { x: p.x - size.width / 2, y: p.y - size.height / 2 });
    }
  }
  return positions;
}
