// 啟動流程：登入 → 載入資料 → 畫面框架與路由
import { be, loadAll, seedIfEmpty } from './store.js';
import { esc, $, $$, closeOverlay, closeAllOverlays, overlayCount, toast, fail } from './ui.js';
import { actions, setRefresh } from './core.js';
import { renderLibrary, mountLibrary } from './views-library.js';
import { renderProjects, renderProject } from './views-projects.js';
import { renderShopping, renderBrands, renderSettings, shoppingCount, applyTheme } from './views-misc.js';

const app = $('#app');
let session = null;

const ICONS = {
  paints: '<path d="M9 3h6v4H9zM8 7h8l1 4v9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-9z"/><path d="M7 14h10"/>',
  aux: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z"/>',
  projects: '<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
  shopping: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  brands: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.500" cy="8.500" r="1.200"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const NAV = [
  { key: 'paints', hash: '#/paints', label: '顏料' },
  { key: 'aux', hash: '#/aux', label: '輔助劑' },
  { key: 'projects', hash: '#/projects', label: '計畫' },
  { key: 'shopping', hash: '#/shopping', label: '購物' },
  { key: 'brands', hash: '#/brands', label: '品牌', desktopOnly: true },
  { key: 'settings', hash: '#/settings', label: '設定' },
];

// ---------- 登入畫面 ----------
function renderAuth(mode = 'in', message = '') {
  const signUp = mode === 'up';
  app.innerHTML = `
  <main class="auth">
    <div class="auth-card">
      <div class="auth-wells" aria-hidden="true">
        ${['#2b2f33', '#8a6a3b', '#b9482e', '#d9b23c', '#5f7d4e', '#3d6f8e', '#c8c4b4'].map((c) => `<span class="well" style="--c:${c}"></span>`).join('')}
      </div>
      <h1>顏料庫存</h1>
      <p class="auth-lead">出門買顏料前，先查家裡有沒有。</p>
      <form id="auth-form" novalidate>
        <label class="field"><span>電子信箱</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>密碼</span><input name="password" type="password" autocomplete="${signUp ? 'new-password' : 'current-password'}" required minlength="6"></label>
        <p class="form-error" ${message ? '' : 'hidden'}>${esc(message)}</p>
        <button class="btn primary wide">${signUp ? '建立帳號' : '登入'}</button>
      </form>
      <p class="auth-switch">${signUp ? '已經有帳號了？' : '第一次使用？'}<button class="link" data-act="auth-mode" data-mode="${signUp ? 'in' : 'up'}">${signUp ? '改為登入' : '建立帳號'}</button></p>
      <p class="auth-switch"><a class="link" href="?demo">不登入，先試用看看</a></p>
    </div>
  </main>`;
  $('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { email, password } = Object.fromEntries(new FormData(e.target));
    const err = $('.form-error');
    const btn = $('button', e.target);
    if (!email.trim() || !password) {
      err.textContent = '請輸入信箱和密碼。';
      err.hidden = false;
      return;
    }
    btn.disabled = true;
    btn.textContent = signUp ? '建立中…' : '登入中…';
    try {
      await (signUp ? be.signUp(email.trim(), password) : be.signIn(email.trim(), password));
      await start();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = signUp ? '建立帳號' : '登入';
    }
  });
}
actions['auth-mode'] = (el) => renderAuth(el.dataset.mode);

// ---------- 主畫面 ----------
function renderShell() {
  app.innerHTML = `
  <nav class="rail" aria-label="主選單">
    <a class="brandmark" href="#/paints"><span class="well" style="--c:#d9b23c"></span><span class="brandmark-text">顏料庫存</span></a>
    <ul>${NAV.map((n) => `<li class="${n.desktopOnly ? 'desktop-only' : ''}"><a href="${n.hash}" data-nav="${n.key}">${icon(n.key)}<span>${n.label}</span>${n.key === 'shopping' ? '<b class="badge" id="shop-badge" hidden></b>' : ''}</a></li>`).join('')}</ul>
  </nav>
  <main class="main" id="main" tabindex="-1"></main>`;
}

function route() {
  const [, view = 'paints', id] = location.hash.split('/');
  return { view: view || 'paints', id };
}

function render({ keepScroll = false } = {}) {
  const main = $('#main');
  if (!main) return;
  const { view, id } = route();
  const y = window.scrollY;
  let html;
  let navKey = view;
  if (view === 'aux') html = renderLibrary('auxiliary');
  else if (view === 'projects') html = id ? renderProject(id) : renderProjects();
  else if (view === 'shopping') html = renderShopping();
  else if (view === 'brands') html = renderBrands();
  else if (view === 'settings') html = renderSettings(session?.email);
  else {
    html = renderLibrary('paint');
    navKey = 'paints';
  }
  main.innerHTML = html;
  main.dataset.view = navKey;
  if (navKey === 'paints' || navKey === 'aux') mountLibrary();
  // 手機沒有「品牌」分頁，品牌頁算在「設定」底下
  $$('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === navKey || (navKey === 'brands' && a.dataset.nav === 'settings' && !matchMedia('(min-width: 800px)').matches);
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const badge = $('#shop-badge');
  const n = shoppingCount();
  badge.textContent = n;
  badge.hidden = !n;
  window.scrollTo(0, keepScroll ? y : 0);
}

setRefresh(() => render({ keepScroll: true }));

window.addEventListener('hashchange', () => {
  closeAllOverlays();
  document.body.classList.remove('filters-open');
  render();
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  if (el.tagName !== 'A') e.preventDefault();
  Promise.resolve(fn(el, e)).catch(fail);
});

actions['ov-close'] = () => closeOverlay();
actions['goto'] = () => closeAllOverlays();
actions['sign-out'] = async () => {
  await be.signOut();
  session = null;
  closeAllOverlays();
  renderAuth();
};
actions['retry'] = () => start();

async function start() {
  app.innerHTML = '<div class="splash"><span class="well lg spin" style="--c:#d9b23c"></span><p>載入中…</p></div>';
  try {
    session = await be.session();
    if (!session) return renderAuth();
    await loadAll();
    const seeded = await seedIfEmpty();
    renderShell();
    render();
    if (seeded) toast('已建立 8 個預設品牌，可以開始新增顏料了。');
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="splash">
      <p class="empty-title">載入失敗</p>
      <p>${esc(e.message || '請檢查網路連線。')}</p>
      <button class="btn primary" data-act="retry">再試一次</button>
      <button class="btn" data-act="sign-out">登出</button>
    </div>`;
  }
}

applyTheme();
start();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// 供除錯時檢查
window.__overlayCount = overlayCount;
