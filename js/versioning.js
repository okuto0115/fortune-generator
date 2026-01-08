/* =========================================================================
  versioning.js / Version 1
  - ページ読み込み時に指定ファイルの内容ハッシュを作成
  - 前回のハッシュと違えば version++（localStorage）
  - index.html の #appVersion に表示

  ✅後で編集しやすい：上の CONFIG だけ触ればOK
============================================================================ */

(function () {
  "use strict";

  // =========================
  // ✅ 設定（ここだけ触ればOK）
  // =========================
  const CONFIG = {
    // 変更検知に使うファイル（増減OK）
    filesToWatch: [
      "./index.html",
      "./js/app.js",
      "./js/fortune.js",
      "./js/data.js",
      "./js/data.custom.js",
      "./js/utils.js",
      "./css/style.css",
    ],

    // localStorage keys
    storageKeyVersion: "kuma_version_counter",
    storageKeyHash: "kuma_version_hash",

    // 初期バージョン（最初だけ効く）
    initialVersion: 27,
  };

  // =========================
  // 内部：ハッシュ（軽量）
  // =========================
  function xfnv1a(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function getStoredInt(key, fallback) {
    try {
      const v = Number(localStorage.getItem(key));
      return Number.isFinite(v) ? v : fallback;
    } catch {
      return fallback;
    }
  }

  function setStored(key, val) {
    try { localStorage.setItem(key, String(val)); } catch {}
  }

  function setVersionText(v) {
    const el = document.getElementById("appVersion");
    if (el) el.textContent = String(v);
    else {
      // 保険：.ver の中身が "Version 27" のままでも拾う
      const p = document.querySelector(".ver");
      if (p) p.textContent = `Version ${v}`;
    }
  }

  async function fetchText(url) {
    // キャッシュで更新検知が鈍らないようにクエリ付与
    const bust = `v=${Date.now()}`;
    const u = url.includes("?") ? `${url}&${bust}` : `${url}?${bust}`;
    const res = await fetch(u, { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch failed: ${url}`);
    return await res.text();
  }

  async function computeCombinedHash() {
    const texts = await Promise.all(
      CONFIG.filesToWatch.map(async (f) => {
        try {
          const t = await fetchText(f);
          return `${f}::${t}`;
        } catch {
          // 取れないファイルがあっても壊れないように
          return `${f}::(missing)`;
        }
      })
    );
    return String(xfnv1a(texts.join("\n---\n")));
  }

  async function initVersioning() {
    // 初期値を用意
    let version = getStoredInt(CONFIG.storageKeyVersion, CONFIG.initialVersion);
    if (!version || version < 1) version = CONFIG.initialVersion;

    // ハッシュ比較
    const prevHash = (() => {
      try { return localStorage.getItem(CONFIG.storageKeyHash) || ""; } catch { return ""; }
    })();

    let nextHash = "";
    try {
      nextHash = await computeCombinedHash();
    } catch {
      // 失敗しても表示だけは出す
      setVersionText(version);
      return;
    }

    if (!prevHash) {
      // 初回：保存して表示
      setStored(CONFIG.storageKeyHash, nextHash);
      setStored(CONFIG.storageKeyVersion, version);
      setVersionText(version);
      return;
    }

    if (prevHash !== nextHash) {
      version += 1;
      setStored(CONFIG.storageKeyVersion, version);
      setStored(CONFIG.storageKeyHash, nextHash);
    }

    setVersionText(version);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initVersioning();
  });
})();
