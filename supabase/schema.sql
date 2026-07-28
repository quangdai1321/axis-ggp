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

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
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

drop policy if exists "Car slots are viewable by everyone" on public.car_slots;
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

drop policy if exists "Sessions are viewable by everyone" on public.race_sessions;
create policy "Sessions are viewable by everyone"
  on public.race_sessions for select
  using (true);

drop policy if exists "Only admins can create sessions" on public.race_sessions;
create policy "Only admins can create sessions"
  on public.race_sessions for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "Only admins can update sessions" on public.race_sessions;
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
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, car_slot_id)
);

alter table public.race_entries add column if not exists is_test boolean not null default false;

-- a real player may only claim one car per session, but admins seeding
-- test/bot entries (all inserted under their own user_id) need many —
-- so uniqueness on (session_id, user_id) only applies to non-test rows
alter table public.race_entries drop constraint if exists race_entries_session_id_user_id_key;
drop index if exists race_entries_session_real_user_idx;
create unique index race_entries_session_real_user_idx
  on public.race_entries (session_id, user_id)
  where not is_test;

alter table public.race_entries enable row level security;

drop policy if exists "Entries are viewable by everyone" on public.race_entries;
create policy "Entries are viewable by everyone"
  on public.race_entries for select
  using (true);

drop policy if exists "Users can claim a car for themselves while lobby is open" on public.race_entries;
create policy "Users can claim a car for themselves while lobby is open"
  on public.race_entries for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.race_sessions
      where id = session_id and status = 'lobby'
    )
  );

drop policy if exists "Users can drop their own car while lobby is open" on public.race_entries;
create policy "Users can drop their own car while lobby is open"
  on public.race_entries for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.race_sessions
      where id = session_id and status = 'lobby'
    )
  );

drop policy if exists "Only admins can write race results" on public.race_entries;
create policy "Only admins can write race results"
  on public.race_entries for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- =========================================================
-- 5. Điểm Quiz (chế độ trả lời câu hỏi kiểu quiz.com ở trang /quiz)
-- =========================================================
create table if not exists public.quiz_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_id text not null,
  score integer not null check (score >= 0),
  correct_count smallint not null check (correct_count >= 0),
  question_count smallint not null check (question_count >= 1),
  created_at timestamptz not null default now()
);

create index if not exists quiz_scores_score_idx on public.quiz_scores (score desc);

alter table public.quiz_scores enable row level security;

drop policy if exists "Quiz scores are viewable by everyone" on public.quiz_scores;
create policy "Quiz scores are viewable by everyone"
  on public.quiz_scores for select
  using (true);

drop policy if exists "Users can insert their own quiz scores" on public.quiz_scores;
create policy "Users can insert their own quiz scores"
  on public.quiz_scores for insert
  with check (auth.uid() = user_id);

-- =========================================================
-- 5b. Phòng Quiz trực tiếp nhiều người (kiểu Kahoot)
--   - 1 chủ phòng (đã đăng nhập) tạo phòng -> có mã tham gia.
--   - Tối đa ~100 người nhập mã + tên để vào (KHÔNG cần đăng nhập).
--   - Chủ phòng bấm "Bắt đầu", mọi người cùng trả lời 1 câu tại 1 thời điểm,
--     tính điểm theo tốc độ (dựa trên đồng hồ server nên công bằng).
-- =========================================================

