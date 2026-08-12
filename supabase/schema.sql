-- Carrier GreenON initial Supabase schema
-- All user-owned tables use RLS, and point mutations are only exposed through guarded RPC functions.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '그린 히어로',
  green_points integer not null default 0 check (green_points >= 0),
  green_level text not null default 'seedling' check (green_level in ('seedling', 'leaf', 'tree')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.missions (
  id bigint generated always as identity primary key,
  code text not null unique,
  title text not null,
  description text not null,
  target_minutes smallint not null check (target_minutes > 0),
  reward_points integer not null check (reward_points > 0),
  required_mode text not null check (required_mode in ('cool', 'dry', 'fan')),
  required_temperature smallint not null check (required_temperature between 18 and 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_missions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id bigint not null references public.missions(id) on delete restrict,
  mission_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'success', 'failed')),
  elapsed_minutes smallint not null default 0 check (elapsed_minutes >= 0),
  failure_reason text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mission_id, mission_date)
);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('earn', 'spend')),
  amount integer not null check (amount > 0),
  balance_after integer not null check (balance_after >= 0),
  source text not null check (source in ('mission', 'reward', 'admin')),
  source_id text,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.rewards (
  id bigint generated always as identity primary key,
  code text not null unique,
  category text not null check (category in ('FOOD', 'LIFE', 'CARRIER')),
  name text not null,
  description text not null,
  price integer not null check (price > 0),
  emoji text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  stock integer check (stock is null or stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reward_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id bigint not null references public.rewards(id) on delete restrict,
  product_name text not null,
  product_emoji text not null,
  points_spent integer not null check (points_spent > 0),
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.aircon_status (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  power boolean not null default true,
  mode text not null default 'cool' check (mode in ('cool', 'dry', 'fan')),
  set_temperature smallint not null default 26 check (set_temperature between 18 and 30),
  fan text not null default 'auto' check (fan in ('auto', 'low', 'medium', 'high')),
  runtime_minutes integer not null default 0 check (runtime_minutes >= 0),
  filter_life smallint not null default 72 check (filter_life between 0 and 100),
  sensor_error boolean not null default false,
  updated_at timestamptz not null default now()
);

create index user_missions_user_id_idx on public.user_missions (user_id);
create index user_missions_mission_id_idx on public.user_missions (mission_id);
create index user_missions_user_date_idx on public.user_missions (user_id, mission_date desc);
create index point_transactions_user_id_idx on public.point_transactions (user_id);
create index point_transactions_user_created_idx on public.point_transactions (user_id, created_at desc);
create unique index point_transactions_source_unique_idx
  on public.point_transactions (user_id, source, source_id)
  where source_id is not null;
create index reward_orders_user_id_idx on public.reward_orders (user_id);
create index reward_orders_reward_id_idx on public.reward_orders (reward_id);
create index reward_orders_user_created_idx on public.reward_orders (user_id, created_at desc);

create or replace function private.calculate_green_level(points integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when points >= 700 then 'tree'
    when points >= 300 then 'leaf'
    else 'seedling'
  end;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger user_missions_set_updated_at
before update on public.user_missions
for each row execute function private.set_updated_at();

create trigger rewards_set_updated_at
before update on public.rewards
for each row execute function private.set_updated_at();

create trigger aircon_status_set_updated_at
before update on public.aircon_status
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), '그린 히어로')
  );

  insert into public.aircon_status (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function public.start_green_mission(
  p_mission_id bigint,
  p_mission_date date default current_date
)
returns public.user_missions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result public.user_missions;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.missions where id = p_mission_id and is_active is true
  ) then
    raise exception 'MISSION_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.user_missions (user_id, mission_id, mission_date, status, elapsed_minutes, failure_reason)
  values (v_user_id, p_mission_id, p_mission_date, 'active', 0, null)
  on conflict (user_id, mission_id, mission_date) do update
    set status = case when public.user_missions.status = 'success' then 'success' else 'active' end,
        elapsed_minutes = case when public.user_missions.status = 'success' then public.user_missions.elapsed_minutes else 0 end,
        failure_reason = null,
        started_at = case when public.user_missions.status = 'success' then public.user_missions.started_at else now() end,
        completed_at = case when public.user_missions.status = 'success' then public.user_missions.completed_at else null end
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.advance_green_mission(
  p_user_mission_id bigint,
  p_minutes smallint default 30
)
returns public.user_missions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_mission_user_id uuid;
  v_status text;
  v_elapsed smallint;
  v_target smallint;
  v_reward integer;
  v_required_mode text;
  v_required_temperature smallint;
  v_aircon public.aircon_status;
  v_result public.user_missions;
  v_new_balance integer;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = 'P0001';
  end if;

  if p_minutes <> 30 then
    raise exception 'INVALID_SIMULATION_STEP' using errcode = 'P0001';
  end if;

  select um.user_id, um.status, um.elapsed_minutes,
         m.target_minutes, m.reward_points, m.required_mode, m.required_temperature
    into v_mission_user_id, v_status, v_elapsed,
         v_target, v_reward, v_required_mode, v_required_temperature
  from public.user_missions um
  join public.missions m on m.id = um.mission_id
  where um.id = p_user_mission_id
  for update of um;

  if v_mission_user_id is null or v_mission_user_id <> v_user_id then
    raise exception 'MISSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_status <> 'active' then
    raise exception 'MISSION_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select * into v_aircon
  from public.aircon_status
  where user_id = v_user_id
  for update;

  if v_aircon.power is not true
    or v_aircon.mode <> v_required_mode
    or v_aircon.set_temperature <> v_required_temperature
    or v_aircon.sensor_error is true then
    update public.user_missions
      set status = 'failed',
          failure_reason = '에어컨 상태가 미션 조건을 충족하지 못했습니다.',
          completed_at = now()
    where id = p_user_mission_id
    returning * into v_result;
    return v_result;
  end if;

  update public.aircon_status
    set runtime_minutes = runtime_minutes + p_minutes,
        filter_life = greatest(0, filter_life - 1)
  where user_id = v_user_id;

  update public.user_missions
    set elapsed_minutes = least(v_target, v_elapsed + p_minutes),
        status = case when v_elapsed + p_minutes >= v_target then 'success' else 'active' end,
        completed_at = case when v_elapsed + p_minutes >= v_target then now() else null end
  where id = p_user_mission_id
  returning * into v_result;

  if v_result.status = 'success' then
    update public.profiles
      set green_points = green_points + v_reward,
          green_level = private.calculate_green_level(green_points + v_reward)
    where id = v_user_id
    returning green_points into v_new_balance;

    insert into public.point_transactions (
      user_id, transaction_type, amount, balance_after, source, source_id, description
    ) values (
      v_user_id, 'earn', v_reward, v_new_balance, 'mission', p_user_mission_id::text, 'GREEN MISSION 성공'
    );
  end if;

  return v_result;
