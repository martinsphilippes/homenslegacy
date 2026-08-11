# Homens | Família & Legado

Aplicação web (PWA) para construção e administração de mapas mentais, criada para o mapa
**“Homem, Família e Legado”** — *Que tipo de família estamos construindo?*

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4**
- **Firebase** — Authentication (e-mail/senha, recuperação de senha) e **Cloud Firestore**
  com regras de segurança por dono (`firestore.rules`)
- **React Flow (@xyflow/react)** — mapa mental visual com layout de árvore próprio O(n)
- **Zustand** — estado do editor com desfazer/refazer
- **PWA** — manifest + service worker (instalável, com visualização offline)
- **Vercel** — deploy

## Funcionalidades

- Login, cadastro, logout, recuperação de senha e proteção das rotas internas
- Tela “Meus Mapas”: abrir, criar, renomear, duplicar, excluir, importar backup
- Mapa mental interativo: criar filho/irmão, editar (duplo clique, Enter/Esc), excluir com
  confirmação, duplicar ramo, mover (posições manuais são salvas), menu de contexto
- Expandir/recolher por ramo, expandir/recolher tudo, “expandir somente este ramo”
- Painel lateral: descrição, anotações, referências bíblicas (livro/capítulo/versículo/comentário),
  tags, tipo da informação, importância, status — tudo com autosave (debounce)
- Busca global (título, descrição, anotações, tags, referências) com navegação e destaque
- Zoom, pan, minimapa, ajustar à tela, breadcrumbs clicáveis
- Organização automática do layout preservando ajustes manuais até “Organizar mapa”
- Desfazer/refazer, versões periódicas do mapa (subcoleção `versions`)
- Modo apresentação (controles ocultos, abrir um ramo por vez, tela cheia)
- Exportar backup JSON (restaurável via importação validada) e exportar PNG
- Dark/Light mode; interface responsiva para desktop, tablet e celular
- Offline: cache persistente do Firestore (IndexedDB) — leitura offline e fila de escritas
  sincronizada automaticamente ao reconectar

## Configuração do Firebase (produção)

1. Crie um projeto em https://console.firebase.google.com
2. **Authentication → Sign-in method → E-mail/senha → Ativar**
3. **Firestore Database → Criar banco** (modo produção)
4. Publique as regras de segurança: copie o conteúdo de `firestore.rules` em
   *Firestore → Regras* (ou `npx firebase deploy --only firestore:rules`)
5. **Configurações do projeto → Seus apps → Web (`</>`)** — registre o app e copie a configuração
6. Preencha as variáveis (veja `.env.example`) no `.env.local` e no painel da Vercel

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha com a configuração do seu projeto Firebase
npm run dev
```

Para desenvolver sem projeto real, use o Firebase Emulator (Java necessário):

```bash
npx firebase emulators:start --project demo-hfl --only auth,firestore
# .env.local: NEXT_PUBLIC_FIREBASE_EMULATOR=1 (e projectId demo-hfl)
```

### Testes

```bash
node scripts/e2e.mjs   # 30 verificações de ponta a ponta (Playwright + emulador)
node scripts/perf.mjs  # teste de performance com mapa de ~1300 nodes
```

No primeiro acesso de um usuário sem mapas, o mapa inicial “Homem, Família e Legado” é criado e
populado automaticamente (`src/lib/seed.ts`).

## Dados

```
maps/{mapId}                  → título, conceito, owner_id, timestamps
maps/{mapId}/nodes/{nodeId}   → title, description, notes, node_type, importance, status,
                                tags, refs[], order_index, position_x/y, collapsed, …
maps/{mapId}/versions/{vId}   → snapshots periódicos para recuperação
```

As regras (`firestore.rules`) garantem que apenas o dono acessa o mapa e seus nodes — já
preparadas para papéis futuros (proprietário/editor/visualizador via campo `members`).

## Arquitetura (resumo)

- `src/store/map-store.ts` — estado do editor (nodes, seleção, histórico) e operações
- `src/lib/persistence.ts` — fila de salvamento com debounce sobre o cache persistente do Firestore
- `src/lib/maps-repo.ts` — operações de mapas (CRUD, duplicação, importação, batches)
- `src/lib/layout.ts` — índice da árvore, visibilidade (colapso) e layout automático O(n)
- `src/components/editor/*` — React Flow, node customizado, painel, busca, breadcrumbs, menu
- `src/lib/seed.ts` — conteúdo inicial do mapa
- `src/lib/backup.ts` — exportação/validação de backups

A arquitetura está preparada para integrações futuras (API bíblica, sugestões com IA por node):
as referências são estruturadas e todas as operações do editor passam por um único store.
