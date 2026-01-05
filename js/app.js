/* =========================================================================
  app.js / Version 10 (patched v10.1)
  - time UI（不明/入力する + 時 + 00/30）対応
  - バッジ更新（badgeType / badgeAxis / badgeLevel）
  - 右上カードの「クマタイプ名・説明」も可能な限り自動で反映
  - data.js の POOLS / TYPES 前提
============================================================================ */

const $ = (sel) => document.querySelector(sel);

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? "";
}
function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? "";
}

// id候補を順に探して見つかったら入れる（UI差分に強くする）
function setTextAny(ids, text) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text ?? "";
      return true;
    }
  }
  return false;
}

// 画像枠がある場合に、srcを入れる（無ければ何もしない）
function setImgAny(ids, src, alt = "") {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.tagName === "IMG") {
      el.src = src;
      el.alt = alt;
      return true;
    }
  }
  return false;
}

/* =========================
  入力保存
========================= */
const STORAGE_KEY = "fortune_generator_v10_inputs";

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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
}

/* =========================
  決定的乱数
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
  スコア → band
========================= */
function toBand(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return "mid";
  if (score >= 67) return "high";
  if (score >= 34) return "mid";
  return "low";
}

/* =========================
  tone正規化
========================= */
function normalizeTone(uiToneValue) {
  if (uiToneValue === "soft" || uiToneValue === "standard" || uiToneValue === "toxic") {
    return uiToneValue;
  }
  return "standard";
}

/* =========================
  fortune.js 呼び出し
========================= */
function runFortuneEngine(input) {
  const engine =
    window.FortuneEngine ||
    window.fortune ||
    window.Fortune ||
    window.fortuneEngine ||
    null;

  const candidates = [
    engine?.run,
    engine?.calc,
    engine?.getResult,
    engine?.generate,
    engine?.makeResult,
    window.runFortune,
    window.calcFortune,
    window.getFortuneResult,
  ].filter(Boolean);

  if (candidates.length === 0) {
    return {
      typeKey: "t01",
      scores: { overall: 50, work: 50, money: 50, love: 50, health: 50 },
      meta: { axis: "-", level: "fortune.js が見つからないためダミー表示", type: null },
    };
  }

  const fn = candidates[0];
  return fn(input);
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

  // meta.type が無い場合、window.TYPES から引く保険
  if (!normalized.meta.type && Array.isArray(window.TYPES)) {
    normalized.meta.type = window.TYPES.find(t => t.key === normalized.typeKey) || null;
  }

  return normalized;
}

/* =========================
  右上カード（タイプ詳細）更新
========================= */
function updateTypeCard(result) {
  const typeKey = result?.typeKey ?? "-";
  const typeObj = result?.meta?.type || (Array.isArray(window.TYPES) ? window.TYPES.find(t => t.key === typeKey) : null);

  const typeName = typeObj?.name || typeKey || "-";
  const typeOneLine = typeObj?.oneLine || "-";
  const axis = result?.meta?.axis || "-";
  const level = result?.meta?.level || "-";

  // idは環境差があり得るので、候補を複数用意
  setTextAny(["typeKey", "cardTypeKey", "resultTypeKey", "kumaTypeKey", "typeCode"], typeKey);
  setTextAny(["typeName", "cardTypeName", "resultTypeName", "kumaTypeName", "typeTitle"], typeName);
  setTextAny(["typeDesc", "typeOneLine", "cardTypeDesc", "resultTypeDesc", "kumaTypeDesc", "typeSubtitle"], typeOneLine);

  setTextAny(["typeAxis", "cardAxis", "resultAxis", "kumaAxis"], axis);
  setTextAny(["typeLevel", "cardLevel", "resultLevel", "kumaLevel"], level);

  // 画像がある場合（data.js の TYPES に img を追加する予定ならここで拾える）
  if (typeObj?.img) {
    setImgAny(["typeImg", "cardTypeImg", "resultTypeImg", "kumaTypeImg"], typeObj.img, typeName);
  }
}

