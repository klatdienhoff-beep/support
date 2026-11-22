-- Assign sequential case numbers to existing conversations without changing their IDs.
begin;

alter table public.support_conversations
  add column if not exists case_id bigint generated always as identity (start with 164080774) unique;

commit;
