-- Execute depois das migrações existentes.
-- Adiciona mensagens de áudio curtas e o bucket público usado no chat.

alter table public.messages add column if not exists message_type text not null default 'text';
alter table public.messages add column if not exists audio_url text;
alter table public.messages add column if not exists duration_seconds integer;
alter table public.messages add column if not exists waveform jsonb;

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check check (message_type in ('text', 'audio'));

insert into storage.buckets (id, name, public)
values ('chat-audio', 'chat-audio', true)
on conflict (id) do update set public = true;

drop policy if exists chat_audio_public_read on storage.objects;
create policy chat_audio_public_read on storage.objects for select to public
using (bucket_id = 'chat-audio');

drop policy if exists chat_audio_authenticated_upload on storage.objects;
create policy chat_audio_authenticated_upload on storage.objects for insert to authenticated
with check (bucket_id = 'chat-audio' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists chat_audio_owner_update on storage.objects;
create policy chat_audio_owner_update on storage.objects for update to authenticated
using (bucket_id = 'chat-audio' and owner_id = (select auth.uid()::text))
with check (bucket_id = 'chat-audio' and owner_id = (select auth.uid()::text));

drop policy if exists chat_audio_owner_delete on storage.objects;
create policy chat_audio_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'chat-audio' and owner_id = (select auth.uid()::text));
