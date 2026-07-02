-- Run this in your Supabase SQL editor (new project)
-- Enable anonymous auth in Supabase Dashboard → Authentication → Providers → Anonymous

-- LISTS
create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('personal', 'tasks', 'shopping')),
  emoji       text not null default '📋',
  owner_id    uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- LIST ITEMS
create table public.list_items (
  id                 uuid primary key default gen_random_uuid(),
  list_id            uuid not null references public.lists(id) on delete cascade,
  title              text not null,
  quantity           text,
  completed          boolean not null default false,
  added_by_name      text not null,
  completed_by_name  text,
  created_at         timestamptz not null default now()
);

-- LIST MEMBERS
create table public.list_members (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.lists(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  role         text not null check (role in ('owner', 'collaborator')),
  display_name text not null,
  unique (list_id, user_id)
);

-- RLS
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.list_members enable row level security;

-- lists: owner can do anything; members can read
create policy "owner full access" on public.lists
  for all using (owner_id = auth.uid());

create policy "members can read" on public.lists
  for select using (
    exists (
      select 1 from public.list_members
      where list_id = lists.id and user_id = auth.uid()
    )
  );

create policy "members can update updated_at" on public.lists
  for update using (
    exists (
      select 1 from public.list_members
      where list_id = lists.id and user_id = auth.uid()
    )
  );

-- list_items: any member can read/insert/update/delete
create policy "members can read items" on public.list_items
  for select using (
    exists (
      select 1 from public.list_members
      where list_id = list_items.list_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.lists
      where id = list_items.list_id and owner_id = auth.uid()
    )
  );

create policy "members can insert items" on public.list_items
  for insert with check (
    exists (
      select 1 from public.list_members
      where list_id = list_items.list_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.lists
      where id = list_items.list_id and owner_id = auth.uid()
    )
  );

create policy "members can update items" on public.list_items
  for update using (
    exists (
      select 1 from public.list_members
      where list_id = list_items.list_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.lists
      where id = list_items.list_id and owner_id = auth.uid()
    )
  );

create policy "members can delete items" on public.list_items
  for delete using (
    exists (
      select 1 from public.list_members
      where list_id = list_items.list_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.lists
      where id = list_items.list_id and owner_id = auth.uid()
    )
  );

-- list_members: members can read; anyone can insert (to join)
create policy "members can read members" on public.list_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.lists
      where id = list_members.list_id and owner_id = auth.uid()
    )
    or exists (
      select 1 from public.list_members lm2
      where lm2.list_id = list_members.list_id and lm2.user_id = auth.uid()
    )
  );

create policy "authenticated users can join" on public.list_members
  for insert with check (user_id = auth.uid());

-- Enable realtime on list_items
alter publication supabase_realtime add table public.list_items;