end;
$$;

create or replace function public.purchase_reward(p_reward_id bigint)
returns public.reward_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_reward public.rewards;
  v_balance integer;
  v_new_balance integer;
  v_order public.reward_orders;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_reward
  from public.rewards
  where id = p_reward_id and is_active is true
  for update;

  if v_reward.id is null or (v_reward.stock is not null and v_reward.stock <= 0) then
    raise exception 'REWARD_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  select green_points into v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if v_balance < v_reward.price then
    raise exception 'INSUFFICIENT_POINTS' using errcode = 'P0001';
  end if;

  v_new_balance := v_balance - v_reward.price;

  update public.profiles
    set green_points = v_new_balance,
        green_level = private.calculate_green_level(v_new_balance)
  where id = v_user_id;

  if v_reward.stock is not null then
    update public.rewards set stock = stock - 1 where id = v_reward.id;
  end if;

  insert into public.reward_orders (
    user_id, reward_id, product_name, product_emoji, points_spent
  ) values (
    v_user_id, v_reward.id, v_reward.name, v_reward.emoji, v_reward.price
  ) returning * into v_order;

  insert into public.point_transactions (
    user_id, transaction_type, amount, balance_after, source, source_id, description
  ) values (
    v_user_id, 'spend', v_reward.price, v_new_balance, 'reward', v_order.id::text, v_reward.name
  );

  return v_order;
end;
$$;

revoke all on function public.start_green_mission(bigint, date) from public, anon;
revoke all on function public.advance_green_mission(bigint, smallint) from public, anon;
revoke all on function public.purchase_reward(bigint) from public, anon;
grant execute on function public.start_green_mission(bigint, date) to authenticated;
grant execute on function public.advance_green_mission(bigint, smallint) to authenticated;
grant execute on function public.purchase_reward(bigint) to authenticated;

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.user_missions enable row level security;
alter table public.point_transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_orders enable row level security;
alter table public.aircon_status enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy missions_select_active on public.missions
  for select to authenticated
  using (is_active is true);

create policy user_missions_select_own on public.user_missions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy point_transactions_select_own on public.point_transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy rewards_select_active on public.rewards
  for select to authenticated
  using (is_active is true);

create policy reward_orders_select_own on public.reward_orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy aircon_status_select_own on public.aircon_status
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy aircon_status_update_own on public.aircon_status
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.missions to authenticated;
grant select on public.user_missions to authenticated;
grant select on public.point_transactions to authenticated;
grant select on public.rewards to authenticated;
grant select on public.reward_orders to authenticated;
grant select, update on public.aircon_status to authenticated;

insert into public.missions (
  code, title, description, target_minutes, reward_points, required_mode, required_temperature
) values (
  'daily-26c-60m',
  '적정 온도 26℃ 지키기',
  '냉방 모드와 26℃를 60분 동안 유지해 에너지를 절약해요.',
  60,
  150,
  'cool',
  26
);

insert into public.rewards (code, category, name, description, price, emoji, color) values
  ('food-tumbler-drink', 'FOOD', '카페 텀블러 음료 쿠폰', '개인 텀블러와 함께 사용할 수 있는 시원한 음료 쿠폰이에요.', 100, '🥤', '#E8F5FF'),
  ('food-salad', 'FOOD', '로컬 채소 샐러드', '가까운 농장에서 온 제철 채소로 만든 건강한 한 끼예요.', 180, '🥗', '#E8FAEF'),
  ('life-bag', 'LIFE', 'GreenON 리유저블 백', '장보기와 나들이에 가볍게 쓰는 튼튼한 다회용 가방이에요.', 250, '🛍️', '#FFF5DC'),
  ('life-bamboo', 'LIFE', '대나무 칫솔 세트', '일상 속 플라스틱 사용을 줄여 주는 부드러운 칫솔 세트예요.', 320, '🪥', '#EEF9E8'),
  ('carrier-filter', 'CARRIER', 'Carrier 필터 케어 키트', '가상 에어컨을 깨끗하게 관리하는 GreenON 전용 케어 키트예요.', 600, '❄️', '#E5F2FF'),
  ('carrier-clean', 'CARRIER', '에어컨 클린 케어 쿠폰', '쾌적한 냉방을 위한 가상 Carrier 클린 케어 리워드예요.', 900, '✨', '#EEEAFF');
