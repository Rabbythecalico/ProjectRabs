# ProjectRabs

ProjectRabs is a responsive, public website for sharing original-character profiles and talking about them. It uses Supabase for shared authentication and persistent public data; it is not a native mobile app.

## One-time setup before the site works

1. Open the Supabase project dashboard for `tlwsgzigfsbecmwgxfpg`.
2. Go to **SQL Editor → New query**, paste the complete contents of `schema.sql`, and run it.
3. In **Authentication → URL Configuration**, set the Site URL to your GitHub Pages address (for example `https://rabbythecalico.github.io/ProjectRabs/`) and add that same address to Redirect URLs. Use the actual Pages address shown in your repository settings.
4. In **Authentication → Providers → Email**, decide whether to require email confirmation. If enabled, people must confirm their email before signing in.
5. In GitHub, open **Settings → Pages** and publish the `main` branch from `/ (root)`. The website stays available at the Pages URL while GitHub Pages and the Supabase project remain enabled.

The project URL and publishable/anon key in `index.html` are browser-safe. Do not put a Supabase `service_role` or secret key in website files. Database row-level security is enabled by `schema.sql`; public visitors can read profiles, characters, comments, and likes, while signed-in users can only change their own profile and characters.

## Features in this shared website version

- Browse the public character feed and creator profiles without logging in.
- Register/log in with email and password; username is public and unique.
- Create character posts, upload a small image, and add tags/pronouns/gender/content warnings.
- Like characters and post shared comments.
- Edit public profile details; delete your own characters/comments.

Images are stored as small data URLs in rows for this starter version (character images max 1.5 MB and avatar max 500 KB). For a larger public site, move image uploads to Supabase Storage. Existing browser-only accounts/posts do not automatically migrate into the shared database.
