-- ProjectRabs shared website database for Supabase (Postgres)
-- Run the complete file once in Supabase Dashboard > SQL Editor > New query.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 24),
  display_name text not null default 'New creator' check (char_length(display_name) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 500),
  pronouns text not null default '' check (char_length(pronouns) <= 40),
  gender text not null default '' check (char_length(gender) <= 40),
  avatar_url text not null default '',
  theme text not null default 'bubblegum',
  font text not null default 'quicksand',
  created_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null constraint characters_owner_id_fkey references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null check (char_length(description) between 1 and 4000),
  pronouns text not null default '' check (char_length(pronouns) <= 40),
  gender text not null default '' check (char_length(gender) <= 40),
  tags text[] not null default '{}',
  bg_theme text not null default 'none',
  images text[] not null default '{}',
  sticker_layers jsonb not null default '[]'::jsonb,
  content_warning boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, character_id)
);

create index if not exists characters_created_at_idx on public.characters(created_at desc);
create index if not exists characters_owner_id_idx on public.characters(owner_id);
create index if not exists comments_character_id_idx on public.comments(character_id, created_at);

-- Automatically create a public profile when an Auth account is registered.
create or replace function public.handle_new_projectrabs_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(requested_username) < 3 then
    requested_username := 'creator_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    left(requested_username, 24),
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), requested_username), 40)
  );
  return new;
end;
$$;

drop trigger if exists on_projectrabs_auth_user_created on auth.users;
create trigger on_projectrabs_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_projectrabs_user();

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

drop policy if exists "Public profiles are viewable" on public.profiles;
create policy "Public profiles are viewable" on public.profiles for select using (true);
drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Characters are public" on public.characters;
create policy "Characters are public" on public.characters for select using (true);
drop policy if exists "Signed-in users create their characters" on public.characters;
create policy "Signed-in users create their characters" on public.characters for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "Owners update characters" on public.characters;
create policy "Owners update characters" on public.characters for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Owners delete characters" on public.characters;
create policy "Owners delete characters" on public.characters for delete to authenticated using (auth.uid() = owner_id);

drop policy if exists "Comments are public" on public.comments;
create policy "Comments are public" on public.comments for select using (true);
drop policy if exists "Signed-in users add comments" on public.comments;
create policy "Signed-in users add comments" on public.comments for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "Authors delete their comments" on public.comments;
create policy "Authors delete their comments" on public.comments for delete to authenticated using (auth.uid() = author_id);
drop policy if exists "Character owners delete comments on their characters" on public.comments;
create policy "Character owners delete comments on their characters" on public.comments for delete to authenticated using (
  exists (select 1 from public.characters c where c.id = character_id and c.owner_id = auth.uid())
);

drop policy if exists "Likes are public" on public.likes;
create policy "Likes are public" on public.likes for select using (true);
drop policy if exists "Users add their own likes" on public.likes;
create policy "Users add their own likes" on public.likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users remove their own likes" on public.likes;
create policy "Users remove their own likes" on public.likes for delete to authenticated using (auth.uid() = user_id);

grant select on public.profiles, public.characters, public.comments, public.likes to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.characters to authenticated;
grant insert, delete on public.comments to authenticated;
grant insert, delete on public.likes to authenticated;
