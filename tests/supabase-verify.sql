-- All test users and rows are rolled back inside a subtransaction; no email is sent.
do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  payload jsonb := '{"version":1,"edits":{"notes":{},"addedNodes":{},"deleted":[],"renamed":{},"moved":{}},"progress":{"mastery":{},"checkins":{}}}'::jsonb;
  result jsonb;
  changed integer;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.jrs_workspaces'::regclass) then
    raise exception 'Workspace RLS is disabled';
  end if;
  if has_table_privilege('anon', 'public.jrs_workspaces', 'SELECT')
    or has_function_privilege('anon', 'public.jrs_save_workspace(uuid,jsonb,bigint)', 'EXECUTE') then
    raise exception 'Anonymous access is enabled';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.jrs_save_workspace(uuid,jsonb,bigint)'::regprocedure) then
    raise exception 'Save RPC bypasses RLS';
  end if;

  begin
    insert into auth.users(id) values (user_a), (user_b);
    insert into public.jrs_workspaces(user_id, payload) values (user_b, payload);
    perform set_config('request.jwt.claim.sub', user_a::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', user_a, 'role', 'authenticated')::text, true);
    set local role authenticated;

    result := public.jrs_save_workspace(user_a, payload, 0);
    if result->>'revision' is distinct from '1' then raise exception 'Initial save failed'; end if;
    result := public.jrs_save_workspace(user_a, payload, 1);
    if result->>'revision' is distinct from '2' then raise exception 'Revision update failed'; end if;
    if (select count(*) from public.jrs_workspaces) <> 1 then raise exception 'RLS revealed another workspace'; end if;
    if exists (select 1 from public.jrs_workspaces where user_id = user_b) then raise exception 'Cross-account read succeeded'; end if;

    update public.jrs_workspaces as workspace set payload = workspace.payload || '{"marker":"forbidden"}'::jsonb where user_id = user_b;
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'Cross-account update succeeded'; end if;

    begin
      perform public.jrs_save_workspace(user_a, payload, 1);
      raise exception 'Stale revision was accepted';
    exception when sqlstate 'PT409' then null;
    end;
    begin
      perform public.jrs_save_workspace(user_b, payload, 1);
      raise exception 'Cross-account RPC succeeded';
    exception when sqlstate 'PT401' then null;
    end;
    begin
      insert into public.jrs_workspaces(user_id, payload) values (user_b, payload);
      raise exception 'Cross-account insert succeeded';
    exception when insufficient_privilege then null;
    end;
    begin
      update public.jrs_workspaces set user_id = user_b where user_id = user_a;
      raise exception 'Workspace ownership reassignment succeeded';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.jrs_save_workspace(user_a, '{"version":2}'::jsonb, 2);
      raise exception 'Invalid snapshot was accepted';
    exception when check_violation then null;
    end;

    -- This sentinel rolls back every test mutation, including role and JWT changes.
    raise sqlstate 'Z0001' using message = 'Verification passed; roll back disposable data';
  exception when sqlstate 'Z0001' then null;
  end;
end;
$$;
select 'PASS: save/update/revision conflict/RLS isolation/anonymous denial/payload validation; test data rolled back' as verification;
