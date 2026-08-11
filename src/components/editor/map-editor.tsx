'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  applyNodeChanges,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  type Edge,
  type NodeChange,
} from '@xyflow/react';
import { toPng } from 'html-to-image';
import { createClient } from '@/lib/supabase/client';
import { SaveQueue, cacheMapLocally, readLocalCache } from '@/lib/persistence';
import { buildChildrenIndex, computeDepths, computeLayout, computeVisibleIds } from '@/lib/layout';
import { buildBackup } from '@/lib/backup';
import { maybeSnapshot } from '@/lib/versions';
import { useMapStore } from '@/store/map-store';
import type { MapNode, MindMap } from '@/lib/types';
import { MindNode, type MindFlowNode } from './mind-node';
import { SidePanel } from './side-panel';
import { NodeContextMenu, type MenuState } from './context-menu';
import { SearchOverlay } from './search-overlay';
import { Breadcrumbs } from './breadcrumbs';
import { ThemeToggle } from '@/components/theme-toggle';

const nodeTypes = { mind: MindNode };

const btnCls =
  'pointer-events-auto flex h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 text-sm text-[var(--muted)] shadow-sm transition-colors hover:text-[var(--ink)] disabled:opacity-40';

function EditorInner({ mapId }: { mapId: string }) {
  const router = useRouter();
  const rf = useReactFlow();

  const map = useMapStore((s) => s.map);
  const nodes = useMapStore((s) => s.nodes);
  const rootId = useMapStore((s) => s.rootId);
  const selectedId = useMapStore((s) => s.selectedId);
  const editingId = useMapStore((s) => s.editingId);
  const highlightId = useMapStore((s) => s.highlightId);
  const presenting = useMapStore((s) => s.presenting);
  const saveStatus = useMapStore((s) => s.saveStatus);
  const canUndo = useMapStore((s) => s.past.length > 0);
  const canRedo = useMapStore((s) => s.future.length > 0);

  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [offlineView, setOfflineView] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const queueRef = useRef<SaveQueue | null>(null);

  // ----- Data loading -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const queue = new SaveQueue(mapId, (s) => useMapStore.getState().setSaveStatus(s));
    queueRef.current = queue;

    async function load() {
      const supabase = createClient();
      // Sync edits made offline before fetching, so they are not overwritten.
      await queue.flush();

      const [mapRes, nodesRes] = await Promise.all([
        supabase.from('maps').select('*').eq('id', mapId).maybeSingle(),
        supabase.from('nodes').select('*').eq('map_id', mapId),
      ]);

      if (cancelled) return;

      if (mapRes.error || nodesRes.error || !mapRes.data) {
        const cached = readLocalCache<{ map: MindMap; nodes: MapNode[] }>(mapId);
        if (cached) {
          useMapStore.getState().init(cached.map, cached.nodes, queue);
          setOfflineView(true);
          setLoading(false);
          return;
        }
        setLoadError(
          mapRes.error?.message || nodesRes.error?.message || 'Mapa não encontrado.'
        );
        setLoading(false);
        return;
      }

      const mapData = mapRes.data as MindMap;
      const nodeRows = (nodesRes.data ?? []) as MapNode[];
      useMapStore.getState().init(mapData, nodeRows, queue);
      cacheMapLocally(mapId, { map: mapData, nodes: nodeRows });
      setLoading(false);
      maybeSnapshot(mapData, nodeRows);
    }

    load();

    const flushNow = () => queue.flush();
    window.addEventListener('beforeunload', flushNow);
    window.addEventListener('pagehide', flushNow);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', flushNow);
      window.removeEventListener('pagehide', flushNow);
      queue.flush();
      queue.destroy();
      useMapStore.getState().reset();
    };
  }, [mapId]);

  // Keep the local cache fresh so offline mode shows the latest state.
  useEffect(() => {
    if (!map || loading) return;
    const t = setTimeout(() => cacheMapLocally(mapId, { map, nodes: Object.values(nodes) }), 1500);
    return () => clearTimeout(t);
  }, [map, nodes, mapId, loading]);

  // ----- Derived React Flow graph ------------------------------------------
  const derived = useMemo(() => {
    const list = Object.values(nodes);
    if (!list.length) return { flowNodes: [] as MindFlowNode[], flowEdges: [] as Edge[] };
    const childrenOf = buildChildrenIndex(list);
    const depths = computeDepths(childrenOf);
    const visible = computeVisibleIds(childrenOf);
    const positions = computeLayout(childrenOf, visible, depths);

    const subtreeCount = (id: string): number => {
      let count = 0;
      const stack = [...(childrenOf.get(id) ?? [])];
      while (stack.length) {
        const n = stack.pop()!;
        count++;
        (childrenOf.get(n.id) ?? []).forEach((c) => stack.push(c));
      }
      return count;
    };

    const flowNodes: MindFlowNode[] = [];
    const flowEdges: Edge[] = [];
    for (const n of list) {
      if (!visible.has(n.id)) continue;
      const pos = positions.get(n.id) ?? { x: 0, y: 0 };
      flowNodes.push({
        id: n.id,
        type: 'mind',
        position: pos,
        selected: n.id === selectedId,
        draggable: !presenting,
        data: {
          node: n,
          depth: depths.get(n.id) ?? 0,
          childCount: (childrenOf.get(n.id) ?? []).length,
          hiddenCount: subtreeCount(n.id),
          presenting,
          highlighted: n.id === highlightId,
          editing: n.id === editingId,
        },
      });
      if (n.parent_id && visible.has(n.parent_id)) {
        flowEdges.push({
          id: `e-${n.parent_id}-${n.id}`,
          source: n.parent_id,
          target: n.id,
          type: 'default',
        });
      }
    }
    return { flowNodes, flowEdges };
  }, [nodes, selectedId, editingId, highlightId, presenting]);

  const [rfNodes, setRfNodes] = useState<MindFlowNode[]>([]);
  useEffect(() => setRfNodes(derived.flowNodes), [derived.flowNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange<MindFlowNode>[]) =>
      setRfNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  // ----- Actions ------------------------------------------------------------
  const confirmDelete = useCallback((id: string) => {
    const s = useMapStore.getState();
    if (id === s.rootId) {
      alert('A raiz do mapa não pode ser excluída.');
      return;
    }
    const node = s.nodes[id];
    if (!node) return;
    const count = s.subtreeIds(id).length - 1;
    const msg =
      count > 0
        ? `Excluir “${node.title}” e ${count} sub-assunto(s)?`
        : `Excluir “${node.title}”?`;
    if (confirm(msg)) s.deleteSubtree(id);
  }, []);

  const reveal = useCallback(
    (id: string) => {
      const s = useMapStore.getState();
      s.pathTo(id)
        .slice(0, -1)
        .forEach((n) => {
          if (n.collapsed) s.updateNode(n.id, { collapsed: false }, 'reveal');
        });
      s.select(id);
      s.setHighlight(id);
      setSearchOpen(false);
      setTimeout(() => {
        const n = rf.getNode(id);
        if (n) {
          rf.setCenter(
            n.position.x + (n.measured?.width ?? 160) / 2,
            n.position.y + (n.measured?.height ?? 44) / 2,
            { zoom: Math.max(rf.getZoom(), 1), duration: 500 }
          );
        }
      }, 140);
      setTimeout(() => useMapStore.getState().setHighlight(null), 2600);
    },
    [rf]
  );

  const enterPresentation = useCallback(() => {
    const s = useMapStore.getState();
    s.collapseAll();
    s.setPresenting(true);
    setMenu(null);
    setSearchOpen(false);
    setTimeout(() => rf.fitView({ duration: 400, padding: 0.2 }), 150);
  }, [rf]);

  const exitPresentation = useCallback(() => {
    useMapStore.getState().setPresenting(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const exportJson = useCallback(() => {
    const s = useMapStore.getState();
    if (!s.map) return;
    const backup = buildBackup(s.map, Object.values(s.nodes));
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${s.map.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-backup.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setExportOpen(false);
  }, []);

  const exportPng = useCallback(async () => {
    setExportOpen(false);
    const el = document.querySelector<HTMLElement>('.react-flow__viewport');
    if (!el || !rfNodes.length) return;
    const bounds = getNodesBounds(rfNodes);
    const width = Math.min(4096, Math.max(1024, bounds.width + 160));
    const height = Math.min(4096, Math.max(768, bounds.height + 160));
    const vp = getViewportForBounds(bounds, width, height, 0.2, 2, 0.05);
    const dark = document.documentElement.classList.contains('dark');
    try {
      const url = await toPng(el, {
        backgroundColor: dark ? '#12100e' : '#f6f5f2',
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        },
        filter: (node) => !node?.classList?.contains('react-flow__minimap'),
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${map?.title ?? 'mapa'}.png`;
      a.click();
    } catch {
      alert('Não foi possível gerar a imagem.');
    }
  }, [rfNodes, map]);

  // ----- Keyboard shortcuts -------------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && !typing) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          useMapStore.getState().undo();
          return;
        }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          useMapStore.getState().redo();
          return;
        }
        if (e.key === 'f') {
          e.preventDefault();
          setSearchOpen(true);
          return;
        }
      }

      if (typing) return;
      const s = useMapStore.getState();

      if (e.key === 'Escape') {
        setMenu(null);
        setSearchOpen(false);
        setExportOpen(false);
        if (s.presenting) exitPresentation();
        else s.select(null);
        return;
      }
      if (s.presenting) return;

      if (e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (!s.selectedId) return;

      if (e.key === 'Tab' || e.key === '+' || e.key === 'Insert') {
        e.preventDefault();
        s.createChild(s.selectedId);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (s.selectedId === s.rootId) s.createChild(s.selectedId);
        else s.createSibling(s.selectedId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        confirmDelete(s.selectedId);
      } else if (e.key === 'F2') {
        e.preventDefault();
        s.setEditing(s.selectedId);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDelete, exitPresentation]);

  // ----- Render -------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-[var(--muted)]">
        Carregando mapa…
      </div>
    );
  }
  if (loadError || !map) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-red-500">{loadError || 'Mapa não encontrado.'}</p>
        <button onClick={() => router.push('/')} className={btnCls}>
          ← Voltar aos mapas
        </button>
      </div>
    );
  }

  const selectedNode = selectedId ? nodes[selectedId] : null;
  const statusLabel =
    saveStatus === 'saving'
      ? 'Salvando…'
      : saveStatus === 'saved'
        ? 'Salvo'
        : saveStatus === 'offline'
          ? 'Offline — alterações serão sincronizadas'
          : saveStatus === 'error'
            ? 'Erro ao salvar — tentando novamente'
            : offlineView
              ? 'Offline — visualizando cópia local'
              : '';

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <ReactFlow
        nodes={rfNodes}
        edges={derived.flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, n) => {
          setMenu(null);
          if (presenting) useMapStore.getState().toggleCollapsed(n.id);
          else useMapStore.getState().select(n.id);
        }}
        onNodeDoubleClick={(_, n) => {
          if (!presenting) useMapStore.getState().setEditing(n.id);
        }}
        onNodeContextMenu={(e, n) => {
          e.preventDefault();
          if (!presenting) setMenu({ id: n.id, x: e.clientX, y: e.clientY });
        }}
        onNodeDragStop={(_, n) => useMapStore.getState().moveNode(n.id, n.position.x, n.position.y)}
        onPaneClick={() => {
          setMenu(null);
          setExportOpen(false);
          useMapStore.getState().select(null);
        }}
        fitView
        minZoom={0.05}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
        defaultEdgeOptions={{ type: 'default' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} className="opacity-40" />
        {!presenting && (
          <>
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              className="hidden !h-28 !w-40 sm:block"
              nodeColor={() =>
                document.documentElement.classList.contains('dark') ? '#44403c' : '#d6d3d1'
              }
            />
          </>
        )}
      </ReactFlow>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 p-3">
        <div className="flex min-w-0 items-center gap-2">
          {!presenting && (
            <button onClick={() => router.push('/')} className={btnCls} title="Meus mapas">
              ←
            </button>
          )}
          <div className="pointer-events-auto min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 shadow-sm">
            <span className="block truncate text-sm font-semibold [font-family:var(--font-display)]">
              {map.title}
            </span>
            {statusLabel && (
              <span
                className={[
                  'block text-[10px]',
                  saveStatus === 'offline' || offlineView
                    ? 'text-amber-600 dark:text-amber-400'
                    : saveStatus === 'error'
                      ? 'text-red-500'
                      : 'text-[var(--muted)]',
                ].join(' ')}
              >
                {statusLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-1.5">
          {presenting ? (
            <>
              <button onClick={() => useMapStore.getState().expandAll()} className={btnCls} title="Expandir tudo">
                ⊞
              </button>
              <button onClick={() => useMapStore.getState().collapseAll()} className={btnCls} title="Recolher tudo">
                ⊟
              </button>
              <button onClick={toggleFullscreen} className={btnCls} title="Tela cheia">
                {fullscreen ? '⤡' : '⤢'}
              </button>
              <button
                onClick={exitPresentation}
                className={btnCls + ' !text-[var(--accent)]'}
                title="Sair da apresentação (Esc)"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setSearchOpen(true)} className={btnCls} title="Buscar (Ctrl+F ou /)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </button>
              <button
                onClick={() => useMapStore.getState().undo()}
                disabled={!canUndo}
                className={btnCls}
                title="Desfazer (Ctrl+Z)"
              >
                ↩
              </button>
              <button
                onClick={() => useMapStore.getState().redo()}
                disabled={!canRedo}
                className={btnCls}
                title="Refazer (Ctrl+Shift+Z)"
              >
                ↪
              </button>
              <button onClick={() => useMapStore.getState().expandAll()} className={btnCls} title="Expandir tudo">
                ⊞
              </button>
              <button onClick={() => useMapStore.getState().collapseAll()} className={btnCls} title="Recolher tudo">
                ⊟
              </button>
              <button
                onClick={() => {
                  useMapStore.getState().organize();
                  setTimeout(() => rf.fitView({ duration: 400, padding: 0.15 }), 150);
                }}
                className={btnCls}
                title="Organizar mapa automaticamente"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </button>
              <div className="relative">
                <button onClick={() => setExportOpen((v) => !v)} className={btnCls} title="Backup / exportar">
                  ⇩
                </button>
                {exportOpen && (
                  <div className="pointer-events-auto absolute right-0 top-10 z-50 min-w-[190px] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] py-1 shadow-xl">
                    <button onClick={exportJson} className="block w-full px-3.5 py-2 text-left text-[13px] hover:bg-[var(--accent-soft)]">
                      Exportar backup (JSON)
                    </button>
                    <button onClick={exportPng} className="block w-full px-3.5 py-2 text-left text-[13px] hover:bg-[var(--accent-soft)]">
                      Exportar imagem (PNG)
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={enterPresentation}
                className={btnCls}
                title="Modo apresentação"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <ThemeToggle />
            </>
          )}
        </div>
      </div>

      {/* Breadcrumbs */}
      {selectedId && !presenting && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-16">
          <Breadcrumbs nodeId={selectedId} onNavigate={reveal} />
        </div>
      )}

      {/* Side panel / bottom sheet */}
      {selectedNode && !presenting && (
        <div className="absolute inset-x-0 bottom-0 z-40 max-h-[60dvh] md:inset-y-0 md:left-auto md:right-0 md:max-h-none">
          <SidePanel
            node={selectedNode}
            onClose={() => useMapStore.getState().select(null)}
            onDelete={confirmDelete}
          />
        </div>
      )}

      {menu && <NodeContextMenu menu={menu} onClose={() => setMenu(null)} onDelete={confirmDelete} />}
      {searchOpen && <SearchOverlay onPick={reveal} onClose={() => setSearchOpen(false)} />}

      {presenting && rootId && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
          <p className="rounded-full bg-[var(--panel)]/80 px-4 py-1.5 text-xs text-[var(--muted)] shadow-sm backdrop-blur">
            Toque em um assunto para abrir ou fechar o ramo
          </p>
        </div>
      )}
    </div>
  );
}

export function MapEditor({ mapId }: { mapId: string }) {
  return (
    <ReactFlowProvider>
      <EditorInner mapId={mapId} />
    </ReactFlowProvider>
  );
}
