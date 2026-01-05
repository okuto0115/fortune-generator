/* =========================================================
  fortune.js / Version 10 (patched)
  - ES Modulesは使わない（export禁止）
  - app.js から呼べるように window.FortuneEngine.run を提供
  - 出生時間は「精度ラベル」にだけ反映（ロジックは出生時間なしでも成立）
========================================================= */

(function () {
  "use strict";

  // ===== deps =====
  const U = window.Utils;
  if (!U?.hashString || !U?.mulberry32 || !U?.clamp) {
    console.error("[fortune.js] Utils not loaded. window.Utils =", window.Utils);
    return;
  }

  // data.js で window.TYPES が「配列」想定
  // 例: [{ key:"t01", name:"...", oneLine:"...", axis:"...", img:"..." }, ...]
  const TYPES = window.TYPES;
  if (!Array.isArray(TYPES) || TYPES.length === 0) {
    console.warn("[fortune.js] TYPES is missing. window.TYPES =", window.TYPES);
  }

  const { hashString, mulberry32, clamp } = U;

  /* ---------------------------
    安全な日付パース（Safari対策）
    - "YYYY/MM/DD" "YYYY-MM-DD" 両対応
  --------------------------- */
  function parseDob(dobStr) {
    const s = String(dobStr || "").trim();
    if (!s) return null;

    const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (!m) return null;

    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);

    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    if (mo < 1 || mo > 12) return null;
    if (d < 1 || d > 31) return null;

    // ローカル日付として固定（時間は使わない）
    const dt = new Date(y, mo - 1, d);
    // 念のため逆検証
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;

    return dt;
  }

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
    // 月齢の簡易モデル（厳密ではない）
    const base = new Date(Date.UTC(2000, 0, 6, 0, 0, 0));
    const days = (date.getTime() - base.getTime()) / 86400000;
    const phase = ((days % 29.530588) + 29.530588) % 29.530588;
    const signIndex = Math.floor((phase / 29.530588) * 12);
    return SIGNS[signIndex];
  }

  function elementBias(sign){
    const e = ELEMENT[sign];
    return {
      fire:  { work: +8, love: +2, money:+2, health:+1 },
      earth: { work: +6, love: +2, money:+6, health:+6 },
      air:   { work: +4, love: +6, money:+2, health:+2 },
      water: { work: +2, love: +8, money:+1, health:+4 }
    }[e] || {work:0,love:0,money:0,health:0};
  }

  /* ---------------------------
    数秘
  --------------------------- */
  function reduceTo1Digit(n){
    let sum = n;
    while (sum > 9) {
      sum = String(sum).split("").reduce((a,c)=>a+Number(c),0);
    }
    return sum || 9;
  }

  function lifePathNumber(date){
    const y = String(date.getFullYear());
    const m = String(date.getMonth()+1).padStart(2,"0");
    const d = String(date.getDate()).padStart(2,"0");
    const s = y+m+d;
    let sum = 0;
    for (const ch of s) sum += Number(ch);
    return reduceTo1Digit(sum);
  }

  function personalYear(date, yearNow){
    const mm = date.getMonth()+1;
    const dd = date.getDate();
    const s = String(yearNow) + String(mm) + String(dd);
    let sum = 0;
    for (const ch of s) sum += Number(ch);
    return reduceTo1Digit(sum);
  }

  function numerologyBias(lp){
    const map = {
      1: {work:+8, love:+1, money:+3, health:+1},
      2: {work:+2, love:+8, money:+1, health:+3},
      3: {work:+4, love:+5, money:+2, health:+1},
      4: {work:+6, love:+2, money:+5, health:+6},
      5: {work:+5, love:+3, money:+2, health:-1},
      6: {work:+2, love:+7, money:+2, health:+5},
      7: {work:+3, love:+1, money:+2, health:+4},
      8: {work:+6, love:+1, money:+8, health:+2},
      9: {work:+3, love:+5, money:+2, health:+2},
    };
    return map[lp] ?? {work:0,love:0,money:0,health:0};
  }

  function yearBias(py){
    const map = {
      1:{work:+3,love:0,money:+1,health:0},
      2:{work:0,love:+2,money:0,health:+1},
      3:{work:+1,love:+1,money:0,health:0},
      4:{work:+2,love:0,money:+1,health:+2},
      5:{work:+1,love:0,money:0,health:-1},
      6:{work:0,love:+2,money:0,health:+2},
      7:{work:0,love:0,money:0,health:+1},
      8:{work:+2,love:0,money:+2,health:0},
      9:{work:+1,love:+1,money:0,health:+1},
    };
    return map[py] ?? {work:0,love:0,money:0,health:0};
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
      north:  {work:+2, love:+1, money:+1, health:+4},
      kanto:  {work:+4, love:0,  money:+3, health:0},
      chubu:  {work:+3, love:0,  money:+2, health:+2},
      kinki:  {work:+1, love:+3, money:+1, health:0},
      west:   {work:+2, love:+1, money:+1, health:+1},
      south:  {work:+1, love:+3, money:0,  health:+2},
      unknown:{work:0,  love:0,  money:0,  health:0}
    };
    return map[r] ?? map.unknown;
  }

  /* ---------------------------
    名前（kana優先の軽量補正）
    - カタカナ→ひらがな対応
  --------------------------- */
  function kataToHira(str){
    return String(str || "").replace(/[\u30A1-\u30F6]/g, ch => {
      return String.fromCharCode(ch.charCodeAt(0) - 0x60);
    });
  }

  function nameBias(nameLike){
    const raw = nameLike || "";
    const s = kataToHira(raw).replace(/\s/g,"");
    const len = s.length;

    const bias = {work:0,love:0,money:0,health:0};

    if (len >= 6) { bias.health += 2; bias.work += 1; }
    if (len <= 3 && len > 0) { bias.work += 2; }

    const a = (s.match(/あ/g)||[]).length;
    const i = (s.match(/い/g)||[]).length;
    const u = (s.match(/う/g)||[]).length;
    const e = (s.match(/え/g)||[]).length;
    const o = (s.match(/お/g)||[]).length;
    const total = a+i+u+e+o;

    if (total > 0){
      bias.love += Math.round((o+e) * 0.8);
      bias.work += Math.round((i+a) * 0.6);
      bias.health += Math.round(u * 0.6);
    }
    return bias;
  }

  /* ---------------------------
    統合スコア
  --------------------------- */
  function mergeScores(...list){
    const s = {work:0,love:0,money:0,health:0};
    for (const x of list){
      s.work += x.work||0;
      s.love += x.love||0;
      s.money += x.money||0;
      s.health += x.health||0;
    }
    const base = {work:50,love:50,money:50,health:50};
    return {
      work: clamp(base.work + s.work, 0, 100),
      love: clamp(base.love + s.love, 0, 100),
      money: clamp(base.money + s.money, 0, 100),
      health: clamp(base.health + s.health, 0, 100),
    };
  }

  function axisLabel(profile){
    const entries = Object.entries(profile).sort((a,b)=>b[1]-a[1]);
    const [top] = entries[0];
    const [sec] = entries[1];
    const jp = {work:"仕事", money:"お金", love:"恋愛", health:"健康"};
    return `${jp[top] || top}優勢（次点：${jp[sec] || sec}）`;
  }

  function pickTypeKeyByProfile(profile, seed){
    const order = Object.entries(profile).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
    const top = order[0];
    const second = order[1];

    const map = {
      "work|health": ["t01","t03","t15","t19"],
      "work|money":  ["t16","t05","t03","t15"],
      "work|love":   ["t02","t07","t12","t18"],
      "love|health": ["t04","t14","t20","t07"],
      "love|money":  ["t12","t07","t04","t20"],
      "money|health":["t05","t15","t20","t01"],
      "money|work":  ["t16","t03","t05","t15"],
      "health|work": ["t01","t19","t15","t03"],
      "health|love": ["t14","t04","t20","t07"],
      "health|money":["t05","t15","t20","t01"],
    };

    const key = `${top}|${second}`;
    const cands = map[key] || ["t20","t01","t03","t06"];

    const rnd = mulberry32(seed);
    const idx = Math.floor(rnd() * cands.length);
    return cands[idx];
  }

  function estimateLevel(pref, timeValue){
    const hasPref = pref && pref !== "未選択";
    const hasTime = timeValue && timeValue !== "不明";
    if (hasPref && hasTime) return "補助情報あり（拡張向け）";
    if (hasPref) return "補助情報あり（出生地）";
    if (hasTime) return "補助情報あり（出生時間）";
    return "標準（出生時間なし）";
  }

  // ===== public runner =====
  function run(input){
    const dobStr = input?.dob || input?.dobStr || "";
    const pref = input?.pref || "";
    const name = input?.name || "";
    const kana = input?.kana || "";
    const timeValue = input?.birthTime || input?.timeValue || input?.time || "不明";

    const yearNow = (new Date()).getFullYear();

    const birth = parseDob(dobStr);
    if (!birth) {
      return {
        typeKey: "t01",
        scores: { overall:50, work:50, money:50, love:50, health:50 },
        meta: { axis:"-", level:"（日付が不正）", type:null }
      };
    }

    const m = birth.getMonth()+1;
    const d = birth.getDate();

    const sun = signFromMonthDay(m,d);
    const moon = approxMoonSign(birth);

    const lp = lifePathNumber(birth);
    const py = personalYear(birth, yearNow);

    const seed = hashString(`${dobStr}|${pref||""}|${(name||"").toLowerCase()}|${(kana||"").toLowerCase()}`);
    const nameSource = (kana && kana.trim()) ? kana : name;

    const profile = mergeScores(
      elementBias(sun),
      elementBias(moon),
      numerologyBias(lp),
      yearBias(py),
      placeBias(pref),
      nameBias(nameSource)
    );

    const typeKey = pickTypeKeyByProfile(profile, seed);

    const scores = {
      overall: Math.round((profile.work + profile.money + profile.love + profile.health) / 4),
      work: profile.work,
      money: profile.money,
      love: profile.love,
      health: profile.health,
    };

    const typeObj = Array.isArray(TYPES) ? (TYPES.find(t=>t.key===typeKey) || TYPES[0]) : null;

    return {
      typeKey,
      scores,
      meta: {
        sun, moon, lp, py,
        axis: axisLabel(profile),
        level: estimateLevel(pref, timeValue),
        type: typeObj || null,
      },
    };
  }

  window.FortuneEngine = { run };
})();
