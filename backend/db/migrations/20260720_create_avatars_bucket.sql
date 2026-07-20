-- 적용됨: 2026-07-20 (MCP apply_migration `create_avatars_bucket`)
-- 프로필 아바타 버킷 (부록 A-2: Storage만 RLS 사용)
-- 공개 읽기(public URL) + 본인 폴더({user_id}/...)만 쓰기/삭제.
-- 업로드는 프론트가 supabase-js로 직접 수행하고, 백엔드는 public URL만
-- profiles.avatar_url에 저장한다(PATCH /api/users/me).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
