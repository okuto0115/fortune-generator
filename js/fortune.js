/*
  fortune.js (Version 1)
  ------------------------------------------------------------
  ここが「占い結果を表に反映する」中枢。
  - 入力（天体・数秘・アスペクト・トランジット）→ 判定 → 出力テキスト
  - トーン（やさしめ/標準/毒舌）で本文を丸ごと変える
  - クマタイプ20種：後でイラスト紐付け前提（typeKey固定）
*/

import { lonToSign, aspectBetween } from "./astro.js";

/* ---------------------------
  数秘（誕生日）: 1〜9
--------------------------- */
export function lifePath(dobStr){
  const s = dobStr.replaceAll("-", ""); // YYYYMMDD
  let sum = 0;
  for (const ch of s) sum += Number(ch);
  while (sum > 9) sum = String(sum).split("").reduce((a,c)=>a+Number(c),0);
  return sum || 9;
}

/* ---------------------------
  星座の属性（火/地/風/水）
--------------------------- */
export function signElement(sign){
  const fire  = ["牡羊座","獅子座","射手座"];
  const earth = ["牡牛座","乙女座","山羊座"];
  const air   = ["双子座","天秤座","水瓶座"];
  if (fire.includes(sign)) return "FIRE";
  if (earth.includes(sign)) return "EARTH";
  if (air.includes(sign)) return "AIR";
  return "WATER";
}
function lpBucket(lp){
  if (lp === 9) return 5;
  if (lp === 7 || lp === 8) return 4;
  if (lp === 5 || lp === 6) return 3;
  if (lp === 3 || lp === 4) return 2;
  return 1;
}
export function typeKeyFrom(sunSign, lp){
  return `${signElement(sunSign)}_${lpBucket(lp)}`;
}

/* ---------------------------
  クマタイプ20（イラスト紐付け用に固定）
--------------------------- */
export const TYPE_20 = {
  "FIRE_1":  { name:"ほかほか見守りグマ", desc:"守りながら土台を育てる。安心感が運を作る。", tags:"火×安定" },
  "FIRE_2":  { name:"メラメラ練習グマ",   desc:"反復が才能。小さな改善で強くなる。", tags:"火×伸長" },
  "FIRE_3":  { name:"ドッカン突撃グマ",   desc:"決めたら早い。最初の一歩で流れを変える。", tags:"火×挑戦" },
  "FIRE_4":  { name:"ひらめき冒険グマ",   desc:"好奇心が燃料。面白い方へ行くほど開く。", tags:"火×探求" },
  "FIRE_5":  { name:"ごほうび達成グマ",   desc:"完走力で回収する。最後に勝つタイプ。", tags:"火×完成" },

  "EARTH_1": { name:"もふもふ基礎グマ",   desc:"まず整える。土台が固まると安定する。", tags:"地×安定" },
  "EARTH_2": { name:"コツコツ職人グマ",   desc:"継続が武器。積んだ分だけ裏切らない。", tags:"地×伸長" },
  "EARTH_3": { name:"現実つよつよグマ",   desc:"勝ち筋を作って攻める。現実力が強い。", tags:"地×挑戦" },
  "EARTH_4": { name:"黙々研究グマ",       desc:"深掘りで精度を上げるほど評価が上がる。", tags:"地×探求" },
  "EARTH_5": { name:"整え完了グマ",       desc:"終わらせて次へ。整理が開運になる。", tags:"地×完成" },

  "AIR_1":   { name:"ふわっと調整グマ",   desc:"空気を整える。無理なく安定へ持っていける。", tags:"風×安定" },
  "AIR_2":   { name:"おしゃべり成長グマ", desc:"言葉と情報で伸びる。発信が開運。", tags:"風×伸長" },
  "AIR_3":   { name:"スピード転身グマ",   desc:"切り替えが早い。動いた回数が未来になる。", tags:"風×挑戦" },
  "AIR_4":   { name:"アイデア飛行グマ",   desc:"ひらめきを拾って形にすると強い。", tags:"風×探求" },
  "AIR_5":   { name:"言語化まとめグマ",   desc:"まとめて完成へ。言語化で評価が固まる。", tags:"風×完成" },

  "WATER_1": { name:"しっとり安心グマ",   desc:"居場所を作ると強い。縁が土台になる。", tags:"水×安定" },
  "WATER_2": { name:"じわじわ育成グマ",   desc:"育てたものが財産。じわじわ強い。", tags:"水×伸長" },
  "WATER_3": { name:"覚悟ガチ恋グマ",     desc:"本気を決めたら強い。覚悟が流れを動かす。", tags:"水×挑戦" },
  "WATER_4": { name:"深海読み解きグマ",   desc:"本質を見抜く。深く読むほど答えが出る。", tags:"水×探求" },
  "WATER_5": { name:"浄化リセットグマ",   desc:"手放しが開運。区切るほど次が入る。", tags:"水×完成" },
};

