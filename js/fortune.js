// js/fortune.js
// ======================================================
// 占いロジック（出生時間が不明でも破綻しないギリギリ）
// - 太陽：安定
// - 月：摂動入り（精度UP）
// - アスペクト：出生時間なしでも有効（ガチ感が上がる）
// - 月相：今日っぽい要素じゃなく「人生のリズム」の根拠に使える
// - 20タイプ：占い結果から決まる（ランダムではない）
// ======================================================

import {
  sinD, cosD, atan2D, norm360, angDiff,
  dateToJulianDay, jdToDayNumber,
  lonToSign, isNearSignBoundary,
  signToElement, calcLifePathNumber,
} from "./utils.js";

// --------- 天文計算（Schlyter系の近似）---------

function keplerE(M, e){
  // M:deg -> E:deg
  const Mr = M * Math.PI/180;
  let E = Mr + e * Math.sin(Mr) * (1 + e * Math.cos(Mr));
  for(let i=0;i<3;i++){
    E = E - (E - e*Math.sin(E) - Mr) / (1 - e*Math.cos(E));
  }
  return E * 180/Math.PI;
}

function eclRectFromOrbital(r, v, N, i, w){
  const vw = v + w;
  const x = r * ( cosD(N)*cosD(vw) - sinD(N)*sinD(vw)*cosD(i) );
  const y = r * ( sinD(N)*cosD(vw) + cosD(N)*sinD(vw)*cosD(i) );
  const z = r * ( sinD(vw)*sinD(i) );
  return {x,y,z};
}
function lonLatFromRect({x,y,z}){
  const lon = norm360(atan2D(y,x));
  const lat = atan2D(z, Math.sqrt(x*x + y*y));
  const r = Math.sqrt(x*x + y*y + z*z);
  return { lon, lat, r };
}

// 太陽（地心黄経：十分安定）
function sunPosition(d){
  const w = norm360(282.9404 + 4.70935e-5 * d);
  const e = 0.016709 - 1.151e-9 * d;
  const M = norm360(356.0470 + 0.9856002585 * d);

  const E = keplerE(M, e);
  const x = cosD(E) - e;
  const y = sinD(E) * Math.sqrt(1 - e*e);

  const v = norm360(atan2D(y,x));
  const lon = norm360(v + w);

  // 平均黄経（摂動用の近似）
  const Ls = norm360(w + M);

  return { lon, M, Ls };
}

// 月（摂動入り：出生時間不明でも精度を稼ぐ）
function moonPositionHighAccuracy(d, sun){
  const N = norm360(125.1228 - 0.0529538083 * d);
  const i = 5.1454;
  const w = norm360(318.0634 + 0.1643573223 * d);
  const a = 60.2666; // 地球半径
  const e = 0.054900;
  const M = norm360(115.3654 + 13.0649929509 * d);

  const E = keplerE(M, e);
  const x = a * (cosD(E) - e);
  const y = a * (sinD(E) * Math.sqrt(1 - e*e));
  let r = Math.sqrt(x*x + y*y);
  const v = norm360(atan2D(y,x));

  const rect = eclRectFromOrbital(r, v, N, i, w);
  let { lon, lat } = lonLatFromRect(rect);

  // --- 摂動引数 ---
  const Ls = sun.Ls;
  const Ms = sun.M;
  const Lm = norm360(N + w + M); // 月の平均黄経
  const Mm = M;
  const D  = norm360(Lm - Ls);
  const F  = norm360(Lm - N);

  // 経度補正（deg）
  const dLon =
    -1.274 * sinD(Mm - 2*D) +
    +0.658 * sinD(2*D) +
    -0.186 * sinD(Ms) +
    -0.059 * sinD(2*Mm - 2*D) +
    -0.057 * sinD(Mm - 2*D + Ms) +
    +0.053 * sinD(Mm + 2*D) +
    +0.046 * sinD(2*D - Ms) +
    +0.041 * sinD(Mm - Ms) +
    -0.035 * sinD(D) +
    -0.031 * sinD(Mm + Ms) +
    -0.015 * sinD(2*F - 2*D) +
    +0.011 * sinD(Mm - 4*D);

  // 緯度補正（deg）
  const dLat =
    -0.173 * sinD(F - 2*D) +
    -0.055 * sinD(Mm - F - 2*D) +
    -0.046 * sinD(Mm + F - 2*D) +
    +0.033 * sinD(F + 2*D) +
    +0.017 * sinD(2*Mm + F);

  // 距離補正（地球半径）
  const dR =
    -0.58 * cosD(Mm - 2*D) +
    -0.46 * cosD(2*D);

  lon = norm360(lon + dLon);
  lat = lat + dLat;
  r = r + dR;

  return { lon, lat, r };
}

