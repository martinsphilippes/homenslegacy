'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme-toggle';
import { buildSeedNodes, INITIAL_MAP_CONCEPT, INITIAL_MAP_TITLE } from '@/lib/seed';
import type { MindMap } from '@/lib/types';
import { validateBackup } from '@/lib/backup';

export default function MapsPage() {
  const router = useRouter();
  const [maps, setMaps] = useState<MindMap[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const seededRef = useRef(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }

    const { data, error } = await supabase
      .from('maps')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      setError('Não foi possível carregar os mapas. ' + error.message);
      setMaps([]);
      return;
    }

    // First access: create and populate the initial map automatically.
    if (data.length === 0 && !seededRef.current) {
      seededRef.current = true;
      const { data: map, error: mapErr } = await supabase
        .from('maps')
        .insert({ owner_id: user.id, title: INITIAL_MAP_TITLE, concept: INITIAL_MAP_CONCEPT })
        .select()
        .single();
      if (mapErr || !map) {
        setError('Falha ao criar o mapa inicial: ' + (mapErr?.message ?? ''));
        setMaps([]);
        return;
      }
      const nodes = buildSeedNodes(map.id, user.id);
      const { error: nodesErr } = await supabase.from('nodes').insert(nodes);
      if (nodesErr) {
        setError('Falha ao popular o mapa inicial: ' + nodesErr.message);
      }
      setMaps([map]);
      return;
    }

    setMaps(data);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function createMap() {
    const title = prompt('Nome do novo mapa:');
    if (!title?.trim()) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: map, error } = await supabase
      .from('maps')
      .insert({ owner_id: user.id, title: title.trim(), concept: '' })
      .select()
      .single();
    if (error || !map) {
      setError('Falha ao criar mapa: ' + (error?.message ?? ''));
      return;
    }
    // Every map starts with a root node.
    await supabase.from('nodes').insert({
      id: crypto.randomUUID(),
      map_id: map.id,
      parent_id: null,
      title: title.trim(),
      order_index: 0,
      created_by: user.id,
    });
    router.push(`/map/${map.id}`);
  }

  async function renameMap(id: string, title: string) {
    setRenaming(null);
    if (!title.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from('maps').update({ title: title.trim() }).eq('id', id);
    if (error) setError('Falha ao renomear: ' + error.message);
    await load();
  }

  async function duplicateMap(map: MindMap) {
    setBusyId(map.id);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: newMap, error } = await supabase
        .from('maps')
        .insert({ owner_id: user.id, title: `${map.title} (cópia)`, concept: map.concept })
        .select()
        .single();
      if (error || !newMap) throw new Error(error?.message);

      const { data: nodes, error: nErr } = await supabase
        .from('nodes')
        .select('*')
        .eq('map_id', map.id);
      if (nErr) throw new Error(nErr.message);

      const idMap = new Map<string, string>();
      nodes.forEach((n) => idMap.set(n.id, crypto.randomUUID()));
      const copies = nodes.map((n) => ({
        ...n,
        id: idMap.get(n.id)!,
        map_id: newMap.id,
        parent_id: n.parent_id ? (idMap.get(n.parent_id) ?? null) : null,
        created_by: user.id,
      }));
      if (copies.length) {
        const { error: cErr } = await supabase.from('nodes').insert(copies);
        if (cErr) throw new Error(cErr.message);
      }
      await load();
    } catch (e) {
      setError('Falha ao duplicar: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteMap(map: MindMap) {
    if (!confirm(`Excluir o mapa "${map.title}"?\n\nTodos os assuntos serão apagados. Esta ação não pode ser desfeita.`))
      return;
    setBusyId(map.id);
    const supabase = createClient();
    const { error } = await supabase.from('maps').delete().eq('id', map.id);
    if (error) setError('Falha ao excluir: ' + error.message);
    setBusyId(null);
    await load();
  }

  async function importBackup(file: File) {
    try {
      const text = await file.text();
      const backup = validateBackup(JSON.parse(text));
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: map, error } = await supabase
        .from('maps')
        .insert({
          owner_id: user.id,
          title: `${backup.map.title} (importado)`,
          concept: backup.map.concept,
        })
        .select()
        .single();
      if (error || !map) throw new Error(error?.message);

      const idMap = new Map<string, string>();
      backup.nodes.forEach((n) => idMap.set(n.id, crypto.randomUUID()));
      const rows = backup.nodes.map((n) => ({
        ...n,
        id: idMap.get(n.id)!,
        map_id: map.id,
        parent_id: n.parent_id ? (idMap.get(n.parent_id) ?? null) : null,
        created_by: user.id,
        created_at: undefined,
        updated_at: undefined,
      }));
      const { error: nErr } = await supabase.from('nodes').insert(rows);
      if (nErr) throw new Error(nErr.message);
      await load();
    } catch (e) {
      setError(
        'Importação falhou — arquivo inválido ou corrompido. ' +
          (e instanceof Error ? e.message : '')
      );
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
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
            onClick={logout}
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
                    renameMap(map.id, renaming.title);
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
                      onClick={() => duplicateMap(map)}
                      className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50"
                    >
                      {busyId === map.id ? 'Aguarde…' : 'Duplicar'}
                    </button>
                    <button
                      disabled={busyId === map.id}
                      onClick={() => deleteMap(map)}
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
          onClick={createMap}
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
            if (f) importBackup(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
