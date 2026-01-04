/*
  fortune.js / Version 1.5
  ------------------------------------------------------------
  ✅ spicy：からかい系（ニヤニヤして刺す）に統一
  ✅ soft：ふわふわ包み込む“優しい彼女”口調
  ✅ 今日のひとこと：根拠（今日の月×あなたのタイプ）で決定
  ✅ 今日の3ステップ（3行コメント）：同じ根拠で決定（ランダムじゃない）
*/

import { aspectBetween } from "./astro.js";

export const TEXT_DB = {
  tone: {
    soft: {
      header:
        "うん、ちゃんと見たよ。今日ね、あなたは大丈夫。私がそばで整えてあげるからね。",
      closer:
        "えらいよ。ほんとに。完璧じゃなくていいの。今日は“できた”を1個だけ作ろ？私が一緒に喜ぶから。",
    },
    normal: {
      header: "よし、傾向まとめるね。今日の動き方まで落とすよ。",
      closer: "運は選び方と続け方で変わる。だから大丈夫。",
    },
    spicy: {
      header:
        "はいはい、見たよ。で？まだ迷ってるの？その時間で一個終わってたよね？",
      closer:
        "刺さった？でもさ、刺さるってことは“伸びる場所”が分かってるってことだよ。…ほら、次いこ。",
    }
  },

  faceLabel: {
    "牡羊座":"まっすぐ突撃タイプ","牡牛座":"じっくり安定タイプ","双子座":"軽やか切り替えタイプ","蟹座":"守って育てるタイプ",
    "獅子座":"堂々センタータイプ","乙女座":"整えて強くなるタイプ","天秤座":"バランス美意識タイプ","蠍座":"深く刺さるタイプ",
    "射手座":"広げて伸びるタイプ","山羊座":"積み上げ職人タイプ","水瓶座":"自由発想タイプ","魚座":"やさしい感性タイプ"
  },
  coreLabel: {
    "牡羊座":"即反応で燃える","牡牛座":"安心第一で固い","双子座":"頭が先に動く","蟹座":"気持ちで決める",
    "獅子座":"プライドで動く","乙女座":"気づいて直す","天秤座":"空気を読む","蠍座":"一回決めたら深い",
    "射手座":"面白さ優先","山羊座":"現実で判断","水瓶座":"自分ルール","魚座":"共感で動く"
  },
  numLabel: {
    1:"はじめる力",2:"合わせる力",3:"広げる力",4:"積む力",5:"変える力",6:"守る力",7:"読み解く力",8:"勝ち切る力",9:"まとめる力"
  },

  // 20タイプ（かわいい）
  types20: {
    "FIRE_1":  { name:"ほかほか見守りグマ", desc:"安心できる土台ができた瞬間、あなたの運は一気に伸びるよ。", tags:"火×安定" },
    "FIRE_2":  { name:"メラメラ練習グマ",   desc:"反復が才能。地味に見えて、いちばん強い育ち方だよ。", tags:"火×成長" },
    "FIRE_3":  { name:"ドッカン突撃グマ",   desc:"決めて動いた瞬間が最強。迷いで止まるのだけ損だよ。", tags:"火×挑戦" },
    "FIRE_4":  { name:"ひらめき冒険グマ",   desc:"面白い方に行くほど運が開く。体験が正解になるタイプだよ。", tags:"火×探究" },
    "FIRE_5":  { name:"ごほうび達成グマ",   desc:"最後に勝つ。やめない限り負けないタイプだよ。", tags:"火×完成" },

    "EARTH_1": { name:"もふもふ基礎グマ",   desc:"整えた分だけ安定する。生活の土台がそのまま武器だよ。", tags:"地×安定" },
    "EARTH_2": { name:"コツコツ職人グマ",   desc:"積み上げが裏切らない。気づいたら周りが追いつけないよ。", tags:"地×成長" },
    "EARTH_3": { name:"現実つよつよグマ",   desc:"勝ち筋を作ってから攻める。運を仕組みにできるよ。", tags:"地×挑戦" },
    "EARTH_4": { name:"黙々研究グマ",       desc:"深掘りするほど評価が上がる。静かに強いのが魅力だよ。", tags:"地×探究" },
    "EARTH_5": { name:"整え完了グマ",       desc:"区切って次へ行ける。片づけるほど運が入ってくるよ。", tags:"地×完成" },

    "AIR_1":   { name:"ふわっと調整グマ",   desc:"空気を整えると一気にラクになる。無理しないのに強いよ。", tags:"風×安定" },
    "AIR_2":   { name:"おしゃべり成長グマ", desc:"言葉と情報で伸びる。発信は運のスイッチだよ。", tags:"風×成長" },
    "AIR_3":   { name:"スピード転身グマ",   desc:"切り替えが早い。動いた回数が未来を作るよ。", tags:"風×挑戦" },
    "AIR_4":   { name:"アイデア飛行グマ",   desc:"ひらめきを拾って形にできたら最強。思いつきで終わらせないでね。", tags:"風×探究" },
    "AIR_5":   { name:"言語化まとめグマ",   desc:"整理した瞬間に勝つ。言葉にできたら現実がついてくるよ。", tags:"風×完成" },

    "WATER_1": { name:"しっとり安心グマ",   desc:"居場所ができると運が強い。縁があなたの土台になるよ。", tags:"水×安定" },
    "WATER_2": { name:"じわじわ育成グマ",   desc:"育てたものが財産。じわじわ強いのが本物だよ。", tags:"水×成長" },
    "WATER_3": { name:"覚悟ガチ恋グマ",     desc:"本気を決めたら強い。覚悟が流れを動かすよ。", tags:"水×挑戦" },
    "WATER_4": { name:"深海読み解きグマ",   desc:"本質を見抜く。深く読んだ分だけ答えが出るよ。", tags:"水×探究" },
    "WATER_5": { name:"浄化リセットグマ",   desc:"手放しが開運。区切るほど、次が入ってくるよ。", tags:"水×完成" },
  },
};