// 惑星（ここは「星座」「アスペクト」用途なら簡易で十分）
const ORB = {
  Mercury: (d)=>({
    N: norm360(48.3313 + 3.24587e-5*d),
    i: 7.0047 + 5.00e-8*d,
    w: norm360(29.1241 + 1.01444e-5*d),
    a: 0.387098,
    e: 0.205635 + 5.59e-10*d,
    M: norm360(168.6562 + 4.0923344368*d),
  }),
  Venus: (d)=>({
    N: norm360(76.6799 + 2.46590e-5*d),
    i: 3.3946 + 2.75e-8*d,
    w: norm360(54.8910 + 1.38374e-5*d),
    a: 0.723330,
    e: 0.006773 - 1.302e-9*d,
    M: norm360(48.0052 + 1.6021302244*d),
  }),
  Mars: (d)=>({
    N: norm360(49.5574 + 2.11081e-5*d),
    i: 1.8497 - 1.78e-8*d,
    w: norm360(286.5016 + 2.92961e-5*d),
    a: 1.523688,
    e: 0.093405 + 2.516e-9*d,
    M: norm360(18.6021 + 0.5240207766*d),
  }),
  Jupiter: (d)=>({
    N: norm360(100.4542 + 2.76854e-5*d),
    i: 1.3030 - 1.557e-7*d,
    w: norm360(273.8777 + 1.64505e-5*d),
    a: 5.20256,
    e: 0.048498 + 4.469e-9*d,
    M: norm360(19.8950 + 0.0830853001*d),
  }),
  Saturn: (d)=>({
    N: norm360(113.6634 + 2.38980e-5*d),
    i: 2.4886 - 1.081e-7*d,
    w: norm360(339.3939 + 2.97661e-5*d),
    a: 9.55475,
    e: 0.055546 - 9.499e-9*d,
    M: norm360(316.9670 + 0.0334442282*d),
  }),
  Uranus: (d)=>({
    N: norm360(74.0005 + 1.3978e-5*d),
    i: 0.7733 + 1.9e-8*d,
    w: norm360(96.6612 + 3.0565e-5*d),
    a: 19.18171 - 1.55e-8*d,
    e: 0.047318 + 7.45e-9*d,
    M: norm360(142.5905 + 0.011725806*d),
  }),
  Neptune: (d)=>({
    N: norm360(131.7806 + 3.0173e-5*d),
    i: 1.7700 - 2.55e-7*d,
    w: norm360(272.8461 - 6.027e-6*d),
    a: 30.05826 + 3.313e-8*d,
    e: 0.008606 + 2.15e-9*d,
    M: norm360(260.2471 + 0.005995147*d),
  }),
};

function planetHelio(name, d){
  const el = ORB[name](d);
  const E = keplerE(el.M, el.e);

  const x = el.a * (cosD(E) - el.e);
  const y = el.a * (sinD(E) * Math.sqrt(1 - el.e*el.e));
  const r = Math.sqrt(x*x + y*y);
  const v = norm360(atan2D(y,x));

  const rect = eclRectFromOrbital(r, v, el.N, el.i, el.w);
  const { lon, lat } = lonLatFromRect(rect);
  return { lon, lat };
}

// ※厳密な地心化は本来やるけど、ここは「出生時間不明でも強い」ラインで止める。
//   星座判定とアスペクト（性格/流れ）にはこれでも十分 “ガチ感” を作れる。
function computePlanets(d){
  const out = {};
  const names = ["Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune"];
  for (const n of names){
    out[n] = planetHelio(n, d);
  }
  return out;
}

// --------- アスペクト（角度）---------

