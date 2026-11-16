// 資料後端。正式使用時連 Supabase；網址加上 ?demo 則改用瀏覽器本機儲存（試用／測試用）。
import { SUPABASE_URL, SUPABASE_KEY, IMAGE_BUCKET } from './config.js';
import { TABLES } from './constants.js';

const ERROR_TEXT = [
  [/invalid login credentials/i, '信箱或密碼不正確。'],
  [/already registered/i, '這個信箱已經註冊過了，請直接登入。'],
  [/signups? not allowed|signup is disabled/i, '目前不開放註冊。'],
  [/password should be at least (\d+)/i, '密碼太短，至少需要 $1 個字元。'],
  [/email.*invalid|unable to validate email/i, '信箱格式不正確。'],
  [/failed to fetch|networkerror|load failed/i, '連不上伺服器，請檢查網路後再試一次。'],
  [/row-level security/i, '沒有權限執行這個操作，請重新登入後再試。'],
  [/jwt expired/i, '登入已過期，請重新登入。'],
];

function friendly(error) {
  const raw = error?.message || String(error);
  for (const [re, text] of ERROR_TEXT) {
    const m = raw.match(re);
    if (m) return new Error(text.replace('$1', m[1] || ''));
  }
  return new Error(raw);
}

export function isDemo() {
  return new URLSearchParams(location.search).has('demo');
}

export function createBackend() {
  return isDemo() ? localBackend() : supabaseBackend();
}

// ---------------------------------------------------------------- Supabase
function supabaseBackend() {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let uid = null;
  const check = ({ data, error }) => {
    if (error) throw friendly(error);
    return data;
  };

  return {
    demo: false,
    async session() {
      const { data } = await sb.auth.getSession();
      uid = data.session?.user?.id || null;
      return data.session ? { email: data.session.user.email } : null;
    },
    async signIn(email, password) {
      const data = check(await sb.auth.signInWithPassword({ email, password }));
      uid = data.user.id;
    },
    async signUp(email, password) {
      const data = check(await sb.auth.signUp({ email, password }));
      if (!data.session) {
        throw new Error('註冊成功。請先到信箱點擊驗證信，再回來登入。');
      }
      uid = data.user.id;
    },
    async signOut() {
      await sb.auth.signOut();
      uid = null;
    },
    async list(table) {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const page = check(
          await sb.from(table).select('*').order('created_at').range(from, from + 999),
        );
        rows.push(...page);
        if (page.length < 1000) break;
      }
      return rows;
    },
    async insert(table, rows) {
      return check(await sb.from(table).insert(rows).select());
    },
    async upsert(table, rows) {
      return check(await sb.from(table).upsert(rows).select());
    },
    async update(table, id, patch) {
      return check(await sb.from(table).update(patch).eq('id', id).select().single());
    },
    async remove(table, id) {
      check(await sb.from(table).delete().eq('id', id));
    },
    async upload(blob) {
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      check(
        await sb.storage
          .from(IMAGE_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }),
      );
      return path;
    },
    imageUrl(path) {
      if (!path) return '';
      return sb.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    },
    async removeImage(path) {
      if (path) await sb.storage.from(IMAGE_BUCKET).remove([path]);
    },
  };
}

// ---------------------------------------------------------------- 本機（試用模式）
// 刪除時的連動規則，對應 schema.sql 的外鍵設定
const CASCADE = {
  brands: [['series', 'brand_id', 'cascade'], ['paints', 'brand_id', 'null']],
  series: [['paints', 'series_id', 'null']],
  paints: [['project_paints', 'paint_id', 'cascade'], ['layer_paints', 'paint_id', 'cascade']],
  project_categories: [['projects', 'category_id', 'null']],
  projects: [['project_paints', 'project_id', 'cascade'], ['project_sections', 'project_id', 'cascade']],
  project_sections: [['section_layers', 'section_id', 'cascade']],
  section_layers: [['layer_paints', 'layer_id', 'cascade']],
};

function localBackend() {
  const KEY = 'paint-inventory-demo';
  let db;
  try {
    db = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    db = {};
  }
  for (const t of TABLES) db[t] ||= [];
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* 空間不足時只保留在記憶體 */
    }
  };
  const now = () => new Date().toISOString();
  const removeRow = (table, id) => {
    db[table] = db[table].filter((r) => r.id !== id);
    for (const [child, col, mode] of CASCADE[table] || []) {
      for (const row of [...db[child]]) {
        if (row[col] !== id) continue;
        if (mode === 'cascade') removeRow(child, row.id);
        else row[col] = null;
      }
    }
  };

  return {
    demo: true,
    async session() {
      return { email: '試用模式（資料只存在這個瀏覽器）' };
    },
    async signIn() {},
    async signUp() {},
    async signOut() {},
    async list(table) {
      return structuredClone(db[table]);
    },
    async insert(table, rows) {
      const made = rows.map((r) => ({ user_id: 'demo', created_at: now(), updated_at: now(), ...r }));
      db[table].push(...made);
      save();
      return structuredClone(made);
    },
    async upsert(table, rows) {
      const out = [];
      for (const r of rows) {
        const i = db[table].findIndex((x) => x.id === r.id);
        if (i >= 0) db[table][i] = { ...db[table][i], ...r, updated_at: now() };
        else db[table].push({ user_id: 'demo', created_at: now(), updated_at: now(), ...r });
        out.push(db[table].find((x) => x.id === r.id));
      }
      save();
      return structuredClone(out);
    },
    async update(table, id, patch) {
      const row = db[table].find((r) => r.id === id);
      if (!row) throw new Error('找不到這筆資料。');
      Object.assign(row, patch, { updated_at: now() });
      save();
      return structuredClone(row);
    },
    async remove(table, id) {
      removeRow(table, id);
      save();
    },
    async upload(blob) {
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(new Error('圖片讀取失敗。'));
        fr.readAsDataURL(blob);
      });
    },
    imageUrl(path) {
      return path || '';
    },
    async removeImage() {},
  };
}