/* ---------------------------
  トーン（本文の雰囲気）
  - “同じ内容でも言い方”を変えるのではなく、文章自体を別ルートにする
--------------------------- */
const TONES = {
  soft: {
    header: "やさしく、でもちゃんと当てにいくよ。今日から使える形に落とすね。",
    close:  "大丈夫。運は『整える→小さく動く』で必ず味方になるよ。",
    style: (s) => s,
  },
  normal: {
    header: "占いは地図。傾向と打ち手を整理するね。",
    close:  "良い運勢は、良い選択と継続で現実になる。",
    style: (s) => s,
  },
  spicy: {
    header: "遠慮しない。伸びるために必要なことだけ書く。",
    close:  "刺さったなら伸びしろ。やるかどうかはあなた次第。",
    style: (s) => s + "（言い訳しない）",
  },
};

/* ---------------------------
  判定：惑星サイン・アスペクト → 解釈の“根拠”を作る
--------------------------- */
function planetSummary(sunSign, moonSign, mercurySign, venusSign, marsSign, toneKey){
  const t = TONES[toneKey] ?? TONES.normal;

  const lines = [];
  lines.push(`太陽（表の性格）：${sunSign}`);
  lines.push(`月（素の反応）：${moonSign}`);
  lines.push(`水星（考え方）：${mercurySign}`);
  lines.push(`金星（好み/恋愛）：${venusSign}`);
  lines.push(`火星（行動力）：${marsSign}`);

  if (toneKey === "soft") {
    lines.push("→ 表と裏のギャップがあっても大丈夫。うまく使えば魅力になる。");
  } else if (toneKey === "spicy") {
    lines.push("→ 自分のクセを知らないと損する。ここから矯正できる。");
  } else {
    lines.push("→ この組み合わせを前提に、戦い方を選べば強い。");
  }

  return lines.map(t.style);
}

function aspectSummary(lons, toneKey){
  const t = TONES[toneKey] ?? TONES.normal;
  const pick = [];

  // 主要：太陽×月、水星×火星、金星×火星 など
  const pairs = [
    ["太陽","月"],
    ["太陽","火星"],
    ["水星","火星"],
    ["金星","火星"],
    ["太陽","金星"],
  ];

  const mapName = { sun:"太陽", moon:"月", mercury:"水星", venus:"金星", mars:"火星" };
  const keyByLabel = { "太陽":"sun", "月":"moon", "水星":"mercury", "金星":"venus", "火星":"mars" };

  for (const [a,b] of pairs){
    const ka = keyByLabel[a], kb = keyByLabel[b];
    const asp = aspectBetween(lons[ka], lons[kb]);
    if (asp) pick.push(`${a}×${b}：${asp}`);
  }

  if (pick.length === 0) {
    return [t.style("主要アスペクト：今回は強烈な型は少なめ。バランス型になりやすい")];
  }

  // “当たり感”のため、最大3つに絞って表示
  const sliced = pick.slice(0,3).map(x => `主要アスペクト：${x}`);
  return sliced.map(t.style);
}

/* ---------------------------
  トランジット（今日運）
--------------------------- */
function todayTransitSummary(todaySigns, toneKey){
  const t = TONES[toneKey] ?? TONES.normal;
  const { sun, moon, mars } = todaySigns;

  const lines = [];
  lines.push(`今日の太陽：${sun}`);
  lines.push(`今日の月：${moon}`);
  lines.push(`今日の火星：${mars}`);

  // ざっくり指針（ここは後でどんどん精密化できる）
  if (toneKey === "soft") {
    lines.push("→ 今日のコツ：無理に詰めない。『小さく整える』が最強。");
  } else if (toneKey === "spicy") {
    lines.push("→ 今日のコツ：迷う前に動け。先送りは運を削る。");
  } else {
    lines.push("→ 今日のコツ：優先順位を決めて、1つ終わらせると流れが良くなる。");
  }

  return lines.map(t.style);
}

/* ---------------------------
  本文：仕事/お金/恋愛/健康（根拠を使って出す）
--------------------------- */
function sectionWork(ctx, toneKey){
  const t = TONES[toneKey] ?? TONES.normal;
  const lines = [];

  // 水星（思考）＋火星（行動）で仕事の戦い方を決める
  lines.push(`あなたの仕事は「${ctx.mercurySign}の考え方 × ${ctx.marsSign}の動き方」で伸びやすい。`);
  lines.push("作業を『型』にすると一気に速くなる（テンプレ/チェックリスト/ルーティン）。");
  lines.push("発信・見せ方を増やすほど、指名と評価が伸びやすい。");

  if (toneKey === "spicy"){
    lines.push("“忙しい”は免罪符じゃない。優先順位を切れ。");
  } else if (toneKey === "soft"){
    lines.push("頑張りすぎる前に、続けられる形に整えよう。");
  } else {
    lines.push("勝ち筋（得意領域）に寄せるほど安定して強くなる。");
  }

  return lines.map(x => "・" + t.style(x)).join("\n");
}

