'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { getDb } from './firebase';
import type { MapNode, MindMap } from './types';
import { nodeDocData } from './maps-repo';

const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000;
const KEEP = 10;

/**
 * Stores a periodic snapshot of the map for recovery purposes.
 * Called when the editor opens; keeps the latest N versions.
 */
export async function maybeSnapshot(map: MindMap, nodes: MapNode[]) {
  try {
    const db = getDb();
    const versionsRef = collection(db, 'maps', map.id, 'versions');
    const latest = await getDocs(query(versionsRef, orderBy('created_at', 'desc'), limit(1)));
    const latestAt = latest.docs[0]?.data().created_at as string | undefined;
    if (latestAt && Date.now() - new Date(latestAt).getTime() < SNAPSHOT_INTERVAL_MS) return;

    await setDoc(doc(versionsRef), {
      map_id: map.id,
      created_at: new Date().toISOString(),
      snapshot: {
        map: { title: map.title, concept: map.concept },
        nodes: nodes.map((n) => nodeDocData(n)),
      },
    });

    const all = await getDocs(query(versionsRef, orderBy('created_at', 'desc')));
    for (const stale of all.docs.slice(KEEP)) {
      await deleteDoc(stale.ref);
    }
  } catch {
    // Snapshots are best-effort; never block editing.
  }
}
