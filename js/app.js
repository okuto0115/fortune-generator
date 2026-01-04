/* =========================================================================
  Version 11  app.js  (FULL)
  - index.html の time UI（不明/入力 + 時 + 00/30）に対応
  - badgeType / badgeAxis / badgeLevel を更新
  - fortune.js は window.FortuneEngine.run を呼ぶ想定
  - data.js は POOLS を後で再構築（無くても落ちない）
============================================================================ */

const $ = (sel) => document.querySelector(sel);

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? "";
}

/* =========================
  入力保存（セッション残す）
========================= */
const STORAGE_KEY = "fortune_generator_v11_inputs";

function loadInputs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveInputs(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

/* =========================
  文章選択のための “決定的”乱数
========================= */
function xfnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickDeterministic(arr, seed, salt = "") {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  const h = xfnv1a(String(seed) + "::" + salt);
  const rnd = mulberry32(h);
  const idx = Math.floor(rnd() * arr.length);
  return arr[idx];
}

/* =========================
  スコア → high/mid/low
========================= */
function toBand(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return "mid";
  if (score >= 67) return "high";
  if (score >= 34) return "mid";
  return "low";
}

/* =========================
  toneキー正規化
========================= */
function normalizeTone(uiToneValue) {
  if (uiToneValue === "soft" || uiToneValue === "standard" || uiToneValue === "toxic") return uiToneValue;
  return "standard";
}

/* =========================
  fortune.js 呼び出し
========================= */
function runFortuneEngine(input) {
  const engine = window.FortuneEngine || window.Fortune || null;
  const fn =
    engine?.run ||
    engine?.calc ||
    engine?.getResult ||
    engine?.generate ||
    window.runFortune ||
    window.calcFortune ||
    null;

  if (!fn) {
    return {
      typeKey: "t01",
      scores: { overall: 50, work: 50, money: 50, love: 50, health: 50 },
      meta: { axis: "（不明）", level: "（fortune.js 未接続）" },
    };
  }

  const out = fn(input);
  return out;
}

async function getFortuneResult(input) {
  const out = runFortuneEngine(input);
  const result = (out && typeof out.then === "function") ? await out : out;

  const normalized = {
    typeKey: result?.typeKey || result?.kumaType || result?.type || "t01",
    scores: result?.scores || result?.score || {},
    meta: result?.meta || result?.details || {},
  };

  normalized.scores.overall ??= result?.overallScore ?? 50;
  normalized.scores.work ??= result?.workScore ?? 50;
  normalized.scores.money ??= result?.moneyScore ?? 50;
  normalized.scores.love ??= result?.loveScore ?? 50;
  normalized.scores.health ??= result?.healthScore ?? 50;

  normalized.meta.axis ??= "（不明）";
  normalized.meta.level ??= "標準（出生時間なし）";

  return normalized;
}

/* =========================
  data.js（POOLS）から文章を組み立てる
========================= */
function buildSectionsText({ toneKey, result, seedBase }) {
  const sections = ["overall", "work", "money", "love", "health"];
  const out = [];

  const titles = {
    overall: "🌍 全体運",
    work: "💼 仕事運",
    money: "💰 金運",
    love: "❤️ 恋愛運",
    health: "🫁 健康運",
  };

  for (const sec of sections) {
    const score = result.scores?.[sec];
    const band = toBand(score);

    const pool = window.POOLS?.sections?.[sec]?.[toneKey]?.[band];
    const chosen = pickDeterministic(pool, seedBase, `${sec}:${toneKey}:${band}:${result.typeKey}`);

    out.push(`## ${titles[sec] || sec}`);
    out.push(chosen || "（文章が見つからないよ。data.js の POOLS を確認してね）");
    out.push("");
  }

  return out.join("\n");
}

/* =========================
  出力の組み立て
========================= */
function formatDateJP(dobStr) {
  if (!dobStr) return "（未入力）";
  const d = new Date(dobStr);
  if (Number.isNaN(d.getTime())) return "（不正な日付）";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function safeTrim(s) {
  return (s ?? "").toString().trim();
}

function buildOutput({ input, toneKey, result }) {
  const seedBase = xfnv1a(
    [
      safeTrim(input.name),
      safeTrim(input.kana),
      safeTrim(input.dob),
      safeTrim(input.pref),
      safeTrim(input.birthTime),
      toneKey,
      result.typeKey,
    ].join("|")
  );

  const header = [];
  header.push(`# 🔮 占い結果`);
  header.push("");
  header.push(`名前：${safeTrim(input.name) || "（未入力）"}`);
  if (safeTrim(input.kana)) header.push(`ふりがな：${safeTrim(input.kana)}`);
  header.push(`生年月日：${formatDateJP(input.dob)}`);
  header.push(`出生地：${safeTrim(input.pref) || "（未選択）"}`);
  header.push(`出生時間：${safeTrim(input.birthTime) || "不明"}`);
  header.push(`口調：${toneKey === "soft" ? "やさしめ" : toneKey === "standard" ? "標準" : "毒舌"}`);
  header.push("");

  header.push(`## 🧸 クマタイプ`);
  header.push(`あなたは **${result.typeKey}** タイプだよ。`);
  if (result?.meta?.typeOneLine) header.push(`ひとこと：${result.meta.typeOneLine}`);
  header.push("");

  header.push(`## ✅ 今日の3ステップ`);
  header.push(`1) （あとで data.js から入れる枠）`);
  header.push(`2) （あとで data.js から入れる枠）`);
  header.push(`3) （あとで data.js から入れる枠）`);
  header.push("");

  const body = buildSectionsText({ toneKey, result, seedBase });
  return header.join("\n") + body;
}

/* =========================
  time UI（不明/入力 + 時 + 00/30）
========================= */
function openTimePick(open) {
  const pick = document.getElementById("timePick");
  if (!pick) return;
  pick.classList.toggle("isOpen", !!open);
  pick.setAttribute("aria-hidden", open ? "false" : "true");
}

function setMinActive(min) {
  const b00 = document.getElementById("min00");
  const b30 = document.getElementById("min30");
  if (b00) b00.classList.toggle("isActive", min === "00");
  if (b30) b30.classList.toggle("isActive", min === "30");
}

function readTimeFromUI() {
  const modeUnknown = document.getElementById("timeModeUnknown");
  const modeSet = document.getElementById("timeModeSet");
  const timeValueEl = document.getElementById("timeValue");
  const hourEl = document.getElementById("timeHour");

  const isSet = modeSet?.checked;
  if (!isSet) {
    if (timeValueEl) timeValueEl.value = "不明";
    return "不明";
  }

  const hh = hourEl?.value;
  const mm = (document.getElementById("min30")?.classList.contains("isActive")) ? "30" : "00";

  if (!hh) {
    if (timeValueEl) timeValueEl.value = "不明";
    return "不明";
  }

  const t = `${hh}:${mm}`;
  if (timeValueEl) timeValueEl.value = t;
  return t;
}

function applyTimeToUI(timeStr) {
  const modeUnknown = document.getElementById("timeModeUnknown");
  const modeSet = document.getElementById("timeModeSet");
  const hourEl = document.getElementById("timeHour");
  const timeValueEl = document.getElementById("timeValue");

  const t = safeTrim(timeStr);
  if (!t || t === "不明") {
    if (modeUnknown) modeUnknown.checked = true;
    openTimePick(false);
    if (timeValueEl) timeValueEl.value = "不明";
    setMinActive("00");
    if (hourEl) hourEl.value = "";
    return;
  }

  // "HH:MM" 前提
  const [hh, mm] = t.split(":");
  if (modeSet) modeSet.checked = true;
  openTimePick(true);
  if (hourEl) hourEl.value = hh || "";
  setMinActive(mm === "30" ? "30" : "00");
  if (timeValueEl) timeValueEl.value = t;
}

/* =========================
  UI入力取得
========================= */
function getInputFromUI() {
  return {
    name: $("#name")?.value ?? "",
    kana: $("#kana")?.value ?? "",
    dob: $("#dob")?.value ?? "",
    pref: $("#pref")?.value ?? "",
    birthTime: readTimeFromUI(), // ★ここが重要（#birthTime は使わない）
    tone: $("#tone")?.value ?? "standard",
  };
}

function applyInputToUI(saved) {
  if (!saved) return;
  setValue("name", saved.name);
  setValue("kana", saved.kana);
  setValue("dob", saved.dob);
  setValue("pref", saved.pref);
  setValue("tone", saved.tone || "standard");
  applyTimeToUI(saved.birthTime || "不明");
}

function clearUI() {
  setValue("name", "");
  setValue("kana", "");
  setValue("dob", "");
  setValue("pref", "");
  setValue("tone", "standard");
  applyTimeToUI("不明");

  setValue("out", "");
  setText("badgeType", "-");
  setText("badgeAxis", "-");
  setText("badgeLevel", "-");
  setText("typeName", "-");
  setText("typeOneLine", "-");

  const img = document.getElementById("typeImg");
  if (img) {
    img.removeAttribute("src");
    img.style.display = "none";
  }
}

function updateBadges(result) {
  setText("badgeType", result?.typeKey ?? "-");
  setText("badgeAxis", result?.meta?.axis ?? "-");
  setText("badgeLevel", result?.meta?.level ?? "-");

  // タイプ表示枠（index.html 側にある）
  setText("typeName", result?.meta?.typeName ?? result?.typeKey ?? "-");
  setText("typeOneLine", result?.meta?.typeOneLine ?? "-");

  // 画像（あれば）
  const img = document.getElementById("typeImg");
  const src = result?.meta?.typeImg;
  if (img) {
    if (src) {
      img.src = src;
      img.style.display = "block";
    } else {
      img.removeAttribute("src");
      img.style.display = "none";
    }
  }
}

async function onGenerate() {
  const input = getInputFromUI();
  if (!input.dob) {
    alert("生年月日を入力してね");
    return;
  }

  saveInputs(input);

  const toneKey = normalizeTone(input.tone);
  const result = await getFortuneResult(input);

  updateBadges(result);

  const text = buildOutput({ input, toneKey, result });
  const out = $("#out");
  if (out) out.value = text;
}

async function onCopy() {
  const text = $("#out")?.value ?? "";
  if (!text.trim()) return alert("先に生成してね");
  await navigator.clipboard.writeText(text);
  alert("コピーしたよ");
}

function onClear() {
  if (!confirm("入力と結果をクリアする？")) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  clearUI();
}

/* =========================
  初期化
========================= */
function initTimeUIBindings() {
  const modeUnknown = document.getElementById("timeModeUnknown");
  const modeSet = document.getElementById("timeModeSet");

  modeUnknown?.addEventListener("change", () => {
    if (modeUnknown.checked) {
      openTimePick(false);
      readTimeFromUI();
      saveInputs(getInputFromUI());
    }
  });

  modeSet?.addEventListener("change", () => {
    if (modeSet.checked) {
      openTimePick(true);
      readTimeFromUI();
      saveInputs(getInputFromUI());
    }
  });

  document.getElementById("timeHour")?.addEventListener("change", () => {
    readTimeFromUI();
    saveInputs(getInputFromUI());
  });

  document.getElementById("min00")?.addEventListener("click", () => {
    setMinActive("00");
    readTimeFromUI();
    saveInputs(getInputFromUI());
  });

  document.getElementById("min30")?.addEventListener("click", () => {
    setMinActive("30");
    readTimeFromUI();
    saveInputs(getInputFromUI());
  });
}

function init() {
  // 保存入力を復元
  const saved = loadInputs();
  applyInputToUI(saved);

  // time UI
  initTimeUIBindings();

  // ボタン
  $("#gen")?.addEventListener("click", onGenerate);
  $("#copy")?.addEventListener("click", onCopy);
  $("#clear")?.addEventListener("click", onClear);

  // 入力が変わったら保存
  const ids = ["name", "kana", "dob", "pref", "tone"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("change", () => {
      saveInputs(getInputFromUI());
    });
  }

  // 初期時点で timeValue を同期
  readTimeFromUI();
}

document.addEventListener("DOMContentLoaded", init);
