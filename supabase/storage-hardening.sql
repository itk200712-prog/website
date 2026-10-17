-- ============================================================================
-- Panduwasnuwara MPCS — STORAGE HARDENING (⑲ security fix)
-- Supabase Dashboard → SQL Editor → මේ සම්පූර්ණ block එක Run කරන්න
-- ============================================================================
-- ප්‍රශ්නය: site-images bucket එකට anon key (public JS bundle එකේ තියෙන) එකෙන්
--          upload කරන්න පුළුවන් වුණා. (delete/update block වෙලා තිබුණා ✔)
-- විසඳුම: කියවීම public, ලිවීම login වූ admin ට විතරයි.
-- ============================================================================

-- 1) site-images bucket එකට අදාළ පරණ policies සියල්ල ඉවත් කිරීම
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and (coalesce(qual, '') like '%site-images%'
        or coalesce(with_check, '') like '%site-images%')
  loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end $$;

-- 2) පින්තුර කියවීම — සියල්ලන්ට (public website එකට ඕන)
drop policy if exists "site_images_public_read" on storage.objects;
create policy "site_images_public_read"
  on storage.objects for select
  using (bucket_id = 'site-images');

-- 3) Upload — login වූ පරිශීලකයාට විතරයි (anon key එකෙන් බැහැ)
drop policy if exists "site_images_auth_insert" on storage.objects;
create policy "site_images_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'site-images');

-- 4) Update (replace)
drop policy if exists "site_images_auth_update" on storage.objects;
create policy "site_images_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-images')
  with check (bucket_id = 'site-images');

-- 5) Delete — login වූ පරිශීලකයාට විතරයි
drop policy if exists "site_images_auth_delete" on storage.objects;
create policy "site_images_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'site-images');

-- ============================================================================
-- පරීක්ෂාව (Run කරලා බලන්න):
--   select policyname, cmd, roles::text
--   from pg_policies
--   where schemaname='storage' and tablename='objects'
--     and (coalesce(qual,'') like '%site-images%' or coalesce(with_check,'') like '%site-images%');
-- ============================================================================
