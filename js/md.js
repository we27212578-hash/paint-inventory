// Markdown 匯出／匯入。格式說明見 docs/AI-GUIDE.md
import { S, be, uuid, loadAll, brandName, seriesName, sortedBrands, seriesOf, comparePaints, byId } from './store.js';
import {
  ITEM_CLASSES, ALL_CATEGORIES, MEDIUMS, FINISHES, STATUSES, PROJECT_STATUSES,
} from './constants.js';
import { today } from './ui.js';

const PAINT_COLUMNS = ['ID', '類別', '品牌', '系列', '色碼', '色名', '種類', '漆性', '光澤', '容量ml', '數量', '狀態', '擁有', '色票', '備註'];

const cell = (v) => String(v ?? '').replace(/\|/g, '｜').replace(/\s*\n\s*/g, ' ').trim();
const row = (cells) => `| ${cells.map(cell).join(' | ')} |`;
const shortId = (id) => id.slice(0, 8);
const paintLabel = (p) => [brandName(p.brand_id), p.code, p.name].filter(Boolean).join(' ');

export function exportMarkdown() {
  const out = [];
  out.push(`# 顏料庫存`, '', `<!-- paint-inventory-md v1 -->`, `匯出日期：${today()}`, '');
  out.push(
    '> 修改規則（給 AI 或手動編輯時參考）：',
    '> - 「顏料與輔助劑」表格可以修改後匯入回系統。ID 欄請勿更動；新增一列時 ID 留空。',
    '> - 要刪除某一列，把「狀態」改成「刪除」。直接把整列拿掉不會刪除資料。',
    `> - 類別：${Object.values(ITEM_CLASSES).join('、')}`,
    `> - 種類：${Object.values(ALL_CATEGORIES).join('、')}`,
    `> - 漆性：${Object.values(MEDIUMS).join('、')}`,
    `> - 光澤：${Object.values(FINISHES).join('、')}`,
    `> - 狀態：${Object.values(STATUSES).join('、')}、刪除`,
    '> - 擁有：是、否（否 = 還沒買，會出現在購物清單）',
    '> - 色票：#RRGGBB 格式的顏色，可留空',
    '> - 品牌或系列填了系統裡沒有的名稱時，匯入會自動建立。',
    '> - 「計畫」一節只供閱讀，匯入時不會讀取。',
    '',
  );

  out.push('## 品牌與系列', '', row(['品牌', '系列', '預設漆性']), row(['---', '---', '---']));
  for (const b of sortedBrands()) {
    const list = seriesOf(b.id);
    if (!list.length) out.push(row([b.name, '', '']));
    for (const s of list) out.push(row([b.name, s.name, MEDIUMS[s.default_medium] || '']));
  }
  out.push('');

  out.push('## 顏料與輔助劑', '', row(PAINT_COLUMNS), row(PAINT_COLUMNS.map(() => '---')));
  for (const p of [...S.paints].sort(comparePaints)) {
    out.push(
      row([
        shortId(p.id),
        ITEM_CLASSES[p.item_class],
        p.brand_id ? brandName(p.brand_id) : '',
        seriesName(p.series_id),
        p.code,
        p.name,
        ALL_CATEGORIES[p.category] || '',
        MEDIUMS[p.medium] || '',
        FINISHES[p.finish] || '',
        p.volume_ml ?? '',
        p.quantity,
        STATUSES[p.status],
        p.owned ? '是' : '否',
        p.swatch_hex || '',
        p.notes,
      ]),
    );
  }
  out.push('');

  out.push('## 計畫', '');
  if (!S.projects.length) out.push('（尚無計畫）', '');
  for (const pr of S.projects) {
    out.push(`### ${cell(pr.name)}`, '');
    out.push(`- 分類：${byId('project_categories', pr.category_id)?.name || '未分類'}`);
    out.push(`- 日期：${pr.start_date || '未定'} ～ ${pr.end_date || '未定'}`);
    out.push(`- 狀態：${PROJECT_STATUSES[pr.status]}`);
    if (pr.notes) out.push(`- 備註：${cell(pr.notes)}`);
    const paints = S.project_paints.filter((pp) => pp.project_id === pr.id).map((pp) => byId('paints', pp.paint_id)).filter(Boolean);
    out.push(`- 使用顏料：${paints.map((p) => paintLabel(p) + (p.owned ? '' : '（尚未擁有）')).join('；') || '無'}`, '');
    const sections = S.project_sections.filter((s) => s.project_id === pr.id).sort((a, b) => a.sort - b.sort);
    for (const sec of sections) {
      out.push(`#### ${cell(sec.name)}`, '');
      const layers = S.section_layers.filter((l) => l.section_id === sec.id).sort((a, b) => a.sort - b.sort);
      layers.forEach((l, i) => {
        const lp = S.layer_paints.filter((x) => x.layer_id === l.id).sort((a, b) => a.sort - b.sort).map((x) => byId('paints', x.paint_id)).filter(Boolean);
        const parts = [l.name, lp.map(paintLabel).join('、'), l.notes].filter(Boolean).map(cell);
        out.push(`${i + 1}. ${parts.join('｜')}`);
      });
      out.push('');
    }
  }
  return out.join('\n');
}

