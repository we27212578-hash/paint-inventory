-- =============================================================
-- 更新 002：色階（例如 Citadel Tone Pro 每個顏色有 1～5 號）
-- 用法：Supabase 後台 → SQL Editor → New query → 全部貼上 → Run
-- 可重複執行
-- =============================================================

-- 系列可以設定「色階數量」；顏料可以記錄自己是第幾號色階
alter table public.series add column if not exists tone_count int check (tone_count between 2 and 12);
alter table public.paints add column if not exists tone int check (tone between 1 and 12);

-- 替已經有 Citadel 品牌的帳號補上 Tone Pro 系列
insert into public.series (user_id, brand_id, name, default_medium, tone_count, sort)
select b.user_id, b.id, 'Tone Pro', 'acrylic', 5, 8
from public.brands b
where lower(b.name) = 'citadel'
  and not exists (
    select 1 from public.series s where s.brand_id = b.id and lower(s.name) = 'tone pro'
  );

-- 如果之前已經手動建了 Tone Pro 系列，補上色階數量
update public.series set tone_count = 5 where lower(name) = 'tone pro' and tone_count is null;

select 'OK：色階欄位與 Tone Pro 系列已建立' as result;
