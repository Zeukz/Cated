-- Conversas privadas entre amigos do Cated.
-- Execute este arquivo inteiro no Supabase SQL Editor.

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists direct_messages_pair_created_idx
  on public.direct_messages(sender_id, recipient_id, created_at);

alter table public.direct_messages enable row level security;

drop policy if exists direct_messages_read_participant on public.direct_messages;
create policy direct_messages_read_participant on public.direct_messages
for select to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists direct_messages_create_sender on public.direct_messages;
create policy direct_messages_create_sender on public.direct_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = recipient_id)
        or (f.addressee_id = auth.uid() and f.requester_id = recipient_id))
  )
);

drop policy if exists direct_messages_update_sender on public.direct_messages;
create policy direct_messages_update_sender on public.direct_messages
for update to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

drop policy if exists direct_messages_delete_sender on public.direct_messages;
create policy direct_messages_delete_sender on public.direct_messages
for delete to authenticated
using (sender_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
end $$;
