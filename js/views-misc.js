// 購物清單、品牌與系列、設定（匯出匯入、分類、外觀、帳號）
import {
  S, be, add, patch, del, byId, brandName, seriesName, sortedBrands, seriesOf,
  shoppingReason, comparePaints, projectsUsing,
} from './store.js';
import { MEDIUMS, ALL_CATEGORIES } from './constants.js';
import {
  esc, $, openOverlay, closeOverlay, confirmModal, formModal, toast, fail,
  downloadText, pickFile, today, settle,
} from './ui.js';
import { actions, refresh } from './core.js';
import { well, paintTitle, markBought } from './views-library.js';
import { exportMarkdown, planImport, applyImport, exportBackup, importBackup } from './md.js';
import { TABLES } from './constants.js';

// ---------- 購物清單 ----------
const shoppingItems = () => S.paints.filter(shoppingReason).sort(comparePaints);
export const shoppingCount = () => S.paints.filter(shoppingReason).length;

export function renderShopping() {
  const items = shoppingItems();
  if (!items.length) {
    return `<header class="view-head"><h1>購物清單</h1></header>
    <div class="empty">
      <p class="empty-title">目前沒有要買的東西</p>
      <p>把顏料標成「快用完」或「用完」，或在計畫裡加入還沒買的顏料，就會自動出現在這裡。</p>
    </div>`;
  }
  let html = '';
  let last;
  for (const p of items) {
    if (p.brand_id !== last) {
      if (last !== undefined) html += '</ul>';
      html += `<h2 class="brand-head">${esc(brandName(p.brand_id))}<span>${items.filter((x) => x.brand_id === p.brand_id).length}</span></h2><ul class="paint-list">`;
      last = p.brand_id;
    }
    const projects = projectsUsing(p.id).map((pr) => pr.name);
    const sub = [seriesName(p.series_id), ALL_CATEGORIES[p.category], MEDIUMS[p.medium], projects.length ? `用於 ${projects.join('、')}` : ''].filter(Boolean).join('　');
    html += `<li class="shop-row">
      <button class="paint" data-act="paint-open" data-id="${p.id}">
        ${well(p)}
        <span class="paint-main">
          <span class="paint-line"><b class="code">${esc(p.code || '')}</b><span class="pname">${esc(p.name || '')}</span></span>
          <span class="paint-sub">${esc(sub)}</span>
        </span>
        <span class="paint-stock"><span class="tag warn">${shoppingReason(p)}</span></span>
      </button>
      <button class="btn small" data-act="shop-bought" data-id="${p.id}">已買到</button>
    </li>`;
  }
  html += '</ul>';
  return `
  <header class="view-head">
    <h1>購物清單</h1>
    <span class="count">${items.length} 項</span>
    <button class="btn" data-act="shop-copy">複製清單文字</button>
  </header>
  ${html}`;
}

actions['shop-bought'] = async (el) => {
  await markBought(el.dataset.id).catch(fail);
  refresh();
};

actions['shop-copy'] = async () => {
  const lines = [];
  let last;
  for (const p of shoppingItems()) {
    if (p.brand_id !== last) {
      lines.push('', `【${brandName(p.brand_id)}】`);
      last = p.brand_id;
    }
    lines.push(`□ ${[p.code, p.name, seriesName(p.series_id)].filter(Boolean).join(' ')}（${shoppingReason(p)}）`);
  }
  try {
    await navigator.clipboard.writeText(lines.join('\n').trim());
    toast('已複製清單文字');
  } catch {
    toast('無法複製，瀏覽器不允許存取剪貼簿。', 'error');
  }
};

