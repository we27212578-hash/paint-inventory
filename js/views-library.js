// 顏料庫／輔助劑：清單、過濾器、詳細資料、新增與編輯表單、顏料選擇器
import {
  S, be, add, patch, del, byId, brandName, seriesName, sortedBrands, seriesOf,
  findDuplicates, comparePaints, projectsUsing, normCode, paintName,
} from './store.js';
import { tonePreset, presetHex } from './presets.js';
import { loadCatalog, findByCode } from './catalog.js';
import {
  ITEM_CLASSES, PAINT_CATEGORIES, AUX_CATEGORIES, ALL_CATEGORIES, CATEGORY_HINTS,
  MEDIUMS, MEDIUM_GROUPS, FINISHES, STATUSES,
} from './constants.js';
import {
  esc, $, $$, openOverlay, closeOverlay, confirmModal, formModal, toast, fail,
  resizeImage, colorAt, validHex, settle,
} from './ui.js';
import { actions, refresh } from './core.js';

const newFilter = () => ({
  q: '', brand: new Set(), series: new Set(), category: new Set(),
  medium: new Set(), finish: new Set(), status: new Set(),
});
const filters = { paint: newFilter(), auxiliary: newFilter() };
let currentClass = 'paint';

const GROUP_LABELS = { brand: '品牌', series: '系列', category: '種類', medium: '漆性', finish: '光澤', status: '庫存狀態' };
const STATUS_OPTIONS = { ...STATUSES, unowned: '尚未擁有' };

// ---------- 共用小元件 ----------
export const well = (p, size = '') =>
  validHex(p?.swatch_hex)
    ? `<span class="well ${size}" style="--c:${p.swatch_hex}"></span>`
    : `<span class="well none ${size}" title="尚未設定色票"></span>`;

export const paintTitle = (p) => [p.code, paintName(p)].filter(Boolean).join(' ') || '未命名';

const level = (p) =>
  p.owned
    ? `<span class="lvl lvl-${p.status}" title="${STATUSES[p.status]}"><i></i><i></i><i></i></span>`
    : `<span class="tag warn">尚未擁有</span>`;

const familyKey = (p) => `${p.series_id}|${(p.name || '').trim().toLowerCase()}`;

// 深色色票用淺色字，淺色色票用深色字
function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#1c2726' : '#f4f2ea';
}

function toneSlot(p, i) {
  const state = !p.owned ? 'unowned' : p.status === 'empty' || p.status === 'low' ? 'low' : '';
  const stateText = !p.owned ? '尚未擁有' : `${p.quantity} 罐，${STATUSES[p.status]}`;
  const style = validHex(p.swatch_hex) && p.owned ? `style="--c:${p.swatch_hex};--ink:${inkFor(p.swatch_hex)}"` : '';
  return `<button class="tone have ${state}" ${style} data-act="paint-open" data-id="${p.id}" aria-label="${esc(paintName(p))}：${stateText}" title="${stateText}">${i}</button>`;
}

