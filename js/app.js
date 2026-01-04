/*
  app.js (Version 1)
  ------------------------------------------------------------
  UI操作と、astro.js / fortune.js を繋ぐ役
  - 出生時間が不明でも破綻しない（月星座は候補表示）
*/

import {
  lonToSign,
  sunEclipticLongitude, moonEclipticLongitude,
  mercuryLon, venusLon, marsLon,
  makeDateUTCFromJST
} from "./astro.js";

import { lifePath, typeKeyFrom, buildFortuneText, TYPE_20 } from "./fortune.js";

/* ========= 公開UI用リスト ========= */
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
  // value: "unknown" 等にすると内部処理が楽
  { value:"unknown", label:"不明", hour:12, min:0 },
  { value:"early",   label:"早朝（5–8）", hour:6, min:30 },
  { value:"morning", label:"午前（8–12）", hour:9, min:30 },
  { value:"noon",    label:"昼（12–15）", hour:13, min:30 },
  { value:"eve",     label:"夕方（15–18）", hour:16, min:30 },
  { value:"night",   label:"夜（18–22）", hour:20, min:0 },
  { value:"late",    label:"深夜（22–5）", hour:23, min:30 },
];

const $ = (id) => document.getElementById(id);
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

/* ========= 月星座：不明対応 =========
  - 出生時間が不明：その日の 00:00 と 23:59 JST で月星座が変わるなら「候補」表示
  - 時間が分かる（ブロック選択）：代表時刻で計算して確定表示
*/
function moonSignInfoFromInput(dobStr, timeObj){
  if (timeObj.value !== "unknown"){
    const dateUTC = makeDateUTCFromJST(dobStr, timeObj.hour, timeObj.min);
    const lon = moonEclipticLongitude(dateUTC);
    return { info: lonToSign(lon), lon };
  }

  // 不明：境界チェック
  const d0 = makeDateUTCFromJST(dobStr, 0, 0);
  const d1 = makeDateUTCFromJST(dobStr, 23, 59);
  const lon0 = moonEclipticLongitude(d0);
  const lon1 = moonEclipticLongitude(d1);
  const s0 = lonToSign(lon0);
  const s1 = lonToSign(lon1);

  if (s0 === s1){
    // 境界でない
    return { info: s0, lon: (lon0 + lon1) / 2, boundary:false };
  }
  // 境界日：候補表示（嘘をつかない）
  return { info: `候補：${s0} / ${s1}（出生時間で確定）`, lon: lon0, boundary:true };
}

/* ========= 生成 ========= */
function getSelectedTime(){
  const v = $("time").value;
  const t = TIME_BLOCKS.find(x => x.value === v) ?? TIME_BLOCKS[0];
  return t;
}

function formatBadges({ sunSign, moonInfo, lp }){
  $("badgeSun").textContent = sunSign;
  $("badgeMoon").textContent = moonInfo;
  $("badgeLP").textContent = String(lp);
}

function setTypeUI(typeKey){
  const info = TYPE_20[typeKey] ?? { name:"-", desc:"-", tags:"-" };
  $("typeTitle").textContent = `タイプ：${info.name}`;
  $("typeDesc").textContent = info.desc;
  $("typeMeta").textContent = `${info.tags} / typeKey:${typeKey}`;
}

function todayTransitSigns(){
  // 今日（JST基準）の 12:00 を代表にする
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,"0");
  const d = String(now.getDate()).padStart(2,"0");
  const todayStr = `${y}-${m}-${d}`;
  const dateUTC = makeDateUTCFromJST(todayStr, 12, 0);

  const sun = lonToSign(sunEclipticLongitude(dateUTC));
  const moon = lonToSign(moonEclipticLongitude(dateUTC));
  const mars = lonToSign(marsLon(dateUTC));
  return { sun, moon, mars, todayStr };
}

function handleGenerate(){
  const dobStr = $("dob").value;
  if (!dobStr) return alert("生年月日を入力してね");

  const name = $("name").value.trim();
  const place = $("place").value;
  const toneKey = $("tone").value;

  const timeObj = getSelectedTime();
  const timeLabel = timeObj.label;

  // 天体計算（出生情報）
  const birthUTC = makeDateUTCFromJST(dobStr, 12, 0); // 太陽などは日付中心でOK
  const sunLon = sunEclipticLongitude(birthUTC);
  const sunSign = lonToSign(sunLon);

  const moon = moonSignInfoFromInput(dobStr, timeObj);
  const moonSignInfo = moon.info;

  const mercSign = lonToSign(mercuryLon(birthUTC));
  const venSign  = lonToSign(venusLon(birthUTC));
  const marsSign = lonToSign(marsLon(birthUTC));

  const lp = lifePath(dobStr);
  const typeKey = typeKeyFrom(sunSign, lp);

  const today = todayTransitSigns();

  // バッジ & タイプUI
  formatBadges({ sunSign, moonInfo: moonSignInfo, lp });
  setTypeUI(typeKey);

  // 本文作成
  const result = buildFortuneText({
    name, place, timeLabel, dobStr, toneKey,
    sunSign,
    moonSignInfo,
    mercurySign: mercSign,
    venusSign: venSign,
    marsSign,
    lons: { sun:sunLon, moon:moon.lon, mercury:0, venus:0, mars:0 }, // 角度はサイン用途→後で精密化
    lp, typeKey,
    todaySigns: { sun:today.sun, moon:today.moon, mars:today.mars }
  });

  $("out").value = result.text;
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

  $("badgeSun").textContent = "-";
  $("badgeMoon").textContent = "-";
  $("badgeLP").textContent = "-";

  $("typeTitle").textContent = "タイプ：-";
  $("typeDesc").textContent = "生年月日を入れて「生成」を押してね。";
  $("typeMeta").textContent = "-";

  $("out").value = "";
}

/* ========= 初期化 ========= */
(function init(){
  initSelect("place", PREFECTURES);
  initSelect("time", TIME_BLOCKS, x=>x.value, x=>x.label);

  $("gen").addEventListener("click", handleGenerate);
  $("copy").addEventListener("click", handleCopy);
  $("clear").addEventListener("click", handleClear);
})();

