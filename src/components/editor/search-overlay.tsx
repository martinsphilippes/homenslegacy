'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapStore } from '@/store/map-store';
import type { MapNode } from '@/lib/types';

interface Props {
  onPick: (id: string) => void;
  onClose: () => void;
}

interface Hit {
  node: MapNode;
  where: string;
  path: string;
}

export function SearchOverlay({ onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const nodes = useMapStore((s) => s.nodes);
  const pathTo = useMapStore((s) => s.pathTo);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const result: Hit[] = [];
    for (const node of Object.values(nodes)) {
      let where = '';
      if (node.title.toLowerCase().includes(q)) where = 'título';
      else if (node.description.toLowerCase().includes(q)) where = 'descrição';
      else if (node.notes.toLowerCase().includes(q)) where = 'anotações';
      else if (node.tags.some((t) => t.toLowerCase().includes(q))) where = 'tag';
      else if (
        node.refs.some((r) =>
          `${r.book} ${r.chapter}:${r.verse} ${r.comment}`.toLowerCase().includes(q)
        )
      )
        where = 'referência';
      if (where) {
        const path = pathTo(node.id)
          .slice(0, -1)
          .map((n) => n.title)
          .join(' › ');
        result.push({ node, where, path });
      }
    }
    result.sort((a, b) => (a.where === 'título' ? -1 : 0) - (b.where === 'título' ? -1 : 0));
    return result.slice(0, 30);
  }, [query, nodes, pathTo]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12dvh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && hits.length) onPick(hits[0].node.id);
          }}
          placeholder="Buscar em títulos, descrições, anotações, tags e referências…"
          className="w-full border-b border-[var(--line)] bg-transparent px-4 py-3.5 text-sm outline-none"
        />
        <div className="max-h-[50dvh] overflow-y-auto">
          {query.trim().length >= 2 && hits.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">
              Nenhum resultado para “{query}”.
            </p>
          )}
          {hits.map((h) => (
            <button
              key={h.node.id}
              onClick={() => onPick(h.node.id)}
              className="block w-full border-b border-[var(--line)] px-4 py-2.5 text-left last:border-0 hover:bg-[var(--accent-soft)]"
            >
              <span className="block text-sm font-medium">{h.node.title || 'Sem título'}</span>
              <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                {h.path || 'Raiz'} · encontrado em {h.where}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