/* ========= 数秘・タイプキー ========= */
export function lifePath(dobStr){
  const s = dobStr.replaceAll("-", "");
  let sum = 0;
  for (const ch of s) sum += Number(ch);
  while (sum > 9) sum = String(sum).split("").reduce((a,c)=>a+Number(c),0);
  return sum || 9;
}
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

/* ========= 今日のひとこと＆3ステップ（根拠ベース） ========= */
function hash01(str){
  let h = 2166136261;
  for (let i=0; i<str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
function pickDeterministic(list, seedStr){
  const x = hash01(seedStr);
  const idx = Math.floor(x * list.length);
  return list[Math.min(idx, list.length-1)];
}
function todayKeyFrom(ctx){
  const todayMood = signElement(ctx.todaySigns.moon);
  const yourBase  = ctx.typeKey.split("_")[0];
  const yourStep  = ctx.typeKey.split("_")[1];
  return `${todayMood}_${yourBase}_${yourStep}`;
}

/* ここが“根拠→文言”の辞書。増やしたいならここに追加 */
function todayPools(toneKey, k2){
  const soft = {
    "FIRE_FIRE": {
      one: [
        "今日はね、勢いが味方だよ。小さくでいいから、最初の一歩だけ踏み出してみよ？",
        "大丈夫。あなたならできるよ。まず一回だけ始めてみて？そこから軽くなるからね。"
      ],
      steps: [
        "いちばん小さい作業を1個だけ決めよ？",
        "10分だけでいいから手を動かしてみて。",
        "できたら自分を褒めて、ふわっと休も？"
      ]
    },
    "EARTH_EARTH": {
      one: [
        "今日は“整えるだけで勝ち”の日だよ。ひとつ整えたら、心もふわっと軽くなるよ〜。",
        "焦らなくていいよ。今日は土台づくりがいちばんの近道だよ。"
      ],
      steps: [
        "机か予定、どっちか1個だけ整えよ？",
        "やることを1個に絞ってみて。",
        "終わったら、あったかい飲み物でも飲も？"
      ]
    }
  };

  const spicy = {
    "FIRE_FIRE": {
      one: [
        "ねえ、まだ迷ってるの？その時間で一個終わってたよね？",
        "“やりたい”って言うの上手だね。で、手は動いてる？"
      ],
      steps: [
        "まず一個だけ決めて。悩むのはそのあと。",
        "10分でいいからやって。完璧は後回し。",
        "できたら次。できてないなら、何が邪魔か言語化して。"
      ]
    },
    "EARTH_EARTH": {
      one: [
        "“いつかやる”って言ってるうちは何も変わらないよ。今日ちょっと進めて。",
        "整えるだけで勝てる日なのに、やらないのは…普通にもったいないよ？"
      ],
      steps: [
        "まず散らかってるの片づけて。そこから。",
        "やることを1個に絞って。欲張らない。",
        "終わらせてから休んで。逆にするとずっと終わらないよ。"
      ]
    },
    "AIR_AIR": {
      one: [
        "頭の中で悩んでる時間、コスパ悪いよ？書いて。出して。",
        "連絡後回しにしてる？それ運落ちるやつ。短く返して。"
      ],
      steps: [
        "メモに一行書いて、今の状態を見える化して。",
        "連絡は短文でOK。とりあえず出して。",
        "最後に“今日やらないこと”も決めて。"
      ]
    }
  };

  // normalはsoftを少しだけサッパリにして流用
  if (toneKey === "soft") return soft[k2] ?? soft["EARTH_EARTH"];
  if (toneKey === "spicy") return spicy[k2] ?? spicy["EARTH_EARTH"];
  const base = (soft[k2] ?? soft["EARTH_EARTH"]);
  return {
    one: base.one.map(s=>s.replaceAll("〜","")),
    steps: base.steps.map(s=>s.replaceAll("〜","")),
  };
}

function makeTodayOneLine(ctx){
  const key = todayKeyFrom(ctx);
  const [todayMood, yourBase] = key.split("_");
  const k2 = `${todayMood}_${yourBase}`;

  const pools = todayPools(ctx.toneKey, k2);
  const seed = `${ctx.dobStr}|${ctx.todayStr}|${ctx.typeKey}|${ctx.toneKey}|ONE`;
  return pickDeterministic(pools.one, seed);
}

function makeToday3Steps(ctx){
  const key = todayKeyFrom(ctx);
  const [todayMood, yourBase] = key.split("_");
  const k2 = `${todayMood}_${yourBase}`;
  const pools = todayPools(ctx.toneKey, k2);

  // 3つとも同じにならないように seed をずらして選ぶ（決定的）
  const s1 = pickDeterministic(pools.steps, `${ctx.dobStr}|${ctx.todayStr}|${ctx.typeKey}|${ctx.toneKey}|S1`);
  const s2 = pickDeterministic(pools.steps, `${ctx.dobStr}|${ctx.todayStr}|${ctx.typeKey}|${ctx.toneKey}|S2`);
  const s3 = pickDeterministic(pools.steps, `${ctx.dobStr}|${ctx.todayStr}|${ctx.typeKey}|${ctx.toneKey}|S3`);

  // 重複したら、次の候補にずらす（単純で初心者でも追える）
  const uniq = [];
  for (const s of [s1,s2,s3]){
    if (!uniq.includes(s)) uniq.push(s);
  }
  while (uniq.length < 3){
    // 足りない分、別seedで補充
    const extra = pickDeterministic(pools.steps, `${ctx.dobStr}|${ctx.todayStr}|${ctx.typeKey}|${ctx.toneKey}|EX${uniq.length}`);
    if (!uniq.includes(extra)) uniq.push(extra);
    else break;
  }
  return uniq.slice(0,3);
}

/* ========= 公開文 ========= */
function makePublicText(ctx){
  const tonePack = TEXT_DB.tone[ctx.toneKey] ?? TEXT_DB.tone.normal;
  const type = TEXT_DB.types20[ctx.typeKey];
  const name = ctx.name?.trim() ? ctx.name.trim() : "あなた";

  const face = TEXT_DB.faceLabel[ctx.sunSign] ?? "タイプ不明";
  const core = ctx.moonSignInfo.includes("候補")
    ? "本音が二択っぽい（出生時間で確定するよ）"
    : (TEXT_DB.coreLabel[ctx.moonSign] ?? "本音のクセ不明");
  const numLabel = TEXT_DB.numLabel[ctx.lp] ?? "";

  const todayOne = makeTodayOneLine(ctx);
  const steps = makeToday3Steps(ctx);

  const lines = [];
  lines.push(`# 🐻 ${type.name}`);
  lines.push(`${name}はね、ざっくり言うと「${type.desc}」って感じだよ。`);
  lines.push("");

  lines.push(`## 今日のひとこと`);
  lines.push(todayOne);
  lines.push("");

  lines.push(`## 今日の3ステップ（これだけでOK）`);
  lines.push(`① ${steps[0]}`);
  lines.push(`② ${steps[1]}`);
  lines.push(`③ ${steps[2]}`);
  lines.push("");

  lines.push(`## ${name}の雰囲気`);
  lines.push(`外で見せる顔は「${face}」だよ。周りからはそう見られやすいの。`);
  lines.push(`でも本音のクセは「${core}」。ここ分かってると、無駄に疲れにくいよ。`);
  lines.push(`それと、誕生日の数字は「${ctx.lp}（${numLabel}）」。あなたの伸び方のクセ、みたいなものだよ。`);
  lines.push(ctx.timeLabel === "不明"
    ? `出生時間は不明でも大丈夫だよ。必要なところは“候補”で丁寧に出してるからね。`
    : `出生時間は「${ctx.timeLabel}」で見てるよ。`
  );
  lines.push("");

  // 本文（短めは維持）
  lines.push(`## 仕事`);
  if (ctx.toneKey === "soft"){
    lines.push(`今日はね、“できる形で出して、あとで整える”がいちばん上手くいくよ。私が背中そっと押すね。`);
  } else if (ctx.toneKey === "spicy"){
    lines.push(`完璧にしてから動くの、遅いよ？小さく出して回しな。ほら、今できるやつから。`);
  } else {
    lines.push(`仕事は「小さく出して回す」が強い日。テンプレ化も効く。`);
  }
  lines.push("");

  lines.push(`## お金`);
  if (ctx.toneKey === "soft"){
    lines.push(`不安になっても大丈夫だよ。今日は“ルールを1個だけ”作ると安心が増える日なの。小さくでいいよ〜。`);
  } else if (ctx.toneKey === "spicy"){
    lines.push(`数字から目そらしてるなら、やめよ？固定費かルール、1個だけ整えて。逃げないでね。`);
  } else {
    lines.push(`お金はルール化が最強。今日は1つ仕組みを整えると安定する。`);
  }
  lines.push("");

  lines.push(tonePack.header);
  lines.push(tonePack.closer);

  return lines.join("\n");
}

/* ========= 裏メモ ========= */
function makeDevText(ctx){
  const lines = [];
  lines.push(`Kuma Fortune / Version 1.5`);
  lines.push(`---`);
  lines.push(`[入力] name=${ctx.name || ""} dob=${ctx.dobStr} place=${ctx.place} time=${ctx.timeLabel} tone=${ctx.toneKey} today=${ctx.todayStr}`);
  lines.push(`[計算] Sun=${ctx.sunSign} Moon=${ctx.moonSignInfo} Merc=${ctx.mercurySign} Ven=${ctx.venusSign} Mars=${ctx.marsSign} LP=${ctx.lp} typeKey=${ctx.typeKey}`);
  lines.push(`[主要アスペクト（簡易）]`);
  const aspPairs = [
    ["Sun","Moon","sun","moon"],
    ["Sun","Mars","sun","mars"],
    ["Mercury","Mars","mercury","mars"],
    ["Venus","Mars","venus","mars"],
    ["Sun","Venus","sun","venus"],
  ];
  for (const [A,B,ka,kb] of aspPairs){
    const a = ctx.lons[ka], b = ctx.lons[kb];
    const asp = aspectBetween(a,b);
    if (asp) lines.push(`${A} x ${B}: ${asp}`);
  }
  lines.push(`[今日キー] ${todayKeyFrom(ctx)}`);
  return lines.join("\n");
}

export function buildTexts(ctx){
  const type = TEXT_DB.types20[ctx.typeKey] ?? { name:"なぞのクマ", desc:"タイプ情報が見つからない。", tags:"-" };
  return {
    type,
    publicText: makePublicText(ctx),
    devText: makeDevText(ctx)
  };
}
