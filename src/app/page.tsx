'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { AuthGate } from '@/components/auth-gate';
import { ThemeToggle } from '@/components/theme-toggle';
import { buildSeedNodes, INITIAL_MAP_CONCEPT, INITIAL_MAP_TITLE } from '@/lib/seed';
import type { MindMap } from '@/lib/types';
import { validateBackup } from '@/lib/backup';
import {
  batchSetNodes,
  copyMapWithNodes,
  createMap,
  deleteMapDeep,
  fetchNodes,
  importBackupAsMap,
  listMaps,
  listMapsFromCache,
  renameMap,
} from '@/lib/maps-repo';
import { emptyNode } from '@/lib/types';
import { ConfirmDialog } from '@/components/confirm-dialog';

function MapsScreen() {
  const router = useRouter();
  const [maps, setMaps] = useState<MindMap[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirmMap, setConfirmMap] = useState<MindMap | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const seededRef = useRef(false);

  const uid = () => getFirebaseAuth().currentUser?.uid ?? '';

  const load = useCallback(async () => {
    try {
      // Instant render from cache; the server response below stays authoritative.
      listMapsFromCache(uid()).then((cached) => {
        if (cached) setMaps((current) => current ?? cached);
      });

      const data = await listMaps(uid());

      // First access: create and populate the initial map automatically.
      if (data.length === 0 && !seededRef.current) {
        seededRef.current = true;
        const map = await createMap(uid(), INITIAL_MAP_TITLE, INITIAL_MAP_CONCEPT);
        await batchSetNodes(map.id, buildSeedNodes(map.id, uid()));
        setMaps([map]);
        return;
      }
      setMaps(data);
    } catch (e) {
      setError('Não foi possível carregar os mapas. ' + (e instanceof Error ? e.message : ''));
      setMaps([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(title: string) {
    if (!title.trim()) return;
    setCreateOpen(false);
    try {
      const map = await createMap(uid(), title.trim(), '');
      await batchSetNodes(map.id, [
        emptyNode({
          id: crypto.randomUUID(),
          map_id: map.id,
          title: title.trim(),
          created_by: uid(),
        }),
      ]);
      router.push(`/map/${map.id}`);
    } catch (e) {
      setError('Falha ao criar mapa: ' + (e instanceof Error ? e.message : ''));
    }
  }

  async function handleRename(id: string, title: string) {
    setRenaming(null);
    if (!title.trim()) return;
    try {
      await renameMap(id, title.trim());
    } catch (e) {
      setError('Falha ao renomear: ' + (e instanceof Error ? e.message : ''));
    }
    await load();
  }

  async function handleDuplicate(map: MindMap) {
    setBusyId(map.id);
    try {
      const nodes = await fetchNodes(map.id);
      await copyMapWithNodes(map, nodes, uid(), `${map.title} (cópia)`);
      await load();
    } catch (e) {
      setError('Falha ao duplicar: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(map: MindMap) {
    setBusyId(map.id);
    try {
      await deleteMapDeep(map.id);
    } catch (e) {
      setError('Falha ao excluir: ' + (e instanceof Error ? e.message : ''));
    }
    setBusyId(null);
    await load();
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const backup = validateBackup(JSON.parse(text));
      await importBackupAsMap(backup, uid());
      await load();
    } catch (e) {
      setError(
        'Importação falhou — arquivo inválido ou corrompido. ' +
          (e instanceof Error ? e.message : '')
      );
    }
  }

  async function handleLogout() {
    await signOut(getFirebaseAuth());
    router.replace('/login');
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:py-14">
      <header className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight [font-family:var(--font-display)]">
            Meus Mapas
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Homens | Família &amp; Legado</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            Sair
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {maps === null ? (
        <p className="text-sm text-[var(--muted)]">Carregando…</p>
      ) : (
        <ul className="space-y-3">
          {maps.map((map) => (
            <li
              key={map.id}
              className="group rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm transition-colors hover:border-[var(--accent)]"
            >
              {renaming?.id === map.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRename(map.id, renaming.title);
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    value={renaming.title}
                    onChange={(e) => setRenaming({ id: map.id, title: e.target.value })}
                    onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)}
                    className="w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <button className="rounded-lg bg-[var(--ink)] px-3 text-sm text-[var(--bg)]">
                    OK
                  </button>
                </form>
              ) : (
                <>
                  <button
                    onClick={() => router.push(`/map/${map.id}`)}
                    className="block w-full text-left"
                  >
                    <span className="text-lg font-medium [font-family:var(--font-display)]">
                      {map.title}
                    </span>
                    {map.concept && (
                      <span className="mt-0.5 block text-sm text-[var(--muted)]">{map.concept}</span>
                    )}
                  </button>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <button
                      onClick={() => router.push(`/map/${map.id}`)}
                      className="rounded-lg bg-[var(--ink)] px-3 py-1.5 font-medium text-[var(--bg)] hover:opacity-90"
                    >
                      Abrir mapa
                    </button>
                    <button
                      onClick={() => setRenaming({ id: map.id, title: map.title })}
                      className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      Renomear
                    </button>
                    <button
                      disabled={busyId === map.id}
                      onClick={() => handleDuplicate(map)}
                      className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50"
                    >
                      {busyId === map.id ? 'Aguarde…' : 'Duplicar'}
                    </button>
                    <button
                      disabled={busyId === map.id}
                      onClick={() => setConfirmMap(map)}
                      className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    >
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setNewTitle('');
            setCreateOpen(true);
          }}
          className="rounded-xl border border-dashed border-[var(--line)] px-4 py-2.5 text-sm text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
        >
          + Criar novo mapa
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border border-dashed border-[var(--line)] px-4 py-2.5 text-sm text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]"
        >
          Importar backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = '';
          }}
        />
      </div>

      {confirmMap && (
        <ConfirmDialog
          title={`Excluir o mapa “${confirmMap.title}”?`}
          message="Todos os assuntos dentro dele serão apagados. Esta ação não pode ser desfeita."
          confirmLabel="Excluir mapa"
          danger
          onConfirm={() => handleDelete(confirmMap)}
          onClose={() => setConfirmMap(null)}
        />
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={() => setCreateOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate(newTitle);
            }}
            className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold">Novo mapa</h2>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setCreateOpen(false)}
              placeholder="Nome do mapa…"
              className="mt-3 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
              >
                Criar mapa
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function MapsPage() {
  return (
    <AuthGate>
      <MapsScreen />
    </AuthGate>
  );
}
