-- Tablas del backend de pen2mermaid (S1). Los permisos y la RLS van en la migración siguiente.
-- Las restricciones nunca son más estrictas que frontend/ops.js (ver design.md, decisión 6).

create table public.diagrams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Diagrama sin título'
    check (char_length(title) between 1 and 200 and btrim(title) <> ''),
  kind text not null default 'flow' check (kind in ('flow', 'state')),
  direction text not null default 'TD' check (direction in ('TD', 'LR')),
  last_seq bigint not null default 0 check (last_seq >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.diagram_members (
  diagram_id uuid not null references public.diagrams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  display_name text,
  added_at timestamptz not null default now(),
  primary key (diagram_id, user_id)
);

-- Un solo dueño por diagrama.
create unique index diagram_members_un_dueno on public.diagram_members (diagram_id) where role = 'owner';
-- Para listar los diagramas de un usuario.
create index diagram_members_user_id on public.diagram_members (user_id);

create table public.diagram_invites (
  token text primary key,
  diagram_id uuid not null references public.diagrams (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);

create index diagram_invites_diagram_id on public.diagram_invites (diagram_id);

create table public.diagram_ops (
  diagram_id uuid not null references public.diagrams (id) on delete cascade,
  seq bigint not null check (seq >= 1),
  -- Si el usuario se da de baja, sus operaciones se quedan en el registro de los diagramas compartidos.
  user_id uuid references auth.users (id) on delete set null,
  op_id uuid not null,
  op jsonb not null check (jsonb_typeof(op) = 'object' and octet_length(op::text) <= 2048),
  created_at timestamptz not null default now(),
  primary key (diagram_id, seq),
  unique (diagram_id, op_id)
);
