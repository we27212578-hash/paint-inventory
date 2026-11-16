// 計畫：清單、計畫頁（計畫顏料、子項目、塗層）
import { S, add, patch, del, byId, brandName, shoppingReason, comparePaints } from './store.js';
import { PROJECT_STATUSES } from './constants.js';
import { esc, confirmModal, formModal, toast, fail, today } from './ui.js';
import { actions, refresh, go } from './core.js';
import { well, paintTitle, openPicker, openPaint } from './views-library.js';

const categoryName = (id) => byId('project_categories', id)?.name || '未分類';
const paintsOf = (projectId) =>
  S.project_paints.filter((pp) => pp.project_id === projectId).map((pp) => byId('paints', pp.paint_id)).filter(Boolean).sort(comparePaints);
const sectionsOf = (projectId) => S.project_sections.filter((s) => s.project_id === projectId).sort((a, b) => a.sort - b.sort);
const layersOf = (sectionId) => S.section_layers.filter((l) => l.section_id === sectionId).sort((a, b) => a.sort - b.sort);
const layerPaints = (layerId) => S.layer_paints.filter((x) => x.layer_id === layerId).sort((a, b) => a.sort - b.sort);
const nextSort = (rows) => rows.reduce((m, r) => Math.max(m, r.sort), -1) + 1;

const dateRange = (p) => {
  if (!p.start_date && !p.end_date) return '';
  return `${p.start_date || '未定'} 至 ${p.end_date || '未定'}`;
};

// ---------- 計畫清單 ----------
export function renderProjects() {
  const projects = [...S.projects].sort((a, b) => (b.start_date || b.created_at || '').localeCompare(a.start_date || a.created_at || ''));
  const cards = projects
    .map((p) => {
      const paints = paintsOf(p.id);
      const missing = paints.filter(shoppingReason).length;
      return `<li><a class="proj-card" href="#/projects/${p.id}">
        <span class="proj-swatches">${paints.slice(0, 9).map((x) => well(x, 'sm')).join('') || '<span class="muted">尚未加入顏料</span>'}</span>
        <strong>${esc(p.name)}</strong>
        <span class="proj-tags"><span class="tag">${esc(categoryName(p.category_id))}</span><span class="tag st-${p.status}">${PROJECT_STATUSES[p.status]}</span></span>
        <span class="muted">${esc(dateRange(p) || '未設定日期')}</span>
        <span class="muted">${paints.length} 種顏料${missing ? `，<b class="warn-text">${missing} 種要補貨</b>` : ''}</span>
      </a></li>`;
    })
    .join('');
  return `
  <header class="view-head">
    <h1>計畫</h1>
    <span class="count">${projects.length} 個</span>
    <button class="btn primary" data-act="project-new">新增計畫</button>
  </header>
  ${projects.length
    ? `<ul class="proj-grid">${cards}</ul>`
    : `<div class="empty">
        <p class="empty-title">還沒有計畫</p>
        <p>替每一件作品建立計畫，記下各部位用了哪些顏料、塗了幾層，下次做類似的題材可以直接參考。</p>
        <button class="btn primary" data-act="project-new">新增計畫</button>
      </div>`}`;
}

function projectFields(p = {}) {
  return [
    { name: 'name', label: '計畫名稱', required: true, value: p.name, placeholder: '例如 戰艦羅馬號 1/700' },
    {
      name: 'category_id', label: '分類', type: 'select', value: p.category_id || '',
      options: [['', '未分類'], ...S.project_categories.sort((a, b) => a.sort - b.sort).map((c) => [c.id, c.name])],
      hint: '分類可以在「設定」裡新增或修改。',
    },
    { name: 'start_date', label: '開始日期', type: 'date', value: p.start_date ?? today() },
    { name: 'end_date', label: '完成日期', type: 'date', value: p.end_date || '' },
    { name: 'status', label: '進度', type: 'select', value: p.status || 'planning', options: Object.entries(PROJECT_STATUSES) },
    { name: 'notes', label: '備註', type: 'textarea', value: p.notes || '' },
  ];
}

