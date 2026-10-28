-- Add fields only. Legacy resets deliberately keep NULL snapshots: they were
-- not captured at the time and cannot be presented as immutable historical facts.
alter table private.admission_count_resets add column period_start timestamptz;
alter table private.admission_count_resets add column snapshot jsonb;
alter table private.admission_count_resets add constraint counting_snapshot_object
  check (snapshot is null or jsonb_typeof(snapshot) = 'object');

-- New issuance timestamps must be assigned AFTER acquiring the counting lock,
-- not at the beginning of a transaction that may wait across a reset boundary.
-- This changes the default for future INSERTs only; existing rows are untouched.
alter table public.tickets alter column created_at set default clock_timestamp();
create index tickets_created_at on public.tickets(created_at);
alter function public.issue_guest_ticket(uuid, boolean) set schema private;
alter function private.issue_guest_ticket(uuid, boolean) rename to issue_guest_ticket_core;
revoke all on function private.issue_guest_ticket_core(uuid, boolean) from public, anon, authenticated;
create function public.issue_guest_ticket(p_owner uuid, p_create boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if current_user <> 'service_role' then raise insufficient_privilege using message = 'Backend access required'; end if;
  if p_create then perform pg_catalog.pg_advisory_xact_lock_shared(20261031, 1); end if;
  return private.issue_guest_ticket_core(p_owner, p_create);
end;
$$;
revoke all on function public.issue_guest_ticket(uuid, boolean) from public, anon, authenticated;
grant execute on function public.issue_guest_ticket(uuid, boolean) to service_role;

-- Half-open intervals [start,end) give a boundary timestamp to exactly one period.
-- All issue/admit transactions hold a shared lock; reset holds the exclusive lock.
create function private.counting_period_stats(p_start timestamptz, p_end timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if current_user <> 'service_role' then raise insufficient_privilege using message = 'Backend access required'; end if;
  return (
    with facts as materialized (
      select t.*,
        (p_start is null or created_at >= p_start) and (p_end is null or created_at < p_end) as generated_in_period,
        redeemed_at is not null and (p_start is null or redeemed_at >= p_start) and (p_end is null or redeemed_at < p_end) as admitted_in_period,
        redeemed_at is null or (p_end is not null and redeemed_at >= p_end) as waiting_at_end
      from public.tickets t where p_end is null or created_at < p_end
    )
    select jsonb_build_object(
      'total', (select count(*) from facts where generated_in_period),
      'admitted', (select count(*) from facts where admitted_in_period),
      'remaining', (select count(*) from facts where generated_in_period and waiting_at_end),
      'lifetimeGenerated', (select count(*) from facts),
      'lifetimeAdmitted', (select count(*) from facts where not waiting_at_end),
      'lifetimeRemaining', (select count(*) from facts where waiting_at_end),
      'distribution', (select coalesce(jsonb_agg(row_to_json(d) order by d."editionId"), '[]'::jsonb) from (
        select e.id as "editionId", count(f.id) filter (where generated_in_period) as total,
          count(f.id) filter (where admitted_in_period) as admitted,
          count(f.id) filter (where generated_in_period and waiting_at_end) as remaining
        from private.ticket_editions e left join facts f on f.edition_id=e.id group by e.id
      ) d)
    )
  );
end;
$$;
revoke all on function private.counting_period_stats(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function private.counting_period_stats(timestamptz, timestamptz) to service_role;

create or replace function public.admin_ticket_action(p_admin uuid, p_action text, p_credential text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare baseline timestamptz;
begin
  perform private.admin_ticket_core(p_admin, 'session', null);
  if p_action in ('admit', 'dashboard') then perform pg_catalog.pg_advisory_xact_lock_shared(20261031, 1); end if;
  if p_action <> 'dashboard' then return private.admin_ticket_core(p_admin, p_action, p_credential); end if;
  select baseline_at into baseline from private.admission_count_resets order by id desc limit 1;
  return private.counting_period_stats(baseline, null) || jsonb_build_object(
    'baselineAt', baseline,
    'recent', (select coalesce(jsonb_agg(row_to_json(r) order by r."redeemedAt" desc, r.id desc), '[]'::jsonb) from (
      select id, edition_id as "editionId", 'HM-' || display_number::text as "displayNumber", redeemed_at as "redeemedAt", redeemed_by as "redeemedBy"
      from public.tickets where status='redeemed' and (baseline is null or redeemed_at >= baseline)
      order by redeemed_at desc, id desc limit 20
    ) r)
  );
end;
$$;

create or replace function public.reset_admission_count(p_admin uuid, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  saved private.admission_count_resets%rowtype;
  previous_start timestamptz;
  cutoff timestamptz;
begin
  perform private.admin_ticket_core(p_admin, 'session', null);
  if p_request_id is null then raise exception 'Reset request ID required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(20261031, 1);
  select * into saved from private.admission_count_resets where request_id=p_request_id;
  if not found then
    select baseline_at into previous_start from private.admission_count_resets order by id desc limit 1;
    cutoff := clock_timestamp();
    insert into private.admission_count_resets(request_id,reset_by,baseline_at,period_start,snapshot)
      values(p_request_id,p_admin,cutoff,previous_start,private.counting_period_stats(previous_start,cutoff)) returning * into saved;
  end if;
  return jsonb_build_object('baselineAt',saved.baseline_at,'resetId',saved.id::text,
    'period',public.admin_ticket_action(p_admin,'dashboard',null));
end;
$$;

create function public.admin_counting_history(p_admin uuid, p_before_id bigint default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform private.admin_ticket_core(p_admin, 'session', null);
  if p_before_id is not null and p_before_id < 1 then raise exception 'Invalid period cursor'; end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(20261031, 1);
  return (
    with records as materialized (
      select * from private.admission_count_resets where p_before_id is null or id < p_before_id order by id desc limit 21
    ), page as (select * from records order by id desc limit 20)
    select jsonb_build_object(
      'periods',(select coalesce(jsonb_agg(jsonb_build_object('id',id::text,'closedAt',baseline_at,
        'resetBy',reset_by,'periodStart',period_start,'snapshot',snapshot) order by id desc),'[]'::jsonb) from page),
      'nextBeforeId',case when (select count(*) from records)>20 then (select min(id)::text from page) else null end,
      'lifetime',jsonb_build_object('generated',(select count(*) from public.tickets),
        'admitted',(select count(*) from public.tickets where status='redeemed'),
        'outstanding',(select count(*) from public.tickets where status='issued'))
    )
  );
end;
$$;
revoke all on function public.admin_counting_history(uuid,bigint) from public, anon, authenticated;
grant execute on function public.admin_counting_history(uuid,bigint) to service_role;
-- CREATE OR REPLACE preserves the existing restricted grants on the two RPCs.
-- No reset, snapshot backfill, ticket UPDATE, sequence reset or DELETE is executed.
