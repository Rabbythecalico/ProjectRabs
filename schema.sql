-- ProjectRabs database (Supabase / PostgreSQL)
-- Run in Supabase: SQL Editor > New query > paste > Run

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (char_length(username) between 3 and 24),
  display_name text check (char_length(display_name) <= 40),
  bio text check (char_length(bio) <= 300),
  pronouns text, gender text, avatar_url text,
  theme text default 'bubblegum', font text default 'fredoka',
  created_at timestamptz default now()
);

create table characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles on delete cascade,
  name text not null check (char_length(name) <= 60),
  description text check (char_length(description) <= 2000),
  pronouns text, gender text,
  tags text[] default '{}',
  bg_theme text default 'none',
  stickers jsonb default '[]',      -- placed sticker layers
  images text[] default '{}',       -- Storage URLs
  created_at timestamptz default now()
);

create table stickers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles on delete cascade,
  url text not null, created_at timestamptz default now()
);

create table likes (
  user_id uuid references profiles on delete cascade,
  character_id uuid references characters on delete cascade,
  primary key (user_id, character_id)   -- stops duplicate likes
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters on delete cascade,
  author_id uuid not null references profiles on delete cascade,
  parent_id uuid references comments on delete cascade,  -- replies
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz default now()
);

create table comment_reactions (
  user_id uuid references profiles on delete cascade,
  comment_id uuid references comments on delete cascade,
  emoji text not null,
  primary key (user_id, comment_id, emoji)
);

create table follows (
  follower_id uuid references profiles on delete cascade,
  following_id uuid references profiles on delete cascade,
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table bookmarks (
  user_id uuid references profiles on delete cascade,
  character_id uuid references characters on delete cascade,
  primary key (user_id, character_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  message text not null, type text default 'info',
  read boolean default false, created_at timestamptz default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles on delete cascade,
  target_type text not null check (target_type in ('character','comment','user')),
  target_id uuid not null, reason text not null,
  created_at timestamptz default now()
);

create table blocks (
  blocker_id uuid references profiles on delete cascade,
  blocked_id uuid references profiles on delete cascade,
  primary key (blocker_id, blocked_id)
);

-- Auto-create a profile when someone signs up (after email verification setup)
create function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, username)
  values (new.id, split_part(new.email,'@',1) || floor(random()*1000)::int);
  return new;
end; $$ language plpgsql security definer;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ===== Row Level Security: users can only change their own data =====
alter table profiles enable row level security;
alter table characters enable row level security;
alter table stickers enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table comment_reactions enable row level security;
alter table follows enable row level security;
alter table bookmarks enable row level security;
alter table notifications enable row level security;
alter table reports enable row level security;
alter table blocks enable row level security;

-- Everyone can read public content
create policy "read profiles" on profiles for select using (true);
create policy "read characters" on characters for select using (true);
create policy "read likes" on likes for select using (true);
create policy "read comments" on comments for select using (true);
create policy "read reactions" on comment_reactions for select using (true);
create policy "read follows" on follows for select using (true);

-- Owners only
create policy "edit own profile" on profiles for update using (auth.uid() = id);
create policy "insert own character" on characters for insert with check (auth.uid() = owner_id);
create policy "edit own character" on characters for update using (auth.uid() = owner_id);
create policy "delete own character" on characters for delete using (auth.uid() = owner_id);
create policy "own stickers" on stickers for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "own likes" on likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "add comment" on comments for insert with check (auth.uid() = author_id);
create policy "delete own comment" on comments for delete using (auth.uid() = author_id);
create policy "own reactions" on comment_reactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own follows" on follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
create policy "own bookmarks" on bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notifications" on notifications for all using (auth.uid() = user_id);
create policy "send report" on reports for insert with check (auth.uid() = reporter_id);
create policy "own blocks" on blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
