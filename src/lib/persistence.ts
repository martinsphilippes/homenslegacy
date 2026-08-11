'use client';

import { doc, writeBatch } from 'firebase/firestore';
import { getDb } from './firebase';
import { nodeDocData } from './maps-repo';
import type { MapNode } from './types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

const DEBOUNCE_MS = 700;
const BATCH_LIMIT = 450;

/**
 * Debounced save queue on top of Firestore.
 * Firestore's persistent local cache makes writes durable offline and syncs
 * them automatically on reconnect; this queue adds debouncing and a save
 * status for the UI.
 */
export class SaveQueue {
  private upserts = new Map<string, MapNode>();
  private deletes = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = 0;
  private destroyed = false;

  constructor(
    private mapId: string,
    private onStatus: (s: SaveStatus) => void
  ) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = () => {
    if (this.inFlight > 0 || this.hasPending()) this.onStatus('saving');
  };

  private handleOffline = () => {
    this.onStatus('offline');
  };

  hasPending() {
    return this.upserts.size > 0 || this.deletes.size > 0;
  }

  queueUpsert(node: MapNode) {
    this.deletes.delete(node.id);
    this.upserts.set(node.id, node);
    this.schedule();
  }

  queueDelete(id: string) {
    this.upserts.delete(id);
    this.deletes.add(id);
    this.schedule();
  }

  private schedule() {
    this.onStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'saving');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  /**
   * Hands everything pending to Firestore. The local cache accepts writes
   * instantly (even offline); the returned promises resolve on server ack.
   */
  flush(): Promise<void> {
    if (this.destroyed || !this.hasPending()) {
      if (this.inFlight === 0 && !this.hasPending()) this.onStatus('saved');
      return Promise.resolve();
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const upserts = [...this.upserts.values()];
    const deletes = [...this.deletes];
    this.upserts.clear();
    this.deletes.clear();

    const db = getDb();
    const ops: Array<{ type: 'set' | 'delete'; node?: MapNode; id: string }> = [
      ...upserts.map((n) => ({ type: 'set' as const, node: n, id: n.id })),
      ...deletes.map((id) => ({ type: 'delete' as const, id })),
    ];

    const commits: Promise<void>[] = [];
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + BATCH_LIMIT)) {
        const ref = doc(db, 'maps', this.mapId, 'nodes', op.id);
        if (op.type === 'set') batch.set(ref, nodeDocData(op.node!));
        else batch.delete(ref);
      }
      commits.push(batch.commit());
    }

    this.inFlight++;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    this.onStatus(offline ? 'offline' : 'saving');

    const done = Promise.all(commits)
      .then(() => {
        this.inFlight--;
        if (this.destroyed) return;
        if (this.inFlight === 0 && !this.hasPending()) this.onStatus('saved');
      })
      .catch((e) => {
        this.inFlight--;
        if (this.destroyed) return;
        // With the persistent cache, writes are still queued locally; a
        // rejection here means a rule/validation error, not lost connectivity.
        console.warn('Falha ao salvar.', e);
        this.onStatus('error');
      });

    // Offline: don't hold callers hostage — the cache already has the writes.
    return offline ? Promise.resolve() : done;
  }

  destroy() {
    // Flush synchronously into Firestore's cache before going away.
    if (this.hasPending()) this.flush();
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }
}
