'use client';

import { useMapStore } from '@/store/map-store';

interface Props {
  nodeId: string;
  onNavigate: (id: string) => void;
}

export function Breadcrumbs({ nodeId, onNavigate }: Props) {
  const nodes = useMapStore((s) => s.nodes);
  const pathTo = useMapStore((s) => s.pathTo);
  if (!nodes[nodeId]) return null;
  const path = pathTo(nodeId);
  if (path.length <= 1) return null;

  return (
    <nav className="scrollbar-thin pointer-events-auto max-w-full overflow-x-auto whitespace-nowrap rounded-xl border border-[var(--line)] bg-[var(--panel)]/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
      {path.map((n, i) => (
        <span key={n.id}>
          {i > 0 && <span className="mx-1 text-[var(--muted)]">›</span>}
          <button
            onClick={() => onNavigate(n.id)}
            className={
              i === path.length - 1
                ? 'font-semibold text-[var(--ink)]'
                : 'text-[var(--muted)] hover:text-[var(--accent)]'
            }
          >
            {n.title || 'Sem título'}
          </button>
        </span>
      ))}
    </nav>
  );
}
