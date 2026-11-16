// 共用介面工具：跳脫字元、浮層（對話框／側欄）、表單對話框、提示訊息、圖片處理

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- 浮層 ----------
const layer = () => $('#overlays');
const stack = [];

export function openOverlay(html, { kind = 'modal', onClose } = {}) {
  const el = document.createElement('div');
  el.className = `ov ov-${kind}`;
  el.innerHTML = `<div class="ov-scrim" data-act="ov-close"></div><div class="ov-panel" role="dialog" aria-modal="true">${html}</div>`;
  layer().appendChild(el);
  stack.push({ el, onClose });
  history.pushState({ ov: stack.length }, '');
  document.body.classList.add('has-overlay');
  const focusable = $('[autofocus], input:not([type=hidden]), select, textarea, button', $('.ov-panel', el));
  if (focusable && matchMedia('(min-width: 800px)').matches) focusable.focus();
  return el;
}

function popOne() {
  const top = stack.pop();
  if (!top) return;
  top.el.remove();
  top.onClose?.();
  if (!stack.length) document.body.classList.remove('has-overlay');
}

// 關閉最上層浮層（透過瀏覽器的上一頁，讓手機的返回鍵行為一致）
export function closeOverlay() {
  if (!stack.length) return;
  if (history.state?.ov) history.back();
  else popOne();
}

export function closeAllOverlays() {
  while (stack.length) popOne();
}

export const overlayCount = () => stack.length;

window.addEventListener('popstate', (e) => {
  const target = e.state?.ov || 0;
  while (stack.length > target) popOne();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) closeOverlay();
});

// 等浮層真的關掉（history.back 是非同步的）
export const settle = () => new Promise((r) => setTimeout(r, 30));

// ---------- 提示訊息 ----------
export function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3200);
}

export const fail = (err) => {
  console.error(err);
  toast(err?.message || '發生錯誤，請再試一次。', 'error');
};

// ---------- 確認對話框 ----------
export function confirmModal({ title, body = '', ok = '確定', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const el = openOverlay(
      `<div class="dialog">
        <h2>${esc(title)}</h2>
        ${body ? `<p class="dialog-body">${esc(body)}</p>` : ''}
        <div class="dialog-actions">
          <button class="btn" data-act="ov-close">取消</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>
        </div>
      </div>`,
      { onClose: () => resolve(answer) },
    );
    $('[data-ok]', el).addEventListener('click', () => {
      answer = true;
      closeOverlay();
    });
  }).then(async (r) => {
    await settle();
    return r;
  });
}

// ---------- 通用表單對話框 ----------
// fields: [{ name, label, type: text|number|date|select|textarea, value, options: [[value,label]], required, placeholder, hint }]
export function formModal({ title, fields, submit = '儲存' }) {
  return new Promise((resolve) => {
    let result = null;
    const inputs = fields
      .map((f) => {
        const v = f.value ?? '';
        let control;
        if (f.type === 'select') {
          control = `<select name="${f.name}">${f.options
            .map(([val, label]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(label)}</option>`)
            .join('')}</select>`;
        } else if (f.type === 'textarea') {
          control = `<textarea name="${f.name}" rows="3" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
        } else {
          control = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} ${f.type === 'number' ? 'step="any" min="0" inputmode="decimal"' : ''}>`;
        }
        return `<label class="field"><span>${esc(f.label)}</span>${control}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`;
      })
      .join('');
    const el = openOverlay(
      `<form class="dialog" novalidate>
        <h2>${esc(title)}</h2>
        <div class="fields">${inputs}</div>
        <p class="form-error" hidden></p>
        <div class="dialog-actions">
          <button type="button" class="btn" data-act="ov-close">取消</button>
          <button class="btn primary">${esc(submit)}</button>
        </div>
      </form>`,
      { onClose: () => resolve(result) },
    );
    $('form', el).addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      for (const f of fields) {
        const raw = (data[f.name] ?? '').trim();
        if (f.required && !raw) {
          const err = $('.form-error', el);
          err.textContent = `請填寫「${f.label}」。`;
          err.hidden = false;
          return;
        }
        data[f.name] = raw === '' ? null : f.type === 'number' ? Number(raw) : raw;
      }
      result = data;
      closeOverlay();
    });
  }).then(async (r) => {
    await settle();
    return r;
  });
}

// ---------- 圖片 ----------
// 把照片縮小並轉成 JPEG，節省儲存空間
export async function resizeImage(file, max = 1000, quality = 0.82) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('這個檔案不是可讀取的圖片。');
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('圖片處理失敗。'))), 'image/jpeg', quality),
  );
}

// 從圖片上點擊的位置取出顏色（取周圍小範圍的平均）
export function colorAt(img, clientX, clientY) {
  const rect = img.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  // object-fit: contain 的實際顯示範圍
  const ratio = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
  const shownW = img.naturalWidth * ratio;
  const shownH = img.naturalHeight * ratio;
  const x = Math.round((clientX - rect.left - (rect.width - shownW) / 2) / ratio);
  const y = Math.round((clientY - rect.top - (rect.height - shownH) / 2) / ratio);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
  const r = Math.max(2, Math.round(canvas.width / 120));
  const x0 = Math.max(0, x - r);
  const y0 = Math.max(0, y - r);
  const w = Math.min(canvas.width - x0, r * 2 + 1);
  const h = Math.min(canvas.height - y0, r * 2 + 1);
  const { data } = ctx.getImageData(x0, y0, w, h);
  let sr = 0, sg = 0, sb = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sr += data[i];
    sg += data[i + 1];
    sb += data[i + 2];
  }
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(sr)}${hex(sg)}${hex(sb)}`;
}

export const validHex = (s) => /^#[0-9a-f]{6}$/i.test(s || '');

export function downloadText(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files[0] || null));
    input.click();
  });
}

export const today = () => new Date().toLocaleDateString('sv');
