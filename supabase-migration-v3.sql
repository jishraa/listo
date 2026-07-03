-- Run this AFTER supabase-migration-v2.sql
-- Adds custom templates and list archiving.

-- A template is a regular list row hidden from the normal sections;
-- it reuses all existing RLS, items and CRUD.
alter table public.lists
  add column if not exists is_template boolean not null default false;

-- Archived lists are hidden from active sections and restorable.
alter table public.lists
  add column if not exists archived_at timestamptz default null;
