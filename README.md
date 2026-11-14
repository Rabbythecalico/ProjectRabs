# ProjectRabs

ProjectRabs is a responsive, public website for sharing original-character profiles and talking about them. It uses Supabase for shared authentication and persistent public data; it is not a native mobile app.

## One-time setup before the site works

1. Open the Supabase project dashboard for `tlwsgzigfsbecmwgxfpg`.
2. Go to **SQL Editor → New query**, paste the complete contents of `schema.sql`, and run it.
3. In **Authentication → URL Configuration**, set the Site URL to your GitHub Pages address (for example `https://rabbythecalico.github.io/ProjectRabs/`) and add that same address to Redirect URLs.
4. In **Authentication → Providers → Email**, decide whether to require email confirmation.
5. Publish the repo from GitHub Pages using `main` as the branch and `/ (root)` as the folder.

The project URL and publishable/anon key in `index.html` are browser-safe. Do not put a Supabase `service_role` key in website files.

## Features

- Browse the public character feed and creator profiles without logging in.
- Register/log in with email and password.
- Create character posts, upload a small image, and add tags/pronouns/gender/content warnings.
- Like characters and post shared comments.
- Edit public profile details; delete your own characters/comments.

Images are stored as small data URLs in rows for this starter version. For a larger public site, move image uploads to Supabase Storage.