/* =========================
  出力テキスト組み立て（POOLS）
========================= */
function buildSectionsText({ toneKey, result, seedBase }) {
  const sections = ["overall", "work", "money", "love", "health"];
  const out = [];

  for (const sec of sections) {
    const score = result.scores?.[sec];
    const band = toBand(score);

    const pool = window.POOLS?.sections?.[sec]?.[toneKey]?.[band];
    const chosen = pickDeterministic(pool, seedBase, `${sec}:${toneKey}:${band}:${result.typeKey}`);

    const titles = {
      overall: "🌍 全体運",
      work: "💼 仕事運",
      money: "💰 金運",
      love: "❤️ 恋愛運",
      health: "🫁 健康運",
    };

    out.push(`## ${titles[sec] || sec}`);
    out.push(chosen || "（文章が見つからないよ。data.js の POOLS を確認してね）");
    out.push("");
  }

  return out.join("\n");
}

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
      safeTrim(input.timeValue),
      toneKey,
      result.typeKey,
    ].join("|")
  );

  const typeObj = result?.meta?.type || (Array.isArray(window.TYPES) ? window.TYPES.find(t => t.key === result.typeKey) : null);
  const typeName = typeObj?.name || result.typeKey || "-";
  const typeOneLine = typeObj?.oneLine || "";

  const header = [];
  header.push(`# 🔮 占い結果`);
  header.push("");
  header.push(`名前：${safeTrim(input.name) || "（未入力）"}`);
  if (safeTrim(input.kana)) header.push(`ふりがな：${safeTrim(input.kana)}`);
  header.push(`生年月日：${formatDateJP(input.dob)}`);
  header.push(`出生地：${safeTrim(input.pref) || "（未選択）"}`);
  header.push(`出生時間：${safeTrim(input.timeValue) || "不明"}`);
  header.push(`口調：${toneKey === "soft" ? "やさしめ" : toneKey === "standard" ? "標準" : "毒舌"}`);
  header.push("");

  header.push(`## 🧸 クマタイプ`);
  header.push(`あなたのクマタイプは **${typeName}（${result.typeKey}）** だよ。`);
  if (typeOneLine) header.push(typeOneLine);
  header.push("");

  // 本文
  const body = buildSectionsText({ toneKey, result, seedBase });
  return header.join("\n") + body;
}

/* =========================
  time UI（index.html仕様）
========================= */
function setTimePickOpen(isOpen) {
  const tp = document.getElementById("timePick");
  if (!tp) return;
  tp.classList.toggle("isOpen", !!isOpen);
  tp.setAttribute("aria-hidden", String(!isOpen));
}

function setMinuteActive(minStr) {
  const b00 = document.getElementById("min00");
  const b30 = document.getElementById("min30");
  if (b00) b00.classList.toggle("isActive", minStr === "00");
  if (b30) b30.classList.toggle("isActive", minStr === "30");
}

function readTimeValueFromUI() {
  const hidden = document.getElementById("timeValue");
  const modeUnknown = document.getElementById("timeModeUnknown");
  const modeSet = document.getElementById("timeModeSet");
  const hourSel = document.getElementById("timeHour");

  const unknownChecked = !!modeUnknown?.checked;
  const setChecked = !!modeSet?.checked;

  if (unknownChecked || !setChecked) {
    if (hidden) hidden.value = "不明";
    return "不明";
  }

  const hh = hourSel?.value;
  const mm = (hidden?.dataset?.min) || "00";

  if (!hh) {
    if (hidden) hidden.value = "不明";
    return "不明";
  }

  const val = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
  if (hidden) hidden.value = val;
  return val;
}

