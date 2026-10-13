-- Daily Wan image quota (5/day free) + Team Workspace (paid-only 24/7 agents).
-- Applies cleanly on re-run (IF NOT EXISTS guards).

-- 1) Daily image generations log (one row per generated image).
create table if not exists public.image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null default 'wan2.7-image',
  created_at timestamptz not null default now()
);
create index if not exists image_generations_user_day_idx
  on public.image_generations (user_id, created_at desc);
alter table public.image_generations enable row level security;
drop policy if exists "service only" on public.image_generations;
create policy "service only" on public.image_generations
  for all to service_role using (true) with check (true);

-- 2) Team workspaces (one per user, paid-only).
create table if not exists public.team_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  goal text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.team_workspaces enable row level security;
drop policy if exists "service only" on public.team_workspaces;
create policy "service only" on public.team_workspaces
  for all to service_role using (true) with check (true);

-- 3) Team agents (persistent 24/7 workers inside a workspace).
create table if not exists public.team_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.team_workspaces(id) on delete cascade,
  name text not null,
  role text not null,
  task text not null default '',
  status text not null default 'running',
  last_result text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_agents_workspace_idx
  on public.team_agents (workspace_id, updated_at desc);
alter table public.team_agents enable row level security;
drop policy if exists "service only" on public.team_agents;
create policy "service only" on public.team_agents
  for all to service_role using (true) with check (true);
