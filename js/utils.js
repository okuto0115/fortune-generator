// js/utils.js
// ======================================================
// 共通処理（初心者向け：関数は小さめ、コメント多め）
// ======================================================

export const APP_VERSION = "v1.0.0";

export const DEG = Math.PI / 180;
export function sinD(deg){ return Math.sin(deg * DEG); }
export function cosD(deg){ return Math.cos(deg * DEG); }
export function atan2D(y,x){ return Math.atan2(y,x) / DEG; }

export function norm360(deg){
  let x = deg % 360;
  if (x < 0) x += 360;
  return x;
}

export function angDiff(a, b){
  // 角度差を 0..180 にする
  const d = Math.abs(norm360(a) - norm360(b));
  return d > 180 ? 360 - d : d;
}

export function clamp(n, min, max){
  return Math.min(max, Math.max(min, n));
}

export function hashString(str){
  // 文字列→32bit種（軽いハッシュ）
  let h = 2166136261;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed){
  // 安定する疑似乱数（同じ入力→同じ結果）
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr){
  return arr[Math.floor(rng() * arr.length)];
}

export function pickN(rng, arr, n){
  const copy = [...arr];
  const out = [];
  while(copy.length && out.length < n){
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i,1)[0]);
  }
  return out;
}

export function formatDateJP(dateObj){
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth()+1).padStart(2,"0");
  const d = String(dateObj.getDate()).padStart(2,"0");
  return `${y}/${m}/${d}`;
}

export function dateToJulianDay(date){
  // JD(UTC) = ms/86400000 + 2440587.5
  const ms = date.getTime();
  return ms / 86400000 + 2440587.5;
}

export function jdToDayNumber(jd){
  // 2000-01-00 0:00 UT からの日数（Schlyter式）
  return jd - 2451543.5;
}

export const SIGNS = [
  "牡羊座","牡牛座","双子座","蟹座","獅子座","乙女座",
  "天秤座","蠍座","射手座","山羊座","水瓶座","魚座"
];

export function lonToSign(lon){
  const idx = Math.floor(norm360(lon) / 30);
  return SIGNS[idx];
}

export function isNearSignBoundary(lon, deg=1.2){
  // 星座境界付近か（出生時間不明のときの注意に使える）
  const x = norm360(lon) % 30;
  return (x < deg) || (x > (30 - deg));
}

export function signToElement(sign){
  // 火・地・風・水
  const fire = ["牡羊座","獅子座","射手座"];
  const earth= ["牡牛座","乙女座","山羊座"];
  const air  = ["双子座","天秤座","水瓶座"];
  const water= ["蟹座","蠍座","魚座"];
  if (fire.includes(sign)) return "火";
  if (earth.includes(sign)) return "地";
  if (air.includes(sign)) return "風";
  return "水";
}

export function calcLifePathNumber(dateObj){
  // 生年月日 YYYYMMDD を足して1桁（1〜9）
  const y = String(dateObj.getFullYear());
  const m = String(dateObj.getMonth() + 1).padStart(2,"0");
  const d = String(dateObj.getDate()).padStart(2,"0");
  const s = y + m + d;
  let sum = 0;
  for (const ch of s) sum += Number(ch);
  while (sum > 9) sum = String(sum).split("").reduce((a,c)=>a+Number(c),0);
  return sum;
}
