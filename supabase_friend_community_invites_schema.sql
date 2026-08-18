-- Convites diretos de comunidade entre amigos e envio seguro de mensagens privadas.
-- Execute este arquivo inteiro no Supabase SQL Editor.

create table if not exists public.community_friend_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inviter_id <> invitee_id),
  unique (community_id, inviter_id, invitee_id)
);

create index if not exists community_friend_invites_recipient_idx
  on public.community_friend_invites(invitee_id, status, created_at desc);

create index if not exists community_friend_invites_community_idx
  on public.community_friend_invites(community_id, status, created_at desc);

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

alter table public.community_friend_invites enable row level security;

drop policy if exists community_friend_invites_read_participant on public.community_friend_invites;
create policy community_friend_invites_read_participant
on public.community_friend_invites
for select to authenticated
using (inviter_id = auth.uid() or invitee_id = auth.uid());

drop policy if exists community_friend_invites_create_member_friend on public.community_friend_invites;
create policy community_friend_invites_create_member_friend
on public.community_friend_invites
for insert to authenticated
with check (
  inviter_id = auth.uid()
  and public.is_community_member(community_id)
  and public.is_accepted_friend(invitee_id)
  and not exists (
    select 1
      from public.community_members cm
     where cm.community_id = community_friend_invites.community_id
       and cm.user_id = community_friend_invites.invitee_id
  )
);

drop policy if exists community_friend_invites_update_participant on public.community_friend_invites;
create policy community_friend_invites_update_participant
on public.community_friend_invites
for update to authenticated
using (inviter_id = auth.uid() or invitee_id = auth.uid())
with check (inviter_id = auth.uid() or invitee_id = auth.uid());

-- O convidado precisa conseguir ler o nome da comunidade antes de aceitar.
drop policy if exists communities_read_pending_friend_invite on public.communities;
create policy communities_read_pending_friend_invite
on public.communities
for select to authenticated
using (
  exists (
    select 1
      from public.community_friend_invites cfi
     where cfi.community_id = communities.id
       and cfi.invitee_id = auth.uid()
       and cfi.status = 'pending'
  )
);

create or replace function public.send_community_friend_invite(target_community uuid, target_friend uuid)
returns public.community_friend_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.community_friend_invites;
begin
  if auth.uid() is null then
    raise exception 'É necessário estar autenticado.';
  end if;
  if not public.is_community_member(target_community) then
    raise exception 'Você não participa desta comunidade.';
  end if;
  if target_friend = auth.uid() then
    raise exception 'Você não pode convidar a si mesmo.';
  end if;
  if not public.is_accepted_friend(target_friend) then
    raise exception 'Só é possível convidar amigos aceitos.';
  end if;
  if exists (select 1 from public.community_members cm where cm.community_id = target_community and cm.user_id = target_friend) then
    raise exception 'Este amigo já participa da comunidade.';
  end if;

  insert into public.community_friend_invites (community_id, inviter_id, invitee_id, status, updated_at)
  values (target_community, auth.uid(), target_friend, 'pending', now())
  on conflict (community_id, inviter_id, invitee_id)
  do update set status = 'pending', updated_at = now()
  returning * into result;

  return result;
end;
$$;

grant execute on function public.send_community_friend_invite(uuid, uuid) to authenticated;

create or replace function public.respond_to_community_friend_invite(target_invite uuid, next_status text)
returns table (community_id uuid, community_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.community_friend_invites;
begin
  if auth.uid() is null then
    raise exception 'É necessário estar autenticado.';
  end if;
  if next_status not in ('accepted', 'declined') then
    raise exception 'Resposta de convite inválida.';
  end if;

  select * into invite_row
    from public.community_friend_invites cfi
   where cfi.id = target_invite
     and cfi.invitee_id = auth.uid()
     and cfi.status = 'pending'
   for update;

  if not found then
    raise exception 'Este convite não está mais disponível.';
  end if;

  update public.community_friend_invites
     set status = next_status, updated_at = now()
   where id = target_invite;

  if next_status = 'accepted' then
    insert into public.community_members (community_id, user_id, role)
    values (invite_row.community_id, auth.uid(), 'Membro')
    on conflict (community_id, user_id) do nothing;
  end if;

  return query
  select c.id, c.name
    from public.communities c
   where c.id = invite_row.community_id;
end;
$$;

grant execute on function public.respond_to_community_friend_invite(uuid, text) to authenticated;

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

-- Realtime para que os convites diretos e as mensagens cheguem sem recarregar.
do $$
begin
  alter publication supabase_realtime add table public.community_friend_invites;
exception when duplicate_object then null;
end $$;

-- Mantém o envio direto disponível mesmo em projetos em que a migração anterior já existia.
do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
end $$;
