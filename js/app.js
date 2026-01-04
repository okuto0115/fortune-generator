/* =========================================================
  app.js / Version 1
  - UI操作
  - 入力を保存（セッション保持）
  - 出力：タイプ宣言 + 詳細鑑定（ボタン1回で全部）
========================================================= */

import { $, loadForm, saveForm, clearForm, safeTrim, formatDateJP, hashString, mulberry32, pickBySeed } from "./utils.js";
import { PREFS, buildTimeOptions, TONES, POOLS, TYPES } from "./data.js";
import { buildFortune } from "./fortune.js";

const YEAR_NOW = new Date().getFullYear(); // 今年の年（GitHub PagesでもOK）

function initSelect(id, options){
  const el = $(id);
  el.innerHTML = "";
  for (const op of options){
    const o = document.createElement("option");
    o.value = op;
    o.textContent = op;
    el.appendChild(o);
  }
}

function readForm(){
  return {
    name: $("name").value,
    dob: $("dob").value,
    pref: $("pref").value,
    time: $("time").value,
    tone: $("tone").value
  };
}

function writeForm(v){
  $("name").value = v?.name ?? "";
  $("dob").value = v?.dob ?? "";
  $("pref").value = v?.pref ?? "未選択";
  $("time").value = v?.time ?? "不明";
  $("tone").value = v?.tone ?? "standard";
}

function autoSave(){
  saveForm(readForm());
}

function bucketKey(profile){
  // ざっくり：上位軸で今日の3ステップを選ぶ
  const entries = Object.entries(profile).sort((a,b)=>b[1]-a[1]);
  const top = entries[0][0];
  if (top === "WORK" || top === "MONEY") return "focus";
  if (top === "LOVE") return "socialize";
  return "energyUp";
}

function pickCoreLines(profile, rnd){
  const lines = [];
  if (profile.WORK >= 70) lines.push(pickBySeed(POOLS.core.workHigh, rnd));
  if (profile.LOVE >= 70) lines.push(pickBySeed(POOLS.core.loveHigh, rnd));
  if (profile.MONEY >= 70) lines.push(pickBySeed(POOLS.core.moneyHigh, rnd));
  if (profile.LIFE >= 70) lines.push(pickBySeed(POOLS.core.lifeHigh, rnd));
  if (lines.length === 0){
    // どれも高くない＝バランス寄り
    lines.push("全体はバランス型。派手さより、続けやすい形に寄せると安定するよ。");
  }
  return lines;
}

