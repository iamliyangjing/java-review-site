-- Each user's complete overlay is saved atomically; immutable course content stays in the app.
create table public.jrs_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint jrs_workspace_payload_valid check (
    (jsonb_typeof(payload) = 'object'
    and payload->'version' = '1'::jsonb
    and jsonb_typeof(payload->'edits') = 'object'
    and jsonb_typeof(payload->'progress') = 'object'
    and jsonb_typeof(payload->'progress'->'mastery') = 'object'
    and jsonb_typeof(payload->'progress'->'checkins') = 'object'
    and octet_length(payload::text) <= 5242880
    ) is true
  )
);

alter table public.jrs_workspaces enable row level security;
revoke all on table public.jrs_workspaces from anon, authenticated;
grant select, insert, update on table public.jrs_workspaces to authenticated;

create policy jrs_select_own_workspace on public.jrs_workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
create policy jrs_insert_own_workspace on public.jrs_workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy jrs_update_own_workspace on public.jrs_workspaces
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Invoker permissions keep RLS active. The expected revision prevents lost updates.
create function public.jrs_save_workspace(p_user_id uuid, p_payload jsonb, p_expected_revision bigint)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  saved_revision bigint;
begin
  if (select auth.uid()) is null or p_user_id is distinct from (select auth.uid()) then
    raise sqlstate 'PT401' using message = 'User identity does not match the workspace';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_payload is null then
    raise sqlstate 'PT400' using message = 'Invalid workspace or revision';
  end if;
  if p_expected_revision = 0 then
    insert into public.jrs_workspaces(user_id, payload, revision)
    values(p_user_id, p_payload, 1)
    on conflict (user_id) do nothing returning revision into saved_revision;
  else
    update public.jrs_workspaces
    set payload = p_payload, revision = revision + 1, updated_at = now()
    where user_id = p_user_id and revision = p_expected_revision
    returning revision into saved_revision;
  end if;
  if saved_revision is null then
    raise sqlstate 'PT409' using message = 'Workspace changed; reload before saving';
  end if;
  return jsonb_build_object('revision', saved_revision);
end;
$$;

revoke execute on function public.jrs_save_workspace(uuid, jsonb, bigint) from public, anon;
grant execute on function public.jrs_save_workspace(uuid, jsonb, bigint) to authenticated;
