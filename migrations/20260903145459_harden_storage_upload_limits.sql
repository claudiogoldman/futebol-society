-- Defense in depth: constrain image uploads at the storage bucket level.
-- Public read remains enabled because profile and group images are displayed publicly.

UPDATE storage.buckets
SET file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ]::text[]
WHERE id IN ('avatars', 'group-images');