// ---------- 匯入 ----------
const reverse = (map) => Object.fromEntries(Object.entries(map).flatMap(([k, v]) => [[v, k], [k, k]]));
const R_CLASS = reverse(ITEM_CLASSES);
const R_CAT = reverse(ALL_CATEGORIES);
const R_MEDIUM = reverse(MEDIUMS);
const R_FINISH = reverse(FINISHES);
const R_STATUS = reverse(STATUSES);

function parseTables(text) {
  const tables = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) {
      current = null;
      continue;
    }
    const cells = t.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    if (!current) {
      current = { header: cells, rows: [] };
      tables.push(current);
    } else current.rows.push(cells);
  }
  return tables;
}

// 解析 md，回傳「打算做的變更」，由畫面確認後才真的寫入
export function planImport(text) {
  const plan = { newBrands: [], newSeries: [], creates: [], updates: [], deletes: [], problems: [] };
  const tables = parseTables(text);
  const paintTable = tables.find((t) => t.header.includes('色碼') && t.header.includes('類別'));
  if (!paintTable) {
    plan.problems.push('找不到「顏料與輔助劑」表格（需要有「類別」和「色碼」欄位）。');
    return plan;
  }

  const brandIds = new Map(S.brands.map((b) => [b.name.toLowerCase(), b.id]));
  const seriesIds = new Map(S.series.map((s) => [`${s.brand_id}|${s.name.toLowerCase()}`, s.id]));
  const ensureBrand = (name) => {
    if (!name) return null;
    const key = name.toLowerCase();
    if (!brandIds.has(key)) {
      const id = uuid();
      brandIds.set(key, id);
      plan.newBrands.push({ id, name, sort: S.brands.length + plan.newBrands.length });
    }
    return brandIds.get(key);
  };
  const ensureSeries = (brandId, name, medium) => {
    if (!name || !brandId) return null;
    const key = `${brandId}|${name.toLowerCase()}`;
    if (!seriesIds.has(key)) {
      const id = uuid();
      seriesIds.set(key, id);
      plan.newSeries.push({ id, brand_id: brandId, name, default_medium: medium || null, sort: 99 });
    }
    return seriesIds.get(key);
  };

  // 品牌與系列表（選用）
  const brandTable = tables.find((t) => t.header.includes('品牌') && t.header.includes('預設漆性'));
  if (brandTable) {
    const bi = brandTable.header.indexOf('品牌');
    const si = brandTable.header.indexOf('系列');
    const mi = brandTable.header.indexOf('預設漆性');
    for (const r of brandTable.rows) ensureSeries(ensureBrand(r[bi]), r[si], R_MEDIUM[r[mi]]);
  }

  const col = Object.fromEntries(paintTable.header.map((h, i) => [h, i]));
  const get = (r, name) => (col[name] === undefined ? '' : r[col[name]] || '');
  const byShort = new Map(S.paints.map((p) => [shortId(p.id), p]));
  const byFull = new Map(S.paints.map((p) => [p.id, p]));

  paintTable.rows.forEach((r, index) => {
    const where = `第 ${index + 1} 列（${get(r, '色碼') || get(r, '色名') || '未命名'}）`;
    const idCell = get(r, 'ID');
    const existing = idCell ? byFull.get(idCell) || byShort.get(idCell) : null;
    if (idCell && !existing) {
      plan.problems.push(`${where}：ID「${idCell}」在系統裡找不到，已略過。新增的列請把 ID 留空。`);
      return;
    }
    const statusText = get(r, '狀態');
    if (statusText === '刪除') {
      if (existing) plan.deletes.push(existing);
      return;
    }
    const lookup = (map, value, label) => {
      if (!value) return null;
      if (map[value] === undefined) {
        plan.problems.push(`${where}：${label}「${value}」不是可用的選項，已留空。`);
        return null;
      }
      return map[value];
    };
    const brand_id = ensureBrand(get(r, '品牌'));
    const medium = lookup(R_MEDIUM, get(r, '漆性'), '漆性');
    const num = (v) => (v === '' || isNaN(Number(v)) ? null : Number(v));
    const hex = get(r, '色票');
    const data = {
      item_class: R_CLASS[get(r, '類別')] || 'paint',
      brand_id,
      series_id: ensureSeries(brand_id, get(r, '系列'), medium),
      code: get(r, '色碼') || null,
      name: get(r, '色名') || null,
      category: lookup(R_CAT, get(r, '種類'), '種類'),
      medium,
      finish: lookup(R_FINISH, get(r, '光澤'), '光澤'),
      volume_ml: num(get(r, '容量ml')),
      quantity: Math.max(0, Math.round(num(get(r, '數量')) ?? 1)),
      status: R_STATUS[statusText] || 'full',
      owned: get(r, '擁有') !== '否',
      swatch_hex: /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : null,
      notes: get(r, '備註') || null,
    };
    if (!data.code && !data.name) {
      plan.problems.push(`${where}：色碼和色名都是空的，已略過。`);
      return;
    }
    if (!existing) {
      plan.creates.push({ id: uuid(), ...data });
      return;
    }
    const changes = {};
    for (const [k, v] of Object.entries(data)) {
      const old = existing[k] ?? null;
      const same = k === 'volume_ml' ? Number(old) === Number(v) && (old === null) === (v === null) : old === v;
      if (!same) changes[k] = v;
    }
    if (Object.keys(changes).length) plan.updates.push({ paint: existing, changes });
  });
  return plan;
}

