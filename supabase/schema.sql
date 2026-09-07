-- ============================================================================
-- Stock Profit Assistant（股票收益小幫手）— Supabase Schema
-- 版本：v0.1（MVP 核心：使用者 / 券商 / 交易 / 股利 / 持股）
--
-- 使用方式：
--   1. 開啟 Supabase 專案 -> SQL Editor -> New query
--   2. 貼上整份檔案 -> Run
--   3. 之後在 Authentication -> Providers 開啟 Google / Email 登入
--
-- 設計原則：
--   - 所有交易明細表都掛 user_id，並開啟 Row Level Security（RLS），
--     確保每位使用者只能存取自己的資料。
--   - 「持股」不落地成獨立表，而是由 trades 表即時聚合運算（v_holdings view），
--     避免庫存與交易紀錄不同步。之後若股價來源穩定，可以再加上物化視圖或排程更新。
--   - 金額一律使用 numeric，避免浮點數誤差。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. 共用：更新 updated_at 的 trigger function
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. profiles：使用者個人設定（延伸 auth.users）
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  base_currency text not null default 'TWD',
  cost_method text not null default 'FIFO' check (cost_method in ('FIFO', 'WEIGHTED_AVERAGE')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  locale text not null default 'zh-TW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 新使用者註冊時自動建立 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2. brokers：券商帳戶管理
-- ----------------------------------------------------------------------------
create table if not exists public.brokers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  broker_name text not null, -- 富邦 / 元大 / 永豐 / 國泰 / 凱基 / 群益 / 統一 / 自訂...
  account_name text,         -- 使用者自訂帳戶暱稱，例如「主帳戶」「退休帳戶」
  fee_discount numeric(5, 3) not null default 1.000 check (fee_discount > 0 and fee_discount <= 1),
  note text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brokers_user_id on public.brokers (user_id);

alter table public.brokers enable row level security;

drop trigger if exists trg_brokers_updated_at on public.brokers;
create trigger trg_brokers_updated_at
  before update on public.brokers
  for each row execute function public.set_updated_at();

create policy "brokers_all_own" on public.brokers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. trades：股票交易紀錄（核心表）
-- ----------------------------------------------------------------------------
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  broker_id uuid references public.brokers (id) on delete set null,
  trade_date date not null,
  stock_id text not null,          -- 股票代號，例如 2330
  stock_name text not null,        -- 股票名稱，例如 台積電
  market text not null default 'TW_LISTED'
    check (market in ('TW_LISTED', 'TW_OTC', 'TW_ETF', 'TW_ACTIVE_ETF', 'OVERSEAS')),
  trade_type text not null check (trade_type in ('buy', 'sell')),
  lot_type text not null default 'whole' check (lot_type in ('whole', 'odd')), -- 整股 / 零股
  price numeric(18, 4) not null check (price >= 0),
  quantity numeric(18, 4) not null check (quantity > 0),
  amount numeric(18, 2) not null,          -- 成交金額（price * quantity，允許手動覆寫以對帳）
  fee numeric(18, 2) not null default 0,   -- 手續費
  tax numeric(18, 2) not null default 0,   -- 交易稅（賣出才有）
  note text,
  source text not null default 'manual' check (source in ('manual', 'ai_ocr', 'import')),
  ocr_confidence numeric(5, 2), -- 若來自 AI 截圖辨識，記錄信心分數 0-100
  screenshot_path text,         -- 對應 Storage 中的截圖檔案路徑
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trades_user_id on public.trades (user_id);
create index if not exists idx_trades_user_stock on public.trades (user_id, stock_id);
create index if not exists idx_trades_user_date on public.trades (user_id, trade_date);
create index if not exists idx_trades_broker_id on public.trades (broker_id);

alter table public.trades enable row level security;

drop trigger if exists trg_trades_updated_at on public.trades;
create trigger trg_trades_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();

create policy "trades_all_own" on public.trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. dividends：股利紀錄
-- ----------------------------------------------------------------------------
create table if not exists public.dividends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stock_id text not null,
  stock_name text not null,
  cash_dividend numeric(18, 2) not null default 0,   -- 現金股利（總額）
  stock_dividend numeric(18, 4) not null default 0,  -- 股票股利（股數）
  payment_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dividends_user_id on public.dividends (user_id);
create index if not exists idx_dividends_user_stock on public.dividends (user_id, stock_id);

alter table public.dividends enable row level security;

drop trigger if exists trg_dividends_updated_at on public.dividends;
create trigger trg_dividends_updated_at
  before update on public.dividends
  for each row execute function public.set_updated_at();

create policy "dividends_all_own" on public.dividends
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. price_cache：即時股價快取（避免 API 超量）
-- ----------------------------------------------------------------------------
create table if not exists public.price_cache (
  stock_id text primary key,
  stock_name text,
  last_price numeric(18, 4),
  prev_close numeric(18, 4),
  currency text not null default 'TWD',
  source text,
  fetched_at timestamptz not null default now()
);

-- price_cache 為全站共用資料（非個人資料），僅允許登入使用者讀取，寫入交由後端 service role 處理
alter table public.price_cache enable row level security;

create policy "price_cache_select_authenticated" on public.price_cache
  for select using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 6. ai_conversations / ai_messages：AI 投資教練對話紀錄
-- ----------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '新對話',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

drop trigger if exists trg_ai_conversations_updated_at on public.ai_conversations;
create trigger trg_ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create policy "ai_conversations_all_own" on public.ai_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_messages_conversation on public.ai_messages (conversation_id, created_at);

alter table public.ai_messages enable row level security;

create policy "ai_messages_all_own" on public.ai_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 7. v_holdings：即時持股彙總 view（依 stock_id 加總所有 buy/sell）
--    注意：這裡採「加權平均成本」做庫存彙總，適合做總覽用途；
--    真正「已實現損益」的 FIFO 計算，交由應用層 lib/portfolio/fifo.ts 逐筆計算，
--    因為 FIFO 需要保留每一批買進的剩餘數量，SQL view 較難優雅表達，
--    應用層算完可再寫回 realized_pnl 相關表（未來擴充）。
-- ----------------------------------------------------------------------------
create or replace view public.v_holdings as
select
  t.user_id,
  t.stock_id,
  t.stock_name,
  sum(case when t.trade_type = 'buy' then t.quantity else -t.quantity end) as net_quantity,
  sum(case when t.trade_type = 'buy' then t.amount + t.fee else 0 end) as total_buy_cost,
  sum(case when t.trade_type = 'buy' then t.quantity else 0 end) as total_buy_quantity,
  sum(case when t.trade_type = 'sell' then t.amount - t.fee - t.tax else 0 end) as total_sell_proceeds,
  sum(case when t.trade_type = 'sell' then t.quantity else 0 end) as total_sell_quantity,
  min(t.trade_date) as first_trade_date,
  max(t.trade_date) as last_trade_date
from public.trades t
group by t.user_id, t.stock_id, t.stock_name;

-- v_holdings 繼承底層 trades 表的 RLS（view 以 invoker 權限查詢時會套用 trades 的 RLS）
alter view public.v_holdings set (security_invoker = on);

-- ----------------------------------------------------------------------------
-- 8. Storage bucket：交易截圖上傳（AI OCR 用）
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', false)
on conflict (id) do nothing;

create policy "screenshots_select_own"
  on storage.objects for select
  using (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "screenshots_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "screenshots_delete_own"
  on storage.objects for delete
  using (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

-- 上傳時請將路徑命名為：{auth.uid()}/{yyyy-mm}/{filename}，才能符合上面的政策。

-- ============================================================================
-- 完成。接下來：
--   1. Authentication -> URL Configuration -> 設定 Site URL / Redirect URLs
--   2. Authentication -> Providers -> 開啟 Google（填入 Client ID/Secret）與 Email
--   3. 複製 Project URL 與 anon key 到 .env.local（見 .env.example）
-- ============================================================================