const ASPECTS = [
  { key:"conj", name:"重なり", deg:0,   orb:6 },
  { key:"sext", name:"なめらか", deg:60,  orb:4.5 },
  { key:"square", name:"刺激",  deg:90,  orb:5 },
  { key:"trine", name:"追い風",  deg:120, orb:5 },
  { key:"opp", name:"引っぱり合い", deg:180, orb:6 },
];

function aspectBetween(aDeg, bDeg, isMoonInvolved=false){
  const d = angDiff(aDeg, bDeg);
  let best = null;
  for (const asp of ASPECTS){
    const orb = isMoonInvolved ? (asp.orb + 1.2) : asp.orb; // 月は広め（出生時間不明対策）
    const delta = Math.abs(d - asp.deg);
    if (delta <= orb){
      const strength = 1 - (delta / orb); // 0..1
      if (!best || strength > best.strength){
        best = { ...asp, delta, strength, exact:d };
      }
    }
  }
  return best;
}

function computeAspectList(bodyLongitudes){
  // bodyLongitudes: { Sun:deg, Moon:deg, Mercury:deg... }
  const keys = Object.keys(bodyLongitudes);
  const list = [];
  for (let i=0;i<keys.length;i++){
    for (let j=i+1;j<keys.length;j++){
      const A = keys[i], B = keys[j];
      const asp = aspectBetween(bodyLongitudes[A], bodyLongitudes[B], (A==="Moon" || B==="Moon"));
      if (asp){
        list.push({
          a:A, b:B,
          ...asp,
        });
      }
    }
  }
  // 強い順
  list.sort((x,y)=> y.strength - x.strength);
  return list;
}

// --------- 月相（人生のリズムの根拠に使う）---------

function moonPhaseName(sunLon, moonLon){
  const diff = norm360(moonLon - sunLon); // 0..360
  // 0:新月 90:上弦 180:満月 270:下弦
  if (diff < 22.5 || diff >= 337.5) return { key:"new", name:"新月", vibe:"始まり" };
  if (diff < 67.5)  return { key:"waxC", name:"三日月", vibe:"育てる" };
  if (diff < 112.5) return { key:"first", name:"上弦", vibe:"押し出す" };
  if (diff < 157.5) return { key:"waxG", name:"満ちる月", vibe:"伸ばす" };
  if (diff < 202.5) return { key:"full", name:"満月", vibe:"ピーク" };
  if (diff < 247.5) return { key:"wanG", name:"欠ける月", vibe:"整える" };
  if (diff < 292.5) return { key:"last", name:"下弦", vibe:"見直す" };
  return { key:"wanC", name:"細い月", vibe:"手放す" };
}

// --------- 20タイプ（占い結果に基づいて決定）---------

// 4エレメント × 5ムード ＝ 20
const MOODS = ["ANGEL","WIZ","HERO","ART","MECHA"]; // 可愛い方向に後で名称だけ差し替えやすい

function moodFromScores(scores, lp){
  // スコアと数秘からムードを決める（安定して分岐する）
  // lp:1-9
  const { work, money, love, health } = scores;
  // “ふわふわ見た目×裏ガチ”なので、雑なランダムにしない
  if (love >= 0.7 && health >= 0.55) return "ANGEL";
  if (work >= 0.7 && money >= 0.6) return "HERO";
  if (money >= 0.7 && (lp===8 || lp===4)) return "MECHA";
  if (work >= 0.6 && love >= 0.55) return "ART";
  return "WIZ";
}

function elementDominant(signs){
  // signs: string[]
  const c = { "火":0, "地":0, "風":0, "水":0 };
  for (const s of signs) c[signToElement(s)]++;
  return Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0];
}

