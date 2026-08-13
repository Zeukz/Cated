-- Execute este arquivo depois de supabase_schema.sql no SQL Editor do Supabase.
-- Ele adiciona amizades, convites e permissões administrativas.

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create table if not exists public.community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_email text,
  invite_code text not null unique default encode(gen_random_bytes(8), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  moderator_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('disconnect', 'server_mute', 'server_deafen', 'channel_mute')),
  channel_id uuid references public.channels(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create or replace function public.is_community_admin(target_community uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.communities c
    left join public.community_members cm on cm.community_id = c.id and cm.user_id = auth.uid()
    where c.id = target_community
      and (c.owner_id = auth.uid() or cm.role in ('Organizador', 'Administrador'))
  );
$$;

create or replace function public.is_friend_with(target_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = target_user)
        or (f.addressee_id = auth.uid() and f.requester_id = target_user))
  );
$$;

alter table public.friendships enable row level security;
alter table public.community_invites enable row level security;
alter table public.moderation_actions enable row level security;

drop policy if exists friendships_read_participant on public.friendships;
create policy friendships_read_participant on public.friendships for select to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists friendships_create_self on public.friendships;
create policy friendships_create_self on public.friendships for insert to authenticated
with check (requester_id = auth.uid());
drop policy if exists friendships_update_participant on public.friendships;
create policy friendships_update_participant on public.friendships for update to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid())
with check (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists friendships_delete_participant on public.friendships;
create policy friendships_delete_participant on public.friendships for delete to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists invites_read_member on public.community_invites;
create policy invites_read_member on public.community_invites for select to authenticated
using (inviter_id = auth.uid() or public.is_community_member(community_id));
drop policy if exists invites_create_admin on public.community_invites;
create policy invites_create_admin on public.community_invites for insert to authenticated
with check (inviter_id = auth.uid() and public.is_community_admin(community_id));
drop policy if exists invites_update_admin on public.community_invites;
create policy invites_update_admin on public.community_invites for update to authenticated
using (inviter_id = auth.uid() or public.is_community_admin(community_id));

drop policy if exists moderation_read_admin on public.moderation_actions;
create policy moderation_read_admin on public.moderation_actions for select to authenticated
using (public.is_community_admin(community_id));
drop policy if exists moderation_create_admin on public.moderation_actions;
create policy moderation_create_admin on public.moderation_actions for insert to authenticated
with check (moderator_id = auth.uid() and public.is_community_admin(community_id));

-- Apenas administradores devem alterar cargos.
drop policy if exists members_update_owner on public.community_members;
create policy members_update_owner on public.community_members for update to authenticated
using (public.is_community_admin(community_id))
with check (public.is_community_admin(community_id));
