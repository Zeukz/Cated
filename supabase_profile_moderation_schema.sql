-- Execute depois de supabase_schema.sql e supabase_social_schema.sql.
-- Adiciona perfil visual e expulsão segura pelo proprietário/administrador.

alter table public.profiles add column if not exists avatar_url text;

alter table public.moderation_actions drop constraint if exists moderation_actions_action_check;
alter table public.moderation_actions add constraint moderation_actions_action_check
  check (action in ('disconnect', 'server_mute', 'server_deafen', 'channel_mute', 'kick'));

drop policy if exists members_delete_admin on public.community_members;
create policy members_delete_admin on public.community_members for delete to authenticated
using (public.is_community_admin(community_id));

-- Permite ao usuário atualizar apenas o próprio nome e foto.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create table if not exists public.community_roles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  can_manage_channels boolean not null default false,
  can_moderate boolean not null default false,
  created_at timestamptz not null default now(),
  unique (community_id, name)
);

alter table public.community_roles enable row level security;
drop policy if exists roles_read_member on public.community_roles;
create policy roles_read_member on public.community_roles for select to authenticated
using (public.is_community_member(community_id));
drop policy if exists roles_create_admin on public.community_roles;
create policy roles_create_admin on public.community_roles for insert to authenticated
with check (public.is_community_admin(community_id));
drop policy if exists roles_update_admin on public.community_roles;
create policy roles_update_admin on public.community_roles for update to authenticated
using (public.is_community_admin(community_id))
with check (public.is_community_admin(community_id));
drop policy if exists roles_delete_admin on public.community_roles;
create policy roles_delete_admin on public.community_roles for delete to authenticated
using (public.is_community_admin(community_id));

-- O proprietário pode excluir a comunidade; a exclusão em cascata remove canais e membros relacionados.
drop policy if exists communities_delete_owner on public.communities;
create policy communities_delete_owner on public.communities for delete to authenticated
using (owner_id = auth.uid());