export async function applyImport(plan) {
  if (plan.newBrands.length) await be.insert('brands', plan.newBrands);
  if (plan.newSeries.length) await be.insert('series', plan.newSeries);
  if (plan.creates.length) await be.insert('paints', plan.creates);
  for (const u of plan.updates) await be.update('paints', u.paint.id, u.changes);
  for (const p of plan.deletes) await be.remove('paints', p.id);
  await loadAll();
}

// ---------- 完整備份（JSON） ----------
export function exportBackup() {
  const data = {};
  for (const [table, rows] of Object.entries(S)) {
    data[table] = rows.map(({ user_id, ...rest }) => rest);
  }
  return JSON.stringify({ format: 'paint-inventory-backup', version: 1, exported_at: new Date().toISOString(), data }, null, 2);
}

export async function importBackup(text, tables) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('這不是有效的備份檔（JSON 格式錯誤）。');
  }
  if (parsed.format !== 'paint-inventory-backup' || !parsed.data) throw new Error('這不是本系統匯出的備份檔。');
  let count = 0;
  for (const table of tables) {
    const rows = (parsed.data[table] || []).map(({ user_id, ...rest }) => rest);
    for (let i = 0; i < rows.length; i += 200) {
      await be.upsert(table, rows.slice(i, i + 200));
    }
    count += rows.length;
  }
  await loadAll();
  return count;
}