-- Phòng: `questions` là snapshot ĐÃ xáo trộn, CHỈ gồm text + answers (không lộ
-- đáp án đúng). Đáp án đúng để riêng ở bảng quiz_room_keys mà client không đọc được.
create table if not exists public.quiz_rooms (
  id bigint generated always as identity primary key,
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  topic_id text not null,
  topic_name text not null,
  questions jsonb not null,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  current_index smallint not null default -1,
  question_started_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists quiz_rooms_code_idx on public.quiz_rooms (code);

alter table public.quiz_rooms enable row level security;

drop policy if exists "Quiz rooms are viewable by everyone" on public.quiz_rooms;
create policy "Quiz rooms are viewable by everyone"
  on public.quiz_rooms for select using (true);

drop policy if exists "Host can create room" on public.quiz_rooms;
create policy "Host can create room"
  on public.quiz_rooms for insert with check (auth.uid() = host_id);

drop policy if exists "Host can update own room" on public.quiz_rooms;
create policy "Host can update own room"
  on public.quiz_rooms for update using (auth.uid() = host_id);

drop policy if exists "Host can delete own room" on public.quiz_rooms;
create policy "Host can delete own room"
  on public.quiz_rooms for delete using (auth.uid() = host_id);

-- Bảng đáp án đúng — KHÔNG có policy SELECT nên anon/authenticated không đọc được;
-- chỉ các hàm SECURITY DEFINER (chạy dưới quyền owner) mới truy cập để chấm điểm.
create table if not exists public.quiz_room_keys (
  room_id bigint primary key references public.quiz_rooms (id) on delete cascade,
  answer_key jsonb not null
);

alter table public.quiz_room_keys enable row level security;

drop policy if exists "Host can insert key" on public.quiz_room_keys;
create policy "Host can insert key"
  on public.quiz_room_keys for insert
  with check (exists (select 1 from public.quiz_rooms r where r.id = room_id and r.host_id = auth.uid()));

-- Người chơi trong phòng
create table if not exists public.quiz_room_players (
  id bigint generated always as identity primary key,
  room_id bigint not null references public.quiz_rooms (id) on delete cascade,
  nickname text not null,
  token text not null,
  score integer not null default 0,
  correct_count smallint not null default 0,
  answered_index smallint not null default -1,
  joined_at timestamptz not null default now(),
  unique (room_id, nickname)
);

alter table public.quiz_room_players enable row level security;

drop policy if exists "Room players are viewable by everyone" on public.quiz_room_players;
create policy "Room players are viewable by everyone"
  on public.quiz_room_players for select using (true);

-- Câu trả lời từng câu (chống trả lời 2 lần bằng unique)
create table if not exists public.quiz_room_answers (
  id bigint generated always as identity primary key,
  room_id bigint not null references public.quiz_rooms (id) on delete cascade,
  player_id bigint not null references public.quiz_room_players (id) on delete cascade,
  question_index smallint not null,
  answer_index smallint,
  is_correct boolean not null default false,
  gained integer not null default 0,
  created_at timestamptz not null default now(),
  unique (room_id, player_id, question_index)
);

alter table public.quiz_room_answers enable row level security;

drop policy if exists "Room answers are viewable by everyone" on public.quiz_room_answers;
create policy "Room answers are viewable by everyone"
  on public.quiz_room_answers for select using (true);

-- Hàm tham gia phòng (người chơi vô danh gọi được): tạo người chơi + token bí mật
create or replace function public.join_quiz_room(p_code text, p_nickname text)
returns table (room_id bigint, player_id bigint, token text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_room public.quiz_rooms;
  v_nick text;
  v_token text;
begin
  v_nick := btrim(p_nickname);
  if v_nick = '' or char_length(v_nick) > 24 then
    raise exception 'Tên phải từ 1–24 ký tự.';
  end if;

  select * into v_room from public.quiz_rooms where code = upper(btrim(p_code));
  if not found then
    raise exception 'Không tìm thấy phòng với mã này.';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'Phòng đã bắt đầu hoặc kết thúc, không thể tham gia.';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  begin
    insert into public.quiz_room_players (room_id, nickname, token)
    values (v_room.id, v_nick, v_token)
    returning id into player_id;
  exception when unique_violation then
    raise exception 'Tên này đã có người dùng trong phòng.';
  end;

  room_id := v_room.id;
  token := v_token;
  return next;
end;
$$;

grant execute on function public.join_quiz_room(text, text) to anon, authenticated;

-- Hàm nộp câu trả lời (chấm điểm phía server, đọc đáp án đúng ở bảng ẩn)
create or replace function public.submit_quiz_room_answer(
  p_code text,
  p_player_id bigint,
  p_token text,
  p_question_index int,
  p_answer_index int
)
returns table (is_correct boolean, gained int, correct_index int)
language plpgsql
security definer set search_path = public
as $$
declare
  v_room public.quiz_rooms;
  v_key jsonb;
  v_correct int;
  v_elapsed numeric;
  v_frac numeric;
  v_gained int := 0;
  v_correctb boolean := false;
  v_qsec constant int := 10; -- khớp QUESTION_SECONDS (10s) ở RoomClient.jsx
  v_inserted boolean := false;
begin
  select * into v_room from public.quiz_rooms where code = upper(btrim(p_code));
  if not found then raise exception 'Phòng không tồn tại.'; end if;

  perform 1 from public.quiz_room_players
    where id = p_player_id and room_id = v_room.id and token = p_token;
  if not found then raise exception 'Người chơi không hợp lệ.'; end if;

  if v_room.status <> 'playing' or v_room.current_index <> p_question_index then
    raise exception 'Câu hỏi không còn mở.';
  end if;

  select answer_key into v_key from public.quiz_room_keys where room_id = v_room.id;
  v_correct := (v_key ->> p_question_index)::int;
  v_elapsed := extract(epoch from (now() - v_room.question_started_at));

  if p_answer_index is not null and p_answer_index = v_correct then
    v_correctb := true;
    if v_elapsed <= v_qsec then
      v_frac := (v_qsec - v_elapsed) / v_qsec;
      if v_frac < 0 then v_frac := 0; end if;
      v_gained := round(500 + 500 * v_frac)::int;
    else
      v_gained := 0;
    end if;
  end if;

  insert into public.quiz_room_answers
    (room_id, player_id, question_index, answer_index, is_correct, gained)
  values (v_room.id, p_player_id, p_question_index, p_answer_index, v_correctb, v_gained)
  on conflict (room_id, player_id, question_index) do nothing;
  v_inserted := found;

  if v_inserted then
    update public.quiz_room_players
      set score = score + v_gained,
          correct_count = correct_count + (case when v_correctb then 1 else 0 end),
          answered_index = p_question_index
      where id = p_player_id;
  else
    -- đã trả lời câu này rồi: trả lại kết quả cũ, không cộng điểm lần 2
    select a.is_correct, a.gained into v_correctb, v_gained
      from public.quiz_room_answers a
      where a.room_id = v_room.id and a.player_id = p_player_id and a.question_index = p_question_index;
  end if;

  is_correct := v_correctb;
  gained := v_gained;
  correct_index := v_correct;
  return next;
end;
$$;

grant execute on function public.submit_quiz_room_answer(text, bigint, text, int, int) to anon, authenticated;

-- Giờ của server: client gọi để đo độ lệch đồng hồ, nhờ đó mọi người trong
-- phòng đếm ngược theo cùng một mốc thời gian (đồng bộ tuyệt đối).
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now() $$;

grant execute on function public.server_now() to anon, authenticated;

-- =========================================================
-- 6. Bật Realtime cho Sảnh chờ (ai chọn/bỏ xe thấy ngay không cần refresh)
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

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_rooms'
  ) then
    alter publication supabase_realtime add table public.quiz_rooms;
  end if;
end $$;

