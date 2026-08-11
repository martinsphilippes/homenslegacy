'use client';

import { createClient } from '@/lib/supabase/client';
import type { MapNode, MindMap } from './types';

const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000;
const KEEP = 10;

/**
 * Stores a periodic snapshot of the map for recovery purposes.
 * Called when the editor opens; keeps the latest N versions.
 */
export async function maybeSnapshot(map: MindMap, nodes: MapNode[]) {
  try {
    const supabase = createClient();
    const { data: latest } = await supabase
      .from('map_versions')
      .select('id, created_at')
      .eq('map_id', map.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest && Date.now() - new Date(latest.created_at).getTime() < SNAPSHOT_INTERVAL_MS) {
      return;
    }

    await supabase.from('map_versions').insert({
      map_id: map.id,
      snapshot: { map: { title: map.title, concept: map.concept }, nodes },
    });

    const { data: all } = await supabase
      .from('map_versions')
      .select('id')
      .eq('map_id', map.id)
      .order('created_at', { ascending: false });

    if (all && all.length > KEEP) {
      const stale = all.slice(KEEP).map((v) => v.id);
      await supabase.from('map_versions').delete().in('id', stale);
    }
  } catch {
    // Snapshots are best-effort; never block editing.
  }
}
