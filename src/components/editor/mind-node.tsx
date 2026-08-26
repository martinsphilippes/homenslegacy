'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { NODE_TYPE_META, STATUS_META, type MapNode } from '@/lib/types';
import { useMapStore } from '@/store/map-store';

export interface MindNodeData extends Record<string, unknown> {
  node: MapNode;
  depth: number;
  childCount: number;
  hiddenCount: number;
  presenting: boolean;
  highlighted: boolean;
  editing: boolean;
  dropTarget: boolean;
}

export type MindFlowNode = Node<MindNodeData, 'mind'>;

function MindNodeComponent({ id, data, selected }: NodeProps<MindFlowNode>) {
  const { node, depth, childCount, hiddenCount, presenting, highlighted, editing, dropTarget } =
    data;
  const updateNode = useMapStore((s) => s.updateNode);
  const setEditing = useMapStore((s) => s.setEditing);
  const createChild = useMapStore((s) => s.createChild);
  const deleteSubtree = useMapStore((s) => s.deleteSubtree);
  const toggleCollapsed = useMapStore((s) => s.toggleCollapsed);

  const [draft, setDraft] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const originalTitle = useRef(node.title);

  useEffect(() => {
    if (editing) {
      setDraft(node.title);
      originalTitle.current = node.title;
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function commit() {
    const title = draft.trim();
    if (!title && !originalTitle.current && childCount === 0) {
      // Newly created node abandoned empty: remove it.
      deleteSubtree(id);
    } else if (title && title !== node.title) {
      updateNode(id, { title }, `title:${id}`);
    }
    setEditing(null);
  }

  function cancel() {
    if (!originalTitle.current && childCount === 0) {
      deleteSubtree(id);
    }
    setEditing(null);
  }

  const typeMeta = NODE_TYPE_META[node.node_type];
  const statusMeta = STATUS_META[node.status];
  const isRoot = depth === 0;
  const fundamental = node.importance === 'fundamental';
  const important = node.importance === 'importante';

  return (
    <div
      className={[
        'group relative rounded-xl border transition-shadow',
        isRoot
          ? 'border-transparent bg-[var(--ink)] px-5 py-3 text-[var(--bg)] shadow-md'
          : 'bg-[var(--panel)] px-3.5 py-2 shadow-sm',
        !isRoot && (fundamental ? 'border-[var(--accent)]' : 'border-[var(--line)]'),
        selected && !presenting ? 'ring-2 ring-[var(--accent)]' : '',
        dropTarget ? 'scale-105 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-transparent' : '',
        highlighted ? 'node-flash' : '',
        presenting && childCount > 0 ? 'cursor-pointer' : '',
      ].join(' ')}
      style={{ minWidth: isRoot ? 200 : 130, maxWidth: 320 }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {/* Meta badges (kept subtle to avoid clutter) */}
      {!isRoot &&
        (node.node_type !== 'observacao' ||
          node.status !== 'ideia' ||
          important ||
          fundamental ||
          node.refs.length > 0 ||
          (node.linked_parent_ids?.length ?? 0) > 0) && (
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {node.node_type !== 'observacao' && (
              <span
                className="rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide text-white"
                style={{ background: typeMeta.color }}
                title={typeMeta.label}
              >
                {typeMeta.short}
              </span>
            )}
            {(important || fundamental) && (
              <span
                className="text-[10px] text-[var(--accent)]"
                title={fundamental ? 'Fundamental' : 'Importante'}
              >
                {fundamental ? '★★' : '★'}
              </span>
            )}
            {node.status !== 'ideia' && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: statusMeta.color }}
                title={statusMeta.label}
              />
            )}
            {node.refs.length > 0 && (
              <span className="text-[9px] text-[var(--muted)]" title="Referências bíblicas">
                ✝ {node.refs.length}
              </span>
            )}
            {(node.linked_parent_ids?.length ?? 0) > 0 && (
              <span
                className="rounded px-1 text-[9px] font-bold text-[var(--accent)]"
                title={`Também pertence a ${node.linked_parent_ids!.length} outra(s) caixa(s)`}
              >
                ⇄ {node.linked_parent_ids!.length}
              </span>
            )}
          </div>
        )}

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          onClick={(e) => e.stopPropagation()}
          className="nodrag w-full min-w-[120px] bg-transparent text-sm outline-none"
          placeholder="Novo assunto…"
        />
      ) : (
        <div
          className={[
            'leading-snug',
            isRoot
              ? 'text-base font-semibold [font-family:var(--font-display)]'
              : depth === 1
                ? 'text-sm font-semibold'
                : 'text-[13px]',
            presenting ? 'select-none' : '',
          ].join(' ')}
        >
          {node.title || <span className="italic opacity-50">Sem título</span>}
        </div>
      )}

      {/* Collapse / expand chip */}
      {childCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapsed(id);
          }}
          title={node.collapsed ? 'Expandir' : 'Recolher'}
          className={[
            'nodrag node-chip absolute -right-2.5 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full border px-1 text-[10px] font-semibold',
            node.collapsed
              ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
          ].join(' ')}
        >
          {node.collapsed ? hiddenCount : '−'}
        </button>
      )}

      {/* Quick add child */}
      {!presenting && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            createChild(id);
          }}
          title="Criar derivação (+)"
          className={[
            'nodrag node-add absolute -bottom-3 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-sm text-[var(--muted)] shadow-sm transition-opacity hover:border-[var(--accent)] hover:text-[var(--accent)]',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          ].join(' ')}
        >
          +
        </button>
      )}
    </div>
  );
}

export const MindNode = memo(MindNodeComponent);
