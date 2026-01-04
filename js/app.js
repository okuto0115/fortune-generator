/* =========================================================================
  Version 10  app.js  (FULL)
  - UI接続 + 文章選択ロジック（data.jsのPOOLSから選ぶ）
  - fortune.js は“占い結果を出すだけ”に寄せる想定（ここでは改変しない）
  - 関数名や戻り値が多少違っても動くように保険を入れてる
  - 入力値は localStorage に保存して、次回も残る
============================================================================ */

/* =========================
  0) DOMユーティリティ
========================= */
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
  1) 入力保存（セッション残す）
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

/* =========================
  2) 文章選択のための “決定的”乱数
     - 同じ入力なら同じ文章を選ぶ（公開向き）
========================= */
function xfnv1a(str) {
  // 32bit hash
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
  3) スコア → high/mid/low
     - fortune.js が 0-100 or -? を返しても “だいたい”で丸める
========================= */
function toBand(score) {
  // score が無い場合は mid
  if (typeof score !== "number" || Number.isNaN(score)) return "mid";
  // 0〜100想定
  if (score >= 67) return "high";
  if (score >= 34) return "mid";
  return "low";
}

/* =========================
  4) toneキーの正規化（UIは やさしめ/標準/毒舌）
========================= */
function normalizeTone(uiToneValue) {
  // UI側の value は "soft" | "standard" | "toxic" を想定
  if (uiToneValue === "soft" || uiToneValue === "standard" || uiToneValue === "toxic") {
    return uiToneValue;
  }
  // もし旧値が来ても救う
  if (uiToneValue === "clear") return "standard";
  return "soft";
}

/* =========================
  5) fortune.js 呼び出し（関数名が違っても拾う）
     - 返り値は result オブジェクトに寄せる
========================= */
function runFortuneEngine(input) {
  // fortune.js側がどんなエクスポートでも拾う保険
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
    // どうしても無ければ、最低限のダミー（表示テスト用）
    return {
      typeKey: "kuma01",
      scores: { overall: 50, work: 50, money: 50, love: 50, health: 50 },
      meta: { note: "fortune.js が見つからないためダミー表示" },
    };
  }

  // 1つ目を使う
  const fn = candidates[0];
  const out = fn(input);

  // promiseでも同期でもOKにする
  return out;
}

async function getFortuneResult(input) {
  const out = runFortuneEngine(input);
  const result = (out && typeof out.then === "function") ? await out : out;

  // 返り値を正規化
  const normalized = {
    typeKey: result?.typeKey || result?.kumaType || result?.type || "kuma01",
    scores: result?.scores || result?.score || {},
    meta: result?.meta || result?.details || {},
  };

  // scoresが不足してたら埋める（落ちないため）
  normalized.scores.overall ??= result?.overallScore ?? 50;
  normalized.scores.work ??= result?.workScore ?? 50;
  normalized.scores.money ??= result?.moneyScore ?? 50;
  normalized.scores.love ??= result?.loveScore ?? 50;
  normalized.scores.health ??= result?.healthScore ?? 50;

  return normalized;
}

/* =========================
  6) data.js（POOLS）から文章を組み立てる
========================= */
function buildSectionsText({ toneKey, result, seedBase }) {
  // 期待する sections
  const sections = ["overall", "work", "money", "love", "health"];

  const out = [];
  for (const sec of sections) {
    const score = result.scores?.[sec];
    const band = toBand(score);

    const pool = POOLS?.sections?.[sec]?.[toneKey]?.[band];
    const chosen = pickDeterministic(pool, seedBase, `${sec}:${toneKey}:${band}:${result.typeKey}`);

    // セクション見出し（初心者が後で変えやすい固定）
    const titles = {
      overall: "🌍 全体運",
      work: "💼 仕事運",
      money: "💰 金運",
      love: "❤️ 恋愛運",
      health: "🫁 健康運",
    };

    out.push(`## ${titles[sec] || sec}`);
    out.push(chosen || "（文章が見つからないよ。data.js の POOLS を確認してね）");
    out.push(""); // 改行
  }
  return out.join("\n");
}

