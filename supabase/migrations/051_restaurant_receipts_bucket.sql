-- The restaurant-ratings flow (migration 012) has always uploaded receipt
-- photos to a 'restaurant-receipts' bucket and rendered them via
-- getPublicUrl() — but no migration ever actually created that bucket,
-- unlike post-photos/recipe-photos/avatars (migration 003) and
-- restaurant-claim-proofs (migration 049). It silently worked only for
-- as long as no one actually tried to submit a real rating with a
-- receipt; the first real attempt in production surfaced "Bucket not
-- found" from Supabase Storage. Public (not private, unlike claim
-- proofs), since existing client code already calls getPublicUrl() for
-- it rather than a signed URL — receipts are shown inline in reviews to
-- any signed-in user today, same trust level as a post photo.

insert into storage.buckets (id, name, public)
values ('restaurant-receipts', 'restaurant-receipts', true)
on conflict (id) do nothing;

drop policy if exists "Public read of restaurant receipts" on storage.objects;
create policy "Public read of restaurant receipts"
  on storage.objects for select
  using (bucket_id = 'restaurant-receipts');

drop policy if exists "Authenticated users can upload their own restaurant receipt" on storage.objects;
create policy "Authenticated users can upload their own restaurant receipt"
  on storage.objects for insert
  with check (
    bucket_id = 'restaurant-receipts'
    and auth.role() = 'authenticated'
    and owner = auth.uid()
  );

drop policy if exists "Users can delete their own uploaded restaurant receipt" on storage.objects;
create policy "Users can delete their own uploaded restaurant receipt"
  on storage.objects for delete
  using (
    bucket_id = 'restaurant-receipts'
    and owner = auth.uid()
  );
