-- =============================================================
-- 顏料庫存管理系統 — Supabase 資料庫結構 v1
-- 用法：Supabase 後台 → SQL Editor → New query → 全部貼上 → Run
-- 可重複執行（已存在的東西會略過）
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- 共用：自動更新 updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- 品牌 ----------
create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  country     text,
  website     text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- 系列（隸屬品牌） ----------
create table if not exists public.series (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand_id       uuid not null references public.brands(id) on delete cascade,
  name           text not null,
  default_medium text,          -- 預設漆性代碼，例如 acrylic / enamel / lacquer / oil
  notes          text,
  sort           int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- 顏料與塗裝輔助劑 ----------
create table if not exists public.paints (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_class     text not null default 'paint' check (item_class in ('paint','auxiliary')),
  brand_id       uuid references public.brands(id) on delete set null,
  series_id      uuid references public.series(id) on delete set null,
  code           text,           -- 色碼，例如 XF-63
  name           text,           -- 色名
  category       text,           -- 種類代碼（一般漆、底漆…或輔助劑種類），由前端定義
  medium         text,           -- 漆性代碼：acrylic / enamel / lacquer / oil / other
  finish         text,           -- 光澤：matt / satin / gloss / metallic / other
  volume_ml      numeric,
  quantity       int  not null default 1 check (quantity >= 0),
  status         text not null default 'full' check (status in ('full','half','low','empty')),
  owned          boolean not null default true,   -- false = 尚未擁有（計畫需要／想買）
  swatch_hex     text,           -- 色票顏色 #RRGGBB
  package_image  text,           -- Storage 路徑
  swatch_image   text,           -- Storage 路徑
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists paints_user_idx       on public.paints (user_id);
create index if not exists paints_brand_code_idx on public.paints (user_id, brand_id, lower(code));

-- ---------- 計畫分類（軍事、戰棋、鋼彈…可自訂） ----------
create table if not exists public.project_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- 計畫 ----------
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text not null,
  category_id  uuid references public.project_categories(id) on delete set null,
  start_date   date,
  end_date     date,
  status       text not null default 'planning' check (status in ('planning','in_progress','paused','done')),
  cover_image  text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- 計畫使用的顏料清單 ----------
create table if not exists public.project_paints (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  paint_id    uuid not null references public.paints(id)   on delete cascade,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (project_id, paint_id)
);

-- ---------- 計畫子項目（例如：甲板） ----------
create table if not exists public.project_sections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  notes       text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- 子項目中的塗層（第 1 層、第 2 層…） ----------
create table if not exists public.section_layers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  section_id  uuid not null references public.project_sections(id) on delete cascade,
  name        text,             -- 例如「底漆」「木甲板色」
  notes       text,             -- 稀釋比例、噴筆／筆塗等
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- 塗層使用的顏料 ----------
create table if not exists public.layer_paints (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  layer_id    uuid not null references public.section_layers(id) on delete cascade,
  paint_id    uuid not null references public.paints(id)         on delete cascade,
  notes       text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- updated_at 觸發器 ----------
do $$
declare t text;
begin
  foreach t in array array['brands','series','paints','projects'] loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$s', t);
    execute format('create trigger %1$s_updated_at before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- 權限：每個人只能看到、修改自己的資料 ----------
do $$
declare t text;
begin
  foreach t in array array['brands','series','paints','project_categories','projects',
                           'project_paints','project_sections','section_layers','layer_paints'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------- 明確授權：只有登入的使用者能存取這些資料表（未登入者完全無權） ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.brands, public.series, public.paints, public.project_categories, public.projects,
  public.project_paints, public.project_sections, public.section_layers, public.layer_paints
  to authenticated;
revoke all on
  public.brands, public.series, public.paints, public.project_categories, public.projects,
  public.project_paints, public.project_sections, public.section_layers, public.layer_paints
  from anon;

-- ---------- 圖片儲存空間 ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('paint-images', 'paint-images', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- 圖片放在「使用者ID/檔名」資料夾下，只能上傳、修改、刪除自己資料夾的檔案
drop policy if exists "paint-images own select" on storage.objects;
drop policy if exists "paint-images own insert" on storage.objects;
drop policy if exists "paint-images own update" on storage.objects;
drop policy if exists "paint-images own delete" on storage.objects;

create policy "paint-images own select" on storage.objects for select to authenticated
  using (bucket_id = 'paint-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "paint-images own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'paint-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "paint-images own update" on storage.objects for update to authenticated
  using (bucket_id = 'paint-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "paint-images own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'paint-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- 完成！
select 'OK：資料表、權限與圖片空間已建立' as result;