// ---------- 品牌與系列 ----------
export function renderBrands() {
  const cards = sortedBrands()
    .map((b) => {
      const count = S.paints.filter((p) => p.brand_id === b.id).length;
      const series = seriesOf(b.id)
        .map((s) => {
          const n = S.paints.filter((p) => p.series_id === s.id).length;
          return `<li>
            <span class="series-name">${esc(s.name)}</span>
            ${s.default_medium ? `<span class="tag">${MEDIUMS[s.default_medium]}</span>` : ''}
            <span class="muted">${n ? `${n} 項` : ''}</span>
            <span class="row-tools">
              <button class="link" data-act="series-edit" data-id="${s.id}">編輯</button>
              <button class="link danger-text" data-act="series-delete" data-id="${s.id}">刪除</button>
            </span>
          </li>`;
        })
        .join('');
      return `<article class="brand-card">
        <header>
          <h2>${esc(b.name)}</h2>
          <span class="muted">${[b.country, `${count} 項`].filter(Boolean).join('　')}</span>
          <span class="row-tools">
            <button class="link" data-act="brand-edit" data-id="${b.id}">編輯</button>
            <button class="link danger-text" data-act="brand-delete" data-id="${b.id}">刪除</button>
          </span>
        </header>
        ${series ? `<ul class="series-list">${series}</ul>` : '<p class="muted pad">還沒有系列。</p>'}
        <button class="btn small" data-act="series-add" data-id="${b.id}">新增系列</button>
      </article>`;
    })
    .join('');
  return `
  <header class="view-head">
    <h1>品牌與系列</h1>
    <span class="count">${S.brands.length} 個品牌</span>
    <button class="btn primary" data-act="brand-add">新增品牌</button>
  </header>
  <p class="view-note">系列可以設定預設漆性，新增顏料時選了系列就會自動帶入。</p>
  ${cards ? `<div class="brand-grid">${cards}</div>` : '<div class="empty"><p class="empty-title">還沒有品牌</p><button class="btn primary" data-act="brand-add">新增品牌</button></div>'}`;
}

const brandFields = (b = {}) => [
  { name: 'name', label: '品牌名稱', required: true, value: b.name || '' },
  { name: 'country', label: '國家或地區', value: b.country || '' },
];
const seriesFields = (s = {}) => [
  { name: 'name', label: '系列名稱', required: true, value: s.name || '' },
  { name: 'default_medium', label: '預設漆性', type: 'select', value: s.default_medium || '', options: [['', '不固定'], ...Object.entries(MEDIUMS)] },
];

actions['brand-add'] = async () => {
  const r = await formModal({ title: '新增品牌', fields: brandFields(), submit: '新增' });
  if (!r) return;
  await add('brands', { ...r, sort: S.brands.reduce((m, b) => Math.max(m, b.sort), -1) + 1 }).catch(fail);
  refresh();
};
actions['brand-edit'] = async (el) => {
  const b = byId('brands', el.dataset.id);
  const r = await formModal({ title: '編輯品牌', fields: brandFields(b) });
  if (!r) return;
  await patch('brands', b.id, r).catch(fail);
  refresh();
};
actions['brand-delete'] = async (el) => {
  const b = byId('brands', el.dataset.id);
  const count = S.paints.filter((p) => p.brand_id === b.id).length;
  const ok = await confirmModal({
    title: `刪除品牌「${b.name}」？`,
    body: `它的系列會一併刪除。${count ? `這個品牌的 ${count} 項庫存不會被刪除，但會變成「未指定品牌」。` : ''}`,
    ok: '刪除品牌',
    danger: true,
  });
  if (!ok) return;
  await del('brands', b.id).catch(fail);
  refresh();
};
actions['series-add'] = async (el) => {
  const brandId = el.dataset.id;
  const r = await formModal({ title: `新增 ${brandName(brandId)} 的系列`, fields: seriesFields(), submit: '新增' });
  if (!r) return;
  await add('series', { brand_id: brandId, ...r, sort: seriesOf(brandId).reduce((m, s) => Math.max(m, s.sort), -1) + 1 }).catch(fail);
  refresh();
};
actions['series-edit'] = async (el) => {
  const s = byId('series', el.dataset.id);
  const r = await formModal({ title: '編輯系列', fields: seriesFields(s) });
  if (!r) return;
  await patch('series', s.id, r).catch(fail);
  refresh();
};
actions['series-delete'] = async (el) => {
  const s = byId('series', el.dataset.id);
  const count = S.paints.filter((p) => p.series_id === s.id).length;
  const ok = await confirmModal({
    title: `刪除系列「${s.name}」？`,
    body: count ? `這個系列的 ${count} 項庫存不會被刪除，但系列欄位會清空。` : '',
    ok: '刪除系列',
    danger: true,
  });
  if (!ok) return;
  await del('series', s.id).catch(fail);
  refresh();
};