function optionCounts(cls, key, valueOf) {
  const counts = new Map();
  for (const p of S.paints) {
    if (p.item_class !== cls) continue;
    const v = valueOf(p);
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return counts;
}

function matches(p, f) {
  if (f.brand.size && !f.brand.has(p.brand_id)) return false;
  if (f.series.size && !f.series.has(p.series_id)) return false;
  if (f.category.size && !f.category.has(p.category)) return false;
  if (f.medium.size && !f.medium.has(p.medium)) return false;
  if (f.finish.size && !f.finish.has(p.finish)) return false;
  if (f.status.size && !f.status.has(p.owned ? p.status : 'unowned')) return false;
  const q = f.q.trim().toLowerCase();
  if (q) {
    const hay = [p.code, paintName(p), brandName(p.brand_id), seriesName(p.series_id), p.notes, ALL_CATEGORIES[p.category]]
      .filter(Boolean).join(' ').toLowerCase();
    const code = normCode(p.code);
    for (const token of q.split(/\s+/)) {
      if (!hay.includes(token) && !(normCode(token) && code.includes(normCode(token)))) return false;
    }
  }
  return true;
}

const activeCount = (f) => ['brand', 'series', 'category', 'medium', 'finish', 'status'].reduce((n, k) => n + f[k].size, 0);

// ---------- 過濾器面板 ----------
function chip(group, value, label, count, on) {
  return `<button class="chip ${on ? 'on' : ''}" data-act="filter-toggle" data-group="${group}" data-value="${esc(value)}" aria-pressed="${on}">${esc(label)}${count ? `<span class="n">${count}</span>` : ''}</button>`;
}

function filterPanel(cls) {
  const f = filters[cls];
  const group = (key, body) => `<section class="fgroup"><h3>${GROUP_LABELS[key]}</h3>${body}</section>`;
  const chips = (key, entries, counts) =>
    `<div class="chips">${entries.map(([v, label]) => chip(key, v, label, counts.get(v), f[key].has(v))).join('')}</div>`;

  const brandCounts = optionCounts(cls, 'brand', (p) => p.brand_id);
  let html = group('brand', chips('brand', sortedBrands().map((b) => [b.id, b.name]), brandCounts));

  if (f.brand.size) {
    const seriesCounts = optionCounts(cls, 'series', (p) => p.series_id);
    const list = [...f.brand].flatMap((id) => seriesOf(id));
    if (list.length) {
      const multi = f.brand.size > 1;
      html += group('series', chips('series', list.map((s) => [s.id, multi ? `${brandName(s.brand_id)}｜${s.name}` : s.name]), seriesCounts));
    }
  }

  const cats = cls === 'paint' ? PAINT_CATEGORIES : AUX_CATEGORIES;
  html += group('category', chips('category', Object.entries(cats), optionCounts(cls, 'category', (p) => p.category)));

  const mediumCounts = optionCounts(cls, 'medium', (p) => p.medium);
  html += group(
    'medium',
    MEDIUM_GROUPS.map(
      (g) => `<div class="chips-row">${g.label ? `<span class="sub">${g.label}</span>` : ''}<div class="chips">${g.items
        .map((m) => chip('medium', m, MEDIUMS[m], mediumCounts.get(m), f.medium.has(m))).join('')}</div></div>`,
    ).join(''),
  );

  if (cls === 'paint') {
    html += group('finish', chips('finish', Object.entries(FINISHES), optionCounts(cls, 'finish', (p) => p.finish)));
  }
  html += group('status', chips('status', Object.entries(STATUS_OPTIONS), optionCounts(cls, 'status', (p) => (p.owned ? p.status : 'unowned'))));
  return html;
}

function listHtml(cls) {
  const f = filters[cls];
  const all = S.paints.filter((p) => p.item_class === cls);
  const noun = ITEM_CLASSES[cls];
  if (!all.length) {
    return `<div class="empty">
      <p class="empty-title">還沒有任何${noun}</p>
      <p>${cls === 'paint' ? '把手邊的顏料建檔，之後在店裡搜尋色碼，就知道家裡有沒有。' : '稀釋液、緩乾劑、洗筆液這類用品放在這裡。'}</p>
      <button class="btn primary" data-act="paint-new">新增${noun}</button>
    </div>`;
  }
  const shown = all.filter((p) => matches(p, f)).sort(comparePaints);
  if (!shown.length) {
    return `<div class="empty">
      <p class="empty-title">沒有符合的${noun}</p>
      <p>${f.q ? `庫存裡找不到「${esc(f.q)}」。` : '目前的篩選條件沒有結果。'}</p>
      <button class="btn" data-act="filter-clear">清除搜尋與篩選</button>
    </div>`;
  }
  let html = '';
  let lastBrand;
  const doneFamilies = new Set();
  for (const p of shown) {
    if (p.brand_id !== lastBrand) {
      if (lastBrand !== undefined) html += '</ul>';
      const n = shown.filter((x) => x.brand_id === p.brand_id).length;
      html += `<h2 class="brand-head">${esc(brandName(p.brand_id))}<span>${n}</span></h2><ul class="paint-list">`;
      lastBrand = p.brand_id;
    }
    const tags = [ALL_CATEGORIES[p.category], MEDIUMS[p.medium], cls === 'paint' ? FINISHES[p.finish] : null].filter(Boolean);
    const toneCount = p.tone ? byId('series', p.series_id)?.tone_count : null;
    if (toneCount) {
      // 有色階的系列：同一個顏色合併成一列，用格子顯示每一號有沒有
      const key = familyKey(p);
      if (doneFamilies.has(key)) continue;
      doneFamilies.add(key);
      const family = all.filter((x) => x.tone && familyKey(x) === key);
      const slots = [];
      for (let i = 1; i <= toneCount; i++) {
        const x = family.find((f) => Number(f.tone) === i);
        slots.push(x ? toneSlot(x, i) : `<button class="tone missing" data-act="tone-add" data-series="${p.series_id}" data-name="${esc(p.name || '')}" data-tone="${i}" aria-label="${esc(p.name || '')} ${i} 號：沒有，點一下新增">${i}</button>`);
      }
      const have = family.filter((f) => f.owned).length;
      html += `<li class="tone-row">
        <span class="paint-main">
          <span class="paint-line"><span class="pname fam">${esc(p.name || '未命名')}</span></span>
          <span class="paint-sub">${esc([seriesName(p.series_id), ...tags, `有 ${have} / ${toneCount}`].filter(Boolean).join('　'))}</span>
        </span>
        <span class="tones">${slots.join('')}</span>
      </li>`;
      continue;
    }
    html += `<li><button class="paint" data-act="paint-open" data-id="${p.id}">
      ${well(p)}
      <span class="paint-main">
        <span class="paint-line"><b class="code">${esc(p.code || '')}</b><span class="pname">${esc(paintName(p) || (p.code ? '' : '未命名'))}</span></span>
        <span class="paint-sub">${esc([seriesName(p.series_id), ...tags].filter(Boolean).join('　'))}</span>
      </span>
      <span class="paint-stock">${p.owned ? `<span class="qty">×${p.quantity}</span>` : ''}${level(p)}</span>
    </button></li>`;
  }
  return html + '</ul>';
}

function activeChips(cls) {
  const f = filters[cls];
  const label = (group, v) =>
    group === 'brand' ? brandName(v)
      : group === 'series' ? seriesName(v)
        : group === 'category' ? ALL_CATEGORIES[v]
          : group === 'medium' ? MEDIUMS[v]
            : group === 'finish' ? FINISHES[v]
              : STATUS_OPTIONS[v];
  const items = [];
  for (const group of Object.keys(GROUP_LABELS)) {
    for (const v of f[group]) {
      items.push(`<button class="chip on removable" data-act="filter-toggle" data-group="${group}" data-value="${esc(v)}" title="移除這個條件">${esc(label(group, v))}<span class="x" aria-hidden="true">×</span></button>`);
    }
  }
  return items.length ? `${items.join('')}<button class="link" data-act="filter-clear">全部清除</button>` : '';
}

export function renderLibrary(cls) {
  currentClass = cls;
  const f = filters[cls];
  const noun = ITEM_CLASSES[cls];
  const total = S.paints.filter((p) => p.item_class === cls).length;
  return `
  <header class="view-head">
    <h1>${cls === 'paint' ? '顏料庫' : '塗裝輔助劑'}</h1>
    <span class="count">${total} 項</span>
    <button class="btn primary" data-act="paint-new">新增${noun}</button>
  </header>
  <div class="lib">
    <aside class="filters" id="filters">
      <div class="filters-head"><h2>篩選</h2><button class="btn small" data-act="filters-close">完成</button></div>
      <div id="filter-body">${filterPanel(cls)}</div>
    </aside>
    <div class="filters-scrim" data-act="filters-close"></div>
    <section class="lib-main">
      <div class="searchbar">
        <input type="search" id="q" value="${esc(f.q)}" placeholder="${cls === 'paint' ? '搜尋色碼或色名，例如 XF-63' : '搜尋名稱或品牌'}" autocomplete="off" enterkeyhint="search" aria-label="搜尋">
        <button class="btn filter-btn" data-act="filters-open">篩選<b id="filter-count" ${activeCount(f) ? '' : 'hidden'}>${activeCount(f)}</b></button>
      </div>
      <div class="active-filters" id="active-filters">${activeChips(cls)}</div>
      <div id="plist">${listHtml(cls)}</div>
    </section>
  </div>`;
}

export function mountLibrary() {
  const q = $('#q');
  if (!q) return;
  q.addEventListener('input', () => {
    filters[currentClass].q = q.value;
    $('#plist').innerHTML = listHtml(currentClass);
  });
}

function refreshFilters() {
  const f = filters[currentClass];
  // 品牌取消後，拿掉已不屬於所選品牌的系列
  for (const id of [...f.series]) {
    const s = byId('series', id);
    if (!s || !f.brand.has(s.brand_id)) f.series.delete(id);
  }
  $('#filter-body').innerHTML = filterPanel(currentClass);
  $('#active-filters').innerHTML = activeChips(currentClass);
  $('#plist').innerHTML = listHtml(currentClass);
  const badge = $('#filter-count');
  badge.textContent = activeCount(f);
  badge.hidden = !activeCount(f);
}

actions['filter-toggle'] = (el) => {
  const set = filters[currentClass][el.dataset.group];
  const v = el.dataset.value;
  set.has(v) ? set.delete(v) : set.add(v);
  refreshFilters();
};
actions['filter-clear'] = () => {
  filters[currentClass] = newFilter();
  $('#q').value = '';
  refreshFilters();
};
actions['filters-open'] = () => document.body.classList.add('filters-open');
actions['filters-close'] = () => document.body.classList.remove('filters-open');

// ---------- 詳細資料 ----------
const imageSearchUrl = (p) =>
  'https://www.google.com/search?tbm=isch&q=' +
  encodeURIComponent([p.brand_id ? brandName(p.brand_id) : '', seriesName(p.series_id), p.code, paintName(p)].filter(Boolean).join(' '));

function detailHtml(p) {
  const rows = [
    ['品牌', p.brand_id ? brandName(p.brand_id) : '未指定'],
    ['系列', seriesName(p.series_id)],
    ['種類', ALL_CATEGORIES[p.category]],
    ['漆性', MEDIUMS[p.medium]],
    p.item_class === 'paint' ? ['光澤', FINISHES[p.finish]] : null,
    ['容量', p.volume_ml != null ? `${Number(p.volume_ml)} ml` : ''],
    ['色票', validHex(p.swatch_hex) ? p.swatch_hex.toUpperCase() : ''],
  ].filter((r) => r && r[1]);
  const used = projectsUsing(p.id);
  const pkg = be.imageUrl(p.package_image);
  const sw = be.imageUrl(p.swatch_image);
  return `
  <div class="detail">
    <header class="detail-head">
      <button class="icon-btn" data-act="ov-close" aria-label="關閉">✕</button>
      <span class="detail-class">${ITEM_CLASSES[p.item_class]}</span>
    </header>
    <div class="detail-hero">
      ${well(p, 'xl')}
      <div>
        <p class="code big">${esc(p.code || '')}</p>
        <h2>${esc(paintName(p) || (p.code ? '' : '未命名'))}</h2>
      </div>
    </div>

    ${pkg || sw ? `<div class="detail-images">
      ${pkg ? `<figure><a href="${esc(pkg)}" target="_blank" rel="noopener"><img src="${esc(pkg)}" alt="包裝照片" loading="lazy"></a><figcaption>包裝</figcaption></figure>` : ''}
      ${sw ? `<figure><a href="${esc(sw)}" target="_blank" rel="noopener"><img src="${esc(sw)}" alt="色票照片" loading="lazy"></a><figcaption>色票</figcaption></figure>` : ''}
    </div>` : ''}

    <section class="stock-box">
      ${p.owned ? `
      <div class="stock-row">
        <span class="stock-label">數量</span>
        <div class="stepper">
          <button data-act="qty" data-id="${p.id}" data-d="-1" aria-label="減少一罐" ${p.quantity <= 0 ? 'disabled' : ''}>−</button>
          <output>${p.quantity}</output>
          <button data-act="qty" data-id="${p.id}" data-d="1" aria-label="增加一罐">＋</button>
        </div>
      </div>
      <div class="stock-row">
        <span class="stock-label">剩餘</span>
        <div class="segmented">${Object.entries(STATUSES).map(([k, v]) => `<button data-act="set-status" data-id="${p.id}" data-status="${k}" class="${p.status === k ? 'on' : ''}" aria-pressed="${p.status === k}">${v}</button>`).join('')}</div>
      </div>` : `
      <p class="unowned-note">這罐還沒買，目前列在購物清單。</p>
      <button class="btn primary" data-act="mark-bought" data-id="${p.id}">已買到，加入庫存</button>`}
    </section>

    <dl class="props">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${p.notes ? `<section class="notes"><h3>備註</h3><p>${esc(p.notes)}</p></section>` : ''}
    ${used.length ? `<section class="notes"><h3>用在這些計畫</h3><ul class="plain">${used.map((pr) => `<li><a href="#/projects/${pr.id}" data-act="goto">${esc(pr.name)}</a></li>`).join('')}</ul></section>` : ''}

    <footer class="detail-actions">
      <button class="btn" data-act="paint-edit" data-id="${p.id}">編輯</button>
      <a class="btn" href="${esc(imageSearchUrl(p))}" target="_blank" rel="noopener">上網找圖片</a>
      <button class="btn danger-text" data-act="paint-delete" data-id="${p.id}">刪除</button>
    </footer>
  </div>`;
}

let detailEl = null;
let detailId = null;

export function openPaint(id) {
  const p = byId('paints', id);
  if (!p) return;
  detailId = id;
  detailEl = openOverlay(detailHtml(p), { kind: 'drawer', onClose: () => ((detailEl = null), (detailId = null)) });
}

function redrawDetail() {
  if (!detailEl) return;
  const p = byId('paints', detailId);
  if (p) $('.ov-panel', detailEl).innerHTML = detailHtml(p);
}

actions['paint-open'] = (el) => openPaint(el.dataset.id);

actions['qty'] = async (el) => {
  const p = byId('paints', el.dataset.id);
  const quantity = Math.max(0, p.quantity + Number(el.dataset.d));
  const changes = { quantity };
  if (quantity === 0) changes.status = 'empty';
  else if (p.quantity === 0) changes.status = 'full';
  await patch('paints', p.id, changes).catch(fail);
  redrawDetail();
  refresh();
};

actions['set-status'] = async (el) => {
  await patch('paints', el.dataset.id, { status: el.dataset.status }).catch(fail);
  redrawDetail();
  refresh();
};

export async function markBought(id) {
  const p = byId('paints', id);
  await patch('paints', id, { owned: true, status: 'full', quantity: Math.max(1, p.owned ? p.quantity : 1) });
  toast(`已加入庫存：${paintTitle(p)}`);
}

actions['mark-bought'] = async (el) => {
  await markBought(el.dataset.id).catch(fail);
  redrawDetail();
  refresh();
};

actions['paint-delete'] = async (el) => {
  const p = byId('paints', el.dataset.id);
  const used = projectsUsing(p.id);
  const ok = await confirmModal({
    title: `刪除「${paintTitle(p)}」？`,
    body: used.length ? `它用在 ${used.length} 個計畫裡，刪除後會一併從這些計畫移除。這個動作無法復原。` : '這個動作無法復原。',
    ok: '刪除',
    danger: true,
  });
  if (!ok) return;
  try {
    await del('paints', p.id);
    be.removeImage(p.package_image);
    be.removeImage(p.swatch_image);
    closeOverlay();
    toast('已刪除');
    refresh();
  } catch (e) {
    fail(e);
  }
};

actions['paint-new'] = async () => {
  const made = await openPaintForm({ preset: { item_class: currentClass } });
  if (made) refresh();
};

actions['tone-add'] = async (el) => {
  const series = byId('series', el.dataset.series);
  if (!series) return;
  const made = await openPaintForm({
    preset: { item_class: currentClass, brand_id: series.brand_id, series_id: series.id, name: el.dataset.name, medium: series.default_medium, tones: [Number(el.dataset.tone)] },
  });
  if (made) refresh();
};

actions['paint-edit'] = async (el) => {
  await openPaintForm({ id: el.dataset.id });
  redrawDetail();
  refresh();
};

// ---------- 新增／編輯表單 ----------
const options = (entries, selected, blank) =>
  (blank !== undefined ? `<option value="">${blank}</option>` : '') +
  entries.map(([v, label]) => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(label)}</option>`).join('');

export function openPaintForm({ id, preset = {} } = {}) {
  const editing = id ? byId('paints', id) : null;
  const p = editing || {
    item_class: 'paint', brand_id: null, series_id: null, code: '', name: '', category: null, medium: null,
    finish: null, volume_ml: null, quantity: 1, status: 'full', owned: true, swatch_hex: null,
    package_image: null, swatch_image: null, notes: '', tone: null, ...preset,
  };
  const presetTones = new Set(preset.tones || []);
  // 尚未儲存的圖片：{ blob, url }、'remove'（要移除）或 null（不變）
  const pending = { package_image: null, swatch_image: null };

  return new Promise((resolve) => {
    let saved = null;
    const brandOptions = (sel) => options(sortedBrands().map((b) => [b.id, b.name]), sel, '未指定') + '<option value="__new">＋ 新增品牌…</option>';
    const seriesOptions = (brandId, sel) =>
      brandId
        ? options(seriesOf(brandId).map((s) => [s.id, s.name]), sel, '未指定') + '<option value="__new">＋ 新增系列…</option>'
        : '<option value="">先選品牌</option>';
    const catOptions = (cls, sel) => options(Object.entries(cls === 'paint' ? PAINT_CATEGORIES : AUX_CATEGORIES), sel, '未指定');
    const imageField = (key, label, hint) => {
      const url = be.imageUrl(p[key]);
      return `<div class="imgfield" data-key="${key}">
        <span class="imgfield-label">${label}</span>
        <div class="imgfield-preview ${url ? '' : 'blank'}">${url ? `<img src="${esc(url)}" alt="" crossorigin="anonymous">` : '<span>尚無圖片</span>'}</div>
        <div class="imgfield-actions">
          <label class="btn small">選擇圖片<input type="file" accept="image/*" hidden></label>
          <label class="btn small only-touch">拍照<input type="file" accept="image/*" capture="environment" hidden></label>
          <button type="button" class="btn small danger-text" data-remove ${url ? '' : 'hidden'}>移除</button>
        </div>
        <small>${hint}</small>
      </div>`;
    };

    const el = openOverlay(
      `<form class="dialog paint-form" novalidate>
        <h2>${editing ? '編輯' : '新增'}<span id="pf-noun">${ITEM_CLASSES[p.item_class]}</span></h2>

        <div class="segmented wide" role="radiogroup" aria-label="類別">
          ${Object.entries(ITEM_CLASSES).map(([k, v]) => `<label><input type="radio" name="item_class" value="${k}" ${p.item_class === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}
        </div>

        <div class="fields two">
          <label class="field"><span>品牌</span><select name="brand_id">${brandOptions(p.brand_id)}</select></label>
          <label class="field"><span>系列</span><select name="series_id">${seriesOptions(p.brand_id, p.series_id)}</select></label>
          <label class="field"><span>色碼</span><input name="code" value="${esc(p.code || '')}" placeholder="例如 XF-63" autocomplete="off" autocapitalize="characters" list="pf-codes"><datalist id="pf-codes"></datalist><small id="pf-cat-src"></small></label>
          <label class="field"><span>名稱</span><input name="name" value="${esc(p.name || '')}" placeholder="例如 German Grey" autocomplete="off" list="pf-families"><datalist id="pf-families"></datalist></label>
        </div>
        <div class="tone-field" id="pf-tone" hidden>
          <span class="imgfield-label">色階<small id="pf-tone-hint"></small></span>
          <div class="tone-boxes" id="pf-tone-boxes"></div>
        </div>
        <div id="pf-dup"></div>

        <div class="fields two">
          <label class="field"><span>種類</span><select name="category">${catOptions(p.item_class, p.category)}</select><small id="pf-cat-hint"></small></label>
          <label class="field"><span>漆性</span><select name="medium">
            <option value="">未指定</option>
            <optgroup label="水性">${options([['acrylic', MEDIUMS.acrylic]], p.medium)}</optgroup>
            <optgroup label="油性">${options([['oil', MEDIUMS.oil], ['enamel', MEDIUMS.enamel], ['lacquer', MEDIUMS.lacquer]], p.medium)}</optgroup>
            ${options([['other', MEDIUMS.other]], p.medium)}
          </select></label>
          <label class="field" id="pf-finish"><span>光澤</span><select name="finish">${options(Object.entries(FINISHES), p.finish, '未指定')}</select></label>
          <label class="field"><span>容量（ml）</span><input name="volume_ml" type="number" min="0" step="any" inputmode="decimal" value="${p.volume_ml ?? ''}"></label>
        </div>

        <label class="check"><input type="checkbox" name="owned" ${p.owned ? 'checked' : ''}><span>我已經擁有這罐</span></label>
        <div class="fields two" id="pf-stock">
          <label class="field"><span>數量（罐）</span><input name="quantity" type="number" min="0" step="1" inputmode="numeric" value="${p.quantity}"></label>
          <label class="field"><span>剩餘</span><select name="status">${options(Object.entries(STATUSES), p.status)}</select></label>
        </div>

        <div class="swatch-field">
          <span class="imgfield-label">色票顏色</span>
          <div class="swatch-row">
            <span class="well lg ${validHex(p.swatch_hex) ? '' : 'none'}" id="pf-well" style="--c:${validHex(p.swatch_hex) ? p.swatch_hex : 'transparent'}"></span>
            <input type="color" id="pf-color" value="${validHex(p.swatch_hex) ? p.swatch_hex : '#808080'}" aria-label="選擇色票顏色">
            <input name="swatch_hex" id="pf-hex" value="${esc(p.swatch_hex || '')}" placeholder="#RRGGBB" maxlength="7" autocomplete="off" aria-label="色票色碼">
            <button type="button" class="btn small" id="pf-hex-clear">清除</button>
          </div>
          <small>可以用選色器，也可以直接點下面的圖片取色。</small>
        </div>

        <div class="imgfields">
          ${imageField('package_image', '包裝照片', '拍下瓶身或從網路存圖後上傳。')}
          ${imageField('swatch_image', '色票照片', '實際試塗的樣子，可不填。')}
        </div>

        <label class="field"><span>備註</span><textarea name="notes" rows="2" placeholder="稀釋比例、購買地點、使用心得…">${esc(p.notes || '')}</textarea></label>

        <p class="form-error" hidden></p>
        <div class="dialog-actions sticky">
          <button type="button" class="btn" data-act="ov-close">取消</button>
          <button class="btn primary" id="pf-submit">${editing ? '儲存變更' : '加入'}</button>
        </div>
      </form>`,
      { onClose: () => resolve(saved) },
    );

    const form = $('form', el);
    const field = (name) => form.elements[name];
    const cls = () => form.elements.item_class.value;

    const syncClass = () => {
      $('#pf-noun', el).textContent = ITEM_CLASSES[cls()];
      $('#pf-finish', el).hidden = cls() !== 'paint';
    };
    const syncOwned = () => ($('#pf-stock', el).hidden = !field('owned').checked);
    const syncCatHint = () => ($('#pf-cat-hint', el).textContent = CATEGORY_HINTS[field('category').value] || '');
    const tonedSeries = () => {
      const sr = byId('series', field('series_id').value);
      return sr?.tone_count ? sr : null;
    };
    const checkedTones = () => $$('#pf-tone-boxes input:checked', el).map((i) => Number(i.value));
    // 色階格子：新增時可複選（一次建多罐），編輯時單選
    const syncTone = () => {
      const sr = tonedSeries();
      const box = $('#pf-tone', el);
      box.hidden = !sr;
      $('#pf-families', el).innerHTML = '';
      if (!sr) return;
      const preset = tonePreset(sr.name);
      if (preset) {
        $('#pf-families', el).innerHTML = preset.families.map(([n]) => `<option value="${esc(n)}"></option>`).join('');
        if (!editing && preset.volume_ml && !field('volume_ml').value) field('volume_ml').value = preset.volume_ml;
      }
      const name = field('name').value.trim().toLowerCase();
      const existing = new Map(
        S.paints.filter((x) => x.series_id === sr.id && x.id !== editing?.id && name && (x.name || '').trim().toLowerCase() === name).map((x) => [Number(x.tone), x]),
      );
      const was = new Set(box.dataset.series === sr.id ? checkedTones() : editing?.tone ? [Number(editing.tone)] : [...presetTones]);
      box.dataset.series = sr.id;
      let html = '';
      for (let i = 1; i <= sr.tone_count; i++) {
        const hex = presetHex(sr.name, field('name').value, i);
        const taken = existing.get(i);
        html += `<label class="tone-box ${taken ? 'taken' : ''}" ${hex ? `style="--c:${hex};--ink:${inkFor(hex)}"` : ''}>
          <input type="${editing ? 'radio' : 'checkbox'}" name="tone_pick" value="${i}" ${was.has(i) && !taken ? 'checked' : ''} ${taken ? 'disabled' : ''}>
          <span>${i}</span>${taken ? `<small>${taken.owned ? '已有' : '已列入'}</small>` : ''}
        </label>`;
      }
      $('#pf-tone-boxes', el).innerHTML = html;
      $('#pf-tone-hint', el).textContent = editing ? '　這一罐是第幾號' : '　勾選你有的號數，可以一次勾多個';
    };
    // 官方色表：選了有色表的系列後，輸入色碼會自動帶出名稱（仍可自行修改）
    let catalog = null;
    const nameField = field('name');
    const applyCode = () => {
      const hit = findByCode(catalog, field('code').value);
      const src = $('#pf-cat-src', el);
      if (!hit) {
        src.textContent = catalog ? `這個系列有官方色表（${catalog.items.length} 色），輸入色碼會自動帶出名稱。` : '';
        return;
      }
      if (!nameField.value.trim() || nameField.dataset.auto === '1') {
        nameField.value = hit.name;
        nameField.dataset.auto = '1';
      }
      src.textContent = `官方色表：${hit.code} ${hit.name}${hit.line ? `（${hit.line}）` : ''}`;
    };
    const applyName = () => {
      nameField.dataset.auto = '';
      const hit = catalog?.byName.get(nameField.value.trim().toLowerCase());
      if (hit && !field('code').value.trim()) {
        field('code').value = hit.code;
        applyCode();
        syncDup();
      }
    };
    const syncCatalog = async () => {
      catalog = await loadCatalog(brandName(field('brand_id').value), seriesName(field('series_id').value)).catch(() => null);
      $('#pf-codes', el).innerHTML = catalog ? catalog.items.map((it) => `<option value="${esc(it.code)}">${esc(it.name)}</option>`).join('') : '';
      if (catalog && !tonedSeries()) $('#pf-families', el).innerHTML = catalog.items.map((it) => `<option value="${esc(it.name)}">${esc(it.code)}</option>`).join('');
      applyCode();
    };
    const syncDup = () => {
      if (tonedSeries() && !field('code').value.trim()) {
        $('#pf-dup', el).innerHTML = '';
        return [];
      }
      const dups = findDuplicates({ id: editing?.id, brand_id: field('brand_id').value || null, code: field('code').value });
      $('#pf-dup', el).innerHTML = dups.length
        ? `<div class="dup-warn"><strong>庫存裡已經有這個色碼</strong>${dups.map((d) => `<span>${well(d, 'sm')}${esc(paintTitle(d))}　${d.owned ? `${d.quantity} 罐，${STATUSES[d.status]}` : '尚未擁有'}</span>`).join('')}</div>`
        : '';
      return dups;
    };
    const setHex = (hex) => {
      const ok = validHex(hex);
      const w = $('#pf-well', el);
      w.classList.toggle('none', !ok);
      w.style.setProperty('--c', ok ? hex : 'transparent');
      if (ok) $('#pf-color', el).value = hex.toLowerCase();
    };

    syncClass(); syncOwned(); syncCatHint(); syncTone(); syncDup(); syncCatalog();
    field('name').addEventListener('input', syncTone);
    field('name').addEventListener('input', applyName);
    field('code').addEventListener('input', applyCode);

    $$('input[name=item_class]', el).forEach((r) =>
      r.addEventListener('change', () => {
        field('category').innerHTML = catOptions(cls(), null);
        syncClass(); syncCatHint();
      }),
    );
    field('owned').addEventListener('change', syncOwned);
    field('category').addEventListener('change', syncCatHint);
    field('code').addEventListener('input', syncDup);

    field('brand_id').addEventListener('change', async () => {
      const sel = field('brand_id');
      if (sel.value === '__new') {
        sel.value = '';
        const r = await formModal({ title: '新增品牌', fields: [{ name: 'name', label: '品牌名稱', required: true }], submit: '新增' });
        if (r) {
          const b = await add('brands', { name: r.name, sort: S.brands.length }).catch(fail);
          if (b) {
            sel.innerHTML = brandOptions(b.id);
          }
        }
      }
      field('series_id').innerHTML = seriesOptions(sel.value, null);
      syncTone();
      syncDup();
      syncCatalog();
    });

    field('series_id').addEventListener('change', async () => {
      const sel = field('series_id');
      const brandId = field('brand_id').value;
      if (sel.value === '__new') {
        sel.value = '';
        const r = await formModal({
          title: `新增 ${brandName(brandId)} 的系列`,
          fields: [
            { name: 'name', label: '系列名稱', required: true },
            { name: 'default_medium', label: '這個系列的漆性', type: 'select', options: [['', '不固定'], ...Object.entries(MEDIUMS)], hint: '之後選這個系列時會自動帶入。' },
          ],
          submit: '新增',
        });
        if (r) {
          const s = await add('series', { brand_id: brandId, name: r.name, default_medium: r.default_medium, sort: seriesOf(brandId).length }).catch(fail);
          if (s) sel.innerHTML = seriesOptions(brandId, s.id);
        }
      }
      const s = byId('series', sel.value);
      if (s?.default_medium) field('medium').value = s.default_medium;
      syncTone();
      syncDup();
      syncCatalog();
    });

    $('#pf-color', el).addEventListener('input', (e) => {
      $('#pf-hex', el).value = e.target.value;
      setHex(e.target.value);
    });
    $('#pf-hex', el).addEventListener('input', (e) => {
      let v = e.target.value.trim();
      if (v && !v.startsWith('#')) v = '#' + v;
      setHex(v);
    });
    $('#pf-hex-clear', el).addEventListener('click', () => {
      $('#pf-hex', el).value = '';
      setHex('');
    });

    // 圖片欄位
    $$('.imgfield', el).forEach((box) => {
      const key = box.dataset.key;
      const preview = $('.imgfield-preview', box);
      const removeBtn = $('[data-remove]', box);
      $$('input[type=file]', box).forEach((input) =>
        input.addEventListener('change', async () => {
          const file = input.files[0];
          input.value = '';
          if (!file) return;
          try {
            const blob = await resizeImage(file);
            const url = URL.createObjectURL(blob);
            pending[key] = { blob, url };
            preview.classList.remove('blank');
            preview.innerHTML = `<img src="${url}" alt="">`;
            removeBtn.hidden = false;
          } catch (e) {
            fail(e);
          }
        }),
      );
      removeBtn.addEventListener('click', () => {
        pending[key] = 'remove';
        preview.classList.add('blank');
        preview.innerHTML = '<span>尚無圖片</span>';
        removeBtn.hidden = true;
      });
      preview.addEventListener('click', (e) => {
        const img = $('img', preview);
        if (!img || !img.complete) return;
        try {
          const hex = colorAt(img, e.clientX, e.clientY);
          if (hex) {
            $('#pf-hex', el).value = hex;
            setHex(hex);
            toast(`已取色 ${hex.toUpperCase()}`);
          }
        } catch {
          toast('這張圖片無法取色，請改用選色器。', 'error');
        }
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('.form-error', el);
      const showError = (msg) => {
        err.textContent = msg;
        err.hidden = false;
      };
      err.hidden = true;
      const text = (name) => field(name).value.trim() || null;
      const number = (name) => (field(name).value.trim() === '' ? null : Number(field(name).value));
      const hexRaw = $('#pf-hex', el).value.trim();
      const hex = hexRaw && !hexRaw.startsWith('#') ? '#' + hexRaw : hexRaw;

      if (!text('code') && !text('name')) return showError('請至少填寫色碼或名稱。');
      if (hex && !validHex(hex)) return showError('色票顏色的格式要像 #3A5F7D 這樣，或按「清除」留空。');

      const owned = field('owned').checked;
      const data = {
        item_class: cls(),
        brand_id: text('brand_id'),
        series_id: text('series_id'),
        code: text('code'),
        name: text('name'),
        category: text('category'),
        medium: text('medium'),
        finish: cls() === 'paint' ? text('finish') : null,
        volume_ml: number('volume_ml'),
        quantity: Math.max(0, Math.round(number('quantity') ?? 1)),
        status: field('status').value,
        owned,
        swatch_hex: hex ? hex.toLowerCase() : null,
        notes: text('notes'),
      };

      const sr = tonedSeries();
      const tones = sr ? checkedTones() : [];
      if (sr && !tones.length) return showError(editing ? '請選擇這一罐是第幾號色階。' : '請勾選至少一個色階。已經建檔過的號數不能重複勾選。');
      if (sr && !data.name) return showError('請填寫顏色名稱。');
      if (sr) data.tone = tones[0];
      else if (editing && editing.tone != null) data.tone = null;

      if (!editing) {
        const dups = syncDup();
        if (dups.length) {
          const ok = await confirmModal({
            title: '庫存裡已經有這個色碼',
            body: `${brandName(data.brand_id)} ${data.code} 已經建檔過了。確定要再新增一筆嗎？如果只是多買一罐，建議取消後直接把既有那筆的數量加 1。`,
            ok: '仍然新增',
          });
          if (!ok) return;
        }
      }

      const submit = $('#pf-submit', el);
      submit.disabled = true;
      submit.textContent = '儲存中…';
      try {
        const oldImages = [];
        for (const key of ['package_image', 'swatch_image']) {
          const pend = pending[key];
          if (pend === 'remove') {
            if (p[key]) oldImages.push(p[key]);
            data[key] = null;
          } else if (pend) {
            data[key] = await be.upload(pend.blob);
            if (p[key]) oldImages.push(p[key]);
          }
        }
        if (sr && !data.swatch_hex) data.swatch_hex = presetHex(sr.name, data.name, data.tone);
        if (editing) {
          saved = await patch('paints', editing.id, data);
        } else {
          saved = await add('paints', data);
          // 一次勾了多個色階：其餘號數各建一筆，圖片各自上傳一份
          for (const tone of tones.slice(1)) {
            const extra = { ...data, tone, swatch_hex: hex ? hex.toLowerCase() : presetHex(sr.name, data.name, tone) };
            for (const key of ['package_image', 'swatch_image']) {
              if (pending[key] && pending[key] !== 'remove') extra[key] = await be.upload(pending[key].blob);
            }
            await add('paints', extra);
          }
        }
        oldImages.forEach((path) => be.removeImage(path));
        toast(editing ? '已儲存' : tones.length > 1 ? `已加入 ${data.name} 的 ${tones.length} 個色階` : `已加入：${paintTitle(saved)}`);
        closeOverlay();
      } catch (e2) {
        submit.disabled = false;
        submit.textContent = editing ? '儲存變更' : '加入';
        showError(e2.message || '儲存失敗，請再試一次。');
      }
    });
  }).then(async (r) => {
    await settle();
    return r;
  });
}

// ---------- 顏料選擇器（計畫用） ----------
export function openPicker({ title, projectId, exclude = new Set() }) {
  return new Promise((resolve) => {
    let chosen = null;
    const inProject = new Set(S.project_paints.filter((pp) => pp.project_id === projectId).map((pp) => pp.paint_id));
    const rowsHtml = (q) => {
      const f = { ...newFilter(), q };
      const list = S.paints.filter((p) => !exclude.has(p.id) && matches(p, f)).sort(comparePaints);
      const item = (p) => `<li><button type="button" class="paint" data-pick="${p.id}">
        ${well(p)}
        <span class="paint-main">
          <span class="paint-line"><b class="code">${esc(p.code || '')}</b><span class="pname">${esc(paintName(p))}</span></span>
          <span class="paint-sub">${esc([brandName(p.brand_id), ALL_CATEGORIES[p.category], MEDIUMS[p.medium]].filter(Boolean).join('　'))}</span>
        </span>
        <span class="paint-stock">${level(p)}</span>
      </button></li>`;
      const mine = list.filter((p) => inProject.has(p.id));
      const rest = list.filter((p) => !inProject.has(p.id));
      let html = '';
      if (mine.length) html += `<h3 class="pick-head">這個計畫的顏料</h3><ul class="paint-list">${mine.map(item).join('')}</ul>`;
      if (rest.length) html += `${mine.length ? '<h3 class="pick-head">庫存中的其他項目</h3>' : ''}<ul class="paint-list">${rest.map(item).join('')}</ul>`;
      return html || `<div class="empty small"><p>${q ? `找不到「${esc(q)}」。` : '沒有可以加入的項目。'}</p></div>`;
    };
    const el = openOverlay(
      `<div class="dialog picker">
        <h2>${esc(title)}</h2>
        <input type="search" id="pick-q" placeholder="搜尋色碼、名稱或品牌" autocomplete="off" aria-label="搜尋">
        <div class="pick-list" id="pick-list">${rowsHtml('')}</div>
        <div class="dialog-actions">
          <button type="button" class="btn" id="pick-new">新增還沒買的顏料</button>
          <button type="button" class="btn" data-act="ov-close">取消</button>
        </div>
      </div>`,
      { onClose: () => resolve(chosen) },
    );
    $('#pick-q', el).addEventListener('input', (e) => ($('#pick-list', el).innerHTML = rowsHtml(e.target.value)));
    $('#pick-list', el).addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pick]');
      if (!btn) return;
      chosen = btn.dataset.pick;
      closeOverlay();
    });
    $('#pick-new', el).addEventListener('click', async () => {
      const made = await openPaintForm({ preset: { owned: false } });
      if (made) {
        chosen = made.id;
        closeOverlay();
      }
    });
  }).then(async (r) => {
    await settle();
    return r;
  });
}