actions['project-new'] = async () => {
  const r = await formModal({ title: '新增計畫', fields: projectFields(), submit: '建立計畫' });
  if (!r) return;
  try {
    const p = await add('projects', r);
    go(`#/projects/${p.id}`);
  } catch (e) {
    fail(e);
  }
};

actions['project-edit'] = async (el) => {
  const p = byId('projects', el.dataset.id);
  const r = await formModal({ title: '編輯計畫', fields: projectFields(p) });
  if (!r) return;
  await patch('projects', p.id, r).catch(fail);
  refresh();
};

actions['project-delete'] = async (el) => {
  const p = byId('projects', el.dataset.id);
  const ok = await confirmModal({
    title: `刪除計畫「${p.name}」？`,
    body: '計畫裡的子項目和塗層紀錄會一併刪除，顏料庫存不受影響。這個動作無法復原。',
    ok: '刪除計畫',
    danger: true,
  });
  if (!ok) return;
  try {
    await del('projects', p.id);
    toast('已刪除計畫');
    go('#/projects');
  } catch (e) {
    fail(e);
  }
};

// ---------- 計畫頁 ----------
const pchip = (p, removeAct, removeId) => {
  const reason = shoppingReason(p);
  return `<span class="pchip ${reason ? 'need' : ''}">
    <button class="pchip-main" data-act="paint-open" data-id="${p.id}" title="${esc(brandName(p.brand_id))}">
      ${well(p, 'sm')}<b class="code">${esc(p.code || '')}</b><span>${esc(p.name || (p.code ? '' : '未命名'))}</span>${reason ? `<em>${reason}</em>` : ''}
    </button>
    <button class="pchip-x" data-act="${removeAct}" data-id="${removeId}" aria-label="移除 ${esc(paintTitle(p))}">×</button>
  </span>`;
};

