// 有「色階」的系列的預設顏色名稱。鍵是系列名稱（小寫）。
// 色值是第三方整理的近似值（非官方數據），只用來自動帶入色票，之後可以自行修改。
export const TONE_PRESETS = {
  'tone pro': {
    volume_ml: 12,
    families: [
      ['Carmine Blades', ['#3c262a', '#5b3539', '#750019', '#910022', '#c64d50']],
      ['Bloodtoof Red', ['#581e16', '#94001e', '#ad072b', '#d60020', '#ef353c']],
      ['Chotec Orange', ['#93150b', '#b82f2d', '#e04a33', '#f56230', '#f78030']],
      ["Ta'unar Ochre", ['#bb5528', '#d27144', '#e78344', '#ea9b6b', '#e9b06e']],
      ['Khemri Sands', ['#6c4b12', '#8d5e06', '#b1791e', '#cf8400', '#dc9a00']],
      ['Hawkshroud Yellow', ['#f69113', '#fba200', '#febb00', '#ffd300', '#fde07e']],
      ['Megaboss Yellow', ['#f9ad00', '#f8ce00', '#ffe440', '#f8e85f', '#fff175']],
      ['Plague Toad Venom', ['#49892d', '#549b32', '#80c234', '#9cc829', '#c8d600']],
      ['Kruleboyz Green', ['#4a7d36', '#627f3c', '#7a823f', '#939859', '#aeb16c']],
      ['Lustria Green', ['#004816', '#006929', '#007931', '#34ad40', '#4eb33f']],
      ['Kasrkin Green', ['#001b1b', '#1f4530', '#40713c', '#678e55', '#86a978']],
      ['Hierotek Green', ['#00321c', '#00542d', '#006a2e', '#00894e', '#00b681']],
      ['Green Morkshroom', ['#143230', '#004f48', '#006458', '#007b6d', '#37ac83']],
      ['Seraphon Blue', ['#002f34', '#004650', '#006874', '#008d92', '#00b7b9']],
      ['Craventhrone Cloak', ['#08232e', '#12373e', '#164858', '#41717d', '#598a8e']],
      ['Stormwolf Blue', ['#233f55', '#405568', '#54697d', '#6e95a4', '#87afb9']],
      ['Scinari Blue', ['#004789', '#005895', '#006c9a', '#0088bb', '#009ab9']],
      ['Blue Gorkshroom', ['#002356', '#004487', '#0057a3', '#006cad', '#007bb2']],
      ['Ultramar Blue', ['#001a42', '#0f3062', '#0d4f88', '#436ca1', '#6d9ecf']],
      ['Shalaxi Violet', ['#130040', '#262e6d', '#324e99', '#6472b9', '#7e8bc8']],
      ['Enrapturess Dusk', ['#1e1435', '#413549', '#534d5e', '#6e6773', '#817a86']],
      ['Hive Fleet Purple', ['#1e1a40', '#3c1e54', '#655192', '#8769b1', '#8f82ae']],
      ['Magnus The Red', ['#3a202d', '#4a123e', '#76003f', '#9a1b59', '#aa4277']],
      ['Eye Of Terror', ['#920030', '#bd0047', '#c20060', '#d4417b', '#db6499']],
      ['Carthalos Skin', ['#241815', '#2d140c', '#4e2212', '#5f3a37', '#795346']],
      ['Celestine Skin', ['#cd8169', '#d58b70', '#d99578', '#eaa889', '#ddb398']],
      ['Gnarlwood', ['#342928', '#514235', '#725c44', '#776857', '#887b67']],
      ['Necrolith Bone', ['#877561', '#b0916a', '#b99f7d', '#c1ab86', '#bcb79e']],
      ['Dataslate Grey', ['#2b2d28', '#3e3d35', '#555650', '#737069', '#878983']],
      ['Blackstone Void', ['#000208', '#4e5458', '#6e7074', '#9b9d9f', '#ffffff']],
    ],
  },
};

export const tonePreset = (seriesName) => TONE_PRESETS[(seriesName || '').trim().toLowerCase()] || null;

export function presetHex(seriesName, family, tone) {
  const preset = tonePreset(seriesName);
  const row = preset?.families.find(([name]) => name.toLowerCase() === (family || '').trim().toLowerCase());
  return row?.[1][tone - 1] || null;
}
