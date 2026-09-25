# Teacher membership

Supabase Auth handles email/password signup, confirmation and recovery. New verified teachers remain pending until an administrator approves them. The fixed bootstrap admin email is yunusemreyilmaz93@gmail.com and provides the initial owner account. Existing administrators can promote any email-confirmed member to administrator from the management panel. Signup metadata never controls roles. No demo auth fallback exists.

## Deployment

1. Run the Supabase migrations in order. Existing installations must also apply `20260925_admin_roles.sql` to enable administrator promotion.
2. Set Supabase Site URL to https://arapcaydt.vercel.app. Enable email confirmation; set a production SMTP provider for teacher confirmation and recovery emails (the built-in Supabase sender is restricted).
3. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (publishable key) at build time. Server also needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (secret or legacy service_role, never browser-exposed).
4. Existing ELEVENLABS_API_KEY remains server-only. Deploy only after the database and environment are ready.
5. Owner registers and verifies the bootstrap email, then sees the admin panel. Teachers register, verify email, and wait for approval.

## Authorization and storage

All database tables have RLS. Teachers only read/write their own projects. Administrators read all project summaries and activity, can approve or block teachers, and can promote an email-confirmed member to administrator through a security-definer RPC. Disabling a teacher prevents new database/storage access and paid voice requests. Already-issued private signed asset links expire after six hours.

Images/audio are immutable private Storage objects, referenced by permanent paths in project JSON. Signed URLs are reconstructed when opening projects. Redundant base64 is stripped on save. MP4 rendering remains entirely in the browser; generated videos download to the teacher rather than consuming cloud render/storage quota.

Voice requests verify the Supabase user plus current approval on the server, reserve usage atomically before calling ElevenLabs, and log outcomes. Limit: 5,000 characters per request, 20,000 per teacher per UTC day, 10 seconds between requests. Failed/uncertain requests remain counted conservatively; requested characters are not a billing report. Browser-reported completed video exports are explicitly labelled. Deneme counts use distinct nonempty exam names, separately from deneme question counts.

## Validation

npm test includes a real embedded PostgreSQL test (PGlite) covering user metadata spoofing, pending access, teacher isolation, storage isolation, admin stats, paid-request reservation permissions/rate limits, and revocation. npm run lint; npm run build.

Legacy browser-only projects stay in local storage; import is an explicit administrator operation, never automatically assigned to whichever teacher logs in first.
