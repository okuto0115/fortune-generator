/*
  astro.js / Version 1.2
  ------------------------------------------------------------
  ✅ GitHub Pagesだけで完結（外部APIなし）
  ✅ 太陽・月：近似（Meeus系の簡易）
  ✅ 水星・金星・火星：平均運動モデル → 軌道要素 + ケプラー方程式 + 地心補正（簡易）
     ※天文学の厳密値ではないが、占い用途の“当たり感”は上がる
  ------------------------------------------------------------
  初心者向けメモ：
  - 「計算をもっとガチに」したいなら、このファイルを強化する
  - 表示文章は fortune.js 側で初心者向けに翻訳する（専門用語は表に出さない）
*/

export function norm360(deg){
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}
function deg2rad(d){ return d * Math.PI / 180; }
function rad2deg(r){ return r * 180 / Math.PI; }

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
function centuriesSinceJ2000(jd){ return (jd - 2451545.0) / 36525.0; }

export const SIGNS = [
  "牡羊座","牡牛座","双子座","蟹座","獅子座","乙女座",
  "天秤座","蠍座","射手座","山羊座","水瓶座","魚座"
];
export function lonToSign(lonDeg){
  const idx = Math.floor(norm360(lonDeg) / 30);
  return SIGNS[idx] ?? "不明";
}

/* JSTの時刻 → UTC Date（JST=UTC+9） */
export function makeDateUTCFromJST(dobStr, hour, minute){
  const [Y,M,D] = dobStr.split("-").map(Number);
  return new Date(Date.UTC(Y, M-1, D, hour-9, minute, 0));
}

/* 太陽（見かけ黄経：簡易） */
export function sunEclipticLongitude(dateUTC){
  const jd = toJulianDay(dateUTC);
  const n = daysSinceJ2000(jd);

  const g = norm360(357.529 + 0.98560028 * n);  // 平均近点角
  const q = norm360(280.459 + 0.98564736 * n);  // 平均黄経
  const L = q + 1.915 * Math.sin(deg2rad(g)) + 0.020 * Math.sin(deg2rad(2*g));
  return norm360(L);
}

/* 月（見かけ黄経：簡易） */
export function moonEclipticLongitude(dateUTC){
  const jd = toJulianDay(dateUTC);
  const n = daysSinceJ2000(jd);

  const L0 = norm360(218.316 + 13.176396 * n);  // 平均黄経
  const D  = norm360(297.850 + 12.190749 * n);  // 平均離角
  const Ms = norm360(357.529 + 0.98560028 * n); // 太陽平均近点角
  const Mm = norm360(134.963 + 13.064993 * n);  // 月平均近点角

  const lon = L0
    + 6.289 * Math.sin(deg2rad(Mm))
    + 1.274 * Math.sin(deg2rad(2*D - Mm))
    + 0.658 * Math.sin(deg2rad(2*D))
    + 0.214 * Math.sin(deg2rad(2*Mm))
    - 0.186 * Math.sin(deg2rad(Ms));

  return norm360(lon);
}

/* -----------------------------
  ここから惑星：軌道要素 + ケプラー + 地心補正（簡易）
  参考にしているのは一般的な近似式（Meeus系のオーダー感）
  ※厳密VSOPほどではないが、平均運動よりは“当たり感”が上がる
----------------------------- */

function solveKepler(Mrad, e){
  // E - e sin E = M をニュートン法で解く
  let E = Mrad;
  for (let i=0; i<10; i++){
    const f = E - e*Math.sin(E) - Mrad;
    const fp = 1 - e*Math.cos(E);
    E = E - f/fp;
  }
  return E;
}