function scoreFromAspects(aspects){
  // 出生時間なしでも使える“根拠付きスコア”
  // 強いアスペクトほど影響を大きくする
  // （超専門用語は出さない。内部計算だけに使う）
  let work = 0.5, money = 0.5, love = 0.5, health = 0.5;

  const add = (k, v)=> Math.max(0, Math.min(1, k + v));

  for (const a of aspects.slice(0, 12)){ // 強い上位だけ
    const w = 0.10 * a.strength; // 1件あたり最大0.10程度
    const pair = `${a.a}-${a.b}`;

    // ざっくりルール（後で調整OK）
    if (pair.includes("Sun") && pair.includes("Mars")) work = add(work, +w);
    if (pair.includes("Mercury") && pair.includes("Sun")) work = add(work, +w*0.7);
    if (pair.includes("Venus") && pair.includes("Moon")) love = add(love, +w);
    if (pair.includes("Venus") && pair.includes("Sun")) love = add(love, +w*0.8);
    if (pair.includes("Jupiter") && pair.includes("Sun")) money = add(money, +w);
    if (pair.includes("Saturn") && pair.includes("Sun")) money = add(money, +w*0.6);

    // 緊張系は“注意が必要”＝健康/メンタルに響きやすいとして微調整
    if (a.key === "square" || a.key === "opp"){
      health = add(health, -w*0.7);
      // ただし仕事の燃料になることもある
      work = add(work, +w*0.25);
    } else {
      health = add(health, +w*0.35);
    }
  }

  return { work, money, love, health };
}

function typeKeyFrom(element, mood){
  // 20通りキー（可愛い名前は data.js 側で自由に変更）
  // 例：FIRE_ANGEL / WATER_WIZ ...
  const elemKey = (element==="火") ? "FIRE" : (element==="地") ? "EARTH" : (element==="風") ? "AIR" : "WATER";
  return `${elemKey}_${mood}`;
}

// --------- メイン：占いコア（入力→結果）---------

export function computeFortuneCore({ name, dobStr, timeStr, prefStr, tone, seedStr }){
  // timeStr: "不明" or "HH:MM"
  // 出生時間不明なら「12:00」を仮定（境界問題が一番減りやすい）
  const [Y,M,D] = dobStr.split("-").map(Number);
  let hh = 12, mm = 0;
  if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)){
    const [h, m] = timeStr.split(":").map(Number);
    hh = clampH(h); mm = clampM(m);
  }
  const localDate = new Date(Y, M-1, D, hh, mm, 0, 0);

  const jd = dateToJulianDay(localDate);
  const dnum = jdToDayNumber(jd);

  const sun = sunPosition(dnum);
  const moon = moonPositionHighAccuracy(dnum, sun);
  const planets = computePlanets(dnum);

  const bodies = {
    Sun: sun.lon,
    Moon: moon.lon,
    Mercury: planets.Mercury.lon,
    Venus: planets.Venus.lon,
    Mars: planets.Mars.lon,
    Jupiter: planets.Jupiter.lon,
    Saturn: planets.Saturn.lon,
    Uranus: planets.Uranus.lon,
    Neptune: planets.Neptune.lon,
  };

  const signs = {
    Sun: lonToSign(bodies.Sun),
    Moon: lonToSign(bodies.Moon),
    Mercury: lonToSign(bodies.Mercury),
    Venus: lonToSign(bodies.Venus),
    Mars: lonToSign(bodies.Mars),
    Jupiter: lonToSign(bodies.Jupiter),
    Saturn: lonToSign(bodies.Saturn),
    Uranus: lonToSign(bodies.Uranus),
    Neptune: lonToSign(bodies.Neptune),
  };

  const aspects = computeAspectList(bodies);
  const scores = scoreFromAspects(aspects);

  const lp = calcLifePathNumber(localDate);

  const domElement = elementDominant([signs.Sun, signs.Moon, signs.Mercury, signs.Venus, signs.Mars]);
  const mood = moodFromScores(scores, lp);
  const typeKey = typeKeyFrom(domElement, mood);

  const phase = moonPhaseName(bodies.Sun, bodies.Moon);

  // 境界フラグ（月は特に）
  const moonBoundary = isNearSignBoundary(bodies.Moon, 1.2);
  const sunBoundary  = isNearSignBoundary(bodies.Sun, 0.5);

  return {
    meta: {
      name: name || "",
      dobStr,
      timeStr: timeStr || "不明",
      prefStr: prefStr || "",
      tone,
      seedStr,
      jd,
      dnum,
    },
    bodies,
    signs,
    aspects,
    scores,
    lp,
    phase,
    typeKey,
    flags: {
      moonBoundary,
      sunBoundary,
      timeUnknown: !(timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)),
    }
  };
}

function clampH(h){ return Math.max(0, Math.min(23, h)); }
function clampM(m){ return Math.max(0, Math.min(59, m)); }
