-- AXIS: Gadget Grand Prix — Supabase schema
-- Chạy toàn bộ file này trong Supabase Dashboard → SQL Editor → New query → Run.
-- Mô hình: user đăng nhập, chọn 1 trong tối đa 50 xe có sẵn và đặt tên,
-- admin bấm bắt đầu thì hệ thống tính kết quả và phát lại trận đua.

-- =========================================================
-- 1. Hồ sơ người chơi (1-1 với auth.users)
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- email is null for Web3 (wallet) sign-ins, so fall back to the wallet
  -- address if present, then to a short id-based handle as a last resort
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      case
        when new.raw_user_meta_data ->> 'address' is not null
          then 'wallet_' || substr(new.raw_user_meta_data ->> 'address', 3, 6)
      end,
      'wallet_' || substr(new.id::text, 1, 8)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Sau khi chạy xong file này, hãy tự phong admin cho tài khoản của bạn:
--   update public.profiles set is_admin = true where username = 'ten_dang_nhap_cua_ban';

-- =========================================================
-- 2. Danh sách 50 xe có sẵn để user chọn
-- =========================================================
create table if not exists public.car_slots (
  id smallint primary key,
  slot_number smallint not null unique,
  model_name text not null,
  color_hex text not null,
  speed_rating numeric not null default 1.0
);

alter table public.car_slots enable row level security;

create policy "Car slots are viewable by everyone"
  on public.car_slots for select
  using (true);

insert into public.car_slots (id, slot_number, model_name, color_hex, speed_rating)
select
  n,
  n,
  (array[
    'Dorayaki Car', 'Time Bike', 'Anywhere Door Truck', 'Cloud Kart',
    'Robot Racer', 'Bamboo Helicopter Buggy', 'Mini Tank'
  ])[((n - 1) % 7) + 1],
  (array[
    '#ff6fa1', '#ffcf3a', '#1e9bf0', '#53e07a', '#ff9a3c', '#9b59b6', '#2ecc71'
  ])[((n - 1) % 7) + 1],
  round((0.94 + ((n * 13) % 11) * 0.012)::numeric, 3)
from generate_series(1, 50) as n
on conflict (id) do nothing;

-- =========================================================
-- 3. Phiên đua hiện tại (mỗi lần admin "Ván mới" sẽ tạo 1 row)
-- =========================================================
create table if not exists public.race_sessions (
  id bigint generated always as identity primary key,
  status text not null default 'lobby' check (status in ('lobby', 'racing', 'finished')),
  laps smallint not null default 2,
  started_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.race_sessions enable row level security;

create policy "Sessions are viewable by everyone"
  on public.race_sessions for select
  using (true);

create policy "Only admins can create sessions"
  on public.race_sessions for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

create policy "Only admins can update sessions"
  on public.race_sessions for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- tạo sẵn 1 phiên "lobby" đầu tiên
insert into public.race_sessions (status)
select 'lobby'
where not exists (select 1 from public.race_sessions);

-- =========================================================
-- 4. Xe mà từng user đã chọn trong phiên hiện tại
-- =========================================================
create table if not exists public.race_entries (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.race_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  car_slot_id smallint not null references public.car_slots (id),
  nickname text not null,
  finish_time numeric,
  position smallint,
  created_at timestamptz not null default now(),
  unique (session_id, user_id),
  unique (session_id, car_slot_id)
);

alter table public.race_entries enable row level security;

create policy "Entries are viewable by everyone"
  on public.race_entries for select
  using (true);

create policy "Users can claim a car for themselves while lobby is open"
  on public.race_entries for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.race_sessions
      where id = session_id and status = 'lobby'
    )
  );

create policy "Users can drop their own car while lobby is open"
  on public.race_entries for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.race_sessions
      where id = session_id and status = 'lobby'
    )
  );

create policy "Only admins can write race results"
  on public.race_entries for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- =========================================================
-- 5. Bật Realtime cho Sảnh chờ (ai chọn/bỏ xe thấy ngay không cần refresh)
-- =========================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'race_entries'
  ) then
    alter publication supabase_realtime add table public.race_entries;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'race_sessions'
  ) then
    alter publication supabase_realtime add table public.race_sessions;
  end if;
end $$;

