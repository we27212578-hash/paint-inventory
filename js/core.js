// 各畫面共用：點擊動作登記表、重新繪製目前畫面
export const actions = {};

let refreshFn = () => {};
export const setRefresh = (fn) => (refreshFn = fn);
export const refresh = () => refreshFn();

export const go = (hash) => {
  if (location.hash === hash) refresh();
  else location.hash = hash;
};
