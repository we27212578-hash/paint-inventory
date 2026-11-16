// 官方色表：依「品牌｜系列」載入對照表，用來在輸入色碼時自動帶出名稱。
// 資料檔放在 catalog/ 資料夾，只收錄原廠公布的色碼與名稱。
import { normCode } from './store.js';

let index = null;
const cache = new Map();

function build(data) {
  const byCode = new Map(data.items.map((it) => [normCode(it.code), it]));
  const byName = new Map(data.items.map((it) => [it.name.toLowerCase(), it]));
  return { ...data, byCode, byName };
}

export async function loadCatalog(brand, series) {
  if (!brand || !series) return null;
  index ??= await fetch('catalog/index.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const file = index[`${brand}|${series}`.toLowerCase()];
  if (!file) return null;
  if (!cache.has(file)) {
    cache.set(file, fetch(`catalog/${file}`).then((r) => r.json()).then(build).catch(() => null));
  }
  return cache.get(file);
}

// 用色碼找：完全相符優先；只打數字（例如 11108）時，比對結尾
export function findByCode(catalog, input) {
  const n = normCode(input);
  if (!catalog || !n) return null;
  if (catalog.byCode.has(n)) return catalog.byCode.get(n);
  if (n.length < 3) return null;
  const hits = [...catalog.byCode.entries()].filter(([code]) => code.endsWith(n));
  return hits.length === 1 ? hits[0][1] : null;
}
