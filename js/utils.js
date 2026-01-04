/* =========================================================
  utils.js / Version 1
  開発者メモ：
  - “同じ入力 → 同じ結果”にしたいので、seed付き乱数を使う
  - 入力欄の値は localStorage に保存してセッションを残す
========================================================= */

export const STORAGE_KEY = "kuma_fortune_v1_form";

export function $(id){ return document.getElementById(id); }

export function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

export function pad2(n){ return String(n).padStart(2,"0"); }

export function formatDateJP(dateObj){
  const y = dateObj.getFullYear();
  const m = pad2(dateObj.getMonth()+1);
  const d = pad2(dateObj.getDate());
  return `${y}/${m}/${d}`;
}

export function safeTrim(s){ return (s ?? "").toString().trim(); }

/** 文字列→簡易ハッシュ（安定） */
export function hashString(str){
  let h = 2166136261; // FNV-1a
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** seed付き乱数（0..1） */
export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickBySeed(list, rnd){
  if (!list || list.length === 0) return "";
  const idx = Math.floor(rnd() * list.length);
  return list[idx];
}

export function loadForm(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  }catch{
    return null;
  }
}

export function saveForm(obj){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }catch{}
}

export function clearForm(){
  try{ localStorage.removeItem(STORAGE_KEY); }catch{}
}


// =========================================================
// Version 10 - dropdown bootstrap (最小復旧)
// data.js の window.PREFS / window.HOURS を select に流し込む
// =========================================================

(function () {
  function fillSelect(selectEl, values, { emptyLabel = null } = {}) {
    if (!selectEl) return;
    selectEl.innerHTML = "";

    if (emptyLabel != null) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = emptyLabel;
      selectEl.appendChild(opt);
    }

    (values || []).forEach((v) => {
      const opt = document.createElement("option");
      opt.value = (v === "未選択") ? "" : v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
  }

  function bootstrapSelects() {
    // data.js がまだ来てない場合でも落ちない
    const prefs = window.PREFS || [];
    const hours = window.HOURS || [];

    const prefEl = document.getElementById("pref");
    const hourEl = document.getElementById("timeHour");

    // “空のまま”でも見た目が分かるように先頭ラベルを入れる
    fillSelect(prefEl, prefs, { emptyLabel: "選択してね" });
    fillSelect(hourEl, hours, { emptyLabel: "選択" });
  }

  // DOM準備後に流し込み
  document.addEventListener("DOMContentLoaded", bootstrapSelects);

  // 念のため：JSの読み込み順が遅れてても復旧できるように
  // （一部環境でDOMContentLoadedより先に走って失敗するのを回避）
  setTimeout(bootstrapSelects, 0);
  setTimeout(bootstrapSelects, 200);
})();
