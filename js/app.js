/*
  app.js / Version 1
  ------------------------------------------------------------
  ✅ 入力の保持（localStorage）
  ✅ 都道府県/出生時間：プルダウン
  ✅ 生成ボタン1回で：
     - 人生鑑定（メイン）を出す
     - 今日の3ステップ（折りたたみ）も更新
*/

import { pad2 } from "./utils.js";
import {
  lifePath,
  calcZodiacSign,
  signElement,
  typeKeyFrom,
  buildTodayBonus,
  buildPublicText,
  TEXT_DB
} from "./fortune.js";

/* ====== 定数 ====== */
const STORAGE_KEY = "kuma_fortune_v1_form";

const PREFECTURES = [
  "都道府県",
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"
];

const TIME_BLOCKS = [
  { value:"unknown", label:"不明", hour:12, min:0 },
  { value:"early",   label:"早朝（5–8）", hour:6,  min:30 },
  { value:"morning", label:"午前（8–12）", hour:9, min:30 },
  { value:"noon",    label:"昼（12–15）", hour:13, min:30 },
  { value:"eve",     label:"夕方（15–18）", hour:16, min:30 },
  { value:"night",   label:"夜（18–22）", hour:20, min:0 },
  { value:"late",    label:"深夜（22–5）", hour:23, min:30 },
];

/* ====== DOM ====== */
const $ = (id)=>document.getElementById(id);

/* ====== select初期化 ====== */
function initSelect(id, items, getValue=(x)=>x, getLabel=(x)=>x){
  const el = $(id);
  el.innerHTML = "";
  for (const it of items){
    const opt = document.createElement("option");
    opt.value = getValue(it);
    opt.textContent = getLabel(it);
    el.appendChild(opt);
  }
}

/* ====== 保存/復元 ====== */
function readSaved(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}
function writeSaved(st){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(st)); }catch{}
}
function clearSaved(){
  try{ localStorage.removeItem(STORAGE_KEY); }catch{}
}

function currentState(){
  return {
    name: $("name").value ?? "",
    dob: $("dob").value ?? "",
    place: $("place").value ?? "都道府県",
    time: $("time").value ?? "unknown",
    tone: $("tone").value ?? "normal",
  };
}
function applyState(st){
  if (!st) return;
  if (typeof st.name === "string") $("name").value = st.name;
  if (typeof st.dob === "string") $("dob").value = st.dob;
  if (typeof st.place === "string") $("place").value = st.place;
  if (typeof st.time === "string") $("time").value = st.time;
  if (typeof st.tone === "string") $("tone").value = st.tone;
}

let saveTimer = null;
function scheduleSave(){
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(()=> writeSaved(currentState()), 120);
}

function wireAutoSave(){
  ["name","dob","place","time","tone"].forEach(id=>{
    $(id).addEventListener("input", scheduleSave);
    $(id).addEventListener("change", scheduleSave);
  });
}

/* ====== 今日の元素（簡易） ======
   ※本格的にするなら天体計算が必要。
   今は「今日の日付から擬似的に月の元素を回す」だけ。
   “根拠”は「日付→決定的」になっているので、適当ランダムではない。
*/
function todayElemFromDate(todayStr){
  const elems = ["FIRE","EARTH","AIR","WATER"];
  // 文字列を元に決定的に選ぶ
  let sum = 0;
  for (const ch of todayStr) sum += ch.charCodeAt(0);
  return elems[sum % elems.length];
}
function getTodayStr(){
  const now = new Date();
  const y = now.getFullYear();
  const m = pad2(now.getMonth()+1);
  const d = pad2(now.getDate());
  return `${y}-${m}-${d}`;
}

/* ====== 生成 ====== */
function handleGenerate(){
  const dobStr = $("dob").value;
  if (!dobStr) return alert("生年月日を入力してね");

  const name = $("name").value.trim();
  const toneKey = $("tone").value;
  const place = $("place").value;
  const timeKey = $("time").value;

  // メイン判定：太陽星座 + 数秘 → 20タイプ
  const birthDate = new Date(dobStr);
  const sunSign = calcZodiacSign(birthDate);
  const lp = lifePath(dobStr);
  const typeKey = typeKeyFrom(sunSign, lp);

  // 今日（おまけ）の根拠
  const todayStr = getTodayStr();
  const youElem = signElement(sunSign);
  const todayElem = todayElemFromDate(todayStr);

  const ctx = {
    name, dobStr, place,
    timeKey,
    toneKey,
    sunSign,
    lp,
    typeKey,
    youElem,
    todayElem,
    todayStr
  };

  const todayBonus = buildTodayBonus(ctx);
  const publicText = buildPublicText(ctx, todayBonus);

  // UI表示
  const type = TEXT_DB.types20[typeKey] ?? { name:"なぞのクマ", desc:"タイプ情報が見つからない。", tags:"-" };
  $("typeTitle").textContent = `${type.name}`;
  $("typeDesc").textContent = `${type.desc}`;

  $("out").value = publicText;

  // 折りたたみ：今日の3ステップ
  $("todaySteps").textContent =
    `① ${todayBonus.steps[0]}\n` +
    `② ${todayBonus.steps[1]}\n` +
    `③ ${todayBonus.steps[2]}`;

  // 保存
  writeSaved(currentState());

  $("outputCard").scrollIntoView({ behavior:"smooth", block:"start" });
}

async function handleCopy(){
  const text = $("out").value;
  if (!text.trim()) return alert("先に生成してね");
  await navigator.clipboard.writeText(text);
  alert("コピーしたよ");
}

function handleClear(){
  $("name").value = "";
  $("dob").value = "";
  $("place").value = "都道府県";
  $("time").value = "unknown";
  $("tone").value = "normal";

  $("typeTitle").textContent = "-";
  $("typeDesc").textContent = "生年月日を入れて「生成」を押してね。";

  $("out").value = "";
  $("todaySteps").textContent = "";

  clearSaved();
}

/* ====== init ====== */
(function init(){
  initSelect("place", PREFECTURES);
  initSelect("time", TIME_BLOCKS, x=>x.value, x=>x.label);

  applyState(readSaved());
  wireAutoSave();

  $("gen").addEventListener("click", handleGenerate);
  $("copy").addEventListener("click", handleCopy);
  $("clear").addEventListener("click", handleClear);

  writeSaved(currentState());
})();
