// Domain types shared across the app.

export type NodeType =
  | 'mandamento'
  | 'principio'
  | 'interpretacao'
  | 'aplicacao'
  | 'posicao'
  | 'discussao'
  | 'pergunta'
  | 'referencia'
  | 'observacao';

export type Importance = 'normal' | 'importante' | 'fundamental';

export type NodeStatus = 'ideia' | 'estudando' | 'consolidado';

export interface BibleRef {
  book: string;
  chapter: string;
  verse: string;
  comment: string;
}

export interface MindMap {
  id: string;
  owner_id: string;
  title: string;
  concept: string;
  created_at: string;
  updated_at: string;
}

export interface MapNode {
  id: string;
  map_id: string;
  parent_id: string | null;
  title: string;
  description: string;
  notes: string;
  node_type: NodeType;
  importance: Importance;
  status: NodeStatus;
  tags: string[];
  refs: BibleRef[];
  order_index: number;
  position_x: number | null;
  position_y: number | null;
  collapsed: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
}

export interface MapBackup {
  format: 'homens-legado-backup';
  version: 1;
  exported_at: string;
  map: { title: string; concept: string };
  nodes: MapNode[];
}

export const NODE_TYPE_META: Record<NodeType, { label: string; short: string; color: string }> = {
  mandamento: { label: 'Mandamento bíblico', short: 'MAND', color: '#b45309' },
  principio: { label: 'Princípio bíblico', short: 'PRIN', color: '#a16207' },
  interpretacao: { label: 'Interpretação', short: 'INT', color: '#0369a1' },
  aplicacao: { label: 'Aplicação prática', short: 'APL', color: '#15803d' },
  posicao: { label: 'Posição familiar', short: 'POS', color: '#7c3aed' },
  discussao: { label: 'Tema para discussão', short: 'DISC', color: '#c2410c' },
  pergunta: { label: 'Pergunta', short: '?', color: '#be123c' },
  referencia: { label: 'Referência', short: 'REF', color: '#0f766e' },
  observacao: { label: 'Observação', short: 'OBS', color: '#64748b' },
};

export const IMPORTANCE_META: Record<Importance, { label: string }> = {
  normal: { label: 'Normal' },
  importante: { label: 'Importante' },
  fundamental: { label: 'Fundamental' },
};

export const STATUS_META: Record<NodeStatus, { label: string; color: string }> = {
  ideia: { label: 'Ideia', color: '#94a3b8' },
  estudando: { label: 'Estudando', color: '#f59e0b' },
  consolidado: { label: 'Consolidado', color: '#22c55e' },
};

export function emptyNode(partial: Partial<MapNode> & { id: string; map_id: string }): MapNode {
  return {
    parent_id: null,
    title: '',
    description: '',
    notes: '',
    node_type: 'observacao',
    importance: 'normal',
    status: 'ideia',
    tags: [],
    refs: [],
    order_index: 0,
    position_x: null,
    position_y: null,
    collapsed: false,
    ...partial,
  };
}