// ---------- 設定 ----------
export const getTheme = () => {
  try {
    return localStorage.getItem('pi-theme') || 'dark';
  } catch {
    return 'dark';
  }
};
export function applyTheme(theme = getTheme()) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function renderSettings(email) {
  const theme = getTheme();
  const cats = [...S.project_categories].sort((a, b) => a.sort - b.sort);
  return `
  <header class="view-head"><h1>設定</h1></header>

  <section class="block">
    <h2>資料管理</h2>
    <a class="nav-row" href="#/brands"><span>品牌與系列</span><span class="muted">${S.brands.length} 個品牌，${S.series.length} 個系列　›</span></a>
  </section>

  <section class="block">
    <h2>計畫分類</h2>
    <ul class="cat-list">${cats.map((c) => `<li><span>${esc(c.name)}</span><span class="row-tools"><button class="link" data-act="cat-edit" data-id="${c.id}">重新命名</button><button class="link danger-text" data-act="cat-delete" data-id="${c.id}">刪除</button></span></li>`).join('')}</ul>
    <button class="btn small" data-act="cat-add">新增分類</button>
  </section>

  <section class="block">
    <h2>請 AI 幫忙修改（Markdown）</h2>
    <p class="muted">匯出一份 md 檔，交給 AI 批次修改後再匯入。檔案開頭有寫明修改規則。匯入前會先讓你看到會變動哪些資料。</p>
    <div class="btn-row">
      <button class="btn" data-act="md-export">匯出 md 檔</button>
      <button class="btn" data-act="md-import">匯入 md 檔</button>
    </div>
  </section>

  <section class="block">
    <h2>完整備份</h2>
    <p class="muted">備份檔包含所有顏料、品牌、計畫與塗層紀錄。圖片存在雲端，不包含在備份檔裡。</p>
    <div class="btn-row">
      <button class="btn" data-act="backup-export">下載備份檔</button>
      <button class="btn" data-act="backup-import">從備份檔還原</button>
    </div>
  </section>

  <section class="block">
    <h2>外觀</h2>
    <div class="segmented">${[['dark', '深色'], ['light', '淺色'], ['auto', '跟隨系統']].map(([k, v]) => `<button data-act="theme" data-theme-value="${k}" class="${theme === k ? 'on' : ''}" aria-pressed="${theme === k}">${v}</button>`).join('')}</div>
  </section>

  <section class="block">
    <h2>帳號</h2>
    <p>${esc(email || '')}</p>
    ${be.demo ? '<p class="muted">試用模式的資料只存在這個瀏覽器，不會同步到其他裝置。</p><a class="btn" href="./">離開試用模式</a>' : '<button class="btn" data-act="sign-out">登出</button>'}
  </section>`;
}

actions['theme'] = (el) => {
  try {
    localStorage.setItem('pi-theme', el.dataset.themeValue);
  } catch { /* 無法儲存時只套用這一次 */ }
  applyTheme(el.dataset.themeValue);
  refresh();
};