/* =========================
  7) 出力の組み立て（1ボタンで全部出す）
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

  // クマタイプ宣言（イラスト連携しやすい）
  header.push(`## 🧸 クマタイプ`);
  header.push(`あなたは **${result.typeKey}** タイプだよ。`);
  header.push("");

  // 今日の3ステップ（折りたたみで出す前提のテキスト枠）
  // ※現時点は「枠だけ」。後でfortune.js側の根拠付きステップを入れられる
  header.push(`## ✅ 今日の3ステップ`);
  header.push(`（アプリ側では折りたたみ表示にしてあるよ）`);
  header.push("");

  // 本文（全体運〜健康運）
  const body = buildSectionsText({ toneKey, result, seedBase });

  return header.join("\n") + body;
}

/* =========================
  8) UIイベント
========================= */
function getInputFromUI() {
  return {
    name: $("#name")?.value ?? "",
    // ふりがな欄（将来用：無くてもOK。UIに無ければ空）
    kana: $("#kana")?.value ?? "",
    dob: $("#dob")?.value ?? "",
    // 都道府県プルダウン
    pref: $("#pref")?.value ?? "",
    // 時刻のUI（プルダウン or 入力）
    birthTime: $("#birthTime")?.value ?? "",
    // 口調
    tone: $("#tone")?.value ?? "soft",
  };
}

function applyInputToUI(saved) {
  if (!saved) return;
  setValue("name", saved.name);
  setValue("kana", saved.kana);
  setValue("dob", saved.dob);
  setValue("pref", saved.pref);
  setValue("birthTime", saved.birthTime);
  setValue("tone", saved.tone || "soft");
}

function clearUI() {
  setValue("name", "");
  setValue("kana", "");
  setValue("dob", "");
  setValue("pref", "");
  setValue("birthTime", "");
  setValue("tone", "soft");
  setValue("out", "");
  setText("badgeType", "-");
  setText("badgeBand", "-");
}

function updateBadges(result) {
  // バッジ（UIに要素がある場合のみ）
  setText("badgeType", result?.typeKey ?? "-");
  // overallだけ代表で band を出す
  const b = toBand(result?.scores?.overall);
  setText("badgeBand", b ?? "-");
}

async function onGenerate() {
  const input = getInputFromUI();
  if (!input.dob) {
    alert("生年月日を入力してね");
    return;
  }

  // 入力保存
  saveInputs(input);

  const toneKey = normalizeTone(input.tone);
  const result = await getFortuneResult(input);

  updateBadges(result);

  const text = buildOutput({ input, toneKey, result });
  const out = $("#out");
  if (out) out.value = text;

  // 「今日の3ステップ」を折りたたみに出す（UIがあれば）
  // ここは今はダミー。後で result.meta.steps とかに差し替えできる
  const stepsEl = $("#steps");
  if (stepsEl) {
    const steps = result?.meta?.steps;
    if (Array.isArray(steps) && steps.length) {
      stepsEl.innerHTML = steps.map((s) => `<li>${s}</li>`).join("");
    } else {
      stepsEl.innerHTML = `<li>今日は「ひとつ整える」だけで勝ちだよ。</li><li>連絡は短くでOK。止めないのが強いよ。</li><li>最後に深呼吸して、早めに寝ようね。</li>`;
    }
  }
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
  9) 初期化
========================= */
function init() {
  // 保存入力を復元
  const saved = loadInputs();
  applyInputToUI(saved);

  // ボタン紐付け
  $("#gen")?.addEventListener("click", onGenerate);
  $("#copy")?.addEventListener("click", onCopy);
  $("#clear")?.addEventListener("click", onClear);

  // 入力が変わったら自動保存（任意：初心者に優しい）
  const ids = ["name", "kana", "dob", "pref", "birthTime", "tone"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("change", () => {
      const input = getInputFromUI();
      saveInputs(input);
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
