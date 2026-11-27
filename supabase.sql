-- Gym Log – cloud sync schema for Supabase.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- One table holds every record of every user: (user, store, id) → the record as JSON.
-- The app stays the source of truth on each device; the server only keeps the newest version
-- of each record (by updatedAt) and a running sequence number so devices can ask
-- "what changed since seq N?". Row Level Security: everyone only sees and writes their own rows.

create sequence if not exists public.records_seq;

create table if not exists public.records (
  user_id    uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  store      text   not null check (store in ('exercises', 'workouts', 'workoutExercises', 'sets',
                                              'plans', 'planWorkouts', 'planExercises', 'charts')),
  id         text   not null,
  data       jsonb  not null,
  updated_at text   not null,                                  -- record.updatedAt (ISO string from the app)
  seq        bigint not null default nextval('public.records_seq'), -- bumped on every change, for pulling
  primary key (user_id, store, id)
);
create index if not exists records_user_seq on public.records (user_id, seq);

alter table public.records enable row level security;

drop policy if exists "read own records" on public.records;
create policy "read own records" on public.records
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "insert own records" on public.records;
create policy "insert own records" on public.records
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "update own records" on public.records;
create policy "update own records" on public.records
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.records from anon, authenticated;
grant select, insert, update on public.records to authenticated;
grant usage on sequence public.records_seq to authenticated;

-- Upsert a batch of records: [{ store, id, data, updated_at }, …].
-- A record only replaces the stored one if it is newer, so an old device can never overwrite newer data.
create or replace function public.push_records(items jsonb)
returns integer
language sql
security invoker          -- runs as the signed-in user, so the policies above apply
set search_path = ''
as $$
  with written as (
    insert into public.records (user_id, store, id, data, updated_at)
    select auth.uid(), i ->> 'store', i ->> 'id', i -> 'data', coalesce(i ->> 'updated_at', '')
    from jsonb_array_elements(items) as i
    on conflict (user_id, store, id) do update
      set data = excluded.data, updated_at = excluded.updated_at, seq = excluded.seq
      where public.records.updated_at < excluded.updated_at
    returning 1
  )
  select count(*)::integer from written;
$$;

revoke execute on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
