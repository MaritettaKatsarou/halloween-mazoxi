-- The project's Realtime-owned schema is not altered beyond supported policies.
create policy ticket_admission_owner_receive on realtime.messages
for select to authenticated using (
  extension = 'broadcast'
  and topic = (select realtime.topic())
  and exists (
    select 1 from public.tickets t
    where t.owner_id = (select auth.uid())
      and 'ticket-admission:' || t.id::text = (select realtime.topic())
  )
);

-- No permissive client INSERT policy is granted. Explicitly protect this
-- namespace even if another feature later adds permissive send policies.
create policy ticket_admission_no_client_publish on realtime.messages
as restrictive for insert to anon, authenticated
with check (topic not like 'ticket-admission:%');

create function private.broadcast_ticket_admission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_schema <> 'public' or tg_table_name <> 'tickets' or tg_op <> 'UPDATE' then
    raise insufficient_privilege using message = 'Ticket transition trigger only';
  end if;
  if old.status = 'issued' and new.status = 'redeemed'
    and new.redeemed_at is not null and new.redeemed_by is not null
    and old.owner_id = new.owner_id and old.id = new.id then
    -- Database Broadcast is inserted in the same transaction. Rollback removes
    -- the notification; logical replication never sends uncommitted rows.
    perform realtime.send(jsonb_build_object('ticketId', new.id),
      'admitted', 'ticket-admission:' || new.id::text, true);
  end if;
  return new;
end;
$$;
revoke all on function private.broadcast_ticket_admission() from public, anon, authenticated, service_role;
create trigger ticket_admission_broadcast after update of status on public.tickets
for each row when (old.status = 'issued' and new.status = 'redeemed')
execute function private.broadcast_ticket_admission();
