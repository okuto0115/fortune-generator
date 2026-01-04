/*
  fortune.js / Version 11 (stabilized)
  ===================================
  方針：
  - ES Modules は使わない（export/import禁止）
  - window.Utils と window.TYPES を参照（data.js側で用意）
  - app.js から呼びやすいように window.FortuneEngine.run を提供
  - 出生時間なしでも成立（ASC/ハウス無し）
*/

(function () {
  "use strict";

  const U = window.Utils || {};
  const { hashString, mulberry32, clamp } = U;

  // Utils に無い環境でも落ちないようにする
  const safeTrim = U.safeTrim || function (s) { return (s ?? "").toString().trim(); };

  // data.js 側：
  // window.TYPES = [{ key, name, oneLine, img }, ...] を推奨（配列で統一）
  const TYPES = window.TYPES;

  if (!hashString || !mulberry32 || !clamp) {
    console.error("[fortune.js] Utils not loaded. window.Utils =", window.Utils);
    return;
  }
  if (!Array.isArray(TYPES) || TYPES.length === 0) {
    console.error("[fortune.js] TYPES not loaded or invalid. window.TYPES =", window.TYPES);
    return;
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
    // 月星座（超簡易）：出生時間がない前提で破綻しにくい軽量版
    const base = new Date("2000-01-06T00:00:00Z");
    const days = (date.getTime() - base.getTime()) / 86400000;
    const phase = ((days % 29.530588) + 29.530588) % 29.530588;
    const signIndex = Math.floor((phase / 29.530588) * 12);
    return SIGNS[clamp(signIndex, 0, 11)];
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

  function reduceTo1Digit(n){
    let x = n;
    while (x > 9) {
      x = String(x).split("").reduce((a,c)=>a+Number(c),0);
    }
    return x || 9;
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
      north:  {WORK:+2, LOVE:+1, MONEY:+1, LIFE:+4},
      kanto:  {WORK:+4, LOVE:0,  MONEY:+3, LIFE:0},
      chubu:  {WORK:+3, LOVE:0,  MONEY:+2, LIFE:+2},
      kinki:  {WORK:+1, LOVE:+3, MONEY:+1, LIFE:0},
      west:   {WORK:+2, LOVE:+1, MONEY:+1, LIFE:+1},
      south:  {WORK:+1, LOVE:+3, MONEY:0,  LIFE:+2},
      unknown:{WORK:0,  LOVE:0,  MONEY:0,  LIFE:0}
    };
    return map[r] ?? map.unknown;
  }

  /* ---------------------------
    名前（kana優先の軽量補正）
  --------------------------- */

  function nameBias(nameLike){
    const name = nameLike || "";
    const s = name.replace(/\s/g,"");
    const len = s.length;

    const bias = {WORK:0,LOVE:0,MONEY:0,LIFE:0};

    if (len >= 6) { bias.LIFE += 2; bias.WORK += 1; }
    if (len <= 3 && len > 0) { bias.WORK += 2; }

    const a = (s.match(/あ/g)||[]).length;
    const i = (s.match(/い/g)||[]).length;
    const u = (s.match(/う/g)||[]).length;
    const e = (s.match(/え/g)||[]).length;
    const o = (s.match(/お/g)||[]).length;
    const total = a+i+u+e+o;

    if (total > 0){
      bias.LOVE += Math.round((o+e) * 0.8);
      bias.WORK += Math.round((i+a) * 0.6);
      bias.LIFE += Math.round(u * 0.6);
    }
    return bias;
  }

  /* ---------------------------
    統合スコア
  --------------------------- */

  function mergeScores(...list){
    const s = {WORK:0,LOVE:0,MONEY:0,LIFE:0};
    for (const x of list){
      s.WORK += x.WORK||0;
      s.LOVE += x.LOVE||0;
      s.MONEY += x.MONEY||0;
      s.LIFE += x.LIFE||0;
    }
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
    const [top] = entries[0];
    const [sec] = entries[1];
    return `${top}優勢（次点：${sec}）`;
  }

  function estimateLevel(pref, time){
    const hasPref = !!(pref && pref !== "未選択");
    const hasTime = !!(time && time !== "不明");
    if (hasPref && hasTime) return "補助情報あり（拡張向け）";
    if (hasPref) return "補助情報あり（出生地）";
    if (hasTime) return "補助情報あり（出生時間）";
    return "標準（出生時間なし）";
  }

  function pickTypeKeyByAxis(profile, seed){
    const order = Object.entries(profile).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
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

  function safeDate(dobStr){
    const d = new Date(dobStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /* ===========================
    メイン：buildFortune
  =========================== */

  function buildFortune({ name, kana, dobStr, pref, time, yearNow }){
    const birth = safeDate(dobStr);
    if (!birth) {
      return {
        typeKey: TYPES[0].key,
        scores: { overall: 50, work: 50, money: 50, love: 50, health: 50 },
        meta: { level: "（日付不正）", axis: "（不明）" }
      };
    }

    const m = birth.getMonth()+1;
    const d = birth.getDate();

    const sun = signFromMonthDay(m,d);
    const moon = approxMoonSign(birth);
    const lp = lifePathNumber(birth);
    const py = personalYear(birth, yearNow);

    const nameSource = safeTrim(kana) ? kana : name;

    const seed = hashString(
      `${dobStr}|${pref||""}|${(name||"").toLowerCase()}|${(kana||"").toLowerCase()}|${time||""}`
    );

    const profile = mergeScores(
      elementBias(sun),
      elementBias(moon),
      numerologyBias(lp),
      yearBias(py),
      placeBias(pref),
      nameBias(nameSource)
    );

    const typeKey = pickTypeKeyByAxis(profile, seed);
    const type = TYPES.find(t=>t.key===typeKey) || TYPES[0];

    // app.js が使いやすい形に変換（overall/work/money/love/health）
    const scores = {
      overall: Math.round((profile.WORK + profile.MONEY + profile.LOVE + profile.LIFE) / 4),
      work: profile.WORK,
      money: profile.MONEY,
      love: profile.LOVE,
      health: profile.LIFE, // LIFE を健康枠として使う
    };

    return {
      typeKey: type.key,
      type,
      profile,
      scores,
      meta: {
        sun, moon, lp, py,
        axis: axisLabel(profile),
        level: estimateLevel(pref, time),
        seed
      }
    };
  }

  /* ===========================
    app.js から呼ぶ入口
  =========================== */

  window.FortuneEngine = {
    run(input){
      const yearNow = new Date().getFullYear();
      const res = buildFortune({
        name: input?.name ?? "",
        kana: input?.kana ?? "",
        dobStr: input?.dob ?? input?.dobStr ?? "",
        pref: input?.pref ?? "",
        time: input?.birthTime ?? input?.time ?? "不明",
        yearNow
      });

      return {
        typeKey: res.typeKey,
        scores: res.scores,
        meta: {
          ...res.meta,
          typeName: res.type?.name ?? res.typeKey,
          typeOneLine: res.type?.oneLine ?? "",
          typeImg: res.type?.img ?? ""
        }
      };
    }
  };

  // 互換（古い参照を拾う）
  window.Fortune = window.FortuneEngine;

})();