export function renderProject(id) {
  const p = byId('projects', id);
  if (!p) {
    return `<div class="empty"><p class="empty-title">找不到這個計畫</p><a class="btn" href="#/projects">回到計畫清單</a></div>`;
  }
  const paints = paintsOf(id);
  const missing = paints.filter(shoppingReason);
  const ppRows = S.project_paints.filter((pp) => pp.project_id === id);
  const ppId = (paintId) => ppRows.find((pp) => pp.paint_id === paintId)?.id;

  const sections = sectionsOf(id)
    .map((sec) => {
      const layers = layersOf(sec.id);
      const items = layers
        .map((l, i) => {
          const lps = layerPaints(l.id);
          const chips = lps.map((lp) => {
            const paint = byId('paints', lp.paint_id);
            return paint ? pchip(paint, 'lp-remove', lp.id) : '';
          }).join('');
          return `<li class="layer">
            <span class="layer-n" aria-hidden="true">${i + 1}</span>
            <div class="layer-body">
              <div class="layer-top">
                <h4><span class="sr">第 ${i + 1} 層　</span>${esc(l.name || `第 ${i + 1} 層`)}</h4>
                <div class="layer-tools">
                  <button class="icon-btn" data-act="layer-move" data-id="${l.id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="往上移">↑</button>
                  <button class="icon-btn" data-act="layer-move" data-id="${l.id}" data-d="1" ${i === layers.length - 1 ? 'disabled' : ''} aria-label="往下移">↓</button>
                  <button class="link" data-act="layer-edit" data-id="${l.id}">編輯</button>
                  <button class="link danger-text" data-act="layer-delete" data-id="${l.id}">刪除</button>
                </div>
              </div>
              ${l.notes ? `<p class="layer-notes">${esc(l.notes)}</p>` : ''}
              <div class="pchips">${chips}<button class="chip add" data-act="lp-add" data-id="${l.id}">＋ 加入顏料</button></div>
            </div>
          </li>`;
        })
        .join('');
      return `<article class="section-card">
        <header>
          <h3>${esc(sec.name)}</h3>
          <div class="layer-tools">
            <button class="link" data-act="section-edit" data-id="${sec.id}">重新命名</button>
            <button class="link danger-text" data-act="section-delete" data-id="${sec.id}">刪除</button>
          </div>
        </header>
        ${sec.notes ? `<p class="layer-notes">${esc(sec.notes)}</p>` : ''}
        ${layers.length ? `<ol class="layers">${items}</ol>` : '<p class="muted pad">還沒有塗層。從最先上的那一層開始加。</p>'}
        <button class="btn small" data-act="layer-add" data-id="${sec.id}">新增塗層</button>
      </article>`;
    })
    .join('');

  return `
  <header class="view-head project-head">
    <a class="back" href="#/projects">‹ 所有計畫</a>
    <h1>${esc(p.name)}</h1>
    <div class="head-actions">
      <button class="btn" data-act="project-edit" data-id="${p.id}">編輯</button>
      <button class="btn danger-text" data-act="project-delete" data-id="${p.id}">刪除</button>
    </div>
  </header>
  <div class="proj-meta">
    <span class="tag">${esc(categoryName(p.category_id))}</span>
    <span class="tag st-${p.status}">${PROJECT_STATUSES[p.status]}</span>
    ${dateRange(p) ? `<span class="muted">${esc(dateRange(p))}</span>` : ''}
  </div>
  ${p.notes ? `<p class="proj-notes">${esc(p.notes)}</p>` : ''}

  <section class="block">
    <header class="block-head">
      <h2>計畫顏料<span class="count">${paints.length}</span></h2>
      <button class="btn small" data-act="pp-add" data-id="${p.id}">加入顏料</button>
    </header>
    ${missing.length ? `<p class="need-note">有 ${missing.length} 種還沒買或快用完，已列入<a href="#/shopping">購物清單</a>。</p>` : ''}
    ${paints.length
      ? `<div class="pchips">${paints.map((x) => pchip(x, 'pp-remove', ppId(x.id))).join('')}</div>`
      : '<p class="muted">把這件作品會用到的顏料加進來。還沒買的也可以先加，會自動列入購物清單。</p>'}
  </section>

  <section class="block">
    <header class="block-head">
      <h2>部位與塗層</h2>
      <button class="btn small" data-act="section-add" data-id="${p.id}">新增部位</button>
    </header>
    ${sections || '<p class="muted">把作品分成幾個部位（例如甲板、船身、艦橋），再記下每個部位由下到上塗了哪些層。</p>'}
  </section>`;
}

// ---------- 計畫顏料 ----------
actions['pp-add'] = async (el) => {
  const projectId = el.dataset.id;
  const exclude = new Set(S.project_paints.filter((pp) => pp.project_id === projectId).map((pp) => pp.paint_id));
  const paintId = await openPicker({ title: '加入計畫顏料', projectId, exclude });
  if (!paintId) return;
  await add('project_paints', { project_id: projectId, paint_id: paintId }).catch(fail);
  refresh();
};

actions['pp-remove'] = async (el) => {
  const pp = byId('project_paints', el.dataset.id);
  if (!pp) return;
  const sectionIds = new Set(sectionsOf(pp.project_id).map((s) => s.id));
  const layerIds = new Set(S.section_layers.filter((l) => sectionIds.has(l.section_id)).map((l) => l.id));
  const used = S.layer_paints.filter((lp) => layerIds.has(lp.layer_id) && lp.paint_id === pp.paint_id);
  if (used.length) {
    const ok = await confirmModal({
      title: '從計畫移除這個顏料？',
      body: `它用在 ${used.length} 個塗層裡，會一併從這些塗層移除。`,
      ok: '移除',
      danger: true,
    });
    if (!ok) return;
  }
  try {
    for (const lp of used) await del('layer_paints', lp.id);
    await del('project_paints', pp.id);
    refresh();
  } catch (e) {
    fail(e);
  }
};

