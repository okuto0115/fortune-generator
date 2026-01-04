/* =========================================================
  utils.js / Version 10
  開発者メモ：
  - “同じ入力 → 同じ結果”にしたいので、seed付き乱数を使う
  - 入力欄の値は localStorage に保存してセッションを残す
  - GitHub Pages初心者向け：ES Modules(export/import)は使わない
    → window.Utils に集約して参照する
========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "kuma_fortune_v1_form";

  function $(id){ return document.getElementById(id); }
  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
  function pad2(n){ return String(n).padStart(2,"0"); }

  function formatDateJP(dateObj){
    const y = dateObj.getFullYear();
    const m = pad2(dateObj.getMonth()+1);
    const d = pad2(dateObj.getDate());
    return `${y}/${m}/${d}`;
  }

  function safeTrim(s){ return (s ?? "").toString().trim(); }

  /** 文字列→簡易ハッシュ（安定） */
  function hashString(str){
    let h = 2166136261; // FNV-1a
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** seed付き乱数（0..1） */
  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickBySeed(list, rnd){
    if (!list || list.length === 0) return "";
    const idx = Math.floor(rnd() * list.length);
    return list[idx];
  }

  function loadForm(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    }catch{
      return null;
    }
  }

  function saveForm(obj){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }catch{}
  }

  function clearForm(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch{}
  }

  // =========================================================
  // dropdown bootstrap（都道府県 / 時）
  // data.js の window.PREFS / window.HOURS を select に流し込む
  // =========================================================

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
    const prefs = window.PREFS || [];
    const hours = window.HOURS || [];

    fillSelect(document.getElementById("pref"), prefs, { emptyLabel: "選択してね" });
    fillSelect(document.getElementById("timeHour"), hours, { emptyLabel: "選択" });
  }

  // DOM準備後に流し込み
  document.addEventListener("DOMContentLoaded", () => {
    bootstrapSelects();
    // たまに順序で負けるとき用に保険
    setTimeout(bootstrapSelects, 0);
    setTimeout(bootstrapSelects, 200);
  });

  // window に公開（他ファイルから Utils.xxx で使う）
  window.Utils = {
    STORAGE_KEY,
    $,
    clamp,
    pad2,
    formatDateJP,
    safeTrim,
    hashString,
    mulberry32,
    pickBySeed,
    loadForm,
    saveForm,
    clearForm,
    bootstrapSelects,
    fillSelect,
  };
})();