function writeTimeValueToUI(timeValue) {
  const hidden = document.getElementById("timeValue");
  const modeUnknown = document.getElementById("timeModeUnknown");
  const modeSet = document.getElementById("timeModeSet");
  const hourSel = document.getElementById("timeHour");

  if (!timeValue || timeValue === "不明") {
    if (modeUnknown) modeUnknown.checked = true;
    if (modeSet) modeSet.checked = false;
    setTimePickOpen(false);
    if (hidden) hidden.value = "不明";
    return;
  }

  const m = String(timeValue).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    if (hidden) hidden.value = "不明";
    return;
  }

  const hh = String(m[1]).padStart(2,"0");
  const mm = m[2] === "30" ? "30" : "00";

  if (modeUnknown) modeUnknown.checked = false;
  if (modeSet) modeSet.checked = true;
  setTimePickOpen(true);

  if (hourSel) hourSel.value = hh;
  if (hidden) {
    hidden.value = `${hh}:${mm}`;
    hidden.dataset.min = mm;
  }
  setMinuteActive(mm);
}

/* =========================
  UI 入出力
========================= */
function getInputFromUI() {
  return {
    name: $("#name")?.value ?? "",
    kana: $("#kana")?.value ?? "",
    dob: $("#dob")?.value ?? "",
    pref: $("#pref")?.value ?? "",
    timeValue: readTimeValueFromUI(),
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
  writeTimeValueToUI(saved.timeValue || "不明");
}

function clearUI() {
  setValue("name", "");
  setValue("kana", "");
  setValue("dob", "");
  setValue("pref", "");
  setValue("tone", "standard");
  writeTimeValueToUI("不明");
  setValue("out", "");
  setText("badgeType", "-");
  setText("badgeAxis", "-");
  setText("badgeLevel", "-");

  // 右上カードもクリア
  updateTypeCard({ typeKey: "-", meta: { type: null, axis: "-", level: "-" } });
}

function updateBadges(result) {
  setText("badgeType", result?.typeKey ?? "-");
  setText("badgeAxis", result?.meta?.axis ?? "-");
  setText("badgeLevel", result?.meta?.level ?? "-");
}

/* =========================
  ボタン処理
========================= */
async function onGenerate() {
  const input = getInputFromUI();
  if (!input.dob) {
    alert("生年月日を入力してね");
    return;
  }

  saveInputs(input);

  const toneKey = normalizeTone(input.tone);

  const engineInput = {
    name: input.name,
    kana: input.kana,
    dob: input.dob,
    pref: input.pref,
    birthTime: input.timeValue,
  };

  const result = await getFortuneResult(engineInput);

  updateBadges(result);
  updateTypeCard(result);

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
function bindTimeUI() {
  const modeUnknown = document.getElementById("timeModeUnknown");
  const modeSet = document.getElementById("timeModeSet");
  const hourSel = document.getElementById("timeHour");
  const b00 = document.getElementById("min00");
  const b30 = document.getElementById("min30");
  const hidden = document.getElementById("timeValue");

  setTimePickOpen(!!modeSet?.checked);

  modeUnknown?.addEventListener("change", () => {
    if (modeUnknown.checked) {
      setTimePickOpen(false);
      if (hidden) {
        hidden.value = "不明";
        delete hidden.dataset.min;
      }
      saveInputs(getInputFromUI());
    }
  });

  modeSet?.addEventListener("change", () => {
    if (modeSet.checked) {
      setTimePickOpen(true);
      if (hidden && !hidden.dataset.min) hidden.dataset.min = "00";
      setMinuteActive(hidden?.dataset?.min || "00");
      saveInputs(getInputFromUI());
    }
  });

  hourSel?.addEventListener("change", () => {
    saveInputs(getInputFromUI());
  });

  function setMin(minStr) {
    if (hidden) hidden.dataset.min = minStr;
    setMinuteActive(minStr);
    readTimeValueFromUI();
    saveInputs(getInputFromUI());
  }

  b00?.addEventListener("click", () => setMin("00"));
  b30?.addEventListener("click", () => setMin("30"));
}

function init() {
  const saved = loadInputs();
  applyInputToUI(saved);

  $("#gen")?.addEventListener("click", onGenerate);
  $("#copy")?.addEventListener("click", onCopy);
  $("#clear")?.addEventListener("click", onClear);

  bindTimeUI();

  const ids = ["name", "kana", "dob", "pref", "tone", "timeHour"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("change", () => saveInputs(getInputFromUI()));
  }
}

document.addEventListener("DOMContentLoaded", init);
