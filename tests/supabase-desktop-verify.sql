-- Run after both desktop backup migrations in an isolated Supabase database.
-- All generated auth users and snapshots are rolled back by the sentinel.
do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  payload jsonb := '{"version":2,"categories":[],"questions":[],"schedules":[],"reviews":[]}'::jsonb;
  result jsonb;
  revision integer;
  own_count integer;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.jrs_desktop_backup_snapshots'::regclass) then
    raise exception 'Desktop snapshot RLS is disabled';
  end if;
  if has_table_privilege('anon', 'public.jrs_desktop_backup_snapshots', 'SELECT')
    or has_function_privilege('anon', 'public.jrs_save_desktop_backup_snapshot(uuid,jsonb,bigint)', 'EXECUTE') then
    raise exception 'Anonymous snapshot access is enabled';
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.jrs_save_desktop_backup_snapshot(uuid,jsonb,bigint)'::regprocedure) then
    raise exception 'Snapshot RPC must be SECURITY DEFINER to keep writes RPC-only';
  end if;
  if has_table_privilege('authenticated', 'public.jrs_desktop_backup_snapshots', 'INSERT')
    or has_table_privilege('authenticated', 'public.jrs_desktop_backup_snapshots', 'DELETE') then
    raise exception 'Authenticated clients can bypass snapshot retention';
  end if;

  begin
    insert into auth.users(id) values (user_a), (user_b);
    perform set_config('request.jwt.claim.sub', user_a::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', user_a, 'role', 'authenticated')::text, true);
    set local role authenticated;

    for revision in 1..11 loop
      result := public.jrs_save_desktop_backup_snapshot(user_a, payload || jsonb_build_object('marker', revision), revision - 1);
      if (result->>'revision')::integer <> revision then raise exception 'Revision sequence was not monotonic'; end if;
    end loop;
    select count(*) into own_count from public.jrs_desktop_backup_snapshots;
    if own_count <> 10 then raise exception 'Expected exactly ten retained snapshots, found %', own_count; end if;
    if exists (select 1 from public.jrs_desktop_backup_snapshots where user_id = user_b) then raise exception 'Cross-account read succeeded'; end if;
    if (select payload->>'marker' from public.jrs_desktop_backup_snapshots where revision = 2) <> '2' then
      raise exception 'Oldest retained snapshot cannot be restored';
    end if;

    begin
      perform public.jrs_save_desktop_backup_snapshot(user_a, payload, 10);
      raise exception 'Stale revision was accepted';
    exception when sqlstate 'PT409' then null;
    end;
    begin
      perform public.jrs_save_desktop_backup_snapshot(user_b, payload, 11);
      raise exception 'Cross-account RPC succeeded';
    exception when sqlstate 'PT401' then null;
    end;
    begin
      perform public.jrs_save_desktop_backup_snapshot(user_a, '{"version":1}'::jsonb, 11);
      raise exception 'Invalid payload was accepted';
    exception when sqlstate 'PT400' then null;
    end;

    raise sqlstate 'Z0001' using message = 'Verification passed; roll back disposable data';
  exception when sqlstate 'Z0001' then null;
  end;
end;
$$;
select 'PASS: RLS isolation, RPC-only saves, stale revisions, payload checks and 10-version retention' as verification;