// ---------- 部位 ----------
actions['section-add'] = async (el) => {
  const projectId = el.dataset.id;
  const r = await formModal({
    title: '新增部位',
    fields: [
      { name: 'name', label: '部位名稱', required: true, placeholder: '例如 甲板' },
      { name: 'notes', label: '備註', type: 'textarea' },
    ],
    submit: '新增',
  });
  if (!r) return;
  await add('project_sections', { project_id: projectId, ...r, sort: nextSort(sectionsOf(projectId)) }).catch(fail);
  refresh();
};

actions['section-edit'] = async (el) => {
  const sec = byId('project_sections', el.dataset.id);
  const r = await formModal({
    title: '編輯部位',
    fields: [
      { name: 'name', label: '部位名稱', required: true, value: sec.name },
      { name: 'notes', label: '備註', type: 'textarea', value: sec.notes || '' },
    ],
  });
  if (!r) return;
  await patch('project_sections', sec.id, r).catch(fail);
  refresh();
};

actions['section-delete'] = async (el) => {
  const sec = byId('project_sections', el.dataset.id);
  const ok = await confirmModal({ title: `刪除部位「${sec.name}」？`, body: '裡面的塗層紀錄會一併刪除。', ok: '刪除', danger: true });
  if (!ok) return;
  await del('project_sections', sec.id).catch(fail);
  refresh();
};

// ---------- 塗層 ----------
const layerFields = (l = {}) => [
  { name: 'name', label: '這一層是什麼', value: l.name || '', placeholder: '例如 黑色底漆、木甲板色、漬洗' },
  { name: 'notes', label: '作法備註', type: 'textarea', value: l.notes || '', placeholder: '稀釋比例、噴筆或筆塗、乾燥時間…' },
];

actions['layer-add'] = async (el) => {
  const sectionId = el.dataset.id;
  const n = layersOf(sectionId).length + 1;
  const r = await formModal({ title: `新增第 ${n} 層`, fields: layerFields(), submit: '新增' });
  if (!r) return;
  await add('section_layers', { section_id: sectionId, ...r, sort: nextSort(layersOf(sectionId)) }).catch(fail);
  refresh();
};

actions['layer-edit'] = async (el) => {
  const l = byId('section_layers', el.dataset.id);
  const r = await formModal({ title: '編輯塗層', fields: layerFields(l) });
  if (!r) return;
  await patch('section_layers', l.id, r).catch(fail);
  refresh();
};

actions['layer-delete'] = async (el) => {
  const l = byId('section_layers', el.dataset.id);
  const ok = await confirmModal({ title: `刪除塗層「${l.name || '未命名'}」？`, ok: '刪除', danger: true });
  if (!ok) return;
  await del('section_layers', l.id).catch(fail);
  refresh();
};

actions['layer-move'] = async (el) => {
  const l = byId('section_layers', el.dataset.id);
  const list = layersOf(l.section_id);
  const i = list.findIndex((x) => x.id === l.id);
  const j = i + Number(el.dataset.d);
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  try {
    for (const [index, row] of list.entries()) {
      if (row.sort !== index) await patch('section_layers', row.id, { sort: index });
    }
  } catch (e) {
    fail(e);
  }
  refresh();
};

actions['lp-add'] = async (el) => {
  const layer = byId('section_layers', el.dataset.id);
  const section = byId('project_sections', layer.section_id);
  const projectId = section.project_id;
  const exclude = new Set(layerPaints(layer.id).map((x) => x.paint_id));
  const paintId = await openPicker({ title: `加入「${layer.name || '這一層'}」使用的顏料`, projectId, exclude });
  if (!paintId) return;
  try {
    // 塗層用到的顏料一定也屬於計畫顏料
    if (!S.project_paints.some((pp) => pp.project_id === projectId && pp.paint_id === paintId)) {
      await add('project_paints', { project_id: projectId, paint_id: paintId });
    }
    await add('layer_paints', { layer_id: layer.id, paint_id: paintId, sort: nextSort(layerPaints(layer.id)) });
  } catch (e) {
    fail(e);
  }
  refresh();
};

actions['lp-remove'] = async (el) => {
  await del('layer_paints', el.dataset.id).catch(fail);
  refresh();
};

export { openPaint };
