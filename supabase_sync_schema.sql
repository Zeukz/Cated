-- Migração de sincronização do Cated.
-- Execute este arquivo inteiro no Supabase SQL Editor.

-- Convites são resgatados no servidor para que o destinatário não precise
-- enxergar a linha privada de community_invites antes de entrar.
create or replace function public.redeem_community_invite(input_code text)
returns table (community_id uuid, community_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.community_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'É necessário estar autenticado.';
  end if;

  select ci.*
    into invite_row
    from public.community_invites ci
   where upper(trim(ci.invite_code)) = upper(trim(input_code))
     and ci.status = 'pending'
     and ci.expires_at > now()
   order by ci.created_at desc
   limit 1;

  if not found then
    raise exception 'Convite inválido ou expirado.';
  end if;

  insert into public.community_members (community_id, user_id, role)
  values (invite_row.community_id, auth.uid(), 'Membro')
  on conflict (community_id, user_id) do nothing;

  -- O código permanece pendente até expirar para que o proprietário possa
  -- compartilhá-lo com vários amigos. A associação é protegida pelo conflito.
  return query
  select c.id, c.name
    from public.communities c
   where c.id = invite_row.community_id;
end;
$$;

grant execute on function public.redeem_community_invite(text) to authenticated;

-- Garante que a auditoria aceite expulsões mesmo quando a migração antiga foi aplicada.
alter table public.moderation_actions
  drop constraint if exists moderation_actions_action_check;
alter table public.moderation_actions
  add constraint moderation_actions_action_check
  check (action in ('disconnect', 'server_mute', 'server_deafen', 'channel_mute', 'kick'));

-- Realtime para pedidos de amizade, membros e alterações de cargo.
do $$
begin
  alter publication supabase_realtime add table public.friendships;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.community_members;
exception when duplicate_object then null;
end $$;
