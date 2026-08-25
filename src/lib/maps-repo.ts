'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDb } from './firebase';
import type { MapBackup, MapNode, MindMap } from './types';

const BATCH_LIMIT = 450; // Firestore allows 500 ops per batch; keep headroom.

function now() {
  return new Date().toISOString();
}

export function nodeDocData(n: MapNode): Record<string, unknown> {
  // Firestore rejects undefined values; normalize them away.
  return {
    id: n.id,
    map_id: n.map_id,
    parent_id: n.parent_id ?? null,
    title: n.title ?? '',
    description: n.description ?? '',
    notes: n.notes ?? '',
    node_type: n.node_type ?? 'observacao',
    importance: n.importance ?? 'normal',
    status: n.status ?? 'ideia',
    tags: n.tags ?? [],
    refs: (n.refs ?? []).map((r) => ({
      book: r.book ?? '',
      chapter: r.chapter ?? '',
      verse: r.verse ?? '',
      comment: r.comment ?? '',
    })),
    order_index: n.order_index ?? 0,
    position_x: n.position_x ?? null,
    position_y: n.position_y ?? null,
    collapsed: n.collapsed ?? false,
    created_at: n.created_at ?? now(),
    updated_at: now(),
    created_by: n.created_by ?? null,
  };
}

export async function batchSetNodes(mapId: string, nodes: MapNode[]) {
  const db = getDb();
  for (let i = 0; i < nodes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const n of nodes.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(db, 'maps', mapId, 'nodes', n.id), nodeDocData(n));
    }
    await batch.commit();
  }
}

function mergeMaps(...lists: MindMap[][]): MindMap[] {
  const byId = new Map<string, MindMap>();
  for (const list of lists) for (const m of list) byId.set(m.id, m);
  const maps = [...byId.values()];
  maps.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  return maps;
}

const toMaps = (snap: { docs: { id: string; data: () => unknown }[] }) =>
  snap.docs.map((d) => ({ ...(d.data() as MindMap), id: d.id }));

/** Own maps + maps shared with this e-mail. */
export async function listMaps(uid: string, email?: string | null): Promise<MindMap[]> {
  const db = getDb();
  const queries = [getDocs(query(collection(db, 'maps'), where('owner_id', '==', uid)))];
  if (email) {
    queries.push(
      getDocs(
        query(collection(db, 'maps'), where('member_emails', 'array-contains', email.toLowerCase()))
      )
    );
  }
  const snaps = await Promise.all(queries);
  return mergeMaps(...snaps.map(toMaps));
}

/** Instant read from the local cache; null when nothing is cached yet. */
export async function listMapsFromCache(
  uid: string,
  email?: string | null
): Promise<MindMap[] | null> {
  try {
    const db = getDb();
    const own = await getDocsFromCache(
      query(collection(db, 'maps'), where('owner_id', '==', uid))
    ).catch(() => null);
    const shared = email
      ? await getDocsFromCache(
          query(
            collection(db, 'maps'),
            where('member_emails', 'array-contains', email.toLowerCase())
          )
        ).catch(() => null)
      : null;
    const lists = [own, shared].filter(Boolean).map((s) => toMaps(s!));
    const maps = mergeMaps(...lists);
    return maps.length ? maps : null;
  } catch {
    return null;
  }
}

/** Replaces the list of e-mails that can access the map (owner action). */
export async function setMapMembers(mapId: string, emails: string[]) {
  const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  await updateDoc(doc(getDb(), 'maps', mapId), { member_emails: clean, updated_at: now() });
  return clean;
}

export async function createMap(uid: string, title: string, concept: string): Promise<MindMap> {
  const db = getDb();
  const id = crypto.randomUUID();
  const map: MindMap = {
    id,
    owner_id: uid,
    title,
    concept,
    created_at: now(),
    updated_at: now(),
  };
  await setDoc(doc(db, 'maps', id), { ...map });
  return map;
}

export async function renameMap(mapId: string, title: string) {
  await updateDoc(doc(getDb(), 'maps', mapId), { title, updated_at: now() });
}

export async function fetchNodes(mapId: string): Promise<MapNode[]> {
  const snap = await getDocs(collection(getDb(), 'maps', mapId, 'nodes'));
  return snap.docs.map((d) => d.data() as MapNode);
}

export async function fetchMapWithNodes(
  mapId: string
): Promise<{ map: MindMap | null; nodes: MapNode[]; fromCache: boolean }> {
  const db = getDb();
  const [mapSnap, nodesSnap] = await Promise.all([
    getDoc(doc(db, 'maps', mapId)),
    getDocs(collection(db, 'maps', mapId, 'nodes')),
  ]);
  if (!mapSnap.exists()) return { map: null, nodes: [], fromCache: mapSnap.metadata.fromCache };
  return {
    map: { ...(mapSnap.data() as MindMap), id: mapSnap.id },
    nodes: nodesSnap.docs.map((d) => d.data() as MapNode),
    fromCache: mapSnap.metadata.fromCache || nodesSnap.metadata.fromCache,
  };
}

/** Instant read of a map + nodes from the local cache; null on cache miss. */
export async function fetchMapWithNodesFromCache(
  mapId: string
): Promise<{ map: MindMap; nodes: MapNode[] } | null> {
  try {
    const db = getDb();
    const [mapSnap, nodesSnap] = await Promise.all([
      getDocFromCache(doc(db, 'maps', mapId)),
      getDocsFromCache(collection(db, 'maps', mapId, 'nodes')),
    ]);
    if (!mapSnap.exists() || nodesSnap.empty) return null;
    return {
      map: { ...(mapSnap.data() as MindMap), id: mapSnap.id },
      nodes: nodesSnap.docs.map((d) => d.data() as MapNode),
    };
  } catch {
    return null;
  }
}

/** Copies a map with all nodes (new ids), preserving hierarchy. */
export async function copyMapWithNodes(
  source: MindMap,
  nodes: MapNode[],
  uid: string,
  title: string
): Promise<MindMap> {
  const newMap = await createMap(uid, title, source.concept);
  const idMap = new Map<string, string>();
  nodes.forEach((n) => idMap.set(n.id, crypto.randomUUID()));
  const copies = nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    map_id: newMap.id,
    parent_id: n.parent_id ? (idMap.get(n.parent_id) ?? null) : null,
    created_by: uid,
    created_at: undefined,
    updated_at: undefined,
  })) as MapNode[];
  await batchSetNodes(newMap.id, copies);
  return newMap;
}

export async function importBackupAsMap(backup: MapBackup, uid: string): Promise<MindMap> {
  const source: MindMap = {
    id: '',
    owner_id: uid,
    title: `${backup.map.title} (importado)`,
    concept: backup.map.concept,
    created_at: now(),
    updated_at: now(),
  };
  return copyMapWithNodes({ ...source, title: source.title }, backup.nodes, uid, source.title);
}

async function deleteSubcollection(mapId: string, sub: string) {
  const db = getDb();
  const snap = await getDocs(collection(db, 'maps', mapId, sub));
  const ids = snap.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + BATCH_LIMIT)) {
      batch.delete(doc(db, 'maps', mapId, sub, id));
    }
    await batch.commit();
  }
}

export async function deleteMapDeep(mapId: string) {
  await deleteSubcollection(mapId, 'nodes');
  await deleteSubcollection(mapId, 'versions');
  await deleteDoc(doc(getDb(), 'maps', mapId));
}