function sectionMoney(ctx, toneKey){
  const t = TONES[toneKey] ?? TONES.normal;
  const lines = [];

  // 金星（価値観）＋土台タイプで金運の癖
  lines.push(`金運の癖は「${ctx.venusSign}的な価値観」で動きやすい。`);
  lines.push("固定費とルール（先取り貯蓄・積立）を作るほど、ブレが減る。");
  lines.push("収入源を複線化すると、精神的にも強くなる。");

  if (toneKey === "spicy"){
    lines.push("数字から逃げると一生増えない。見える化しろ。");
  } else if (toneKey === "soft"){
    lines.push("完璧を目指さなくていい。『続く仕組み』が勝つ。");
  } else {
    lines.push("守りが固まるほど、攻めが通る。順番が大事。");
  }

  return lines.map(x => "・" + t.style(x)).join("\n");
}

function sectionLove(ctx, toneKey){
  const t = TONES[toneKey] ?? TONES.normal;
  const lines = [];

  // 月（安心）＋金星（好み）で恋愛の型
  lines.push(`恋愛は「${ctx.moonSign}が安心できる形 × ${ctx.venusSign}が好きな世界観」で決まりやすい。`);
  lines.push("勢いより、生活の相性（時間感覚・お金・距離感）が重要になりやすい。");
  lines.push("“一緒に笑える”は最強の相性指標。ここを大事に。");

  if (toneKey === "spicy"){
    lines.push("雑に選ぶと雑な未来になる。相手の生活力を見ろ。");
  } else if (toneKey === "soft"){
    lines.push("焦らなくていい。安心できる関係ほど、あなたは強くなれる。");
  } else {
    lines.push("選び方で運は変わる。相性の現実面もちゃんと見ると良い。");
  }

  return lines.map(x => "・" + t.style(x)).join("\n");
}

function sectionHealth(ctx, toneKey){
  const t = TONES[toneKey] ?? TONES.normal;
  const lines = [];

  lines.push("健康運は『睡眠×呼吸×リズム』が要。ここを崩すと判断も崩れる。");
  lines.push(`出生時間ブロック（${ctx.timeLabel}）は、生活のリズム設計のヒントになる。`);
  lines.push("軽い運動の継続が、一番“運”を底上げする。");

  if (toneKey === "spicy"){
    lines.push("疲れてるのに突っ込むな。回復できる人が勝つ。");
  } else if (toneKey === "soft"){
    lines.push("休むのは甘えじゃない。回復は開運の条件。");
  } else {
    lines.push("休養も予定に入れると、ブレが減る。");
  }

  return lines.map(x => "・" + t.style(x)).join("\n");
}

/* ---------------------------
  公開用テキスト生成（タイプ宣言 → 詳細）
--------------------------- */
export function buildFortuneText(payload){
  const {
    name, place, timeLabel, dobStr, toneKey,
    sunSign, moonSignInfo, mercurySign, venusSign, marsSign,
    lons, lp, typeKey, todaySigns
  } = payload;

  const t = TONES[toneKey] ?? TONES.normal;
  const typeInfo = TYPE_20[typeKey] ?? { name:"なぞのクマ", desc:"タイプ情報が見つからない。", tags:"-" };

  const out = [];
  out.push(`# 🐻 クマタイプ：${typeInfo.name}`);
  out.push(typeInfo.desc);
  out.push(`（${typeInfo.tags} / typeKey:${typeKey}）`);
  out.push("");

  out.push(`# 🔮 詳細鑑定：${name || "（名前未入力）"}`);
  out.push("");
  out.push(`生年月日：${dobStr}`);
  out.push(`出生地：${place}`);
  out.push(`出生時間：${timeLabel}`);
  out.push("");

  out.push(`太陽：${sunSign}`);
  out.push(`月：${moonSignInfo}`);
  out.push(`数秘：${lp}`);
  out.push("");
  out.push(t.header);
  out.push("");

  // 根拠パート（ガチ感の芯）
  out.push("## 1) 主要天体（根拠）");
  out.push(planetSummary(sunSign, (moonSignInfo.includes("候補") ? "（候補あり）" : moonSignInfo), mercurySign, venusSign, marsSign, toneKey).map(x=>"・"+x).join("\n"));
  out.push("");

  out.push("## 2) アスペクト（性格のクセ）");
  out.push(aspectSummary(lons, toneKey).map(x=>"・"+x).join("\n"));
  out.push("");

  out.push("## 3) 今日の運勢（トランジット）");
  out.push(todayTransitSummary(todaySigns, toneKey).map(x=>"・"+x).join("\n"));
  out.push("");

  // 実用セクション
  out.push("## 4) 仕事運");
  out.push(sectionWork({ mercurySign, marsSign }, toneKey));
  out.push("");

  out.push("## 5) 金運");
  out.push(sectionMoney({ venusSign }, toneKey));
  out.push("");

  out.push("## 6) 恋愛運");
  out.push(sectionLove({ moonSign: moonSignInfo, venusSign }, toneKey));
  out.push("");

  out.push("## 7) 健康運");
  out.push(sectionHealth({ timeLabel }, toneKey));
  out.push("");

  out.push(t.close);
  return { typeInfo, text: out.join("\n") };
}

