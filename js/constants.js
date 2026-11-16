// 所有分類選項集中在這裡。要增加種類時，在對應的清單加一行即可。

export const TABLES = [
  'brands', 'series', 'paints', 'project_categories', 'projects',
  'project_paints', 'project_sections', 'section_layers', 'layer_paints',
];

export const ITEM_CLASSES = { paint: '顏料', auxiliary: '輔助劑' };

// 顏料種類
export const PAINT_CATEGORIES = {
  general: '一般漆',
  contrast: '對比漆',
  primer: '底漆',
  varnish: '保護漆',
  wash: '漬洗漆',
  special: '特殊漆',
  effect: '效果漆',
  weathering: '舊化漆',
  ink: '墨水',
  terrain: '地形漆',
  filter: '濾鏡漆',
  pigment: '顏料粉',
};

export const CATEGORY_HINTS = {
  special: '螢光、金屬、珠光等有加料的一般漆',
  effect: '血液、黏液、裂紋、發光等視覺效果',
};

// 塗裝輔助劑種類
export const AUX_CATEGORIES = {
  thinner: '稀釋液',
  medium: '介質',
  retarder: '緩乾劑',
  flow: 'Flow',
  stripper: '去漆液',
  brush_cleaner: '洗筆液',
  cleaner: '清潔劑',
};

export const ALL_CATEGORIES = { ...PAINT_CATEGORIES, ...AUX_CATEGORIES };

// 漆性：水性 → 壓克力；油性 → 油畫顏料、琺瑯漆、硝基漆
export const MEDIUMS = {
  acrylic: '水性壓克力',
  oil: '油畫顏料',
  enamel: '琺瑯漆',
  lacquer: '硝基漆',
  other: '其他',
};
export const MEDIUM_GROUPS = [
  { label: '水性', items: ['acrylic'] },
  { label: '油性', items: ['oil', 'enamel', 'lacquer'] },
  { label: '', items: ['other'] },
];

export const FINISHES = {
  matt: '消光',
  satin: '半光',
  gloss: '亮光',
  metallic: '金屬',
  other: '其他',
};

export const STATUSES = { full: '滿', half: '一半', low: '快用完', empty: '用完' };

export const PROJECT_STATUSES = {
  planning: '規劃中',
  in_progress: '進行中',
  paused: '暫停',
  done: '完成',
};

// 第一次登入時自動建立的品牌與系列（之後都可以在「品牌」頁修改）
export const SEED_BRANDS = [
  {
    name: 'AK Interactive', country: '西班牙',
    series: [
      ['3rd Generation Acrylics', 'acrylic'],
      ['Real Colors', 'lacquer'],
      ['Xtreme Metal', 'enamel'],
      ['Weathering Enamels', 'enamel'],
      ['Abteilung 502 油畫顏料', 'oil'],
      ['The Inks', 'acrylic'],
      ['Pigments', 'other'],
      ['Diorama / Terrains', 'acrylic'],
    ],
  },
  {
    name: 'Vallejo', country: '西班牙',
    series: [
      ['Model Color', 'acrylic'],
      ['Model Air', 'acrylic'],
      ['Game Color', 'acrylic'],
      ['Game Air', 'acrylic'],
      ['Xpress Color', 'acrylic'],
      ['Mecha Color', 'acrylic'],
      ['Metal Color', 'acrylic'],
      ['Surface Primer', 'acrylic'],
      ['Model Wash', 'acrylic'],
      ['Pigments', 'other'],
      ['Diorama Effects', 'acrylic'],
    ],
  },
  {
    name: 'Citadel', country: '英國',
    series: [
      ['Base', 'acrylic'],
      ['Layer', 'acrylic'],
      ['Shade', 'acrylic'],
      ['Contrast', 'acrylic'],
      ['Tone Pro', 'acrylic', 5],
      ['Dry', 'acrylic'],
      ['Technical', 'acrylic'],
      ['Air', 'acrylic'],
      ['Spray', 'other'],
    ],
  },
  { name: 'AirBeast', country: '', series: [] },
  {
    name: 'Tamiya', country: '日本',
    series: [
      ['壓克力 X / XF', 'acrylic'],
      ['琺瑯 X / XF', 'enamel'],
      ['硝基 LP', 'lacquer'],
      ['噴罐 TS / AS / PS', 'lacquer'],
      ['墨線液 Panel Line Accent', 'enamel'],
      ['Surface Primer 補土', 'lacquer'],
      ['Weathering Master', 'other'],
    ],
  },
  {
    name: 'Mr.Hobby', country: '日本',
    series: [
      ['Mr.Color (C)', 'lacquer'],
      ['Mr.Color GX', 'lacquer'],
      ['Mr.Color LASCIVUS', 'lacquer'],
      ['Mr.Metal Color', 'lacquer'],
      ['Super Metallic', 'lacquer'],
      ['鋼彈漆 Gundam Color (UG)', 'lacquer'],
      ['水性 Hobby Color (H)', 'acrylic'],
      ['水性鋼彈漆 (HUG)', 'acrylic'],
      ['Acrysion (N)', 'acrylic'],
      ['Mr.Surfacer', 'lacquer'],
      ['Mr.Weathering Color', 'oil'],
    ],
  },
  {
    name: 'E7-COLOR', country: '台灣',
    series: [
      ['色漆', 'lacquer'],
      ['S 系列 特殊漆', 'lacquer'],
      ['P 系列 補土', 'lacquer'],
      ['C 系列 稀釋劑', 'lacquer'],
    ],
  },
  {
    name: 'Modo 摩多製造所', country: '台灣',
    series: [
      ['NEO M 系列 基本色', 'lacquer'],
      ['MK 系列', 'lacquer'],
      ['T 系列 Expert\'s Choice', 'lacquer'],
      ['水性漆 Acrylic', 'acrylic'],
    ],
  },
];

export const SEED_PROJECT_CATEGORIES = ['軍事', '戰棋', '鋼彈', '人形', '車輛', '其他'];
