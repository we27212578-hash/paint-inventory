# 顏料庫存

模型顏料的庫存管理系統。出門買顏料前先查色碼，避免買到重複的；也可以替每件作品建立計畫，記下各部位的塗裝分層。

- 顏料與塗裝輔助劑建檔：品牌、系列、色碼、種類、漆性、光澤、容量、數量、剩餘量、色票、包裝照片
- 多條件過濾：品牌、系列、種類、漆性、光澤、庫存狀態可任意組合
- 新增時自動提醒重複的色碼
- 計畫 → 部位 → 塗層 → 顏料
- 購物清單：快用完、用完，以及計畫需要但還沒買的顏料
- 電腦與手機同步，手機可加到主畫面

## 架構

| 部分 | 使用的服務 |
| --- | --- |
| 網頁 | 純 HTML / CSS / JavaScript，沒有建置步驟，由 GitHub Pages 提供 |
| 資料庫、登入、圖片 | Supabase（PostgreSQL、Auth、Storage） |

每筆資料都帶有擁有者，資料庫的權限規則（RLS）確保每個帳號只能讀寫自己的資料。

## 檔案

```
index.html            進入點
css/app.css           樣式
js/config.js          Supabase 網址與公開金鑰
js/constants.js       種類、漆性等選項，以及預設品牌與系列
js/backend.js         資料後端（Supabase／試用模式）
js/store.js           記憶體中的資料與存取函式
js/views-*.js         各個畫面
js/md.js              Markdown 匯出匯入、JSON 備份
supabase/schema.sql   資料庫結構（新專案在 Supabase 的 SQL Editor 執行一次）
supabase/migration-*.sql  既有專案的更新，依編號順序各執行一次
js/presets.js         有色階的系列（如 Citadel Tone Pro）的預設顏色名稱
docs/AI-GUIDE.md      給 AI 助手的修改指南
```

## 試用模式

網址後面加上 `?demo`，資料只存在瀏覽器裡，不需要登入，方便試用與測試。

## 本機開發

```
python3 -m http.server 8000
```

然後開啟 `http://localhost:8000/?demo`。
