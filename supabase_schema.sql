-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- Ele cria a base mínima para a comunidade Amigos.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_color text not null default 'green',
  created_at timestamptz not null default now()
);

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'Membro',
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  type text not null default 'text' check (type in ('text', 'voice')),
  description text not null default '',
  position integer not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists messages_channel_created_idx on public.messages(channel_id, created_at);

create or replace function public.is_community_member(target_community uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = target_community and user_id = auth.uid()
  );
$$;

create or replace function public.is_channel_member(target_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels c
    join public.community_members cm on cm.community_id = c.community_id
    where c.id = target_channel and cm.user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;

drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists communities_read_member on public.communities;
create policy communities_read_member on public.communities for select to authenticated using (public.is_community_member(id) or owner_id = auth.uid());
drop policy if exists communities_create_authenticated on public.communities;
create policy communities_create_authenticated on public.communities for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists members_read_member on public.community_members;
create policy members_read_member on public.community_members for select to authenticated using (public.is_community_member(community_id) or user_id = auth.uid());
drop policy if exists members_insert_owner on public.community_members;
create policy members_insert_owner on public.community_members for insert to authenticated with check (
  user_id = auth.uid() or exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid())
);
drop policy if exists members_update_owner on public.community_members;
create policy members_update_owner on public.community_members for update to authenticated using (
  exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid())
);

drop policy if exists channels_read_member on public.channels;
create policy channels_read_member on public.channels for select to authenticated using (public.is_community_member(community_id));
drop policy if exists channels_create_member on public.channels;
create policy channels_create_member on public.channels for insert to authenticated with check (public.is_community_member(community_id) and created_by = auth.uid());
drop policy if exists channels_delete_owner on public.channels;
create policy channels_delete_owner on public.channels for delete to authenticated using (exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid()));

drop policy if exists messages_read_member on public.messages;
create policy messages_read_member on public.messages for select to authenticated using (public.is_channel_member(channel_id));
drop policy if exists messages_create_member on public.messages;
create policy messages_create_member on public.messages for insert to authenticated with check (public.is_channel_member(channel_id) and author_id = auth.uid());
drop policy if exists messages_update_author on public.messages;
create policy messages_update_author on public.messages for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists messages_delete_author on public.messages;
create policy messages_delete_author on public.messages for delete to authenticated using (author_id = auth.uid());

-- Depois de executar, habilite a tabela messages em Database > Publications > supabase_realtime
-- para receber novos registros em tempo real no cliente.
