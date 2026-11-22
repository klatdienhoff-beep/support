-- Update an existing support-chat database from supabase-setup.sql.
begin;

drop policy if exists "Participants can send messages" on public.support_messages;
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

drop policy if exists "Customers can upload support images" on storage.objects;
drop policy if exists "Participants can upload support images" on storage.objects;
create policy "Participants can upload support images"
on storage.objects for insert to authenticated
with check (bucket_id = 'support-images'
  and exists (select 1 from public.support_conversations c
    where c.customer_id::text = (storage.foldername(name))[1]
      and (c.customer_id = auth.uid() or public.is_support_admin())));

commit;
