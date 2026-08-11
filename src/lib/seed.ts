import type { MapNode, NodeType } from './types';
import { emptyNode } from './types';

// Seed tree for the initial map "Homem, Família e Legado".
// t = title, d = description, k = node_type, c = children
interface SeedNode {
  t: string;
  d?: string;
  k?: NodeType;
  c?: SeedNode[];
}

export const INITIAL_MAP_TITLE = 'Homem, Família e Legado';
export const INITIAL_MAP_CONCEPT = 'Que tipo de família estamos construindo?';

const SEED: SeedNode = {
  t: 'HOMEM, FAMÍLIA E LEGADO',
  d: 'Que tipo de família estamos construindo?\n\n“Que homem preciso me tornar para conseguir construir a família que desejo deixar como legado?”',
  k: 'discussao',
  c: [
    {
      t: 'HOMEM',
      c: [
        {
          t: 'Provedor',
          d: 'O homem assume responsabilidade pela provisão de sua família.',
          c: [{ t: 'Trabalhar' }, { t: 'Produzir' }, { t: 'Prosperar' }, { t: 'Sustentar a casa' }],
        },
        {
          t: 'Mentalidade de construção',
          c: [
            { t: 'Empresário / empreendedor' },
            { t: 'Pensamento de longo prazo' },
            { t: 'Patrimônio' },
            { t: 'Independência financeira' },
            { t: 'Legado' },
          ],
        },
        {
          t: 'Suportar responsabilidade',
          c: [
            { t: 'Aguentar pressão' },
            { t: 'Não transferir sua responsabilidade' },
            { t: 'Proteger a família' },
            { t: 'Sacrificar-se pela casa' },
          ],
        },
        {
          t: 'Liderança espiritual',
          c: [
            { t: 'Debaixo de Cristo' },
            { t: 'Conhecer as Escrituras' },
            { t: 'Ensinar' },
            { t: 'Disciplinar' },
            { t: 'Ser exemplo' },
          ],
        },
        {
          t: 'Força e domínio próprio',
          c: [
            { t: 'Ser capaz de proteger' },
            { t: 'Preparação física' },
            { t: 'Coragem' },
            { t: 'Competência' },
            { t: 'Conhecimento responsável sobre defesa' },
            { t: 'Força controlada pelo domínio próprio' },
          ],
        },
      ],
    },
    {
      t: 'MULHER',
      c: [
        {
          t: 'Feminilidade',
          c: [{ t: 'Delicadeza' }, { t: 'Mansidão' }, { t: 'Sabedoria' }, { t: 'Cuidado com o lar' }],
        },
        {
          t: 'Papel familiar',
          c: [
            { t: 'Esposa' },
            { t: 'Mãe' },
            { t: 'Formação dos filhos' },
            { t: 'Construção do ambiente da casa' },
          ],
        },
        {
          t: 'Submissão conjugal',
          c: [
            { t: 'Autoridade final: Deus' },
            { t: 'Nunca submissão ao pecado' },
            { t: 'Questões morais → Escrituras' },
            { t: 'Estrutura de autoridade do casamento' },
          ],
        },
        {
          t: 'Trabalho e lar',
          c: [
            { t: 'Prioridade da casa' },
            { t: 'Criação dos filhos' },
            { t: 'Presença materna' },
            { t: 'Tese para estudo: “A esposa não trabalhar fora”', k: 'discussao' },
          ],
        },
      ],
    },
    {
      t: 'CASAMENTO',
      c: [
        {
          t: 'Antes de escolher',
          c: [
            {
              t: 'Que marido/esposa meus filhos precisarão ter como pai/mãe?',
              k: 'pergunta',
            },
            { t: 'Fé' },
            { t: 'Caráter' },
            { t: 'Família' },
            { t: 'Temperamento' },
            { t: 'Visão de futuro' },
          ],
        },
        {
          t: 'Namoro / pretendente',
          c: [
            { t: 'Envolvimento dos pais' },
            { t: 'Aproximação das famílias' },
            { t: 'Conhecer profundamente o pretendente' },
            { t: 'Não decidir apenas pela paixão' },
          ],
        },
        {
          t: 'Alinhamento antes do casamento',
          c: [
            { t: 'Fé e igreja' },
            { t: 'Filhos' },
            { t: 'Educação' },
            { t: 'Dinheiro' },
            { t: 'Trabalho da esposa' },
            { t: 'Autoridade dentro da casa' },
            { t: 'Política' },
            { t: 'Sexualidade' },
            { t: 'Relação com sogros' },
            { t: 'Onde morar' },
          ],
        },
        {
          t: 'Infidelidade',
          c: [
            { t: 'O que consideramos traição?', k: 'pergunta' },
            { t: 'Quais limites teremos?', k: 'pergunta' },
            { t: 'Como lidaríamos com uma ocorrência?', k: 'pergunta' },
          ],
        },
        {
          t: 'Depois do casamento',
          c: [
            { t: 'Unidade' },
            { t: 'Fidelidade' },
            { t: 'Responsabilidades definidas' },
            { t: 'Vida espiritual' },
            { t: 'Projeto familiar comum' },
          ],
        },
      ],
    },
    {
      t: 'FILHOS E FILHAS',
      c: [
        {
          t: 'Começar pelo fim',
          c: [{ t: 'Que adulto queremos entregar ao mundo?', k: 'pergunta' }],
        },
        {
          t: 'Filho',
          c: [
            { t: 'Fé' },
            { t: 'Responsabilidade' },
            { t: 'Trabalho' },
            { t: 'Coragem' },
            { t: 'Provisão' },
            { t: 'Liderança' },
            { t: 'Proteção' },
            { t: 'Preparação para ser marido/pai' },
          ],
        },
        {
          t: 'Filha',
          c: [
            { t: 'Fé' },
            { t: 'Caráter' },
            { t: 'Feminilidade' },
            { t: 'Sabedoria' },
            { t: 'Critérios para escolher marido' },
            { t: 'Preparação para casamento/maternidade' },
          ],
        },
        {
          t: 'Etapas',
          c: [
            { t: '0–5 anos', c: [{ t: 'Fundamento' }] },
            { t: '6–10 anos', c: [{ t: 'Hábitos' }, { t: 'Obediência' }] },
            { t: '11–14 anos', c: [{ t: 'Caráter' }, { t: 'Responsabilidade' }] },
            { t: '15–18 anos', c: [{ t: 'Preparação para vida adulta' }] },
            { t: 'Vida adulta', c: [{ t: 'Casamento' }, { t: 'Vocação' }, { t: 'Legado' }] },
          ],
        },
      ],
    },
    {
      t: 'AS DUAS FAMÍLIAS',
      c: [
        { t: 'Casamento não une somente duas pessoas' },
        { t: 'Aproximação familiar' },
        { t: 'Valores compartilhados' },
        { t: 'Conhecer criação e histórico' },
        { t: 'Alinhar expectativas' },
        { t: 'Aconselhamento dos pais' },
        { t: 'Preservar a autoridade do novo casal' },
      ],
    },
    {
      t: 'LEGADO',
      c: [
        { t: 'Fé' },
        { t: 'Família' },
        { t: 'Caráter' },
        { t: 'Conhecimento' },
        { t: 'Patrimônio' },
        { t: 'Trabalho' },
        { t: 'Competência' },
        { t: 'Próxima geração' },
      ],
    },
    {
      t: 'O FLUXO DO LEGADO',
      d: 'Visualização de alto nível.\n\n“Que homem preciso me tornar para conseguir construir a família que desejo deixar como legado?”',
      k: 'principio',
      c: [
        {
          t: 'DEUS',
          c: [
            {
              t: 'HOMEM',
              c: [
                {
                  t: 'CASAMENTO',
                  c: [
                    {
                      t: 'CASA',
                      c: [
                        {
                          t: 'FILHOS',
                          c: [
                            {
                              t: 'CASAMENTO DOS FILHOS',
                              c: [{ t: 'NETOS', c: [{ t: 'LEGADO' }] }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/** Flattens the seed tree into node rows for a given map. */
export function buildSeedNodes(mapId: string, userId: string): MapNode[] {
  const rows: MapNode[] = [];

  function walk(seed: SeedNode, parentId: string | null, order: number, depth: number) {
    const id = crypto.randomUUID();
    rows.push(
      emptyNode({
        id,
        map_id: mapId,
        parent_id: parentId,
        title: seed.t,
        description: seed.d ?? '',
        node_type: seed.k ?? 'observacao',
        importance: depth <= 1 ? 'fundamental' : 'normal',
        order_index: order,
        // Deep branches start collapsed so the first view stays readable.
        collapsed: depth >= 2 && !!seed.c?.length,
        created_by: userId,
      })
    );
    seed.c?.forEach((child, i) => walk(child, id, i, depth + 1));
  }

  walk(SEED, null, 0, 0);
  return rows;
}
