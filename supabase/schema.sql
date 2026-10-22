-- Supabase schema for fairshair-app
-- Profiles table to store user info
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- bills table to store receipts
create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  bill_date date not null,
  total_amount numeric(12,2) not null,
  items jsonb not null,
  created_at timestamp with time zone default now()
);

-- RLS policies for profiles
alter table profiles enable row level security;
create policy "Users can read own profile" on profiles for select using (auth.uid() = user_id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = user_id);

-- RLS policies for bills
alter table bills enable row level security;
create policy "Users can read own bills" on bills for select using (auth.uid() = user_id);
create policy "Users can insert own bills" on bills for insert with check (auth.uid() = user_id);
create policy "Users can update own bills" on bills for update using (auth.uid() = user_id);
