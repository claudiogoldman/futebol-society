alter table public.groups add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('group-images', 'group-images', true)
on conflict (id) do update set public = true;

create policy "group_images_insert_admin" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'group-images'
  and exists (
    select 1 from public.groups g
    where g.id = split_part(name, '/', 1)::uuid
      and (g.created_by = auth.uid() or exists (
        select 1 from public.group_members gm
        where gm.group_id = g.id and gm.user_id = auth.uid() and gm.role = 'admin'
      ))
  )
);

create policy "group_images_update_admin" on storage.objects
for update to authenticated
using (
  bucket_id = 'group-images'
  and exists (
    select 1 from public.groups g
    where g.id = split_part(name, '/', 1)::uuid
      and (g.created_by = auth.uid() or exists (
        select 1 from public.group_members gm
        where gm.group_id = g.id and gm.user_id = auth.uid() and gm.role = 'admin'
      ))
  )
)
with check (
  bucket_id = 'group-images'
  and exists (
    select 1 from public.groups g
    where g.id = split_part(name, '/', 1)::uuid
      and (g.created_by = auth.uid() or exists (
        select 1 from public.group_members gm
        where gm.group_id = g.id and gm.user_id = auth.uid() and gm.role = 'admin'
      ))
  )
);

create policy "group_images_delete_admin" on storage.objects
for delete to authenticated
using (
  bucket_id = 'group-images'
  and exists (
    select 1 from public.groups g
    where g.id = split_part(name, '/', 1)::uuid
      and (g.created_by = auth.uid() or exists (
        select 1 from public.group_members gm
        where gm.group_id = g.id and gm.user_id = auth.uid() and gm.role = 'admin'
      ))
  );
