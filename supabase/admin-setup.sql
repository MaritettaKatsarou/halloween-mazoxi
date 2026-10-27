-- Run manually in the verified halloween-mazoxi Dashboard SQL Editor only.
-- First create and confirm a permanent email/password user in Authentication.
-- Replace the placeholder with that user's UUID. Never put a password here.
insert into private.admin_users(user_id, enabled)
select id, true from auth.users
where id = 'REPLACE_WITH_PERMANENT_USER_UUID'::uuid
  and is_anonymous is false and email is not null and email_confirmed_at is not null
on conflict(user_id) do update set enabled = true
returning user_id, enabled;

-- To revoke later, run separately with the same UUID:
-- update private.admin_users set enabled=false
-- where user_id='REPLACE_WITH_PERMANENT_USER_UUID'::uuid returning user_id,enabled;
