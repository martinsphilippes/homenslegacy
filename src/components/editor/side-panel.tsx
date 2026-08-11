'use client';

import { useState } from 'react';
import {
  IMPORTANCE_META,
  NODE_TYPE_META,
  STATUS_META,
  type BibleRef,
  type Importance,
  type MapNode,
  type NodeStatus,
  type NodeType,
} from '@/lib/types';
import { useMapStore } from '@/store/map-store';

interface Props {
  node: MapNode;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const inputCls =
  'w-full rounded-lg border border-[var(--line)] bg-transparent px-2.5 py-2 text-sm outline-none transition-colors focus:border-[var(--accent)]';
const labelCls =
  'mb-1 mt-4 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]';

export function SidePanel({ node, onClose, onDelete }: Props) {
  const updateNode = useMapStore((s) => s.updateNode);
  const createChild = useMapStore((s) => s.createChild);
  const createSibling = useMapStore((s) => s.createSibling);
  const duplicateSubtree = useMapStore((s) => s.duplicateSubtree);
  const setBranchCollapsed = useMapStore((s) => s.setBranchCollapsed);
  const expandOnlyBranch = useMapStore((s) => s.expandOnlyBranch);
  const rootId = useMapStore((s) => s.rootId);

  const [tagsDraft, setTagsDraft] = useState<string | null>(null);

  const id = node.id;
  const set = (patch: Partial<MapNode>, key: string) => updateNode(id, patch, `panel:${key}:${id}`);

  function updateRef(i: number, patch: Partial<BibleRef>) {
    const refs = node.refs.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    set({ refs }, 'refs');
  }

  return (
    <aside className="pointer-events-auto flex h-full w-full flex-col overflow-hidden border-[var(--line)] bg-[var(--panel)] shadow-xl max-md:rounded-t-2xl max-md:border-t md:w-[340px] md:border-l">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Detalhes do assunto
        </span>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
          title="Fechar (Esc)"
        >
          ✕
        </button>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-6">
        <label className={labelCls}>Título</label>
        <input
          value={node.title}
          onChange={(e) => set({ title: e.target.value }, 'title')}
          className={inputCls}
        />

        <label className={labelCls}>Descrição</label>
        <textarea
          value={node.description}
          onChange={(e) => set({ description: e.target.value }, 'description')}
          rows={3}
          className={inputCls}
          placeholder="Do que se trata este assunto?"
        />

        <label className={labelCls}>Anotações</label>
        <textarea
          value={node.notes}
          onChange={(e) => set({ notes: e.target.value }, 'notes')}
          rows={4}
          className={inputCls}
          placeholder="Estudos, observações, argumentos…"
        />

        <label className={labelCls}>Referências bíblicas</label>
        <div className="space-y-2">
          {node.refs.map((r, i) => (
            <div key={i} className="rounded-lg border border-[var(--line)] p-2">
              <div className="flex gap-1.5">
                <input
                  value={r.book}
                  onChange={(e) => updateRef(i, { book: e.target.value })}
                  placeholder="Livro"
                  className={inputCls + ' flex-1'}
                />
                <input
                  value={r.chapter}
                  onChange={(e) => updateRef(i, { chapter: e.target.value })}
                  placeholder="Cap."
                  className={inputCls + ' w-14'}
                />
                <input
                  value={r.verse}
                  onChange={(e) => updateRef(i, { verse: e.target.value })}
                  placeholder="Vers."
                  className={inputCls + ' w-14'}
                />
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <input
                  value={r.comment}
                  onChange={(e) => updateRef(i, { comment: e.target.value })}
                  placeholder="Comentário"
                  className={inputCls + ' flex-1'}
                />
                <button
                  onClick={() => set({ refs: node.refs.filter((_, idx) => idx !== i) }, 'refs')}
                  className="rounded-lg px-2 text-xs text-red-500 hover:bg-red-500/10"
                  title="Remover referência"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              set(
                { refs: [...node.refs, { book: '', chapter: '', verse: '', comment: '' }] },
                'refs-add'
              )
            }
            className="w-full rounded-lg border border-dashed border-[var(--line)] py-1.5 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            + Adicionar referência
          </button>
        </div>

        <label className={labelCls}>Tags (separadas por vírgula)</label>
        <input
          value={tagsDraft ?? node.tags.join(', ')}
          onChange={(e) => setTagsDraft(e.target.value)}
          onBlur={() => {
            if (tagsDraft !== null) {
              set(
                {
                  tags: tagsDraft
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                },
                'tags'
              );
              setTagsDraft(null);
            }
          }}
          placeholder="Trabalho, Família…"
          className={inputCls}
        />
        {node.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {node.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <label className={labelCls}>Tipo da informação</label>
        <select
          value={node.node_type}
          onChange={(e) => set({ node_type: e.target.value as NodeType }, 'type')}
          className={inputCls}
        >
          {Object.entries(NODE_TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <label className={labelCls}>Importância</label>
        <div className="flex gap-1.5">
          {(Object.keys(IMPORTANCE_META) as Importance[]).map((k) => (
            <button
              key={k}
              onClick={() => set({ importance: k }, 'importance')}
              className={[
                'flex-1 rounded-lg border py-1.5 text-xs',
                node.importance === k
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
                  : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]',
              ].join(' ')}
            >
              {IMPORTANCE_META[k].label}
            </button>
          ))}
        </div>

        <label className={labelCls}>Status</label>
        <div className="flex gap-1.5">
          {(Object.keys(STATUS_META) as NodeStatus[]).map((k) => (
            <button
              key={k}
              onClick={() => set({ status: k }, 'status')}
              className={[
                'flex-1 rounded-lg border py-1.5 text-xs',
                node.status === k
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
                  : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]',
              ].join(' ')}
            >
              {STATUS_META[k].label}
            </button>
          ))}
        </div>

        <label className={labelCls}>Ações</label>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <button
            onClick={() => createChild(id)}
            className="rounded-lg border border-[var(--line)] py-2 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            + Criar filho
          </button>
          <button
            onClick={() => createSibling(id)}
            disabled={id === rootId}
            className="rounded-lg border border-[var(--line)] py-2 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)] disabled:opacity-40"
          >
            + Criar irmão
          </button>
          <button
            onClick={() => duplicateSubtree(id)}
            disabled={id === rootId}
            className="rounded-lg border border-[var(--line)] py-2 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)] disabled:opacity-40"
          >
            Duplicar ramo
          </button>
          <button
            onClick={() => onDelete(id)}
            disabled={id === rootId}
            className="rounded-lg border border-[var(--line)] py-2 text-red-500 hover:bg-red-500/10 disabled:opacity-40"
          >
            Excluir
          </button>
          <button
            onClick={() => setBranchCollapsed(id, false)}
            className="rounded-lg border border-[var(--line)] py-2 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            Expandir este ramo
          </button>
          <button
            onClick={() => setBranchCollapsed(id, true)}
            className="rounded-lg border border-[var(--line)] py-2 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            Recolher este ramo
          </button>
          <button
            onClick={() => expandOnlyBranch(id)}
            className="col-span-2 rounded-lg border border-[var(--line)] py-2 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            Expandir somente este ramo
          </button>
        </div>
      </div>
    </aside>
  );
}
