import type { PGlite } from '@electric-sql/pglite'
// Local database fixture for the managed Realtime-owned objects. Hosted tests
// separately exercise the real WebSocket service and its authorization probes.
export async function prepareRealtimeSchema(db: PGlite) {
  await db.exec(`create schema realtime;
    create table realtime.messages(id uuid default gen_random_uuid(),topic text not null,extension text not null,payload jsonb,event text,private boolean default false);
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to anon,authenticated,service_role;
    grant select,insert on realtime.messages to anon,authenticated,service_role;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    create function realtime.send(payload jsonb,event text,topic text,private boolean default true) returns void language sql as $$
      insert into realtime.messages(topic,extension,payload,event,private) values(topic,'broadcast',payload,event,private)
    $$;`)
}
