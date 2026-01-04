/* =========================================================
  fortune.js / Version 1
  目的：いろんな要素を “混ぜて1つの答え” にする

  開発者メモ（表には出さない）：
  - 出生時間不明でも成立する占星術範囲に絞る（ハウス/ASCは未使用）
  - 西洋占星術：太陽星座・月星座（簡易）・惑星サイン（簡易）・要素バランス
  - 数秘：ライフパス / パーソナルイヤー
  - 出生地：地域補正（日本の生活テンポ補正）
  - 名前：文字数/母音/空気感（軽量）
  - それぞれを同じ “4軸スコア” に翻訳して統合する
========================================================= */

import { hashString, mulberry32, clamp } from "./utils.js";
import { TYPES } from "./data.js";

/* ---------------------------
  占星術（出生時間なしの範囲）
--------------------------- */

const SIGNS = [
  "牡羊座","牡牛座","双子座","蟹座","獅子座","乙女座",
  "天秤座","蠍座","射手座","山羊座","水瓶座","魚座"
];

const ELEMENT = {
  "牡羊座":"fire","獅子座":"fire","射手座":"fire",
  "牡牛座":"earth","乙女座":"earth","山羊座":"earth",
  "双子座":"air","天秤座":"air","水瓶座":"air",
  "蟹座":"water","蠍座":"water","魚座":"water"
};

function signFromMonthDay(m, d){
  // 太陽星座（一般的境界）
  if ((m===3 && d>=21) || (m===4 && d<=19)) return "牡羊座";
  if ((m===4 && d>=20) || (m===5 && d<=20)) return "牡牛座";
  if ((m===5 && d>=21) || (m===6 && d<=21)) return "双子座";
  if ((m===6 && d>=22) || (m===7 && d<=22)) return "蟹座";
  if ((m===7 && d>=23) || (m===8 && d<=22)) return "獅子座";
  if ((m===8 && d>=23) || (m===9 && d<=22)) return "乙女座";
  if ((m===9 && d>=23) || (m===10 && d<=23)) return "天秤座";
  if ((m===10 && d>=24) || (m===11 && d<=22)) return "蠍座";
  if ((m===11 && d>=23) || (m===12 && d<=21)) return "射手座";
  if ((m===12 && d>=22) || (m===1 && d<=19)) return "山羊座";
  if ((m===1 && d>=20) || (m===2 && d<=18)) return "水瓶座";
  return "魚座";
}

function approxMoonSign(date){
  // 開発者メモ：
  // 本格月計算は重いので、出生時間なしでも破綻しにくい簡易版
  // 29.53日周期でサインを回す（ざっくり）
  const base = new Date("2000-01-06T00:00:00Z"); // 新月近辺の基準（目安）
  const days = (date.getTime() - base.getTime()) / 86400000;
  const phase = ((days % 29.530588) + 29.530588) % 29.530588;
  const signIndex = Math.floor((phase / 29.530588) * 12);
  return SIGNS[signIndex];
}

function elementBias(sign){
  const e = ELEMENT[sign];
  return {
    fire:  { WORK: +8, LOVE: +2, MONEY:+2, LIFE:+1 },
    earth: { WORK: +6, LOVE: +2, MONEY:+6, LIFE:+6 },
    air:   { WORK: +4, LOVE: +6, MONEY:+2, LIFE:+2 },
    water: { WORK: +2, LOVE: +8, MONEY:+1, LIFE:+4 }
  }[e] || {WORK:0,LOVE:0,MONEY:0,LIFE:0};
}

/* ---------------------------
  数秘
--------------------------- */
function lifePathNumber(date){
  const y = String(date.getFullYear());
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  const s = y+m+d;
  let sum = 0;
  for (const ch of s) sum += Number(ch);
  while (sum > 9) sum = String(sum).split("").reduce((a,c)=>a+Number(c),0);
  return sum || 9;
}

function personalYear(date, yearNow){
  // ざっくり：誕生日（MMDD）＋年（YYYY）の合算
  const mm = date.getMonth()+1;
  const dd = date.getDate();
  const s = String(yearNow) + String(mm) + String(dd);
  let sum = 0;
  for (const ch of s) sum += Number(ch);
  while (sum > 9) sum = String(sum).split("").reduce((a,c)=>a+Number(c),0);
  return sum || 9;
}

