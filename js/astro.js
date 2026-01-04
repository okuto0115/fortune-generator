/*
  astro.js / Version 1.1
  ------------------------------------------------------------
  ✅ GitHub Pagesだけで完結するために、ブラウザJSで天体位置を“近似計算”
  ✅ Version 1.1は「占い用途としての実用近似」を狙う（天文学の厳密解ではない）

  開発メモ（初心者向け）：
  - ここを強化すると「当たり感」アップ
  - 文章は fortune.js 側で初心者向けに翻訳して表示する
*/

export function norm360(deg){
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}
function deg2rad(d){ return d * Math.PI / 180; }

export function toJulianDay(dateUTC){
  const y = dateUTC.getUTCFullYear();
  const m = dateUTC.getUTCMonth() + 1;
  const D = dateUTC.getUTCDate()
          + dateUTC.getUTCHours()/24
          + dateUTC.getUTCMinutes()/1440
          + dateUTC.getUTCSeconds()/86400;

  let Y = y, M = m;
  if (M <= 2){ Y -= 1; M += 12; }

  const A = Math.floor(Y/100);
  const B = 2 - A + Math.floor(A/4);

  return Math.floor(365.25*(Y + 4716))
       + Math.floor(30.6001*(M + 1))
       + D + B - 1524.5;
}
function daysSinceJ2000(jd){ return jd - 2451545.0; }

export const SIGNS = [
  "牡羊座","牡牛座","双子座","蟹座","獅子座","乙女座",
  "天秤座","蠍座","射手座","山羊座","水瓶座","魚座"
];
export function lonToSign(lonDeg){
  const idx = Math.floor(norm360(lonDeg) / 30);
  return SIGNS[idx] ?? "不明";
}

/* 太陽（近似） */
export function sunEclipticLongitude(dateUTC){
  const jd = toJulianDay(dateUTC);
  const n = daysSinceJ2000(jd);

  const g = norm360(357.529 + 0.98560028 * n);  // 平均近点角
  const q = norm360(280.459 + 0.98564736 * n);  // 平均黄経
  const L = q + 1.915 * Math.sin(deg2rad(g)) + 0.020 * Math.sin(deg2rad(2*g));
  return norm360(L);
}

/* 月（近似） */
export function moonEclipticLongitude(dateUTC){
  const jd = toJulianDay(dateUTC);
  const n = daysSinceJ2000(jd);

  const L0 = norm360(218.316 + 13.176396 * n); // 平均黄経
  const D  = norm360(297.850 + 12.190749 * n); // 平均離角
  const Ms = norm360(357.529 + 0.98560028 * n); // 太陽平均近点角
  const Mm = norm360(134.963 + 13.064993 * n); // 月平均近点角

  const lon = L0
    + 6.289 * Math.sin(deg2rad(Mm))
    + 1.274 * Math.sin(deg2rad(2*D - Mm))
    + 0.658 * Math.sin(deg2rad(2*D))
    + 0.214 * Math.sin(deg2rad(2*Mm))
    - 0.186 * Math.sin(deg2rad(Ms));

  return norm360(lon);
}

/*
  惑星（Version 1.1は“星座判定の雰囲気”用に平均運動モデル）
  → Version 2で精度アップ予定（ここを強化するとさらにガチ感が増える）
*/
function planetMeanLon(dateUTC, baseLon, ratePerDay){
  const jd = toJulianDay(dateUTC);
  const n = daysSinceJ2000(jd);
  return norm360(baseLon + ratePerDay * n);
}
export function mercuryLon(dateUTC){ return planetMeanLon(dateUTC, 252.250, 4.09233445); }
export function venusLon(dateUTC){   return planetMeanLon(dateUTC, 181.979, 1.60213034); }
export function marsLon(dateUTC){    return planetMeanLon(dateUTC, 355.433, 0.52402068); }

/* アスペクト（簡易） */
export function aspectBetween(lonA, lonB){
  let d = Math.abs(norm360(lonA) - norm360(lonB));
  if (d > 180) d = 360 - d;

  const aspects = [
    { name:"合(0°)", deg:0, orb:8 },
    { name:"セクスタイル(60°)", deg:60, orb:5 },
    { name:"スクエア(90°)", deg:90, orb:6 },
    { name:"トライン(120°)", deg:120, orb:6 },
    { name:"オポジション(180°)", deg:180, orb:8 },
  ];
  for (const a of aspects){
    if (Math.abs(d - a.deg) <= a.orb) return a.name;
  }
  return null;
}

/* JSTの時刻 → UTC Date（JST=UTC+9） */
export function makeDateUTCFromJST(dobStr, hour, minute){
  const [Y,M,D] = dobStr.split("-").map(Number);
  return new Date(Date.UTC(Y, M-1, D, hour-9, minute, 0));
}