actions['cat-add'] = async () => {
  const r = await formModal({ title: '新增計畫分類', fields: [{ name: 'name', label: '分類名稱', required: true, placeholder: '例如 科幻' }], submit: '新增' });
  if (!r) return;
  await add('project_categories', { name: r.name, sort: S.project_categories.reduce((m, c) => Math.max(m, c.sort), -1) + 1 }).catch(fail);
  refresh();
};
actions['cat-edit'] = async (el) => {
  const c = byId('project_categories', el.dataset.id);
  const r = await formModal({ title: '重新命名分類', fields: [{ name: 'name', label: '分類名稱', required: true, value: c.name }] });
  if (!r) return;
  await patch('project_categories', c.id, r).catch(fail);
  refresh();
};
actions['cat-delete'] = async (el) => {
  const c = byId('project_categories', el.dataset.id);
  const n = S.projects.filter((p) => p.category_id === c.id).length;
  const ok = await confirmModal({ title: `刪除分類「${c.name}」？`, body: n ? `${n} 個計畫會變成「未分類」。` : '', ok: '刪除', danger: true });
  if (!ok) return;
  await del('project_categories', c.id).catch(fail);
  refresh();
};

actions['md-export'] = () => {
  downloadText(`paint-inventory-${today()}.md`, exportMarkdown(), 'text/markdown');
  toast('已匯出 md 檔');
};

actions['md-import'] = async () => {
  const file = await pickFile('.md,.markdown,.txt,text/markdown,text/plain');
  if (!file) return;
  const plan = planImport(await file.text());
  const total = plan.newBrands.length + plan.newSeries.length + plan.creates.length + plan.updates.length + plan.deletes.length;
  const list = (title, rows) => (rows.length ? `<h3>${title}</h3><ul class="plain">${rows.slice(0, 40).map((r) => `<li>${r}</li>`).join('')}${rows.length > 40 ? `<li class="muted">…還有 ${rows.length - 40} 項</li>` : ''}</ul>` : '');
  const label = (p) => esc([brandName(p.brand_id), p.code, p.name].filter(Boolean).join(' '));
  let confirmed = false;
  await new Promise((resolve) => {
    const el = openOverlay(
      `<div class="dialog import-preview">
        <h2>匯入前確認</h2>
        ${total ? `<p>這份檔案會造成以下變動：</p>` : '<p>這份檔案和目前的資料相同，沒有需要變動的地方。</p>'}
        <div class="import-body">
          ${list(`新增 ${plan.creates.length} 項`, plan.creates.map((p) => esc([p.code, p.name].filter(Boolean).join(' '))))}
          ${list(`修改 ${plan.updates.length} 項`, plan.updates.map((u) => `${label(u.paint)}<span class="muted">　改了 ${Object.keys(u.changes).length} 個欄位</span>`))}
          ${list(`刪除 ${plan.deletes.length} 項`, plan.deletes.map(label))}
          ${list(`新增 ${plan.newBrands.length} 個品牌`, plan.newBrands.map((b) => esc(b.name)))}
          ${list(`新增 ${plan.newSeries.length} 個系列`, plan.newSeries.map((s) => esc(s.name)))}
          ${list(`有 ${plan.problems.length} 個地方需要注意`, plan.problems.map(esc))}
        </div>
        <div class="dialog-actions">
          <button class="btn" data-act="ov-close">取消</button>
          ${total ? `<button class="btn primary" data-ok>套用變動</button>` : ''}
        </div>
      </div>`,
      { onClose: resolve },
    );
    $('[data-ok]', el)?.addEventListener('click', () => {
      confirmed = true;
      closeOverlay();
    });
  });
  await settle();
  if (!confirmed) return;
  try {
    await applyImport(plan);
    toast('已套用匯入的變動');
  } catch (e) {
    fail(e);
  }
  refresh();
};

actions['backup-export'] = () => {
  downloadText(`paint-inventory-backup-${today()}.json`, exportBackup(), 'application/json');
  toast('已下載備份檔');
};

actions['backup-import'] = async () => {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  const ok = await confirmModal({
    title: '從備份檔還原？',
    body: '備份檔裡的資料會寫回系統：相同的項目會被備份檔的內容覆蓋，備份之後才新增的項目會保留。',
    ok: '還原',
  });
  if (!ok) return;
  try {
    const n = await importBackup(await file.text(), TABLES);
    toast(`已還原 ${n} 筆資料`);
  } catch (e) {
    fail(e);
  }
  refresh();
};

export { paintTitle };
