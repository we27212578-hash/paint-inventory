// 記憶體中的資料與存取函式。資料量是個人規模，登入後一次全部載入。
import { createBackend } from './backend.js';
import { TABLES, SEED_BRANDS, SEED_PROJECT_CATEGORIES } from './constants.js';

export const be = createBackend();

export const S = Object.fromEntries(TABLES.map((t) => [t, []]));

export const uuid = () => crypto.randomUUID();

export async function loadAll() {
  const lists = await Promise.all(TABLES.map((t) => be.list(t)));
  TABLES.forEach((t, i) => (S[t] = lists[i]));
}

export async function add(table, row) {
  const [made] = await be.insert(table, [{ id: uuid(), ...row }]);
  S[table].push(made);
  return made;
}

export async function patch(table, id, changes) {
  const row = await be.update(table, id, changes);
  const i = S[table].findIndex((r) => r.id === id);
  if (i >= 0) S[table][i] = row;
  return row;
}

// 刪除會連動其他資料表（例如刪品牌會一併刪系列），所以刪完重新載入
export async function del(table, id) {
  await be.remove(table, id);
  await loadAll();
}

export const byId = (table, id) => S[table].find((r) => r.id === id) || null;

// 第一次使用：建立預設品牌、系列與計畫分類
export async function seedIfEmpty() {
  if (S.brands.length || S.paints.length) return false;
  const brands = [];
  const series = [];
  SEED_BRANDS.forEach((b, bi) => {
    const id = uuid();
    brands.push({ id, name: b.name, country: b.country || null, sort: bi });
    b.series.forEach(([name, medium], si) => {
      series.push({ id: uuid(), brand_id: id, name, default_medium: medium, sort: si });
    });
  });
  await be.insert('brands', brands);
  if (series.length) await be.insert('series', series);
  if (!S.project_categories.length) {
    await be.insert(
      'project_categories',
      SEED_PROJECT_CATEGORIES.map((name, i) => ({ id: uuid(), name, sort: i })),
    );
  }
  await loadAll();
  return true;
}

// ---------- 查詢輔助 ----------
export const brandName = (id) => byId('brands', id)?.name || '未指定品牌';
export const seriesName = (id) => byId('series', id)?.name || '';

export const sortedBrands = () =>
  [...S.brands].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
export const seriesOf = (brandId) =>
  S.series.filter((s) => s.brand_id === brandId).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

export const normCode = (code) => (code || '').toLowerCase().replace(/[\s\-_.]/g, '');

// 找出同品牌、同色碼的既有顏料（防止重複購買）
export function findDuplicates({ id, brand_id, code }) {
  const n = normCode(code);
  if (!n) return [];
  return S.paints.filter((p) => p.id !== id && p.brand_id === (brand_id || null) && normCode(p.code) === n);
}

export function comparePaints(a, b) {
  return (
    brandName(a.brand_id).localeCompare(brandName(b.brand_id)) ||
    seriesName(a.series_id).localeCompare(seriesName(b.series_id)) ||
    (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }) ||
    (a.name || '').localeCompare(b.name || '')
  );
}

export const projectsUsing = (paintId) => {
  const ids = new Set(S.project_paints.filter((pp) => pp.paint_id === paintId).map((pp) => pp.project_id));
  return S.projects.filter((p) => ids.has(p.id));
};

// 需要購買的理由：尚未擁有、用完、快用完
export function shoppingReason(p) {
  if (!p.owned) return '尚未擁有';
  if (p.status === 'empty') return '用完';
  if (p.status === 'low') return '快用完';
  return null;
}
