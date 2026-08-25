'use client';

import { create } from 'zustand';
import type { MapNode, MindMap } from '@/lib/types';
import { emptyNode } from '@/lib/types';
import type { SaveQueue, SaveStatus } from '@/lib/persistence';
import { buildChildrenIndex } from '@/lib/layout';

type NodesRecord = Record<string, MapNode>;

const HISTORY_LIMIT = 80;
const COALESCE_MS = 2500;

interface MapStore {
  map: MindMap | null;
  nodes: NodesRecord;
  rootId: string | null;
  selectedId: string | null;
  editingId: string | null;
  highlightId: string | null;
  presenting: boolean;
  saveStatus: SaveStatus;
  past: NodesRecord[];
  future: NodesRecord[];

  init: (map: MindMap, nodes: MapNode[], queue: SaveQueue) => void;
  reset: () => void;
  setSaveStatus: (s: SaveStatus) => void;
  select: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  setHighlight: (id: string | null) => void;
  setPresenting: (p: boolean) => void;
  setMapMeta: (patch: Partial<Pick<MindMap, 'title' | 'concept'>>) => void;

  createChild: (parentId: string, title?: string) => string;
  createSibling: (id: string, title?: string) => string | null;
  reparent: (id: string, newParentId: string, opts?: { after?: string }) => boolean;
  moveChildren: (fromId: string, toId: string) => number;
  updateNode: (id: string, patch: Partial<MapNode>, coalesceKey?: string) => void;
  deleteSubtree: (id: string) => void;
  duplicateSubtree: (id: string) => string | null;
  moveNode: (id: string, x: number, y: number) => void;
  toggleCollapsed: (id: string) => void;
  setBranchCollapsed: (id: string, collapsed: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandOnlyBranch: (id: string) => void;
  organize: () => void;
  undo: () => void;
  redo: () => void;

  subtreeIds: (id: string) => string[];
  pathTo: (id: string) => MapNode[];
  /** Applies changes coming from other devices/users (no history, no save queue). */
  applyRemoteChanges: (upserts: MapNode[], deletes: string[]) => void;
}

let queueRef: SaveQueue | null = null;
let lastHistoryKey = '';
let lastHistoryAt = 0;

function diffAndQueue(prev: NodesRecord, next: NodesRecord) {
  if (!queueRef) return;
  for (const id of Object.keys(prev)) {
    if (!(id in next)) queueRef.queueDelete(id);
  }
  for (const [id, node] of Object.entries(next)) {
    if (prev[id] !== node) queueRef.queueUpsert(node);
  }
}

export const useMapStore = create<MapStore>((set, get) => {
  /** Applies a nodes mutation with history tracking and persistence. */
  function mutate(
    fn: (nodes: NodesRecord) => NodesRecord,
    opts: { coalesceKey?: string } = {}
  ) {
    const state = get();
    const prev = state.nodes;
    const next = fn(prev);
    if (next === prev) return;

    const now = Date.now();
    const coalesce =
      opts.coalesceKey &&
      opts.coalesceKey === lastHistoryKey &&
      now - lastHistoryAt < COALESCE_MS;

    lastHistoryKey = opts.coalesceKey ?? '';
    lastHistoryAt = now;

    const past = coalesce ? state.past : [...state.past, prev].slice(-HISTORY_LIMIT);
    diffAndQueue(prev, next);
    set({ nodes: next, past, future: [] });
  }

  function childrenOf(nodes: NodesRecord, parentId: string | null): MapNode[] {
    return Object.values(nodes)
      .filter((n) => (n.parent_id ?? null) === parentId)
      .sort((a, b) => a.order_index - b.order_index);
  }

  return {
    map: null,
    nodes: {},
    rootId: null,
    selectedId: null,
    editingId: null,
    highlightId: null,
    presenting: false,
    saveStatus: 'idle',
    past: [],
    future: [],

    init: (map, nodes, queue) => {
      queueRef = queue;
      lastHistoryKey = '';
      const record: NodesRecord = {};
      nodes.forEach((n) => (record[n.id] = n));
      const root = nodes.find((n) => !n.parent_id);
      set({
        map,
        nodes: record,
        rootId: root?.id ?? null,
        selectedId: null,
        editingId: null,
        highlightId: null,
        presenting: false,
        saveStatus: 'idle',
        past: [],
        future: [],
      });
    },

    reset: () => {
      queueRef = null;
      set({ map: null, nodes: {}, rootId: null, selectedId: null, past: [], future: [] });
    },

    setSaveStatus: (saveStatus) => set({ saveStatus }),
    select: (selectedId) => set({ selectedId }),
    setEditing: (editingId) => set({ editingId }),
    setHighlight: (highlightId) => set({ highlightId }),
    setPresenting: (presenting) => set({ presenting, selectedId: null, editingId: null }),
    setMapMeta: (patch) =>
      set((s) => ({ map: s.map ? { ...s.map, ...patch } : s.map })),

    createChild: (parentId, title = '') => {
      const id = crypto.randomUUID();
      mutate((nodes) => {
        const parent = nodes[parentId];
        if (!parent) return nodes;
        const siblings = childrenOf(nodes, parentId);
        const order = siblings.length ? siblings[siblings.length - 1].order_index + 1 : 0;
        const child = emptyNode({
          id,
          map_id: parent.map_id,
          parent_id: parentId,
          title,
          order_index: order,
        });
        const next = { ...nodes, [id]: child };
        if (parent.collapsed) next[parentId] = { ...parent, collapsed: false };
        return next;
      });
      set({ selectedId: id, editingId: title ? null : id });
      return id;
    },

    createSibling: (id, title = '') => {
      const node = get().nodes[id];
      if (!node || !node.parent_id) return null;
      const newId = crypto.randomUUID();
      mutate((nodes) => {
        const siblings = childrenOf(nodes, node.parent_id!);
        const idx = siblings.findIndex((s) => s.id === id);
        const next: NodesRecord = { ...nodes };
        // Shift later siblings to open a slot right after the reference node.
        siblings.slice(idx + 1).forEach((s) => {
          next[s.id] = { ...s, order_index: s.order_index + 1 };
        });
        next[newId] = emptyNode({
          id: newId,
          map_id: node.map_id,
          parent_id: node.parent_id,
          title,
          order_index: node.order_index + 1,
        });
        return next;
      });
      set({ selectedId: newId, editingId: title ? null : newId });
      return newId;
    },

    reparent: (id, newParentId, opts) => {
      const s = get();
      const nodes = s.nodes;
      if (id === s.rootId) return false;
      if (!nodes[id] || !nodes[newParentId]) return false;
      // A node can never be moved into its own subtree (would create a cycle).
      if (s.subtreeIds(id).includes(newParentId)) return false;

      mutate((current) => {
        const next: NodesRecord = { ...current };
        const siblings = childrenOf(current, newParentId).filter((n) => n.id !== id);
        let order: number;
        if (opts?.after) {
          const idx = siblings.findIndex((x) => x.id === opts.after);
          if (idx >= 0) {
            order = siblings[idx].order_index + 1;
            siblings.slice(idx + 1).forEach((sb) => {
              next[sb.id] = { ...sb, order_index: sb.order_index + 1 };
            });
          } else {
            order = siblings.length ? siblings[siblings.length - 1].order_index + 1 : 0;
          }
        } else {
          order = siblings.length ? siblings[siblings.length - 1].order_index + 1 : 0;
        }
        next[id] = {
          ...current[id],
          parent_id: newParentId,
          order_index: order,
          position_x: null,
          position_y: null,
        };
        // Make the result visible right away.
        const parent = next[newParentId] ?? current[newParentId];
        if (parent.collapsed) next[newParentId] = { ...parent, collapsed: false };
        return next;
      });
      set({ selectedId: id });
      return true;
    },

    moveChildren: (fromId, toId) => {
      const s = get();
      const nodes = s.nodes;
      if (!nodes[fromId] || !nodes[toId] || fromId === toId) return 0;
      const kids = childrenOf(nodes, fromId).filter(
        // The target itself and any child whose subtree contains the target stay put.
        (k) => k.id !== toId && !s.subtreeIds(k.id).includes(toId)
      );
      if (!kids.length) return 0;

      mutate((current) => {
        const next: NodesRecord = { ...current };
        const existing = childrenOf(current, toId);
        let order = existing.length ? existing[existing.length - 1].order_index + 1 : 0;
        for (const kid of kids) {
          next[kid.id] = {
            ...current[kid.id],
            parent_id: toId,
            order_index: order++,
            position_x: null,
            position_y: null,
          };
        }
        const target = next[toId] ?? current[toId];
        if (target.collapsed) next[toId] = { ...target, collapsed: false };
        return next;
      });
      set({ selectedId: toId });
      return kids.length;
    },

    updateNode: (id, patch, coalesceKey) => {
      mutate(
        (nodes) => {
          const node = nodes[id];
          if (!node) return nodes;
          return { ...nodes, [id]: { ...node, ...patch } };
        },
        { coalesceKey }
      );
    },

    deleteSubtree: (id) => {
      const ids = new Set(get().subtreeIds(id));
      mutate((nodes) => {
        const next: NodesRecord = {};
        for (const [nid, n] of Object.entries(nodes)) {
          if (!ids.has(nid)) next[nid] = n;
        }
        return next;
      });
      const s = get();
      if (s.selectedId && ids.has(s.selectedId)) set({ selectedId: null, editingId: null });
    },

    duplicateSubtree: (id) => {
      const state = get();
      const source = state.nodes[id];
      if (!source) return null;
      const ids = state.subtreeIds(id);
      const idMap = new Map<string, string>();
      ids.forEach((oldId) => idMap.set(oldId, crypto.randomUUID()));
      const newRootId = idMap.get(id)!;

      mutate((nodes) => {
        const next: NodesRecord = { ...nodes };
        for (const oldId of ids) {
          const n = nodes[oldId];
          const copy: MapNode = {
            ...n,
            id: idMap.get(oldId)!,
            parent_id:
              oldId === id ? n.parent_id : idMap.get(n.parent_id ?? '') ?? n.parent_id,
            position_x: oldId === id && n.position_x != null ? n.position_x + 40 : n.position_x,
            position_y: oldId === id && n.position_y != null ? n.position_y + 40 : n.position_y,
            created_at: undefined,
            updated_at: undefined,
          };
          if (oldId === id) {
            copy.title = `${n.title} (cópia)`;
            copy.order_index = n.order_index + 1;
          }
          next[copy.id] = copy;
        }
        return next;
      });
      set({ selectedId: newRootId });
      return newRootId;
    },

    moveNode: (id, x, y) => {
      get().updateNode(id, { position_x: x, position_y: y }, `move:${id}`);
    },

    toggleCollapsed: (id) => {
      const node = get().nodes[id];
      if (!node) return;
      get().updateNode(id, { collapsed: !node.collapsed }, `collapse:${id}`);
    },

    setBranchCollapsed: (id, collapsed) => {
      const ids = get().subtreeIds(id);
      mutate((nodes) => {
        const next = { ...nodes };
        const index = buildChildrenIndex(Object.values(nodes));
        for (const nid of ids) {
          const hasChildren = (index.get(nid) ?? []).length > 0;
          if (hasChildren && nodes[nid].collapsed !== collapsed) {
            next[nid] = { ...nodes[nid], collapsed };
          }
        }
        return next;
      });
    },

    expandAll: () => {
      mutate((nodes) => {
        const next = { ...nodes };
        let changed = false;
        for (const [id, n] of Object.entries(nodes)) {
          if (n.collapsed) {
            next[id] = { ...n, collapsed: false };
            changed = true;
          }
        }
        return changed ? next : nodes;
      });
    },

    collapseAll: () => {
      const rootId = get().rootId;
      mutate((nodes) => {
        const next = { ...nodes };
        const index = buildChildrenIndex(Object.values(nodes));
        let changed = false;
        for (const [id, n] of Object.entries(nodes)) {
          const hasChildren = (index.get(id) ?? []).length > 0;
          const shouldCollapse = hasChildren && id !== rootId;
          if (shouldCollapse && !n.collapsed) {
            next[id] = { ...n, collapsed: true };
            changed = true;
          }
        }
        return changed ? next : nodes;
      });
    },

    expandOnlyBranch: (id) => {
      const state = get();
      const rootId = state.rootId;
      const path = new Set(state.pathTo(id).map((n) => n.id));
      const subtree = new Set(state.subtreeIds(id));
      mutate((nodes) => {
        const next = { ...nodes };
        const index = buildChildrenIndex(Object.values(nodes));
        for (const [nid, n] of Object.entries(nodes)) {
          const hasChildren = (index.get(nid) ?? []).length > 0;
          if (!hasChildren) continue;
          const shouldExpand = path.has(nid) || subtree.has(nid) || nid === rootId;
          if (n.collapsed === shouldExpand) {
            next[nid] = { ...n, collapsed: !shouldExpand };
          }
        }
        return next;
      });
    },

    organize: () => {
      mutate((nodes) => {
        const next = { ...nodes };
        let changed = false;
        for (const [id, n] of Object.entries(nodes)) {
          if (n.position_x != null || n.position_y != null) {
            next[id] = { ...n, position_x: null, position_y: null };
            changed = true;
          }
        }
        return changed ? next : nodes;
      });
    },

    undo: () => {
      const { past, future, nodes } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      diffAndQueue(nodes, prev);
      lastHistoryKey = '';
      set({ nodes: prev, past: past.slice(0, -1), future: [...future, nodes] });
    },

    redo: () => {
      const { past, future, nodes } = get();
      if (!future.length) return;
      const next = future[future.length - 1];
      diffAndQueue(nodes, next);
      lastHistoryKey = '';
      set({ nodes: next, past: [...past, nodes], future: future.slice(0, -1) });
    },

    subtreeIds: (id) => {
      const nodes = get().nodes;
      const index = buildChildrenIndex(Object.values(nodes));
      const result: string[] = [];
      const stack = [id];
      while (stack.length) {
        const current = stack.pop()!;
        if (!nodes[current]) continue;
        result.push(current);
        (index.get(current) ?? []).forEach((c) => stack.push(c.id));
      }
      return result;
    },

    applyRemoteChanges: (upserts, deletes) => {
      const state = get();
      const next = { ...state.nodes };
      let changed = false;
      for (const n of upserts) {
        const cur = next[n.id];
        if (!cur || (n.updated_at ?? '') !== (cur.updated_at ?? '')) {
          next[n.id] = n;
          changed = true;
        }
      }
      for (const id of deletes) {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      }
      if (!changed) return;
      const root = Object.values(next).find((n) => !n.parent_id);
      const selectedGone = state.selectedId && !next[state.selectedId];
      set({
        nodes: next,
        rootId: root?.id ?? null,
        ...(selectedGone ? { selectedId: null, editingId: null } : {}),
      });
    },

    pathTo: (id) => {
      const nodes = get().nodes;
      const path: MapNode[] = [];
      let current: MapNode | undefined = nodes[id];
      let guard = 0;
      while (current && guard++ < 200) {
        path.unshift(current);
        current = current.parent_id ? nodes[current.parent_id] : undefined;
      }
      return path;
    },
  };
});
