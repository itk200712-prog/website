-- ============================================================================
-- §18. PROFILE AVATAR — profile photo upload (header ball එකේ පේනවා)
-- Supabase → SQL Editor → මේක paste කරලා RUN කරන්න
-- ============================================================================
alter table public.profiles add column if not exists avatar_url text not null default '';

-- ✅ storage: authenticated user කෙනෙක්ට avatars/ folder එකට upload කරන්න ඉඩ දෙන්න
--    (site-images bucket එක දැනටමත් public — මේක දැනට තියෙන policy එකට අමතරව)
drop policy if exists "avatar upload" on storage.objects;
create policy "avatar upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-images' and (storage.foldername(name))[1] = 'avatars');

drop policy if exists "avatar update" on storage.objects;
create policy "avatar update" on storage.objects
  for update to authenticated
  using (bucket_id = 'site-images' and (storage.foldername(name))[1] = 'avatars');

-- public read (bucket public නිසා image පේන්න අවශ්‍ය)
drop policy if exists "avatar read" on storage.objects;
create policy "avatar read" on storage.objects
  for select using (bucket_id = 'site-images');

select '§18 avatar SQL done ✅' as result;