function numerologyBias(lp){
  // “意味がぶれにくい”だけ補正（控えめ）
  const map = {
    1: {WORK:+8, LOVE:+1, MONEY:+3, LIFE:+1},
    2: {WORK:+2, LOVE:+8, MONEY:+1, LIFE:+3},
    3: {WORK:+4, LOVE:+5, MONEY:+2, LIFE:+1},
    4: {WORK:+6, LOVE:+2, MONEY:+5, LIFE:+6},
    5: {WORK:+5, LOVE:+3, MONEY:+2, LIFE:-1},
    6: {WORK:+2, LOVE:+7, MONEY:+2, LIFE:+5},
    7: {WORK:+3, LOVE:+1, MONEY:+2, LIFE:+4},
    8: {WORK:+6, LOVE:+1, MONEY:+8, LIFE:+2},
    9: {WORK:+3, LOVE:+5, MONEY:+2, LIFE:+2},
  };
  return map[lp] ?? {WORK:0,LOVE:0,MONEY:0,LIFE:0};
}

function yearBias(py){
  // 今年の空気（出しすぎると“今日運勢”に寄るので控えめ）
  const map = {
    1:{WORK:+3,LOVE:0,MONEY:+1,LIFE:0},
    2:{WORK:0,LOVE:+2,MONEY:0,LIFE:+1},
    3:{WORK:+1,LOVE:+1,MONEY:0,LIFE:0},
    4:{WORK:+2,LOVE:0,MONEY:+1,LIFE:+2},
    5:{WORK:+1,LOVE:0,MONEY:0,LIFE:-1},
    6:{WORK:0,LOVE:+2,MONEY:0,LIFE:+2},
    7:{WORK:0,LOVE:0,MONEY:0,LIFE:+1},
    8:{WORK:+2,LOVE:0,MONEY:+2,LIFE:0},
    9:{WORK:+1,LOVE:+1,MONEY:0,LIFE:+1},
  };
  return map[py] ?? {WORK:0,LOVE:0,MONEY:0,LIFE:0};
}

/* ---------------------------
  出生地（都道府県）補正
--------------------------- */
function regionOf(pref){
  if (!pref || pref==="未選択") return "unknown";
  const HOKKAIDO_TOHOKU = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県"];
  const KANTO = ["茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県"];
  const CHUBU = ["新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県"];
  const KINKI = ["三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県"];
  const CHUGOKU_SHIKOKU = ["鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県"];
  const KYUSHU_OKINAWA = ["福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];

  if (HOKKAIDO_TOHOKU.includes(pref)) return "north";
  if (KANTO.includes(pref)) return "kanto";
  if (CHUBU.includes(pref)) return "chubu";
  if (KINKI.includes(pref)) return "kinki";
  if (CHUGOKU_SHIKOKU.includes(pref)) return "west";
  if (KYUSHU_OKINAWA.includes(pref)) return "south";
  return "unknown";
}

function placeBias(pref){
  const r = regionOf(pref);
  const map = {
    north: {WORK:+2, LOVE:+1, MONEY:+1, LIFE:+4}, // 基盤寄り
    kanto: {WORK:+4, LOVE:0,  MONEY:+3, LIFE:0}, // 競争/速度
    chubu: {WORK:+3, LOVE:0,  MONEY:+2, LIFE:+2},// 堅実
    kinki: {WORK:+1, LOVE:+3, MONEY:+1, LIFE:0}, // 対人/表現
    west:  {WORK:+2, LOVE:+1, MONEY:+1, LIFE:+1},// 調整
    south: {WORK:+1, LOVE:+3, MONEY:0,  LIFE:+2},// 情/縁
    unknown:{WORK:0,LOVE:0,MONEY:0,LIFE:0}
  };
  return map[r] ?? map.unknown;
}

/* ---------------------------
  名前（軽量）補正
--------------------------- */
function romanizeRough(name){
  // 開発者メモ：厳密ローマ字は不要。母音比率の“雰囲気”を見るだけ
  // 日本語以外でも最低限動くように英字だけ抽出
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z]/g,"");
}

function vowelScore(roman){
  let a=0,i=0,u=0,e=0,o=0;
  for (const ch of roman){
    if (ch==="a") a++;
    if (ch==="i") i++;
    if (ch==="u") u++;
    if (ch==="e") e++;
    if (ch==="o") o++;
  }
  const total = a+i+u+e+o;
  if (total===0) return {a:0,i:0,u:0,e:0,o:0};
  return { a:a/total, i:i/total, u:u/total, e:e/total, o:o/total };
}

