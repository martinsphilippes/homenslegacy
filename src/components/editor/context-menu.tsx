'use client';

import { useMapStore } from '@/store/map-store';

export interface MenuState {
  id: string;
  x: number;
  y: number;
}

interface Props {
  menu: MenuState;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function NodeContextMenu({ menu, onClose, onDelete }: Props) {
  const store = useMapStore.getState();
  const node = useMapStore((s) => s.nodes[menu.id]);
  const rootId = useMapStore((s) => s.rootId);
  if (!node) return null;

  const isRoot = menu.id === rootId;

  const items: Array<{ label: string; danger?: boolean; disabled?: boolean; run: () => void }> = [
    { label: '+ Criar filho', run: () => store.createChild(menu.id) },
    { label: '+ Criar irmão', disabled: isRoot, run: () => store.createSibling(menu.id) },
    { label: 'Editar título', run: () => store.setEditing(menu.id) },
    { label: 'Duplicar ramo', disabled: isRoot, run: () => store.duplicateSubtree(menu.id) },
    {
      label: node.collapsed ? 'Expandir' : 'Recolher',
      run: () => store.toggleCollapsed(menu.id),
    },
    { label: 'Expandir este ramo (tudo)', run: () => store.setBranchCollapsed(menu.id, false) },
    { label: 'Recolher este ramo (tudo)', run: () => store.setBranchCollapsed(menu.id, true) },
    { label: 'Expandir somente este ramo', run: () => store.expandOnlyBranch(menu.id) },
    { label: 'Excluir…', danger: true, disabled: isRoot, run: () => onDelete(menu.id) },
  ];

  return (
    <div
      className="fixed z-50 min-w-[200px] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] py-1 shadow-xl"
      style={{
        left: Math.min(menu.x, typeof window !== 'undefined' ? window.innerWidth - 220 : menu.x),
        top: Math.min(menu.y, typeof window !== 'undefined' ? window.innerHeight - 340 : menu.y),
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.run();
          }}
          className={[
            'block w-full px-3.5 py-1.5 text-left text-[13px] disabled:opacity-40',
            item.danger
              ? 'text-red-500 hover:bg-red-500/10'
              : 'text-[var(--ink)] hover:bg-[var(--accent-soft)]',
          ].join(' ')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
