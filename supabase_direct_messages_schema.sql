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


create or replace function public.is_accepted_friend(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.friendships f
     where f.status = 'accepted'
       and ((f.requester_id = auth.uid() and f.addressee_id = target_user)
         or (f.addressee_id = auth.uid() and f.requester_id = target_user))
  );
$$;

grant execute on function public.is_accepted_friend(uuid) to authenticated;

create or replace function public.send_direct_message(target_recipient uuid, message_content text)
returns public.direct_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.direct_messages;
  clean_content text := btrim(message_content);
begin
  if auth.uid() is null then
    raise exception 'É necessário estar autenticado.';
  end if;
  if target_recipient = auth.uid() then
    raise exception 'Você não pode enviar uma mensagem para si mesmo.';
  end if;
  if clean_content is null or char_length(clean_content) = 0 or char_length(clean_content) > 4000 then
    raise exception 'A mensagem precisa ter entre 1 e 4000 caracteres.';
  end if;
  if not public.is_accepted_friend(target_recipient) then
    raise exception 'Aceite a amizade antes de enviar mensagens privadas.';
  end if;

  insert into public.direct_messages (sender_id, recipient_id, content)
  values (auth.uid(), target_recipient, clean_content)
  returning * into result;

  return result;
end;
$$;

grant execute on function public.send_direct_message(uuid, text) to authenticated;
