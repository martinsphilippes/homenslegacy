# Homens | Família & Legado

Aplicação web (PWA) para construção e administração de mapas mentais, criada para o mapa
**“Homem, Família e Legado”** — *Que tipo de família estamos construindo?*

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4**
- **Supabase** — autenticação (e-mail/senha, recuperação de senha) e banco Postgres com RLS
- **React Flow (@xyflow/react)** + **dagre** — mapa mental visual com layout automático
- **Zustand** — estado do editor com desfazer/refazer
- **PWA** — manifest + service worker (instalável, com visualização offline)
- **Vercel** — deploy

## Funcionalidades

- Login, cadastro, logout, recuperação de senha e proteção de rotas (via proxy/middleware)
- Tela “Meus Mapas”: abrir, criar, renomear, duplicar, excluir, importar backup
- Mapa mental interativo: criar filho/irmão, editar (duplo clique, Enter/Esc), excluir com
  confirmação, duplicar ramo, mover (posições manuais são salvas), menu de contexto
- Expandir/recolher por ramo, expandir/recolher tudo, “expandir somente este ramo”
- Painel lateral: descrição, anotações, referências bíblicas (livro/capítulo/versículo/comentário),
  tags, tipo da informação, importância, status — tudo com autosave (debounce)
- Busca global (título, descrição, anotações, tags, referências) com navegação e destaque
- Zoom, pan, minimapa, ajustar à tela, breadcrumbs clicáveis
- Organização automática do layout (dagre) preservando ajustes manuais até “Organizar mapa”
- Desfazer/refazer, versões periódicas do mapa (`map_versions`)
- Modo apresentação (controles ocultos, abrir um ramo por vez, tela cheia)
- Exportar backup JSON (restaurável via importação validada) e exportar PNG
- Dark/Light mode; interface responsiva para desktop, tablet e celular
- Offline: visualização do último estado carregado + fila de alterações sincronizada ao reconectar

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha com URL e chave do seu projeto Supabase
npm run dev
```

O schema do banco está em `supabase/migrations/0001_init.sql` (tabelas `maps`, `map_members`,
`nodes`, `map_versions`, com políticas RLS por dono e preparadas para papéis futuros
proprietário/editor/visualizador).

No primeiro acesso de um usuário sem mapas, o mapa inicial “Homem, Família e Legado” é criado e
populado automaticamente (`src/lib/seed.ts`).

## Arquitetura (resumo)

- `src/store/map-store.ts` — estado do editor (nodes, seleção, histórico) e operações
- `src/lib/persistence.ts` — fila de salvamento com debounce, espelho em localStorage e retry offline
- `src/lib/layout.ts` — índice da árvore, visibilidade (colapso) e layout automático
- `src/components/editor/*` — React Flow, node customizado, painel, busca, breadcrumbs, menu
- `src/lib/seed.ts` — conteúdo inicial do mapa
- `src/lib/backup.ts` — exportação/validação de backups

A arquitetura está preparada para integrações futuras (API bíblica, sugestões com IA por node):
os dados de referência são estruturados e as operações do editor passam por um único store.
