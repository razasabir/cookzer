-- Lets a message carry an image attachment, and adds a public storage
-- bucket for them (same public-bucket-plus-RLS pattern as post/recipe
-- photos and avatars). Run after 006.

alter table public.messages
  add column attachment_path text;

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', true)
on conflict (id) do nothing;

create policy "Public read of message attachments"
  on storage.objects for select
  using (bucket_id = 'message-attachments');

create policy "Authenticated users can upload message attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'message-attachments'
    and auth.role() = 'authenticated'
    and owner = auth.uid()
  );
