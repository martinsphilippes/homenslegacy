'use client';

import { createClient } from '@/lib/supabase/client';
import type { MapNode } from './types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

const DEBOUNCE_MS = 700;
const RETRY_MS = 15000;

interface PendingState {
  upserts: Record<string, MapNode>;
  deletes: string[];
}

/**
 * Debounced save queue with an offline fallback.
 * Pending operations are mirrored to localStorage so edits made offline
 * survive a reload and sync when the connection returns.
 */
export class SaveQueue {
  private upserts = new Map<string, MapNode>();
  private deletes = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private destroyed = false;

  constructor(
    private mapId: string,
    private onStatus: (s: SaveStatus) => void
  ) {
    this.restore();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
    }
  }

  private storageKey() {
    return `hfl-pending:${this.mapId}`;
  }

  private handleOnline = () => {
    this.flush();
  };

  private restore() {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) return;
      const state: PendingState = JSON.parse(raw);
      Object.values(state.upserts).forEach((n) => this.upserts.set(n.id, n));
      state.deletes.forEach((id) => this.deletes.add(id));
    } catch {}
  }

  private persist() {
    try {
      if (this.upserts.size === 0 && this.deletes.size === 0) {
        localStorage.removeItem(this.storageKey());
      } else {
        const state: PendingState = {
          upserts: Object.fromEntries(this.upserts),
          deletes: [...this.deletes],
        };
        localStorage.setItem(this.storageKey(), JSON.stringify(state));
      }
    } catch {}
  }

  hasPending() {
    return this.upserts.size > 0 || this.deletes.size > 0;
  }

  queueUpsert(node: MapNode) {
    this.deletes.delete(node.id);
    this.upserts.set(node.id, node);
    this.persist();
    this.schedule();
  }

  queueDelete(id: string) {
    this.upserts.delete(id);
    this.deletes.add(id);
    this.persist();
    this.schedule();
  }

  private schedule() {
    this.onStatus('saving');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  /** Flushes everything pending. Resolves true when the queue is empty afterwards. */
  async flush(): Promise<boolean> {
    if (this.destroyed) return false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.flushing) return false;
    if (!this.hasPending()) {
      this.onStatus('saved');
      return true;
    }

    this.flushing = true;
    this.onStatus('saving');

    const upserts = [...this.upserts.values()];
    const deletes = [...this.deletes];
    const supabase = createClient();

    try {
      if (deletes.length) {
        const { error } = await supabase.from('nodes').delete().in('id', deletes);
        if (error) throw error;
        deletes.forEach((id) => this.deletes.delete(id));
      }
      if (upserts.length) {
        const rows = upserts.map((n) => ({ ...n, created_at: undefined, updated_at: undefined }));
        const { error } = await supabase.from('nodes').upsert(rows);
        if (error) throw error;
        // Only clear entries that were not re-queued while the request ran.
        upserts.forEach((n) => {
          if (this.upserts.get(n.id) === n) this.upserts.delete(n.id);
        });
      }
      this.persist();
      this.flushing = false;
      if (this.hasPending()) return this.flush();
      this.onStatus('saved');
      return true;
    } catch (e) {
      this.flushing = false;
      this.persist();
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      this.onStatus(offline ? 'offline' : 'error');
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.flush(), RETRY_MS);
      console.warn('Falha ao salvar; tentando novamente.', e);
      return false;
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
    }
  }
}

export function cacheMapLocally(mapId: string, payload: unknown) {
  try {
    localStorage.setItem(`hfl-cache:${mapId}`, JSON.stringify(payload));
  } catch {}
}

export function readLocalCache<T>(mapId: string): T | null {
  try {
    const raw = localStorage.getItem(`hfl-cache:${mapId}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
