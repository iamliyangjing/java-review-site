create table public.jrs_desktop_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint jrs_desktop_backup_payload_valid check (
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

alter table public.jrs_desktop_backups enable row level security;
revoke all on table public.jrs_desktop_backups from anon, authenticated;
grant select, insert, update on table public.jrs_desktop_backups to authenticated;

create policy jrs_select_own_desktop_backup on public.jrs_desktop_backups
  for select to authenticated using ((select auth.uid()) = user_id);
create policy jrs_insert_own_desktop_backup on public.jrs_desktop_backups
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy jrs_update_own_desktop_backup on public.jrs_desktop_backups
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.jrs_save_desktop_backup(p_user_id uuid, p_payload jsonb, p_expected_revision bigint)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
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

  if p_expected_revision = 0 then
    insert into public.jrs_desktop_backups(user_id, payload, revision)
    values (p_user_id, p_payload, 1)
    on conflict (user_id) do nothing
    returning revision, updated_at into saved_revision, saved_at;
  else
    update public.jrs_desktop_backups
    set payload = p_payload, revision = revision + 1, updated_at = now()
    where user_id = p_user_id and revision = p_expected_revision
    returning revision, updated_at into saved_revision, saved_at;
  end if;

  if saved_revision is null then
    raise sqlstate 'PT409' using message = 'Cloud backup changed; reload before overwriting';
  end if;
  return jsonb_build_object('revision', saved_revision, 'updatedAt', saved_at);
end;
$$;

revoke execute on function public.jrs_save_desktop_backup(uuid, jsonb, bigint) from public, anon;
grant execute on function public.jrs_save_desktop_backup(uuid, jsonb, bigint) to authenticated;