function buildText({ form, fortune }){
  const tonePack = TONES[form.tone] ?? TONES.standard;

  // seed：毎回結果ブレないように
  const seed = hashString(`${fortune.meta.seed}|${form.tone}|v1`);
  const rnd = mulberry32(seed);

  const birth = new Date(form.dob);

  const opener = pickBySeed(tonePack.opener, rnd);
  const closer = pickBySeed(tonePack.closer, rnd);
  const praise = pickBySeed(tonePack.spice.praise, rnd);
  const nudge  = pickBySeed(tonePack.spice.nudge, rnd);

  const coreLines = pickCoreLines(fortune.profile, rnd);
  const reason = pickBySeed(POOLS.reasonLines, rnd);

  const stepsKey = bucketKey(fortune.profile);
  const steps = pickBySeed(POOLS.todaySteps[stepsKey], rnd);

  const sec = POOLS.sections;
  const sOverall = pickBySeed(sec.overall, rnd);
  const sWork    = pickBySeed(sec.work, rnd);
  const sMoney   = pickBySeed(sec.money, rnd);
  const sLove    = pickBySeed(sec.love, rnd);
  const sHealth  = pickBySeed(sec.health, rnd);
  const sFinal   = pickBySeed(sec.final, rnd);

  const name = safeTrim(form.name) || "（名前未入力）";
  const pref = (form.pref && form.pref !== "未選択") ? form.pref : "（未入力）";
  const time = (form.time && form.time !== "不明") ? form.time : "不明";

  const lines = [];
  lines.push(`# 🐻 クマ占い：${name}`);
  lines.push("");
  lines.push(`生年月日：${formatDateJP(birth)}`);
  lines.push(`出生地：${pref}`);
  lines.push(`出生時間：${time}`);
  lines.push("");

  // タイプ宣言（ここが“最初に出す”部分）
  lines.push(`## ✅ あなたのクマタイプ：${fortune.type.name}`);
  lines.push(`${fortune.type.oneLine}`);
  lines.push("");

  // 統合のひとこと
  lines.push(`## ✨ まとめ（統合メッセージ）`);
  lines.push(`${opener}`);
  lines.push("");
  for (const c of coreLines){
    lines.push(`- ${c}`);
  }
  lines.push("");
  lines.push(`（ひとこと：${praise}。今日は${nudge}。）`);
  lines.push("");

  // 根拠っぽい3行（でも専門用語なし）
  lines.push(`## 🧾 3行コメント（根拠は“傾向”として）`);
  lines.push(`- ${reason}`);
  lines.push(`- 今のあなたは「得意な軸」を伸ばすほど、全体が整いやすいよ。`);
  lines.push(`- 逆に、全部を同時に完璧にしようとすると崩れやすい。優先順位が勝ち。`);
  lines.push("");

  // 詳細鑑定（人生メイン）
  lines.push(`## 🌍 人生の流れ`);
  lines.push(sOverall);
  lines.push("");

  lines.push(`## 💼 仕事`);
  lines.push(sWork);
  lines.push("");

  lines.push(`## 💰 お金`);
  lines.push(sMoney);
  lines.push("");

  lines.push(`## ❤️ 恋愛`);
  lines.push(sLove);
  lines.push("");

  lines.push(`## 🫧 健康・メンタル`);
  lines.push(sHealth);
  lines.push("");

  // 今日の3ステップ（折りたたみ）
  lines.push(`## 📌 今日の3ステップ`);
  lines.push(`<details>`);
  lines.push(`<summary>タップして開く</summary>`);
  lines.push(`- ${steps[0]}`);
  lines.push(`- ${steps[1]}`);
  lines.push(`- ${steps[2]}`);
  lines.push(`</details>`);
  lines.push("");

  lines.push(`## 🕊 最後に`);
  lines.push(sFinal);
  lines.push("");
  lines.push(closer);

  // textareaはHTMLタグもそのまま表示されるので、折りたたみは “出力テキスト”には効かない
  // → なのでここだけ：出力テキスト上では折りたたみ“風”にする（公開用）
  // 開発者メモ：将来、結果をHTML表示に切り替えるなら details を生かせる
  const txt = lines.join("\n")
    .replaceAll("<details>", "（折りたたみ：ここから）")
    .replaceAll("</details>", "（折りたたみ：ここまで）")
    .replaceAll("<summary>タップして開く</summary>", "");

  return txt;
}

function updateTypeUI(fortune){
  $("badgeType").textContent = fortune.type.name;
  $("badgeAxis").textContent = fortune.meta.axis;
  $("badgeLevel").textContent = fortune.meta.level;

  $("typeName").textContent = fortune.type.name;
  $("typeOneLine").textContent = fortune.type.oneLine;

  const img = $("typeImg");
  // 画像がない場合でも崩れない
  img.src = `./assets/illust/${fortune.type.key}.png`;
  img.onload = () => { img.style.display = "block"; };
  img.onerror = () => { img.style.display = "none"; };
}

function bindAutoSave(){
  ["name","dob","pref","time","tone"].forEach(id=>{
    $(id).addEventListener("change", autoSave);
    $(id).addEventListener("input", autoSave);
  });
}

/* init */
initSelect("pref", PREFS);
initSelect("time", buildTimeOptions());

const saved = loadForm();
if (saved) writeForm(saved);
bindAutoSave();

$("gen").addEventListener("click", ()=>{
  const form = readForm();
  if (!form.dob){
    alert("生年月日を入力してね");
    return;
  }

  const fortune = buildFortune({
    name: form.name,
    dobStr: form.dob,
    pref: form.pref,
    time: form.time,
    yearNow: YEAR_NOW
  });

  updateTypeUI(fortune);
  $("out").value = buildText({ form, fortune });
  autoSave();
});

$("copy").addEventListener("click", async ()=>{
  const text = $("out").value;
  if (!text.trim()) return alert("先に出力してね");
  await navigator.clipboard.writeText(text);
  alert("コピーしたよ");
});

$("clear").addEventListener("click", ()=>{
  writeForm({ name:"", dob:"", pref:"未選択", time:"不明", tone:"standard" });
  $("out").value = "";
  $("badgeType").textContent = "-";
  $("badgeAxis").textContent = "-";
  $("badgeLevel").textContent = "-";
  $("typeName").textContent = "-";
  $("typeOneLine").textContent = "-";
  $("typeImg").style.display = "none";
  clearForm();
});
