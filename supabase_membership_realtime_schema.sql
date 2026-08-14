-- Execute este arquivo no Supabase SQL Editor para a versão 0.1.3.
-- Ele torna a expulsão permanente na tabela community_members e transmite a alteração em tempo real.

-- Garante que a auditoria de moderação aceite a ação de expulsão.
alter table public.moderation_actions
  drop constraint if exists moderation_actions_action_check;

alter table public.moderation_actions
  add constraint moderation_actions_action_check
  check (action in ('disconnect', 'server_mute', 'server_deafen', 'channel_mute', 'kick'));

-- Um membro pode sair por conta própria. Administradores podem remover outros membros.
drop policy if exists members_delete_admin on public.community_members;
drop policy if exists members_delete_admin_or_self on public.community_members;
create policy members_delete_admin_or_self
on public.community_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_community_admin(community_id)
);

-- Publica inserções, mudanças de cargo e exclusões de membros para os clientes conectados.
do $$
begin
  alter publication supabase_realtime add table public.community_members;
exception
  when duplicate_object then null;
end $$;
