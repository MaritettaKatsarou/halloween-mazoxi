-- Dedicated halloween-mazoxi project only: hefzzwfmpdukwceuwgqr.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to service_role;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.ticket_editions (
  id text primary key,
  enabled boolean not null default true
);
insert into private.ticket_editions(id) values
  ('cauldron'), ('seated-cat'), ('moon-castle'), ('ghost-pumpkin'),
  ('pumpkin-lantern'), ('witch-hat'), ('cat-pumpkin-stack'), ('three-ghosts'),
  ('cat-eyes'), ('moon-moths'), ('arched-cat'), ('orange-tree');

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  edition_id text not null references private.ticket_editions(id),
  display_number bigint generated always as identity unique,
  status text not null default 'issued' check (status in ('issued', 'redeemed')),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  constraint ticket_redemption_consistency check (
    (status = 'issued' and redeemed_at is null) or
    (status = 'redeemed' and redeemed_at is not null and redeemed_at >= created_at)
  )
);

-- Opaque bearer credentials are retrievable ONLY by the trusted backend.
-- They are intentionally absent from public.tickets, RLS results and logs.
create table private.ticket_credentials (
  ticket_id uuid primary key references public.tickets(id) on delete cascade,
  credential text not null unique check (credential ~ '^hm1_[A-Za-z0-9_-]{43}$'),
  credential_hash text not null unique check (credential_hash ~ '^[a-f0-9]{64}$'),
  version smallint not null default 1 check (version = 1),
  created_at timestamptz not null default now()
);

alter table public.tickets enable row level security;
alter table private.ticket_editions enable row level security;
alter table private.ticket_credentials enable row level security;

revoke all on public.tickets from public, anon, authenticated;
grant select on public.tickets to authenticated;
create policy tickets_owner_read on public.tickets for select to authenticated
  using ((select auth.uid()) = owner_id);
-- No guest INSERT, UPDATE, DELETE, sequence or private-schema permissions.
revoke all on private.ticket_editions, private.ticket_credentials from public, anon, authenticated;
revoke all on sequence public.tickets_display_number_seq from public, anon, authenticated;
grant all on public.tickets, private.ticket_editions, private.ticket_credentials to service_role;
grant usage, select on sequence public.tickets_display_number_seq to service_role;

-- SECURITY INVOKER: only service_role can execute this RPC. It is exposed in
-- public solely for the backend PostgREST client, not callable by guests.
create function public.issue_guest_ticket(p_owner uuid, p_create boolean default false)
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
    select id into selected_edition from private.ticket_editions
      where enabled order by random() limit 1;
    if selected_edition is null then raise exception 'No editions available'; end if;
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
revoke all on function public.issue_guest_ticket(uuid, boolean) from public, anon, authenticated;
grant execute on function public.issue_guest_ticket(uuid, boolean) to service_role;

comment on table private.ticket_credentials is
  'Server-only 256-bit bearer recovery and SHA-256 verification. Future redemption must atomically match credential_hash AND status=issued.';
