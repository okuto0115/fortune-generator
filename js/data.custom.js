/* =========================================================
  data.custom.js / Version 1 (CUSTOM)
  ================================
  - ここだけ触ればOK（文章・口調・語尾・結果数）
  - data.js（BASE）の上に上書き/追加するだけ
  - app.js が {byType, default} を拾える前提（あなたの完全版に合わせる）
  - 結果数は VARIANTS_PER_TYPE を増やすだけで 40/60/100 に拡張できる
========================================================= */
(function () {
  "use strict";

  // ------------------------------------------------------
  // safety: BASE が未ロードでも落とさない
  // ------------------------------------------------------
  const TYPES = Array.isArray(window.TYPES) ? window.TYPES : [];
  window.POOLS = window.POOLS || { sections: {}, finalMessage: {} };
  window.POOLS.sections = window.POOLS.sections || {};
  window.POOLS.finalMessage = window.POOLS.finalMessage || {};

  // ------------------------------------------------------
  // ✅ ここだけ触れば「結果数」が増える（20→40→60→100…）
  // ------------------------------------------------------
  const VARIANTS_PER_TYPE = 20; // ← 40 / 60 / 100 にしたければここだけ変える

  // ------------------------------------------------------
  // util
  // ------------------------------------------------------
  const pick = (arr, i) => arr[i % arr.length];
  const genN = (n, makeLine) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push(makeLine(i));
    return out;
  };

  // 「今日」禁止（保険）。どうしても “今日” を書いちゃっても “今” に寄せる
  const banToday = (s) => String(s).replace(/今日/g, "今");

  // 句点/語尾のダブりを減らす（「だよ。だよ。」みたいなのを避ける）
  function tidy(text) {
    let s = String(text || "");

    // 余計な空白
    s = s.replace(/\s+/g, " ").trim();

    // 連続句点/感嘆
    s = s.replace(/。。+/g, "。");
    s = s.replace(/！！+/g, "！");
    s = s.replace(/……+/g, "…");

    // 「だよ。だよ。」のような連続を軽く抑制
    s = s.replace(/(だよ。)\s*\1+/g, "だよ。");
    s = s.replace(/(なんだよ。)\s*\1+/g, "なんだよ。");
    s = s.replace(/(でしょ？)\s*\1+/g, "でしょ？");

    // 文末に「だよ。」が来た後にさらに「だよ。」だけが付くのを防ぐ（あなたの例で出てたやつ）
    s = s.replace(/だよ。\s*だよ。$/g, "だよ。");

    return s;
  }

  // 文章パーツを “いい感じの一文” にまとめる（繋ぎの違和感減らす）
  function joinParts(parts) {
    const filtered = parts
      .map((x) => (x == null ? "" : String(x).trim()))
      .filter(Boolean);

    // 末尾が句点/！/？/… の場合はスペース不要
    const out = [];
    for (let i = 0; i < filtered.length; i++) {
      const p = filtered[i];
      if (out.length === 0) {
        out.push(p);
        continue;
      }
      const prev = out[out.length - 1];
      const prevEnds = /[。！？…]$/.test(prev);
      const curStarts = /^[、。！？…]/.test(p);
      if (prevEnds || curStarts) out.push(p);
      else out.push(" " + p);
    }
    return tidy(out.join(""));
  }

  // base: section/tone/band を必ず作る
  function ensureSection(sec) {
    window.POOLS.sections[sec] = window.POOLS.sections[sec] || {};
    for (const tone of ["soft", "standard", "toxic"]) {
      window.POOLS.sections[sec][tone] = window.POOLS.sections[sec][tone] || {};
      for (const band of ["high", "mid", "low"]) {
        window.POOLS.sections[sec][tone][band] =
          window.POOLS.sections[sec][tone][band] || { byType: {}, default: [] };
      }
    }
  }

  function ensureFinal() {
    for (const tone of ["soft", "standard", "toxic"]) {
      window.POOLS.finalMessage[tone] = window.POOLS.finalMessage[tone] || {};
      for (const band of ["high", "mid", "low"]) {
        window.POOLS.finalMessage[tone][band] =
          window.POOLS.finalMessage[tone][band] || { byType: {}, default: [] };
      }
    }
  }

  function typeName(typeKey) {
    const t = TYPES.find((x) => x.key === typeKey);
    return t ? t.name : typeKey;
  }

  // ------------------------------------------------------
  // ✅ タイプの “味”（ここ増やすと全体が一気に単調じゃなくなる）
  // ------------------------------------------------------
  const TYPE_FLAVOR = {
    t01: ["土台を固めるほど強い", "積み上げが裏切らない", "基礎が全部を救う"],
    t02: ["言葉と表現が扉を開く", "発信で流れが動く", "見せ方で勝ち筋が出る"],
    t03: ["続けた分だけ回収できる", "職人の強さが出る", "仕上げる力が武器"],
    t04: ["癒しが価値になる", "優しさが縁を連れてくる", "安心が運を整える"],
    t05: ["守りが強いほど増える", "安定が資産になる", "ブレないのが勝ち"],
    t06: ["動くほど強い", "挑戦が運を呼ぶ", "止まらない方が伸びる"],
    t07: ["縁が人生を回す", "人が運を運ぶ", "つながりで加速する"],
    t08: ["切替が速いほど勝つ", "変化に強い", "立て直しが早い"],
    t09: ["本質を掴むほど勝つ", "深掘りが武器", "薄い選択を減らすと伸びる"],
    t10: ["整えるほど伸びる", "片付けが開運", "整理で運の通り道ができる"],
    t11: ["情熱が燃料", "好きに寄せるほど強い", "熱が戻ると一気に進む"],
    t12: ["センスが運を引っ張る", "見せ方で勝つ", "美意識が武器"],
    t13: ["学ぶほど加速", "伸びしろが強い", "吸収が全部を変える"],
    t14: ["守る力が才能", "安心が強さ", "居場所を作れる"],
    t15: ["段取りが勝ち", "計画で回収できる", "設計が未来を救う"],
    t16: ["目標があるほど強い", "数字で燃える", "達成が運を太くする"],
    t17: ["直感が当たる", "波に乗ると強い", "感性が道を選ぶ"],
    t18: ["好奇心が武器", "情報で勝てる", "動きながら形にする"],
    t19: ["後半ほど強い", "晩成の怖さが出る", "静かに伸びる"],
    t20: ["全体最適で強い", "バランスで崩れない", "破綻しにくいのが才能"],
  };
  function flavor(typeKey, i) {
    const f = TYPE_FLAVOR[typeKey] || ["整えれば伸びる"];
    return pick(f, i);
  }

  // ------------------------------------------------------
  // ✅ 語尾ルール（ここを増やす＝口調が伸びる）
  // ------------------------------------------------------
  const END_SOFT = [
    "だよ。", "なんだよ。", "していいんだよ。", "大丈夫なんだよ。", "ゆっくりでいいんだよ。",
    "そのままでいいんだよ。", "ちゃんと届くんだよ。", "ひとりじゃないんだよ。"
  ];
  const END_STD = [
    "。", "でいい。", "で大丈夫。", "で進めばいい。", "で整う。", "で勝てる。"
  ];
  const END_TOXIC = [
    "…ね！", "…でしょ？", "…っての！", "…ほら！", "…逃げるんじゃないよ！",
    "…やるんだよ！", "…分かってる？", "…やるしかないでしょ！"
  ];
  const softEnd = (i) => pick(END_SOFT, i);
  const stdEnd = (i) => pick(END_STD, i);
  const toxicEnd = (i) => pick(END_TOXIC, i);

  // ------------------------------------------------------
  // ✅ セクション骨格（抽象すぎを避けるため “少し具体” を維持）
  // ------------------------------------------------------
  const BAND_CORE = {
    high: {
      overall: ["流れは上向きで、回収が始まりやすい", "縁と評価が積もりやすい", "追い風が乗りやすい"],
      work: ["成果が見えやすく、評価に繋がりやすい", "本命を仕上げるほど伸びる", "外に出すほど回り始める"],
      money: ["守りと回収が噛み合いやすい", "整えるほど増える形が作れる", "判断が当たりやすい"],
      love: ["距離が縮みやすく、素直さが刺さる", "関係が進みやすい", "安心が魅力として出る"],
      health: ["整えた分だけ戻りやすい", "回復のルートが見つかりやすい", "無理しなければ安定する"],
    },
    mid: {
      overall: ["安定寄りで、整えた分だけ良くなる", "調整期で、無理しなければ崩れない", "中庸で、積み上げが効く"],
      work: ["改善と仕組み化が効く", "分割して回すと安定する", "やる量より手順が大事になる"],
      money: ["点検と整理が効く", "衝動より確認が勝つ", "固定費と習慣の見直しが刺さる"],
      love: ["安心を積むほど伸びる", "距離感の調整が鍵", "丁寧さが信頼に変わる"],
      health: ["生活リズムで整う", "疲れを溜めない設計が勝つ", "回復を優先すると戻る"],
    },
    low: {
      overall: ["慎重期で、守りが最優先になる", "空回りしやすいから無理は禁物", "回復を優先した方が結果が早い"],
      work: ["確認と整備が勝ちになる", "背負う量を減らす方が進む", "決断は急がず安全運転が合う"],
      money: ["ミスが出やすいから守りが必要", "大きな判断は慎重が良い", "散財の引き金を避けるのが勝ち"],
      love: ["焦りがズレを生むから落ち着きが必要", "深読みより事実で見ると安定する", "距離を詰めすぎない方が良い"],
      health: ["頑張りすぎると崩れやすい", "回復が最優先", "睡眠・食事・休憩が土台になる"],
    },
  };

  const ACTION = {
    overall: [
      "やることを増やすより、優先順位を戻すほど運が整う",
      "抱え込まず、頼れる所を一つ作るほど流れが太くなる",
      "止まっているものを一つだけ完了させると、次が動き出す",
      "余計な選択を減らすほど、心が軽くなる",
    ],
    work: [
      "本命を一つ決めて、そこに寄せて仕上げるほど評価が積もる",
      "提出・公開・連絡まで含めて“完了”にすると流れが太くなる",
      "テンプレ化・手順化で、疲れずに伸ばせる",
      "やる順番を固定すると、迷いが減って強くなる",
    ],
    money: [
      "固定費や習慣を整えると、増やすより早く楽になる",
      "入出金を見える化すると、無駄が自然に減る",
      "買うなら“回収できるか”で選ぶと強い",
      "支払いの自動化で、取りこぼしが消える",
    ],
    love: [
      "安心感を積むほど関係が育つ",
      "好意は重くせず、素直に少しだけ表に出すと進みやすい",
      "会話が続く相手を選ぶほど、自然に長持ちする",
      "無理に盛らず、誠実さを続けると信頼になる",
    ],
    health: [
      "休むのも予定に入れると、長く強くいられる",
      "睡眠と食事を優先すると、回復が早くなる",
      "無理を続けない設計にすると、波が小さくなる",
      "体を温める習慣で、心も戻りやすくなる",
    ],
  };

  // ------------------------------------------------------
  // ✅ 口調テンプレ（“単調”を避けるため lead/emo/jab を多めに回す）
  // ------------------------------------------------------
  const SOFT_LEAD = [
    "ねぇ、安心してね。",
    "大丈夫だよ。",
    "うん…ちゃんと見てるよ。",
    "ふふ、ここにいていいんだよ。",
    "苦しくても、あなたはひとりじゃないよ。",
  ];
  const SOFT_EMO = [
    "無理して笑わなくていいんだよ。私は味方だよ。",
    "頑張ってきたの、ちゃんと分かってるんだよ。えらいよ。",
    "疲れたら甘えていいんだよ。受け止めるよ。",
    "怖くても大丈夫なんだよ。ゆっくりでいいんだよ。",
    "あなたのペースでいいんだよ。置いていかないよ。",
  ];

  const TOXIC_LEAD = [
    "ねぇ。",
    "ちょっと。",
    "…はぁ。",
    "分かってる？",
    "聞いてる？",
  ];
  const TOXIC_JAB = [
    "中途半端にやって「しんどい」とか言わないで！",
    "どうせ不安なんでしょ？なら、やることやって黙って勝ちな！",
    "逃げ道探してる暇があるなら、現実を動かしなよ！",
    "甘えたいなら甘えていい。でも、サボるのは違うから！",
    "できるのにやらないのが一番ムカつくんだよ！",
  ];

  const STD_LEAD = [
    "結論から言うと、",
    "流れとしては、",
    "全体の設計で見ると、",
    "傾向として、",
    "要点はこれ。",
  ];

  // ------------------------------------------------------
  // ✅ 文章生成（1本）
  // ------------------------------------------------------
  function buildLine(section, tone, band, typeKey, i) {
    const tn = typeName(typeKey);
    const fv = flavor(typeKey, i);
    const core = pick(BAND_CORE[band][section], i);
    const act = pick(ACTION[section], i * 2);

    // soft（ふわふわ、包む。長さは “やさしめ理想” に寄せる）
    if (tone === "soft") {
      const lead = pick(SOFT_LEAD, i);
      const emo = pick(SOFT_EMO, i + 3);
      const end = softEnd(i);

      return banToday(
        joinParts([
          `${lead}${tn}のあなたは、${fv}んだよ。`,
          `${core}んだよ。`,
          `だからね、${act}と、ちゃんと未来が楽になるんだよ。`,
          `${emo}`,
          end,
        ])
      );
    }

    // toxic（毒舌だけど女の子。文量は “やさしめ” に近づける）
    if (tone === "toxic") {
      const lead = pick(TOXIC_LEAD, i);
      const jab = pick(TOXIC_JAB, i + 2);
      const end = toxicEnd(i);

      return banToday(
        joinParts([
          `${lead} ${tn}なんだから、${fv}なんでしょ？`,
          `${core}。`,
          `だから${act}って決めなよ。`,
          jab,
          end,
        ])
      );
    }

    // standard（個性薄め・無機質寄り）
    const lead = pick(STD_LEAD, i);
    const end = stdEnd(i);

    return banToday(
      joinParts([
        `${lead}${tn}は${fv}。`,
        `${core}。`,
        `${act}${end}`,
      ])
    );
  }

  // byType 生成
  function buildByType(section, tone, band) {
    const byType = {};
    for (const t of TYPES) {
      byType[t.key] = genN(VARIANTS_PER_TYPE, (i) => buildLine(section, tone, band, t.key, i));
    }
    // default は t20 を採用（無くても落ちない保険）
    const def = genN(VARIANTS_PER_TYPE, (i) => buildLine(section, tone, band, "t20", i));
    return { byType, default: def };
  }

  // ------------------------------------------------------
  // ✅ 最後の一言（3行。softは泣かせ、toxicは折り、standardは淡々）
  // ------------------------------------------------------
  function buildFinal(tone, band, typeKey, i) {
    const tn = typeName(typeKey);
    const fv = flavor(typeKey, i);

    if (tone === "soft") {
      const a = pick(
        [
          "もう、大丈夫だよ。ここまで生きてきたあなたは、それだけで立派なんだよ。",
          "苦しいって言っていいんだよ。あなたはひとりじゃないんだよ。",
          "泣きたくなるくらい頑張ってきたんだよね。…ほんとに、えらいんだよ。",
          "傷つきながらでも進んできたの、ちゃんと知ってるよ。だから安心していいんだよ。",
        ],
        i
      );
      const b = pick(
        [
          `あなたは${tn}で、${fv}んだよ。だから、無理に強がらなくていいんだよ。`,
          `あなたは${tn}だから、ちゃんと戻れるんだよ。止まっても大丈夫なんだよ。`,
          `あなたは${tn}で、未来を変えられる人なんだよ。自分を雑に扱わないでほしいんだよ。`,
        ],
        i + 1
      );
      const c = pick(
        [
          "迷ってもいい。休んでもいい。それでもあなたは、ちゃんと進んでるんだよ。",
          "誰かに追いつかなくていい。あなたの速度で、あなたの人生を抱きしめていいんだよ。",
          "あなたがあなたを守った時、運は一番強く味方するんだよ。",
        ],
        i + 2
      );
      return banToday(tidy(`${a}\n${b}\n${c}`));
    }

    if (tone === "toxic") {
      const a = pick(
        [
          "ねぇ。ここまで来たなら、やるしかないでしょ！",
          "中途半端に生きるくらいなら、ぶっ壊れる覚悟で行くんだよ！",
          "逃げるんじゃないよ。逃げ癖が一番ダサいんだから！",
          "どうせまたサボるんでしょ？ほら。今度こそやりなよ！",
        ],
        i
      );
      const b = pick(
        [
          `あんたは${tn}で、${fv}なんでしょ？だったら途中で投げるなっての！`,
          `あんたは${tn}なんだから、薄い言い訳で負けるのやめなよ！`,
          `あんたは${tn}。できるのにやらないのが一番ムカつくんだよ！`,
        ],
        i + 1
      );
      const c = pick(
        [
          "立ってるんだから、最後までやって。…ね！",
          "やるか、やらないか。それだけ。分かってる？",
          "甘えていい。でも、逃げるのは許さないよ！",
          "ほら、やるんだよ。ちゃんと、ね！",
        ],
        i + 2
      );
      return banToday(tidy(`${a}\n${b}\n${c}`));
    }

    // standard（淡々）
    const a = pick(
      ["結論。伸びる。", "結論。整えた人が勝つ。", "結論。絞れば進む。", "結論。継続が回収になる。"],
      i
    );
    const b = pick([`あなたは${tn}で、${fv}。`, `強みは${fv}。`, `特性は${fv}。`], i + 1);
    const c = pick(
      ["無理を増やさず、優先順位を固定して進めばいい。", "迷うなら小さく決めて回しながら調整すればいい。", "崩れない設計にして淡々と積めば回収できる。"],
      i + 2
    );
    return banToday(tidy(`${a}\n${b}\n${c}`));
  }

  function buildFinalByType(tone, band) {
    const byType = {};
    for (const t of TYPES) {
      byType[t.key] = genN(VARIANTS_PER_TYPE, (i) => buildFinal(tone, band, t.key, i));
    }
    const def = genN(VARIANTS_PER_TYPE, (i) => buildFinal(tone, band, "t20", i));
    return { byType, default: def };
  }

  // ------------------------------------------------------
  // ✅ ここで POOLS を作って公開
  // ------------------------------------------------------
  for (const sec of ["overall", "work", "money", "love", "health"]) ensureSection(sec);
  ensureFinal();

  for (const sec of ["overall", "work", "money", "love", "health"]) {
    for (const tone of ["soft", "standard", "toxic"]) {
      for (const band of ["high", "mid", "low"]) {
        window.POOLS.sections[sec][tone][band] = buildByType(sec, tone, band);
      }
    }
  }

  for (const tone of ["soft", "standard", "toxic"]) {
    for (const band of ["high", "mid", "low"]) {
      window.POOLS.finalMessage[tone][band] = buildFinalByType(tone, band);
    }
  }

  // 目印
  window.__DATA_CUSTOM__ = {
    version: "1.0",
    variantsPerType: VARIANTS_PER_TYPE,
  };
})();
