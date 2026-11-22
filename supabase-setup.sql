-- Run once in the Supabase SQL Editor. Do not run this against a project
-- that already has tables or a bucket with these names.
begin;

create table public.support_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.support_admins enable row level security;
revoke all on public.support_admins from public, anon, authenticated;

create function public.is_support_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.support_admins where user_id = auth.uid());
$$;
revoke all on function public.is_support_admin() from public, anon;
grant execute on function public.is_support_admin() to authenticated;

create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  case_id bigint generated always as identity (start with 164080774) unique,
  customer_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  customer_typing_at timestamptz,
  admin_typing_at timestamptz
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender text not null check (sender in ('customer', 'admin')),
  body text,
  image_path text,
  created_at timestamptz not null default now(),
  check ((body is not null and length(trim(body)) between 1 and 2000 and image_path is null)
    or (body is null and image_path is not null and length(image_path) <= 200))
);
create index support_messages_conversation_time on public.support_messages (conversation_id, created_at, id);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_conversations, public.support_messages from public, anon, authenticated;
grant select on public.support_conversations, public.support_messages to authenticated;
grant insert (customer_id) on public.support_conversations to authenticated;
grant insert (conversation_id, sender, body, image_path) on public.support_messages to authenticated;

create policy "Customers and admins can read conversations"
on public.support_conversations for select to authenticated
using (customer_id = auth.uid() or public.is_support_admin());

create policy "Customers can create their own conversation"
on public.support_conversations for insert to authenticated
with check (customer_id = auth.uid());

create policy "Participants can read messages"
on public.support_messages for select to authenticated
using (exists (
  select 1 from public.support_conversations c
  where c.id = conversation_id and (c.customer_id = auth.uid() or public.is_support_admin())
));

create policy "Participants can send messages"
on public.support_messages for insert to authenticated
with check (exists (
  select 1 from public.support_conversations c
  where c.id = conversation_id and (
    (sender = 'customer' and c.customer_id = auth.uid())
    or (sender = 'admin' and public.is_support_admin())
  ) and (image_path is null or (
    split_part(image_path, '/', 1) = c.customer_id::text
    and exists (select 1 from storage.objects o
      where o.bucket_id = 'support-images' and o.name = image_path)
  ))
));

create function public.support_set_typing(conversation uuid, participant text, active boolean)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or participant is null or participant not in ('customer', 'admin') or active is null then
    raise exception 'Invalid typing request';
  end if;
  if participant = 'customer' then
    update public.support_conversations set customer_typing_at = case when active then now() else null end
    where id = conversation and customer_id = auth.uid();
  else
    if not public.is_support_admin() then raise exception 'Admin access required'; end if;
    update public.support_conversations set admin_typing_at = case when active then now() else null end
    where id = conversation;
  end if;
  if not found then raise exception 'Conversation not found or access denied'; end if;
end;
$$;
revoke all on function public.support_set_typing(uuid, text, boolean) from public, anon;
grant execute on function public.support_set_typing(uuid, text, boolean) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-images', 'support-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

create policy "Participants can upload support images"
on storage.objects for insert to authenticated
with check (bucket_id = 'support-images'
  and exists (select 1 from public.support_conversations c
    where c.customer_id::text = (storage.foldername(name))[1]
      and (c.customer_id = auth.uid() or public.is_support_admin())));

create policy "Participants can view support images"
on storage.objects for select to authenticated
using (bucket_id = 'support-images' and exists (
  select 1 from public.support_conversations c
  where c.customer_id::text = (storage.foldername(name))[1]
    and (c.customer_id = auth.uid() or public.is_support_admin())
));

commit;

-- After creating the staff account in Authentication > Users, replace the
-- placeholder below with its email address and run this separately:
-- insert into public.support_admins (user_id)
-- select id from auth.users where lower(email) = lower('STAFF_EMAIL_HERE');
