-- No baseline is inserted here. Only a confirmed, authorized reset creates one.
create table private.admission_count_resets (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  baseline_at timestamptz not null default clock_timestamp(),
  reset_by uuid not null references auth.users(id) on delete restrict
);
alter table private.admission_count_resets enable row level security;
revoke all on private.admission_count_resets from public, anon, authenticated;
grant select, insert on private.admission_count_resets to service_role;
grant usage, select on sequence private.admission_count_resets_id_seq to service_role;

-- Retain the original authorization, credential verification and atomic redemption
-- body unchanged. It becomes a backend-only implementation in the private schema.
alter function public.admin_ticket_action(uuid, text, text) set schema private;
alter function private.admin_ticket_action(uuid, text, text) rename to admin_ticket_core;
revoke all on function private.admin_ticket_core(uuid, text, text) from public, anon, authenticated;

create function public.admin_ticket_action(p_admin uuid, p_action text, p_credential text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  baseline timestamptz;
begin
  -- The original check locks the enabled permanent admin's authorization row.
  perform private.admin_ticket_core(p_admin, 'session', null);
  if p_action in ('admit', 'dashboard') then
    -- Admissions can proceed concurrently. A reset waits for their COMMIT, then
    -- captures its timestamp; subsequent admissions wait until that reset commits.
    perform pg_catalog.pg_advisory_xact_lock_shared(20261031, 1);
  end if;
  if p_action <> 'dashboard' then
    return private.admin_ticket_core(p_admin, p_action, p_credential);
  end if;
  select baseline_at into baseline from private.admission_count_resets order by id desc limit 1;
  return jsonb_build_object(
    'baselineAt', baseline,
    'total', (select count(*) from public.tickets),
    'lifetimeAdmitted', (select count(*) from public.tickets where status = 'redeemed'),
    'admitted', (select count(*) from public.tickets where status = 'redeemed' and (baseline is null or redeemed_at >= baseline)),
    'remaining', (select count(*) from public.tickets where status = 'issued'),
    'distribution', (select coalesce(jsonb_agg(row_to_json(d) order by d."editionId"), '[]'::jsonb) from (
      select e.id as "editionId", count(t.id) as total,
        count(t.id) filter (where t.status = 'redeemed' and (baseline is null or t.redeemed_at >= baseline)) as admitted
      from private.ticket_editions e left join public.tickets t on t.edition_id = e.id group by e.id
    ) d),
    'recent', (select coalesce(jsonb_agg(row_to_json(r) order by r."redeemedAt" desc, r.id desc), '[]'::jsonb) from (
      select id, edition_id as "editionId", 'HM-' || display_number::text as "displayNumber",
        redeemed_at as "redeemedAt", redeemed_by as "redeemedBy"
      from public.tickets where status = 'redeemed' and (baseline is null or redeemed_at >= baseline)
      order by redeemed_at desc, id desc limit 20
    ) r)
  );
end;
$$;
revoke all on function public.admin_ticket_action(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_ticket_action(uuid, text, text) to service_role;

create function public.reset_admission_count(p_admin uuid, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  saved private.admission_count_resets%rowtype;
begin
  perform private.admin_ticket_core(p_admin, 'session', null);
  if p_request_id is null then raise exception 'Reset request ID required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(20261031, 1);
  select * into saved from private.admission_count_resets where request_id = p_request_id;
  if not found then
    insert into private.admission_count_resets(request_id, reset_by)
      values (p_request_id, p_admin) returning * into saved;
  end if;
  return jsonb_build_object('baselineAt', saved.baseline_at, 'resetId', saved.id::text);
end;
$$;
revoke all on function public.reset_admission_count(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reset_admission_count(uuid, uuid) to service_role;

-- Keyset pagination keeps all past admissions accessible without large payloads.
create function public.admin_admission_history(p_admin uuid, p_before timestamptz default null, p_before_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform private.admin_ticket_core(p_admin, 'session', null);
  if (p_before is null) <> (p_before_id is null) then raise exception 'Invalid history cursor'; end if;
  return (
    with recent as materialized (
      select id, redeemed_at, jsonb_build_object('id', id, 'editionId', edition_id,
        'displayNumber', 'HM-' || display_number::text, 'redeemedAt', redeemed_at, 'redeemedBy', redeemed_by) as item
      from public.tickets where status = 'redeemed'
        and (p_before is null or (redeemed_at, id) < (p_before, p_before_id))
      order by redeemed_at desc, id desc limit 21
    ), page as (select * from recent order by redeemed_at desc, id desc limit 20)
    select jsonb_build_object(
      'items', (select coalesce(jsonb_agg(item order by redeemed_at desc, id desc), '[]'::jsonb) from page),
      'nextCursor', case when (select count(*) from recent) > 20 then (
        select jsonb_build_object('redeemedAt', redeemed_at, 'id', id) from page order by redeemed_at, id limit 1
      ) else null end,
      'resets', (select coalesce(jsonb_agg(row_to_json(r) order by r.id::bigint desc), '[]'::jsonb) from (
        select id::text, baseline_at as "baselineAt", reset_by as "resetBy"
        from private.admission_count_resets order by admission_count_resets.id desc limit 20
      ) r)
    )
  );
end;
$$;
revoke all on function public.admin_admission_history(uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.admin_admission_history(uuid, timestamptz, uuid) to service_role;
