create table public.jrs_desktop_backup_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, revision),
  constraint jrs_desktop_snapshot_payload_valid check (
    (jsonb_typeof(payload) = 'object'
      and payload->'version' = '2'::jsonb
      and jsonb_typeof(payload->'categories') = 'array'
      and jsonb_typeof(payload->'questions') = 'array'
      and jsonb_typeof(payload->'schedules') = 'array'
      and jsonb_typeof(payload->'reviews') = 'array'
      and octet_length(payload::text) <= 20971520
    ) is true
  )
);

insert into public.jrs_desktop_backup_snapshots(user_id, revision, payload, created_at)
select user_id, revision, payload, updated_at from public.jrs_desktop_backups
on conflict (user_id, revision) do nothing;

alter table public.jrs_desktop_backup_snapshots enable row level security;
revoke all on table public.jrs_desktop_backup_snapshots from anon, authenticated;
grant select on table public.jrs_desktop_backup_snapshots to authenticated;
create policy jrs_select_own_desktop_backup_snapshots on public.jrs_desktop_backup_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.jrs_save_desktop_backup_snapshot(p_user_id uuid, p_payload jsonb, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_revision bigint;
  saved_revision bigint;
  saved_at timestamptz;
begin
  if (select auth.uid()) is null or p_user_id is distinct from (select auth.uid()) then
    raise sqlstate 'PT401' using message = 'User identity does not match the backup';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_payload is null
    or jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload->'version' is distinct from '2'::jsonb
    or jsonb_typeof(p_payload->'categories') is distinct from 'array'
    or jsonb_typeof(p_payload->'questions') is distinct from 'array'
    or jsonb_typeof(p_payload->'schedules') is distinct from 'array'
    or jsonb_typeof(p_payload->'reviews') is distinct from 'array'
    or octet_length(p_payload::text) > 20971520 then
    raise sqlstate 'PT400' using message = 'Invalid desktop backup or revision';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select max(revision) into current_revision from public.jrs_desktop_backup_snapshots where user_id = p_user_id;
  current_revision := coalesce(current_revision, 0);
  if current_revision <> p_expected_revision then
    raise sqlstate 'PT409' using message = 'Cloud backup changed; reload before overwriting';
  end if;
  saved_revision := current_revision + 1;
  insert into public.jrs_desktop_backup_snapshots(user_id, revision, payload)
  values (p_user_id, saved_revision, p_payload) returning created_at into saved_at;
  delete from public.jrs_desktop_backup_snapshots
    where user_id = p_user_id and revision <= saved_revision - 10;
  return jsonb_build_object('revision', saved_revision, 'createdAt', saved_at);
end;
$$;

revoke execute on function public.jrs_save_desktop_backup_snapshot(uuid, jsonb, bigint) from public, anon;
grant execute on function public.jrs_save_desktop_backup_snapshot(uuid, jsonb, bigint) to authenticated;
