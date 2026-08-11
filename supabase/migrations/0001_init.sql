-- Homens | Família & Legado — initial schema
-- Maps, nodes, versions and future-proof membership roles, all guarded by RLS.

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  concept text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prepared for future roles (owner / editor / viewer). Only owners exist today.
create table public.map_members (
  map_id uuid not null references public.maps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (map_id, user_id)
);

create table public.nodes (
  id uuid primary key,
  map_id uuid not null references public.maps (id) on delete cascade,
  parent_id uuid references public.nodes (id) on delete cascade,
  title text not null default '',
  description text not null default '',
  notes text not null default '',
  node_type text not null default 'observacao',
  importance text not null default 'normal' check (importance in ('normal', 'importante', 'fundamental')),
  status text not null default 'ideia' check (status in ('ideia', 'estudando', 'consolidado')),
  tags text[] not null default '{}',
  refs jsonb not null default '[]',
  order_index integer not null default 0,
  position_x double precision,
  position_y double precision,
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create index nodes_map_id_idx on public.nodes (map_id);
create index nodes_parent_id_idx on public.nodes (parent_id);
create index maps_owner_id_idx on public.maps (owner_id);

create table public.map_versions (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps (id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index map_versions_map_id_idx on public.map_versions (map_id, created_at desc);

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger maps_updated_at before update on public.maps
  for each row execute function public.set_updated_at();
create trigger nodes_updated_at before update on public.nodes
  for each row execute function public.set_updated_at();

-- Access helper: owner today, membership-aware tomorrow.
create or replace function public.can_access_map(target_map uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.maps m
    where m.id = target_map
      and (
        m.owner_id = (select auth.uid())
        or exists (
          select 1 from public.map_members mm
          where mm.map_id = m.id and mm.user_id = (select auth.uid())
        )
      )
  );
$$;

alter table public.maps enable row level security;
alter table public.map_members enable row level security;
alter table public.nodes enable row level security;
alter table public.map_versions enable row level security;

create policy "maps: owners full access" on public.maps
  for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "map_members: owners manage" on public.map_members
  for all
  using (
    exists (select 1 from public.maps m where m.id = map_id and m.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.maps m where m.id = map_id and m.owner_id = (select auth.uid()))
  );

create policy "nodes: map members full access" on public.nodes
  for all
  using (public.can_access_map(map_id))
  with check (public.can_access_map(map_id));

create policy "map_versions: map members full access" on public.map_versions
  for all
  using (public.can_access_map(map_id))
  with check (public.can_access_map(map_id));
