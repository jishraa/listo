-- Run this AFTER supabase-migration-v3.sql
-- Adds a completion timestamp so activity feeds and future insights
-- (shopping-trip detection, completion trends) can order events honestly.

alter table public.list_items
  add column if not exists completed_at timestamptz default null;

-- Backfill: existing completed rows get their created_at as a best guess
update public.list_items
  set completed_at = created_at
  where completed = true and completed_at is null;
