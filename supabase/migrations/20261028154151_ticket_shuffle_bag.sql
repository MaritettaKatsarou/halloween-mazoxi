-- Atomic cutover for NEW claims only. Drain old issuance using its existing
-- reporting lock; this neither calls RESET COUNT nor changes reporting state.
-- Abort rather than waiting indefinitely on live transactions.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select pg_catalog.pg_advisory_xact_lock(20261031, 1);

create table private.ticket_distribution (
  singleton boolean primary key default true check (singleton),
  activated_at timestamptz not null default clock_timestamp(),
  catalog_ids text[] not null check (cardinality(catalog_ids) = 12),
  edition_order text[] not null check (cardinality(edition_order) = 12),
  cycle bigint not null default 1 check (cycle > 0),
  next_position smallint not null default 1 check (next_position between 1 and 13)
);
alter table private.ticket_distribution enable row level security;
revoke all on private.ticket_distribution from public, anon, authenticated, service_role;
grant select, update(cycle, edition_order, next_position) on private.ticket_distribution to service_role;

-- No existing ticket consumes a slot. Freeze the enabled catalog during setup.
lock table private.ticket_editions in share mode;
do $$
declare
  catalog text[];
begin
  select array_agg(id order by id) into catalog from private.ticket_editions where enabled;
  if catalog is distinct from array[
    'arched-cat','cat-eyes','cat-pumpkin-stack','cauldron','ghost-pumpkin',
    'moon-castle','moon-moths','orange-tree','pumpkin-lantern','seated-cat',
    'three-ghosts','witch-hat'
  ]::text[] then
    raise exception 'Shuffle bag requires the 12 original enabled editions';
  end if;
  insert into private.ticket_distribution(catalog_ids, edition_order)
    select catalog, array_agg(id order by random()) from private.ticket_editions where enabled;
end;
$$;

create function private.draw_ticket_edition()
returns text language plpgsql security invoker set search_path = '' as $$
declare
  bag private.ticket_distribution%rowtype;
  catalog text[];
  queued_catalog text[];
  selected_edition text;
begin
  if current_user <> 'service_role' then
    raise insufficient_privilege using message = 'Backend access required';
  end if;
  -- Only new issuance reaches this function, AFTER its per-owner lock/check.
  -- SHARE permits concurrent claims but prevents catalog changes mid-claim.
  lock table private.ticket_editions in share mode;
  select * into strict bag from private.ticket_distribution where singleton for update;
  select array_agg(id order by id) into catalog from private.ticket_editions where enabled;
  select array_agg(id order by id) into queued_catalog from unnest(bag.edition_order) as edition(id);
  if catalog is distinct from bag.catalog_ids or queued_catalog is distinct from bag.catalog_ids then
    raise exception 'Shuffle bag catalog mismatch';
  end if;
  if bag.next_position = 13 then
    select array_agg(id order by random()) into bag.edition_order from private.ticket_editions where enabled;
    bag.cycle := bag.cycle + 1;
    bag.next_position := 1;
  end if;
  selected_edition := bag.edition_order[bag.next_position];
  if selected_edition is null then raise exception 'Shuffle bag slot unavailable'; end if;
  update private.ticket_distribution set cycle = bag.cycle, edition_order = bag.edition_order,
    next_position = bag.next_position + 1 where singleton;
  -- The row lock and cursor update remain in the ticket/credential transaction.
  -- Any later failure rolls back the draw, including a cycle rollover.
  return selected_edition;
end;
$$;
revoke all on function private.draw_ticket_edition() from public, anon, authenticated;
grant execute on function private.draw_ticket_edition() to service_role;

-- Preserve owner locking, identity, credential generation/recovery and the Edge
-- response contract. The sole behavioral change is the new-edition selection.
create or replace function private.issue_guest_ticket_core(p_owner uuid, p_create boolean default false)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  result public.tickets%rowtype;
  selected_edition text;
  raw_credential text;
begin
  if current_user <> 'service_role' then
    raise insufficient_privilege using message = 'Backend access required';
  end if;
  if p_owner is null then raise exception 'Owner required'; end if;
  -- Serialize claims and recovery for this owner across all Edge invocations.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text, 0));
  select * into result from public.tickets where owner_id = p_owner;
  if not found then
    if not p_create then return null; end if;
    selected_edition := private.draw_ticket_edition();
    insert into public.tickets(owner_id, edition_id) values (p_owner, selected_edition)
      returning * into result;
    raw_credential := 'hm1_' || translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
    insert into private.ticket_credentials(ticket_id, credential, credential_hash)
      values (result.id, raw_credential, encode(extensions.digest(raw_credential, 'sha256'), 'hex'));
  else
    select credential into strict raw_credential from private.ticket_credentials where ticket_id = result.id;
  end if;
  return jsonb_build_object(
    'id', result.id, 'ownerId', result.owner_id, 'editionId', result.edition_id,
    'displayNumber', 'HM-' || result.display_number::text, 'status', result.status,
    'createdAt', result.created_at, 'redeemedAt', result.redeemed_at,
    'qrCredential', case when result.status = 'issued' then raw_credential else null end
  );
end;
$$;
revoke all on function private.issue_guest_ticket_core(uuid, boolean) from public, anon, authenticated;
grant execute on function private.issue_guest_ticket_core(uuid, boolean) to service_role;

comment on table private.ticket_distribution is
  'Private transactional shuffle bag, independent of counting periods. activated_at records migration initialization; only post-cutover new ticket transactions consume slots.';
