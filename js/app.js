/*
  app.js / Version 1.1
  ------------------------------------------------------------
  ✅ UI操作（入力→出力）
  ✅ 出生地/出生時間はプルダウン
  ✅ 出生時間が不明でも「月」は候補で出す（嘘をつかない）
*/

import {
  lonToSign,
  sunEclipticLongitude, moonEclipticLongitude,
  mercuryLon, venusLon, marsLon,
  makeDateUTCFromJST
} from "./astro.js";

import { lifePath, typeKeyFrom, buildTexts, TEXT_DB } from "./fortune.js";

/* 都道府県 */
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

/* 出生時間（不明が多い前提：ブロック選択） */
const TIME_BLOCKS = [
  { value:"unknown", label:"不明", hour:12, min:0 },
  { value:"early",   label:"早朝（5–8）", hour:6,  min:30 },
  { value:"morning", label:"午前（8–12）", hour:9, min:30 },
  { value:"noon",    label:"昼（12–15）", hour:13, min:30 },
  { value:"eve",     label:"夕方（15–18）", hour:16, min:30 },
  { value:"night",   label:"夜（18–22）", hour:20, min:0 },
  { value:"late",    label:"深夜（22–5）", hour:23, min:30 },
];

const $ = (id)=>document.getElementById(id);

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

/* 出生時間の選択オブジェクト */
function getSelectedTime(){
  const v = $("time").value;
  return TIME_BLOCKS.find(x=>x.value===v) ?? TIME_BLOCKS[0];
}

/*
  月の扱い：
  - 時間が分かる：代表時刻で確定
  - 不明：その日の00:00と23:59で星座が変わるなら候補表示
*/
function moonInfo(dobStr, timeObj){
  if (timeObj.value !== "unknown"){
    const dateUTC = makeDateUTCFromJST(dobStr, timeObj.hour, timeObj.min);
    const lon = moonEclipticLongitude(dateUTC);
    return { info: lonToSign(lon), lon };
  }

  const d0 = makeDateUTCFromJST(dobStr, 0, 0);
  const d1 = makeDateUTCFromJST(dobStr, 23, 59);
  const lon0 = moonEclipticLongitude(d0);
  const lon1 = moonEclipticLongitude(d1);
  const s0 = lonToSign(lon0);
  const s1 = lonToSign(lon1);

  if (s0 === s1){
    return { info: s0, lon:(lon0+lon1)/2, boundary:false };
  }
  return { info: `候補：${s0} / ${s1}（出生時間で確定）`, lon:lon0, boundary:true };
}

/* 表示用バッジ（専門用語を出さないラベル） */
function setBadges({ sunSign, moonSignInfo, lp }){
  const face = TEXT_DB.faceLabel[sunSign] ?? "-";
  const core = moonSignInfo.includes("候補")
    ? "二択っぽい（時間で変わる）"
    : (TEXT_DB.coreLabel[moonSignInfo] ?? "-");
  const num = TEXT_DB.numLabel[lp] ?? "";
  $("badgeFace").textContent = face;
  $("badgeCore").textContent = core;
  $("badgeNum").textContent = `${lp}（${num}）`;
}

function setTypeUI(typeInfo, typeKey){
  $("typeTitle").textContent = `タイプ：${typeInfo.name}`;
  $("typeDesc").textContent = typeInfo.desc;
  $("typeMeta").textContent = `${typeInfo.tags} / typeKey:${typeKey}`;
}

function todayTransitSigns(){
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,"0");
  const d = String(now.getDate()).padStart(2,"0");
  const todayStr = `${y}-${m}-${d}`;

  const dateUTC = makeDateUTCFromJST(todayStr, 12, 0);
  return {
    sun: lonToSign(sunEclipticLongitude(dateUTC)),
    moon: lonToSign(moonEclipticLongitude(dateUTC)),
    mars: lonToSign(marsLon(dateUTC)),
    todayStr
  };
}

function handleGenerate(){
  const dobStr = $("dob").value;
  if (!dobStr) return alert("生年月日を入力してね");

  const name = $("name").value.trim();
  const place = $("place").value;
  const toneKey = $("tone").value;

  const timeObj = getSelectedTime();
  const timeLabel = timeObj.label;

  // 出生情報：太陽・惑星は「その日のお昼」を代表で使う（初心者向け＆安定）
  const birthUTC = makeDateUTCFromJST(dobStr, 12, 0);

  const sunLon = sunEclipticLongitude(birthUTC);
  const sunSign = lonToSign(sunLon);

  const moon = moonInfo(dobStr, timeObj);
  const moonSignInfo = moon.info;

  const mercurySign = lonToSign(mercuryLon(birthUTC));
  const venusSign   = lonToSign(venusLon(birthUTC));
  const marsSign    = lonToSign(marsLon(birthUTC));

  const lp = lifePath(dobStr);
  const typeKey = typeKeyFrom(sunSign, lp);

  // 今日（トランジット）
  const today = todayTransitSigns();

  // 角度（アスペクト用）：今は最低限（Version 2で精密化予定）
  // ※ moon.lon は時間によって変わるので、候補時は lon0 を採用（裏メモ用途）
  const lons = {
    sun: sunLon,
    moon: moon.lon,
    mercury: 0, // Version 2で角度を埋める
    venus: 0,
    mars: 0
  };

  const result = buildTexts({
    name, place, dobStr, toneKey,
    timeLabel,
    sunSign,
    moonSignInfo,
    moonSign: moonSignInfo.includes("候補") ? "（候補）" : moonSignInfo,
    mercurySign, venusSign, marsSign,
    lp, typeKey,
    todaySigns: { sun: today.sun, moon: today.moon, mars: today.mars },
    lons
  });

  setBadges({ sunSign, moonSignInfo, lp });
  setTypeUI(result.type, typeKey);

  $("out").value = result.publicText;
  $("devout").value = result.devText;

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

  $("badgeFace").textContent = "-";
  $("badgeCore").textContent = "-";
  $("badgeNum").textContent = "-";

  $("typeTitle").textContent = "タイプ：-";
  $("typeDesc").textContent = "生年月日を入れて「生成」を押してね。";
  $("typeMeta").textContent = "-";

  $("out").value = "";
  $("devout").value = "";
}

(function init(){
  initSelect("place", PREFECTURES);
  initSelect("time", TIME_BLOCKS, x=>x.value, x=>x.label);

  $("gen").addEventListener("click", handleGenerate);
  $("copy").addEventListener("click", handleCopy);
  $("clear").addEventListener("click", handleClear);
})();