function nameBias(name){
  const s = (name || "").replace(/\s/g,"");
  const len = s.length;
  const roman = romanizeRough(name);
  const v = vowelScore(roman);

  // 控えめ補正（強すぎると占いが崩れるので）
  const bias = {WORK:0,LOVE:0,MONEY:0,LIFE:0};

  // 文字数：短いほど機動力、長いほど安定…くらいの軽さ
  if (len >= 6) { bias.LIFE += 2; bias.WORK += 1; }
  if (len <= 3 && len > 0) { bias.WORK += 2; }

  // 母音：雰囲気補正
  bias.LOVE += Math.round(v.o * 3 + v.e * 2);
  bias.WORK += Math.round(v.i * 3 + v.a * 1);
  bias.LIFE += Math.round(v.u * 2);
  // MONEY は直接は触りすぎない（崩れやすいので）
  return bias;
}

/* ---------------------------
  統合スコア → タイプ決定
--------------------------- */

function mergeScores(...list){
  const s = {WORK:0,LOVE:0,MONEY:0,LIFE:0};
  for (const x of list){
    s.WORK += x.WORK||0;
    s.LOVE += x.LOVE||0;
    s.MONEY += x.MONEY||0;
    s.LIFE += x.LIFE||0;
  }
  // 0..100に寄せる（見た目用）
  const base = {WORK:50,LOVE:50,MONEY:50,LIFE:50};
  return {
    WORK: clamp(base.WORK + s.WORK, 0, 100),
    LOVE: clamp(base.LOVE + s.LOVE, 0, 100),
    MONEY: clamp(base.MONEY + s.MONEY, 0, 100),
    LIFE: clamp(base.LIFE + s.LIFE, 0, 100),
  };
}

function axisLabel(profile){
  const entries = Object.entries(profile).sort((a,b)=>b[1]-a[1]);
  const [top, topV] = entries[0];
  const [sec, secV] = entries[1];
  return `${top}優勢（次点：${sec}）`;
}

function pickTypeKey(profile, seed){
  // 20タイプへ安定割り当て（スコア×seedで散らす）
  // 開発者メモ：同スコア帯が偏らないように、top2軸＋seedで決める
  const order = Object.entries(profile).sort((a,b)=>b[1]-a[1]).map(x=>x[0]); // ["WORK","LIFE",...]
  const top = order[0];
  const second = order[1];

  const map = {
    "WORK|LIFE": ["t01","t03","t15","t19"],
    "WORK|MONEY":["t16","t05","t03","t15"],
    "WORK|LOVE": ["t02","t07","t12","t18"],
    "LOVE|LIFE": ["t04","t14","t20","t07"],
    "LOVE|MONEY":["t12","t07","t04","t20"],
    "MONEY|LIFE":["t05","t15","t20","t01"],
    "MONEY|WORK":["t16","t03","t05","t15"],
    "LIFE|WORK": ["t01","t19","t15","t03"],
    "LIFE|LOVE": ["t14","t04","t20","t07"],
    "LIFE|MONEY":["t05","t15","t20","t01"],
  };

  const key = `${top}|${second}`;
  const cands = map[key] || ["t20","t01","t03","t06"];

  const rnd = mulberry32(seed);
  const idx = Math.floor(rnd() * cands.length);
  return cands[idx];
}

function estimateLevel(pref, time){
  // 表示用：出生地/時間の入力があるほど“補助情報あり”にする（精度そのものを誤魔化さない表現）
  const hasPref = pref && pref !== "未選択";
  const hasTime = time && time !== "不明";
  if (hasPref && hasTime) return "補助情報あり（拡張向け）";
  if (hasPref) return "補助情報あり（出生地）";
  if (hasTime) return "補助情報あり（出生時間）";
  return "標準（出生時間なし）";
}

/* ===========================
  外部公開API
=========================== */

export function buildFortune({ name, dobStr, pref, time, yearNow }){
  const birth = new Date(dobStr);
  const m = birth.getMonth()+1;
  const d = birth.getDate();

  const sun = signFromMonthDay(m,d);
  const moon = approxMoonSign(birth);

  const lp = lifePathNumber(birth);
  const py = personalYear(birth, yearNow);

  const seed = hashString(`${dobStr}|${pref||""}|${(name||"").toLowerCase()}`);

  const score = mergeScores(
    elementBias(sun),
    elementBias(moon),
    numerologyBias(lp),
    yearBias(py),
    placeBias(pref),
    nameBias(name)
  );

  const typeKey = pickTypeKey(score, seed);
  const type = TYPES.find(t=>t.key===typeKey) || TYPES[0];

  return {
    meta: {
      sun, moon, lp, py,
      level: estimateLevel(pref, time),
      axis: axisLabel(score),
      seed
    },
    profile: score,
    type
  };
}
