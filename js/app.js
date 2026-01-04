/*
  Version 10 (internal memo)
  - kana保存/読み込み対応
  - time：不明/入力切替 + 時(0-23) + 分(00/30) の短いUIに変更
*/

import { $, loadForm, saveForm, clearForm, safeTrim, formatDateJP, hashString, mulberry32, pickBySeed } from "./utils.js";
import { PREFS, TONES, POOLS, TYPES, HOURS, MINUTES } from "./data.js";
import { buildFortune } from "./fortune.js";

const YEAR_NOW = new Date().getFullYear();

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
    kana: $("kana").value,
    dob: $("dob").value,
    pref: $("pref").value,
    time: $("timeValue").value, // hidden
    tone: $("tone").value,

    // time UI state
    timeMode: $("timeModeSet").checked ? "set" : "unknown",
    timeHour: $("timeHour").value,
    timeMin: $("min30").classList.contains("isActive") ? "30" : "00"
  };
}

function writeForm(v){
  $("name").value = v?.name ?? "";
  $("kana").value = v?.kana ?? "";
  $("dob").value  = v?.dob ?? "";
  $("pref").value = v?.pref ?? "未選択";
  $("tone").value = v?.tone ?? "standard";

  // time restore
  const mode = v?.timeMode ?? "unknown";
  if (mode === "set"){
    $("timeModeSet").checked = true;
    openTimePick(true);
  }else{
    $("timeModeUnknown").checked = true;
    openTimePick(false);
  }

  $("timeHour").value = v?.timeHour ?? "00";
  setMinute(v?.timeMin ?? "00");

  // hidden value
  syncTimeValue();
}

function autoSave(){ saveForm(readForm()); }

function bindAutoSave(){
  ["name","kana","dob","pref","tone","timeHour"].forEach(id=>{
    $(id).addEventListener("change", autoSave);
    $(id).addEventListener("input", autoSave);
  });

  $("timeModeUnknown").addEventListener("change", ()=>{ openTimePick(false); syncTimeValue(); autoSave(); });
  $("timeModeSet").addEventListener("change", ()=>{ openTimePick(true);  syncTimeValue(); autoSave(); });

  $("min00").addEventListener("click", ()=>{ setMinute("00"); syncTimeValue(); autoSave(); });
  $("min30").addEventListener("click", ()=>{ setMinute("30"); syncTimeValue(); autoSave(); });
}

function openTimePick(open){
  const box = $("timePick");
  if (open){
    box.classList.add("isOpen");
    box.setAttribute("aria-hidden","false");
  }else{
    box.classList.remove("isOpen");
    box.setAttribute("aria-hidden","true");
  }
}

function setMinute(mm){
  $("min00").classList.toggle("isActive", mm==="00");
  $("min30").classList.toggle("isActive", mm==="30");
}

function syncTimeValue(){
  if ($("timeModeUnknown").checked){
    $("timeValue").value = "不明";
    return;
  }
  const hh = $("timeHour").value || "00";
  const mm = $("min30").classList.contains("isActive") ? "30" : "00";
  $("timeValue").value = `${hh}:${mm}`;
}

function bucketKey(profile){
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
    lines.push("全体はバランス型。派手さより、続けやすい形に寄せると安定するよ。");
  }
  return lines;
}

function buildText({ form, fortune }){
  const tonePack = TONES[form.tone] ?? TONES.standard;

  const seed = hashString(`${fortune.meta.seed}|${form.tone}|v10`);
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
  const kana = safeTrim(form.kana);
  const pref = (form.pref && form.pref !== "未選択") ? form.pref : "（未入力）";
  const time = (form.time && form.time !== "不明") ? form.time : "不明";

  const lines = [];
  lines.push(`# 🐻 クマ占い：${name}`);
  if (kana) lines.push(`ふりがな：${kana}`);
  lines.push("");
  lines.push(`生年月日：${formatDateJP(birth)}`);
  lines.push(`出生地：${pref}`);
  lines.push(`出生時間：${time}`);
  lines.push("");

  lines.push(`## ✅ あなたのクマタイプ：${fortune.type.name}`);
  lines.push(`${fortune.type.oneLine}`);
  lines.push("");

  lines.push(`## ✨ まとめ（統合メッセージ）`);
  lines.push(`${opener}`);
  lines.push("");
  for (const c of coreLines) lines.push(`- ${c}`);
  lines.push("");
  lines.push(`（ひとこと：${praise}。今日は${nudge}。）`);
  lines.push("");

  lines.push(`## 🧾 3行コメント（根拠は“傾向”として）`);
  lines.push(`- ${reason}`);
  lines.push(`- 今のあなたは「得意な軸」を伸ばすほど、全体が整いやすいよ。`);
  lines.push(`- 逆に、全部を同時に完璧にしようとすると崩れやすい。優先順位が勝ち。`);
  lines.push("");

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

  lines.push(`## 📌 今日の3ステップ（折りたたみ風）`);
  lines.push(`- ${steps[0]}`);
  lines.push(`- ${steps[1]}`);
  lines.push(`- ${steps[2]}`);
  lines.push("");

  lines.push(`## 🕊 最後に`);
  lines.push(sFinal);
  lines.push("");
  lines.push(closer);

  return lines.join("\n");
}

function updateTypeUI(fortune){
  $("badgeType").textContent = fortune.type.name;
  $("badgeAxis").textContent = fortune.meta.axis;
  $("badgeLevel").textContent = fortune.meta.level;

  $("typeName").textContent = fortune.type.name;
  $("typeOneLine").textContent = fortune.type.oneLine;

  const img = $("typeImg");
  img.src = `./assets/illust/${fortune.type.key}.png`;
  img.onload = () => { img.style.display = "block"; };
  img.onerror = () => { img.style.display = "none"; };
}

/* init */
initSelect("pref", PREFS);
initSelect("timeHour", HOURS);
setMinute("00");
syncTimeValue();

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
    kana: form.kana,
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
  writeForm({ 
    name:"", kana:"", dob:"", pref:"未選択", tone:"standard",
    timeMode:"unknown", timeHour:"00", timeMin:"00"
  });

  $("out").value = "";
  $("badgeType").textContent = "-";
  $("badgeAxis").textContent = "-";
  $("badgeLevel").textContent = "-";
  $("typeName").textContent = "-";
  $("typeOneLine").textContent = "-";
  $("typeImg").style.display = "none";
  clearForm();
});
