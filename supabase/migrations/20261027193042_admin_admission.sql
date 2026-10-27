-- Additive Phase 3 schema. Existing credentials and guest tickets are untouched.
create table private.admin_users (
  user_id uuid primary key references auth.users(id) on delete restrict,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table private.admin_users enable row level security;
revoke all on private.admin_users from public, anon, authenticated;
grant select on private.admin_users to service_role;
-- PostgreSQL requires column UPDATE privilege for the authorization row lock.
grant update(enabled) on private.admin_users to service_role;
grant usage on schema auth to service_role;
grant select(id, is_anonymous, email, email_confirmed_at) on auth.users to service_role;

alter table public.tickets add column redeemed_by uuid references auth.users(id) on delete restrict;
alter table public.tickets add constraint issued_ticket_has_no_redeemer
  check (status = 'redeemed' or redeemed_by is null);
create index tickets_recent_admissions on public.tickets(redeemed_at desc) where status = 'redeemed';
create index tickets_edition_id on public.tickets(edition_id);

create function public.admin_ticket_action(p_admin uuid, p_action text, p_credential text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  target public.tickets%rowtype;
  decision text;
begin
  if current_user <> 'service_role' then
    raise insufficient_privilege using message = 'Backend access required';
  end if;
  -- Fresh authorization in every transaction; revocation waits for in-flight work.
  perform a.user_id from private.admin_users a join auth.users u on u.id = a.user_id
    where a.user_id = p_admin and a.enabled and u.is_anonymous is false
      and u.email is not null and u.email_confirmed_at is not null for share of a;
  if not found then raise insufficient_privilege using message = 'Admin access required'; end if;
  if p_action = 'session' then return jsonb_build_object('authorized', true); end if;
  if p_action = 'dashboard' then
    return jsonb_build_object(
      'total', (select count(*) from public.tickets),
      'admitted', (select count(*) from public.tickets where status = 'redeemed'),
      'remaining', (select count(*) from public.tickets where status = 'issued'),
      'distribution', (select coalesce(jsonb_agg(row_to_json(d) order by d."editionId"), '[]'::jsonb) from (
        select e.id as "editionId", count(t.id) as total,
          count(t.id) filter (where t.status = 'redeemed') as admitted
        from private.ticket_editions e left join public.tickets t on t.edition_id = e.id group by e.id
      ) d),
      'recent', (select coalesce(jsonb_agg(row_to_json(r) order by r."redeemedAt" desc), '[]'::jsonb) from (
        select id, edition_id as "editionId", 'HM-' || display_number::text as "displayNumber",
          redeemed_at as "redeemedAt", redeemed_by as "redeemedBy"
        from public.tickets where status = 'redeemed' order by redeemed_at desc, id limit 20
      ) r)
    );
  end if;
  if p_action not in ('validate', 'admit') then raise exception 'Invalid action'; end if;
  if p_credential is null or p_credential !~ '^hm1_[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('result', 'INVALID');
  end if;
  if p_action = 'admit' then
    -- A row lock linearizes simultaneous admissions. Exactly one sees ISSUED.
    select t.* into target from public.tickets t join private.ticket_credentials c on c.ticket_id = t.id
      where c.version = 1 and c.credential_hash = encode(extensions.digest(p_credential, 'sha256'), 'hex')
      for update of t;
  else
    select t.* into target from public.tickets t join private.ticket_credentials c on c.ticket_id = t.id
      where c.version = 1 and c.credential_hash = encode(extensions.digest(p_credential, 'sha256'), 'hex');
  end if;
  if not found then return jsonb_build_object('result', 'INVALID'); end if;
  if target.status = 'redeemed' then decision := 'ALREADY_USED';
  elsif p_action = 'admit' then
    update public.tickets set status = 'redeemed', redeemed_at = clock_timestamp(), redeemed_by = p_admin
      where id = target.id and status = 'issued' returning * into target;
    decision := 'ADMITTED';
  else decision := 'VALID'; end if;
  return jsonb_build_object('result', decision, 'ticket', jsonb_build_object(
    'id', target.id, 'editionId', target.edition_id,
    'displayNumber', 'HM-' || target.display_number::text,
    'status', target.status, 'createdAt', target.created_at,
    'redeemedAt', target.redeemed_at, 'redeemedBy', target.redeemed_by
  ));
end;
$$;
revoke all on function public.admin_ticket_action(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_ticket_action(uuid, text, text) to service_role;
