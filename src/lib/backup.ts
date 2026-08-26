import type { MapBackup, MapNode, MindMap } from './types';

/** Validates an imported backup file. Throws with a readable message when invalid. */
export function validateBackup(raw: unknown): MapBackup {
  if (typeof raw !== 'object' || raw === null) throw new Error('Estrutura inválida.');
  const b = raw as Record<string, unknown>;
  if (b.format !== 'homens-legado-backup') throw new Error('Este arquivo não é um backup do aplicativo.');
  if (b.version !== 1) throw new Error('Versão de backup não suportada.');
  const map = b.map as Record<string, unknown> | undefined;
  if (!map || typeof map.title !== 'string') throw new Error('Título do mapa ausente.');
  if (!Array.isArray(b.nodes) || b.nodes.length === 0) throw new Error('Backup sem assuntos.');

  const ids = new Set<string>();
  for (const n of b.nodes as Record<string, unknown>[]) {
    if (typeof n.id !== 'string' || typeof n.title !== 'string')
      throw new Error('Assunto com formato inválido.');
    ids.add(n.id);
  }
  let roots = 0;
  for (const n of b.nodes as Record<string, unknown>[]) {
    if (n.parent_id == null) roots++;
    else if (typeof n.parent_id !== 'string' || !ids.has(n.parent_id))
      throw new Error('Hierarquia inconsistente no arquivo.');
  }
  if (roots !== 1) throw new Error('O backup deve conter exatamente um assunto raiz.');

  const nodes = (b.nodes as Partial<MapNode>[]).map((n, i) => ({
    id: n.id!,
    map_id: '',
    parent_id: n.parent_id ?? null,
    title: n.title ?? '',
    description: typeof n.description === 'string' ? n.description : '',
    notes: typeof n.notes === 'string' ? n.notes : '',
    node_type: (n.node_type as MapNode['node_type']) ?? 'observacao',
    importance: (n.importance as MapNode['importance']) ?? 'normal',
    status: (n.status as MapNode['status']) ?? 'ideia',
    tags: Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === 'string') : [],
    refs: Array.isArray(n.refs) ? (n.refs as MapNode['refs']) : [],
    order_index: typeof n.order_index === 'number' ? n.order_index : i,
    linked_parent_ids: Array.isArray(n.linked_parent_ids)
      ? n.linked_parent_ids.filter((p): p is string => typeof p === 'string' && ids.has(p))
      : [],
    position_x: typeof n.position_x === 'number' ? n.position_x : null,
    position_y: typeof n.position_y === 'number' ? n.position_y : null,
    collapsed: !!n.collapsed,
  }));

  return {
    format: 'homens-legado-backup',
    version: 1,
    exported_at: typeof b.exported_at === 'string' ? b.exported_at : new Date().toISOString(),
    map: {
      title: map.title as string,
      concept: typeof map.concept === 'string' ? map.concept : '',
    },
    nodes,
  };
}

export function buildBackup(map: MindMap, nodes: MapNode[]): MapBackup {
  return {
    format: 'homens-legado-backup',
    version: 1,
    exported_at: new Date().toISOString(),
    map: { title: map.title, concept: map.concept },
    nodes,
  };
}
