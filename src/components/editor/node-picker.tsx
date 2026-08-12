'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapStore } from '@/store/map-store';
import type { MapNode } from '@/lib/types';

interface Props {
  title: string;
  exclude: Set<string>;
  onPick: (id: string) => void;
  onClose: () => void;
}

/** Modal to choose a destination node (used by "move to…" actions). */
export function NodePicker({ title, exclude, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const nodes = useMapStore((s) => s.nodes);
  const pathTo = useMapStore((s) => s.pathTo);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: { node: MapNode; path: string; depth: number }[] = [];
    for (const node of Object.values(nodes)) {
      if (exclude.has(node.id)) continue;
      if (q && !node.title.toLowerCase().includes(q)) continue;
      const path = pathTo(node.id);
      list.push({
        node,
        path: path.slice(0, -1).map((n) => n.title).join(' › '),
        depth: path.length,
      });
    }
    list.sort((a, b) => a.depth - b.depth || a.node.title.localeCompare(b.node.title));
    return list.slice(0, 40);
  }, [query, nodes, exclude, pathTo]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12dvh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--line)] px-4 pb-2 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {title}
          </p>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && results.length) onPick(results[0].node.id);
            }}
            placeholder="Buscar a caixa de destino…"
            className="w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="max-h-[45dvh] overflow-y-auto">
          {results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">
              Nenhum destino possível para “{query}”.
            </p>
          )}
          {results.map((r) => (
            <button
              key={r.node.id}
              onClick={() => onPick(r.node.id)}
              className="block w-full border-b border-[var(--line)] px-4 py-2.5 text-left last:border-0 hover:bg-[var(--accent-soft)]"
            >
              <span className="block text-sm font-medium">{r.node.title || 'Sem título'}</span>
              {r.path && (
                <span className="mt-0.5 block text-[11px] text-[var(--muted)]">{r.path}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