function heliocentricEclipticXYZ(planet, dateUTC){
  const jd = toJulianDay(dateUTC);
  const T = centuriesSinceJ2000(jd);

  // 軌道要素（角度は度）
  // planet: {a,e,I,L,lp,Om} を Tで更新できるように関数化
  const a  = planet.a(T);
  const e  = planet.e(T);
  const I  = deg2rad(planet.I(T));
  const L  = planet.L(T);
  const lp = planet.lp(T);
  const Om = planet.Om(T);

  const M = norm360(L - lp);                    // 平均近点角（度）
  const Mrad = deg2rad(M);

  const w = deg2rad(norm360(lp - Om));          // 近点引数
  const Omr = deg2rad(Om);

  const E = solveKepler(Mrad, e);

  // 真近点角 ν
  const xv = Math.cos(E) - e;
  const yv = Math.sqrt(1 - e*e) * Math.sin(E);
  const v = Math.atan2(yv, xv);

  // 距離 r
  const r = a * (1 - e*Math.cos(E));

  // 軌道面 → 黄道座標（ヘリオセントリック）
  const cosw_v = Math.cos(w + v);
  const sinw_v = Math.sin(w + v);

  const xh = r * (Math.cos(Omr)*cosw_v - Math.sin(Omr)*sinw_v*Math.cos(I));
  const yh = r * (Math.sin(Omr)*cosw_v + Math.cos(Omr)*sinw_v*Math.cos(I));
  const zh = r * (sinw_v * Math.sin(I));

  return { x:xh, y:yh, z:zh, r };
}

function eclipticLonFromXYZ(x,y){
  return norm360(rad2deg(Math.atan2(y,x)));
}

// 地球（太陽の反対側：地球のヘリオ位置が必要）
const EARTH = {
  a:  (T)=> 1.00000261 + 0.00000562*T,
  e:  (T)=> 0.01671123 - 0.00004392*T,
  I:  (T)=> -0.00001531 - 0.01294668*T/100, // ほぼ0
  L:  (T)=> norm360(100.46457166 + 35999.37244981*T),
  lp: (T)=> norm360(102.93768193 + 0.32327364*T),
  Om: (T)=> norm360(0.0)
};

// 水星・金星・火星（簡易係数）
const MERCURY = {
  a:  (T)=> 0.38709927 + 0.00000037*T,
  e:  (T)=> 0.20563593 + 0.00001906*T,
  I:  (T)=> 7.00497902 - 0.00594749*T,
  L:  (T)=> norm360(252.25032350 + 149472.67411175*T),
  lp: (T)=> norm360(77.45779628 + 0.16047689*T),
  Om: (T)=> norm360(48.33076593 - 0.12534081*T)
};

const VENUS = {
  a:  (T)=> 0.72333566 + 0.00000390*T,
  e:  (T)=> 0.00677672 - 0.00004107*T,
  I:  (T)=> 3.39467605 - 0.00078890*T,
  L:  (T)=> norm360(181.97909950 + 58517.81538729*T),
  lp: (T)=> norm360(131.60246718 + 0.00268329*T),
  Om: (T)=> norm360(76.67984255 - 0.27769418*T)
};

const MARS = {
  a:  (T)=> 1.52371034 + 0.00001847*T,
  e:  (T)=> 0.09339410 + 0.00007882*T,
  I:  (T)=> 1.84969142 - 0.00813131*T,
  L:  (T)=> norm360(355.44656795 + 19140.29934243*T),
  lp: (T)=> norm360(336.05637041 + 0.44323322*T),
  Om: (T)=> norm360(49.55953891 - 0.29257343*T)
};

function geocentricLon(planet, dateUTC){
  // ヘリオ座標 → 地心座標（地球を引く）
  const p = heliocentricEclipticXYZ(planet, dateUTC);
  const e = heliocentricEclipticXYZ(EARTH, dateUTC);

  const xg = p.x - e.x;
  const yg = p.y - e.y;
  const zg = p.z - e.z;

  return eclipticLonFromXYZ(xg, yg);
}

// 公開関数（地心黄経）
export function mercuryLon(dateUTC){ return geocentricLon(MERCURY, dateUTC); }
export function venusLon(dateUTC){   return geocentricLon(VENUS, dateUTC); }
export function marsLon(dateUTC){    return geocentricLon(MARS, dateUTC); }

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
