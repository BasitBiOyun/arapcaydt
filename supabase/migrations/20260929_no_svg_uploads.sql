-- SVG files can carry scripts and the studio never needs them as uploads
-- (question slides are PNG/JPEG/WebP). Safe to run more than once.
update storage.buckets
   set allowed_mime_types = array['image/png','image/jpeg','image/webp','audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/ogg','audio/webm']
 where id = 'project-assets';
