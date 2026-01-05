/*
  data.js / Version 10 (FINAL)
  ==========================
  - 初心者向け：文章編集は基本ここだけ
  - 「今日」禁止：ここは“今後の人生”の流れとして書く
  - 20タイプ × 5運勢 × 3口調 × band(high/mid/low) を生成（決定的に選ばれる）
  - app.js は byType を拾えるようにしてある（口調・タイプ差が確実に出る）
*/
(function () {
  "use strict";

  // ---------------------------
  // 都道府県 / 時刻
  // ---------------------------
  const PREFS = [
    "未選択",
    "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
    "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
    "新潟県","富山県","石川県","福井県","山梨県","長野県",
    "岐阜県","静岡県","愛知県","三重県",
    "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
    "鳥取県","島根県","岡山県","広島県","山口県",
    "徳島県","香川県","愛媛県","高知県",
    "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"
  ];

  const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

  // ---------------------------
  // 20タイプ（fortune.js の typeKey と合わせる）
  // ---------------------------
  const TYPES = [
    { key:"t01", name:"もふもふ基礎クマ", oneLine:"土台を作るほど、後で全部回収できるタイプ。" },
    { key:"t02", name:"きらきら発信クマ", oneLine:"言葉と表現が武器。出すほど運が動くタイプ。" },
    { key:"t03", name:"こつこつ職人クマ", oneLine:"積み上げで勝つ。伸びるのはここからのタイプ。" },
    { key:"t04", name:"ふわふわ癒しクマ", oneLine:"人の心をほどく天才。優しさが価値になるタイプ。" },
    { key:"t05", name:"どっしり安定クマ", oneLine:"ブレない強さ。守りが上手いから増えるタイプ。" },
    { key:"t06", name:"ぐいぐい挑戦クマ", oneLine:"動くと強い。止まると弱い。だから動けるタイプ。" },
    { key:"t07", name:"にこにこ社交クマ", oneLine:"縁で人生が開く。人が運を運んでくるタイプ。" },
    { key:"t08", name:"すいすい切替クマ", oneLine:"変化適性が高い。転んでもすぐ立てるタイプ。" },
    { key:"t09", name:"しんみり深掘りクマ", oneLine:"本質を掴む。浅い場所には飽きるタイプ。" },
    { key:"t10", name:"てきぱき整理クマ", oneLine:"整えるほど運が伸びる。片付けが開運のタイプ。" },
    { key:"t11", name:"どきどき情熱クマ", oneLine:"熱がエンジン。好きに全振りで強くなるタイプ。" },
    { key:"t12", name:"つやつや美意識クマ", oneLine:"センスが運を引っ張る。見せ方で勝つタイプ。" },
    { key:"t13", name:"もりもり成長クマ", oneLine:"学ぶほど加速する。伸びしろで殴れるタイプ。" },
    { key:"t14", name:"ぽかぽか家庭クマ", oneLine:"守る力が強い。安心が才能のタイプ。" },
    { key:"t15", name:"きっちり計画クマ", oneLine:"未来の設計が得意。段取りで勝つタイプ。" },
    { key:"t16", name:"ぴかぴか目標クマ", oneLine:"達成運がある。数字で燃えるタイプ。" },
    { key:"t17", name:"ゆらゆら感性クマ", oneLine:"直感が当たる。波に乗ると一気に伸びるタイプ。" },
    { key:"t18", name:"ころころ好奇心クマ", oneLine:"情報で勝つ。動きながら形にするタイプ。" },
    { key:"t19", name:"じわじわ晩成クマ", oneLine:"後半ほど強い。静かに怖いタイプ。" },
    { key:"t20", name:"すべすべバランスクマ", oneLine:"破綻しにくい。全体最適で強いタイプ。" },
  ];

  function typeName(key) {
    const t = TYPES.find(x => x.key === key);
    return t ? t.name : key;
  }

  // ---------------------------
  // 文章生成ユーティリティ
  // ---------------------------
  function pick(arr, i) {
    return arr[i % arr.length];
  }

  function gen20(makeLine) {
    const out = [];
    for (let i = 0; i < 20; i++) out.push(makeLine(i));
    return out;
  }

  // 口調：語尾ゆらぎ（短調回避）
  const END_SOFT = [
    "だよ。", "なんだよ。", "していいんだよ。", "大丈夫なんだよ。", "ゆっくりでいいんだよ。",
    "そのままでいいんだよ。", "ちゃんと届くんだよ。", "ひとりじゃないんだよ。"
  ];
  const END_TOXIC = [
    "…ね。", "…でしょ？", "…っての！", "…ほら！", "…逃げるんじゃないよ。",
    "…やるんだよ。", "…分かってる？", "…やるしかないでしょ！"
  ];
  const END_STD = [
    "。", "でいい。", "で大丈夫。", "で進めばいい。", "で整う。", "で勝てる。"
  ];

  function softEnd(i){ return pick(END_SOFT, i); }
  function toxicEnd(i){ return pick(END_TOXIC, i); }
  function stdEnd(i){ return pick(END_STD, i); }

  // 「今日」禁止チェック（保険）
  function banToday(s) {
    return String(s).replace(/今日/g, "今");
  }

  // タイプごとの“癖”差し込み（短いフレーバー）
  const TYPE_FLAVOR = {
    t01: ["土台を固めるほど強い", "積み上げが裏切らない", "基礎が全部を救う"],
    t02: ["言葉と表現が扉を開く", "発信で流れが動く", "見せ方で勝ち筋が出る"],
    t03: ["続けた分だけ回収できる", "職人の強さが出る", "仕上げる力が武器"],
    t04: ["癒しが価値になる", "優しさが縁を連れてくる", "安心が運を整える"],
    t05: ["守りが強いほど増える", "安定が資産になる", "ブレないのが勝ち"],
    t06: ["動くほど強い", "挑戦が運を呼ぶ", "止まらない方が伸びる"],
    t07: ["縁が人生を回す", "人が運を運ぶ", "つながりで加速する"],
    t08: ["切替が速いほど勝つ", "変化に強い", "転んでも立て直せる"],
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
    const f = TYPE_FLAVOR[typeKey] || ["運は整えれば伸びる"];
    return pick(f, i);
  }

  // ---------------------------
  // 各運勢の“骨格”（抽象すぎず、少し具体）
  // ---------------------------
  function buildLine(section, tone, band, typeKey, i) {
    const tn = typeName(typeKey);
    const fv = flavor(typeKey, i);

    // bandごとの方向性
    const bandCore = {
      high: {
        overall: ["流れは上向きで、回収が始まりやすい", "縁と評価が積もりやすい", "追い風が乗りやすい"],
        work: ["成果が見えやすく、評価に繋がりやすい", "本命を仕上げるほど伸びる", "外に出すほど回り始める"],
        money: ["守りと回収が噛み合いやすい", "整えるほど増える形が作れる", "判断が当たりやすい"],
        love: ["距離が縮みやすく、素直さが刺さる", "関係が進みやすい", "安心が魅力として出る"],
        health:["整えた分だけ戻りやすい", "回復のルートが見つかりやすい", "無理しなければ安定する"]
      },
      mid: {
        overall: ["安定寄りで、整えた分だけ良くなる", "調整期で、無理しなければ崩れない", "中庸で、積み上げが効く"],
        work: ["改善と仕組み化が効く", "分割して回すと安定する", "やる量より手順が大事になる"],
        money: ["点検と整理が効く", "衝動より確認が勝つ", "固定費と習慣の見直しが刺さる"],
        love: ["安心を積むほど伸びる", "距離感の調整が鍵", "丁寧さが信頼に変わる"],
        health:["生活リズムで整う", "疲れを溜めない設計が勝つ", "回復を優先すると戻る"]
      },
      low: {
        overall: ["慎重期で、守りが最優先になる", "空回りしやすいから無理は禁物", "回復を優先した方が結果が早い"],
        work: ["確認と整備が勝ちになる", "背負う量を減らす方が進む", "決断は急がず安全運転が合う"],
        money: ["ミスが出やすいから守りが必要", "大きな判断は慎重が良い", "散財の引き金を避けるのが勝ち"],
        love: ["焦りがズレを生むから落ち着きが必要", "深読みより事実で見ると安定する", "距離を詰めすぎない方が良い"],
        health:["頑張りすぎると崩れやすい", "回復が最優先", "睡眠・食事・休憩が土台になる"]
      }
    };

    const core = pick(bandCore[band][section], i);

    // セクション別の具体アクション（“今日”は禁止、人生設計として）
    const action = {
      overall: [
        "やることを増やすより、優先順位を戻すほど運が整う",
        "抱え込まず、頼れる所を一つ作るほど流れが太くなる",
        "止まっているものを一つだけ完了させると、次が動き出す"
      ],
      work: [
        "本命を一つ決めて、そこに寄せて仕上げるのが強い",
        "提出・公開・連絡まで含めて“完了”にするほど評価が積もる",
        "手順の固定やテンプレ化で、疲れずに伸ばせる"
      ],
      money: [
        "固定費や習慣を整えると、増やすより早く楽になる",
        "入出金を見える化すると、無駄が自然に減る",
        "買うなら“回収できるか”で選ぶと強い"
      ],
      love: [
        "安心感を積むほど関係が育つ",
        "好意は重くせず、素直に少しだけ表に出すと進みやすい",
        "会話が続く相手を選ぶほど、自然に長持ちする"
      ],
      health: [
        "休むのも予定に入れると、長く強くいられる",
        "整えるほど回復が早い。睡眠と食事が最優先になる",
        "無理を続けない設計にすると、波が小さくなる"
      ]
    };

    const act = pick(action[section], i * 2);

    // 口調ごとの前置き・温度
    if (tone === "soft") {
      const lead = pick([
        `ねぇ、${tn}のあなたはね、`,
        `大丈夫だよ。${tn}って、`,
        `うん…ちゃんと見てるよ。${tn}のあなたはね、`,
        `ふふ、安心して。${tn}のあなたって、`
      ], i);

      const emo = pick([
        "無理して笑わなくていいよ。ちゃんと、あなたの味方だよ。",
        "苦しいのに頑張ってきたの、知ってるよ。えらいんだよ。",
        "心が疲れてるなら、甘えていいんだよ。私が受け止めるよ。",
        "怖くても大丈夫だよ。ゆっくりでいいんだよ。"
      ], i);

      const end = softEnd(i);

      return banToday(`${lead}${fv}んだよ。${core}んだよ。だからね、${act}と、ちゃんと未来が楽になるんだよ。${emo}${end}`);
    }

    if (tone === "toxic") {
      const lead = pick([
        `${tn}のあなたさ、`,
        `ねぇ。${tn}なんだから、`,
        `…はぁ。${tn}のくせに、`,
        `ちょっと。${tn}でしょ、`
      ], i);

      const jab = pick([
        "中途半端にやって「しんどい」とか言わないで。",
        "どうせ不安なんでしょ？なら、やることやって黙って勝ちな。",
        "逃げ道探してる暇があるなら、現実を動かしなよ。",
        "甘えたいなら甘えていい。でも、サボるのは違うから。"
      ], i);

      const end = toxicEnd(i);

      return banToday(`${lead}${fv}なんでしょ？${core}。だから${act}って決めなよ。${jab}${end}`);
    }

    // standard
    const lead = pick([
      `${tn}の傾向として、`,
      `全体の設計で見ると、`,
      `流れとしては、`,
      `結論から言うと、`
    ], i);

    const end = stdEnd(i);
    return banToday(`${lead}${fv}。${core}。${act}${end}`);
  }
  function buildByType(section, tone, band) {
    const byType = {};
    for (const t of TYPES) {
      byType[t.key] = gen20((i) => buildLine(section, tone, band, t.key, i));
    }
    return { byType, default: gen20((i) => buildLine(section, tone, band, "t20", i)) };
  }

  // ---------------------------
  // 最後の一言（泣かせる / 心を折る）
  // ---------------------------
  function buildFinal(tone, band, typeKey, i) {
    const fv = flavor(typeKey, i);
    const tn = typeName(typeKey);

    if (tone === "soft") {
      const a = pick([
        "もう、大丈夫だよ。ここまで生きてきたあなたは、それだけで立派なんだよ。",
        "ねぇ、あなたはひとりじゃないんだよ。苦しいって言っていいんだよ。",
        "泣きたくなるくらい頑張ってきたんだよね。…ほんとに、えらいんだよ。",
        "傷つきながらでも進んできたの、ちゃんと知ってるよ。だから安心していいんだよ。"
      ], i);

      const b = pick([
        `あなたは${tn}で、${fv}んだよ。だから、無理に強がらなくていいんだよ。`,
        `あなたは${tn}だから、ちゃんと戻れるんだよ。ゆっくりでも、止まっても大丈夫なんだよ。`,
        `あなたは${tn}で、ちゃんと未来を変えられる人なんだよ。だから、自分を雑に扱わないでほしいんだよ。`
      ], i);

      const c = pick([
        "迷ってもいい。休んでもいい。それでもあなたは、ちゃんと進んでるんだよ。",
        "誰かに追いつかなくていい。あなたの速度で、あなたの人生を抱きしめていいんだよ。",
        "あなたがあなたを守った時、運は一番強く味方するんだよ。"
      ], i);

      return banToday(`${a}\n${b}\n${c}`);
    }

    if (tone === "toxic") {
      const a = pick([
        "ねぇ。ここまで来たなら、やるしかないでしょ！",
        "中途半端に生きるくらいなら、ぶっ壊れる覚悟で行くんだよ！",
        "逃げるんじゃないよ。逃げ癖が一番ダサいんだから。",
        "どうせまたサボるんでしょ？ほら。今度こそやりなよ！"
      ], i);

      const b = pick([
        `あんたは${tn}で、${fv}なんでしょ？だったら、途中で投げるなっての！`,
        `あんたは${tn}なんだから、薄い言い訳で負けるの、やめなよ。`,
        `あんたは${tn}。できるのにやらないのが一番ムカつくんだよ。`
      ], i);

      const c = pick([
        "立ってるんだから、最後までやって。…ね？",
        "やるか、やらないか。それだけ。分かってる？",
        "甘えていい。でも、逃げるのは許さないよ。",
        "ほら、やるんだよ。ちゃんと、ね！"
      ], i);

      return banToday(`${a}\n${b}\n${c}`);
    }

    // standard（無機質寄り）
    const a = pick([
      "結論。伸びる。",
      "結論。整えた人が勝つ。",
      "結論。やることを絞れば進む。",
      "結論。継続が回収に変わる。"
    ], i);

    const b = pick([
      `あなたは${tn}で、${fv}。`,
      `あなたの特性は${fv}。`,
      `強みは${fv}。`
    ], i);

    const c = pick([
      "無理を増やさず、優先順位を固定して進めばいい。",
      "迷うなら小さく決めて、回しながら調整すればいい。",
      "崩れない設計にして、淡々と積めば回収できる。"
    ], i);

    return banToday(`${a}\n${b}\n${c}`);
  }

  function buildFinalByType(tone, band) {
    const byType = {};
    for (const t of TYPES) {
      byType[t.key] = gen20((i) => buildFinal(tone, band, t.key, i));
    }
    return { byType, default: gen20((i) => buildFinal(tone, band, "t20", i)) };
  }

  // ---------------------------
  // POOLS 本体
  // ---------------------------
  const POOLS = {
    sections: {
      overall: {
        soft:     { high: buildByType("overall","soft","high"), mid: buildByType("overall","soft","mid"), low: buildByType("overall","soft","low") },
        standard: { high: buildByType("overall","standard","high"), mid: buildByType("overall","standard","mid"), low: buildByType("overall","standard","low") },
        toxic:    { high: buildByType("overall","toxic","high"), mid: buildByType("overall","toxic","mid"), low: buildByType("overall","toxic","low") },
      },
      work: {
        soft:     { high: buildByType("work","soft","high"), mid: buildByType("work","soft","mid"), low: buildByType("work","soft","low") },
        standard: { high: buildByType("work","standard","high"), mid: buildByType("work","standard","mid"), low: buildByType("work","standard","low") },
        toxic:    { high: buildByType("work","toxic","high"), mid: buildByType("work","toxic","mid"), low: buildByType("work","toxic","low") },
      },
      money: {
        soft:     { high: buildByType("money","soft","high"), mid: buildByType("money","soft","mid"), low: buildByType("money","soft","low") },
        standard: { high: buildByType("money","standard","high"), mid: buildByType("money","standard","mid"), low: buildByType("money","standard","low") },
        toxic:    { high: buildByType("money","toxic","high"), mid: buildByType("money","toxic","mid"), low: buildByType("money","toxic","low") },
      },
      love: {
        soft:     { high: buildByType("love","soft","high"), mid: buildByType("love","soft","mid"), low: buildByType("love","soft","low") },
        standard: { high: buildByType("love","standard","high"), mid: buildByType("love","standard","mid"), low: buildByType("love","standard","low") },
        toxic:    { high: buildByType("love","toxic","high"), mid: buildByType("love","toxic","mid"), low: buildByType("love","toxic","low") },
      },
      health: {
        soft:     { high: buildByType("health","soft","high"), mid: buildByType("health","soft","mid"), low: buildByType("health","soft","low") },
        standard: { high: buildByType("health","standard","high"), mid: buildByType("health","standard","mid"), low: buildByType("health","standard","low") },
        toxic:    { high: buildByType("health","toxic","high"), mid: buildByType("health","toxic","mid"), low: buildByType("health","toxic","low") },
      }
    },

    finalMessage: {
      soft:     { high: buildFinalByType("soft","high"), mid: buildFinalByType("soft","mid"), low: buildFinalByType("soft","low") },
      standard: { high: buildFinalByType("standard","high"), mid: buildFinalByType("standard","mid"), low: buildFinalByType("standard","low") },
      toxic:    { high: buildFinalByType("toxic","high"), mid: buildFinalByType("toxic","mid"), low: buildFinalByType("toxic","low") },
    }
  };

  // ---------------------------
  // 公開（export/import無し）
  // ---------------------------
  window.PREFS = PREFS;
  window.HOURS = HOURS;
  window.TYPES = TYPES;
  window.POOLS = POOLS;
})();
// （確認用）data.js は最後が必ずこうなってる：
// window.POOLS = POOLS;
// })();
