
/*
  astro.js (Version 1)
  ------------------------------------------------------------
  目的：GitHub Pagesだけで完結するため、ブラウザJSで天体位置を近似計算する。
  対象：太陽・月・水星・金星・火星（星座判定用の黄経）
  + トランジット（今日の太陽/月/火星）で“今日運”を作る。

  注意（ガチ寄りにするための方針）：
  - ここは「占いの根拠」なので、後でどんどん精度を上げてOK
  - Version 1は “占い用途として実用的な近似” を目標（天文学の厳密解ではない）
*/

/* ---------------------------
  基本：角度ユーティリティ
--------------------------- */
export function norm360(deg){
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}
function deg2rad(d){ return d * Math.PI / 180; }
function rad2deg(r){ return r * 180 / Math.PI; }

/* ---------------------------
  Julian Day
  - 入力：Date (JS DateはUTCベースで扱うのが安全)
--------------------------- */
export function toJulianDay(dateUTC){
  const y = dateUTC.getUTCFullYear();
  const m = dateUTC.getUTCMonth() + 1;
  const D = dateUTC.getUTCDate()
          + dateUTC.getUTCHours()/24
          + dateUTC.getUTCMinutes()/1440
          + dateUTC.getUTCSeconds()/86400;

  let Y = y;
  let M = m;
  if (M <= 2){ Y -= 1; M += 12; }

  const A = Math.floor(Y/100);
  const B = 2 - A + Math.floor(A/4);

  const JD = Math.floor(365.25*(Y + 4716))
           + Math.floor(30.6001*(M + 1))
           + D + B - 1524.5;
  return JD;
}

function daysSinceJ2000(jd){
  return jd - 2451545.0;
}

/* ---------------------------
  星座判定：黄経(0..360) → 星座
--------------------------- */
export const SIGNS = [
  "牡羊座","牡牛座","双子座","蟹座","獅子座","乙女座",
  "天秤座","蠍座","射手座","山羊座","水瓶座","魚座"
];
export function lonToSign(lonDeg){
  const idx = Math.floor(norm360(lonDeg) / 30);
  return SIGNS[idx] ?? "不明";
}

/* ---------------------------
  太陽の黄経（近似）
  参照：簡易太陽位置式（いわゆるNOAA簡易系）
--------------------------- */
export function sunEclipticLongitude(dateUTC){
  const jd = toJulianDay(dateUTC);
  const n = daysSinceJ2000(jd);

  // 平均近点角
  const g = norm360(357.529 + 0.98560028 * n);
  // 平均黄経
  const q = norm360(280.459 + 0.98564736 * n);
  // 黄経
  const L = q + 1.915 * Math.sin(deg2rad(g)) + 0.020 * Math.sin(deg2rad(2*g));
  return norm360(L);
}

/* ---------------------------
  月の黄経（近似）
  - Version 1は占い用途のための近似
  - 境界日判定に使える程度を狙う
--------------------------- */
export function moonEclipticLongitude(dateUTC){
  const jd = toJulianDay(dateUTC);
  const n = daysSinceJ2000(jd);

  // 近似式（簡易月位置）
  // 月の平均黄経
  const L0 = norm360(218.316 + 13.176396 * n);
  // 月の平均離角
  const D  = norm360(297.850 + 12.190749 * n);
  // 太陽の平均近点角
  const Ms = norm360(357.529 + 0.98560028 * n);
  // 月の平均近点角
  const Mm = norm360(134.963 + 13.064993 * n);

  // 主な補正（最低限）
  const lon = L0
    + 6.289 * Math.sin(deg2rad(Mm))
    + 1.274 * Math.sin(deg2rad(2*D - Mm))
    + 0.658 * Math.sin(deg2rad(2*D))
    + 0.214 * Math.sin(deg2rad(2*Mm))
    - 0.186 * Math.sin(deg2rad(Ms));

  return norm360(lon);
}

/* ---------------------------
  惑星（超簡易）：水星/金星/火星
  - Version 1では“星座判定”に絞った近似
  - 将来：より正確なVSOP/ELP系へ差し替え可能
  方針：
  - 超簡易の平均運動モデル（占いの雰囲気＞天文学精度）
--------------------------- */
function planetMeanLon(dateUTC, baseLon, ratePerDay){
  const jd = toJulianDay(dateUTC);
  const n = daysSinceJ2000(jd);
  return norm360(baseLon + ratePerDay * n);
}

// 平均運動（度/日）ざっくり：
// 水星 ~4.09, 金星 ~1.60, 火星 ~0.524
export function mercuryLon(dateUTC){ return planetMeanLon(dateUTC, 252.250, 4.09233445); }
export function venusLon(dateUTC){   return planetMeanLon(dateUTC, 181.979, 1.60213034); }
export function marsLon(dateUTC){    return planetMeanLon(dateUTC, 355.433, 0.52402068); }

/* ---------------------------
  アスペクト（簡易）
  角度差(0..180)で判定
--------------------------- */
export function aspectBetween(lonA, lonB){
  let d = Math.abs(norm360(lonA) - norm360(lonB));
  if (d > 180) d = 360 - d;

  // 許容オーブ（簡易）：主要のみ
  const aspects = [
    { name:"合(0°)",   deg:0,   orb:8 },
    { name:"セクスタイル(60°)", deg:60,  orb:5 },
    { name:"スクエア(90°)", deg:90,  orb:6 },
    { name:"トライン(120°)", deg:120, orb:6 },
    { name:"オポジション(180°)", deg:180, orb:8 },
  ];

  for (const a of aspects){
    if (Math.abs(d - a.deg) <= a.orb) return a.name;
  }
  return null;
}

/* ---------------------------
  便利：指定日JSTの「だいたい時刻」をUTC Dateに変換
  - GitHub Pages上でも安定させるため JST固定で扱う
--------------------------- */
export function makeDateUTCFromJST(dobStr, hour, minute){
  // dobStr: "YYYY-MM-DD"
  const [Y,M,D] = dobStr.split("-").map(Number);
  // JST = UTC+9
  return new Date(Date.UTC(Y, M-1, D, hour-9, minute, 0));
}
