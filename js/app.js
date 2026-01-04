// js/app.js
import { APP_VERSION, hashString, mulberry32, pick, pickN, formatDateJP } from "./utils.js";
import { computeFortuneCore } from "./fortune.js";
import { TEXT_DB } from "./data.js";

const $ = (id)=> document.getElementById(id);

const PREFS = [
  "不明/未選択",
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"
];

function buildTimeOptions(){
  const out = ["不明"];
  for(let h=0; h<24; h++){
    for(let m=0; m<60; m+=30){
      out.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
    }
  }
  return out;
}

// ---- セッション保存（ページ再読み込みでも入力が残る）----
const STORE_KEY = "kuma_fortune_v1_input";

function saveSession(){
  const data = {
    name: $("name").value,
    dob: $("dob").value,
    pref: $("pref").value,
    time: $("time").value,
    tone: $("tone").value
  };
  sessionStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function loadSession(){
  const raw = sessionStorage.getItem(STORE_KEY);
  if (!raw) return;
  try{
    const data = JSON.parse(raw);
    if (data.name) $("name").value = data.name;
    if (data.dob) $("dob").value = data.dob;
    if (data.pref) $("pref").value = data.pref;
    if (data.time) $("time").value = data.time;
    if (data.tone) $("tone").value = data.tone;
  }catch(_){}
}

function wireAutoSave(){
  ["name","dob","pref","time","tone"].forEach(id=>{
    $(id).addEventListener("change", saveSession);
    $(id).addEventListener("input", saveSession);
  });
}

// ---- 出力組み立て（“表に出さない文言”は出さない）----

function elementKeyFromTypeKey(typeKey){
  // FIRE_ANGEL -> FIRE
  return typeKey.split("_")[0];
}
function elementJPFromElemKey(elemKey){
  return (elemKey==="FIRE") ? "火" : (elemKey==="EARTH") ? "地" : (elemKey==="AIR") ? "風" : "水";
}

// “根拠ある3行コメント”：占い結果（スコア/月相/強アスペクト）を材料に作る
function build3Lines(core, tone){
  const t = TEXT_DB.tones[tone];
  const topAsps = core.aspects.slice(0, 3);

  // アスペクトを専門用語にしない言い換え
  const hintFromPair = (a)=>{
    const p = `${a.a}-${a.b}`;
    if (p.includes("Sun") && p.includes("Mars")) return "エンジンがかかりやすい日だから、始めるだけで進みやすいよ。";
    if (p.includes("Venus") && p.includes("Moon")) return "気持ちとやさしさがつながりやすいから、恋愛や人間関係が温まりやすいよ。";
    if (p.includes("Jupiter") && p.includes("Sun")) return "広がり運があるから、提案や応募みたいな“出す行動”が当たりやすいよ。";
    if (a.key === "square" || a.key === "opp") return "引っかかりが出やすいけど、そこが伸びしろ。丁寧に整えるほど勝てるよ。";
    return "流れは悪くないよ。小さく動いて反応を見ようね。";
  };

  const L1 = t.hello(core.meta.name);
  const L2 = `月の流れは「${core.phase.name}」寄りで、今は「${core.phase.vibe}」がテーマになりやすいよ。`;
  const L3 = hintFromPair(topAsps[0] || { a:"", b:"", key:"" });

  return [L1, L2, L3].join("\n");
}

function buildSteps(core, tone, rng){
  // 3ステップは “口調” と “スコア” で微調整
  const base = TEXT_DB.steps[tone];
  const s = core.scores;

  // 上書き候補（根拠：スコア）
  const patches = [];
  if (s.work >= 0.68) patches.push("今日は仕事運が乗りやすいよ。最初の一歩を小さく切って、すぐ始めよう。");
  if (s.love >= 0.68) patches.push("人との縁が温まりやすい日。返信・お礼・誘いを丁寧にすると当たりだよ。");
  if (s.health <= 0.45) patches.push("疲れを溜めると運が下がりやすい日。休むのも“行動”だよ。");
  if (patches.length){
    // base の1つを置換（ランダムじゃなく seed による安定乱数）
    const idx = Math.floor(rng() * base.length);
    const copy = [...base];
    copy[idx] = patches[Math.floor(rng() * patches.length)];
    return copy;
  }
  return base;
}

function buildReading(core, tone, rng){
  const typeInfo = TEXT_DB.types[core.typeKey];
  const elemKey = elementKeyFromTypeKey(core.typeKey);
  const elemJP = elementJPFromElemKey(elemKey);

  // セクション文章：占い結果に基づいて選ぶ（完全ランダムじゃない）
  const pickPool = (section)=>{
    const pool = TEXT_DB.POOLS[section]?.[elemKey] || [];
    if (!pool.length) return "";
    return pick(rng, pool);
  };

  const birth = new Date(core.meta.dobStr + "T12:00:00"); // 表示用（時間は見せない）
  const lpText = core.lp;

  const lines = [];
  lines.push(`【タイプ宣言】${typeInfo.name}`);
  lines.push(typeInfo.line);
  lines.push("");

  lines.push(build3Lines(core, tone));
  lines.push("");

  lines.push(`■ 基本データ`);
  lines.push(`・生年月日：${formatDateJP(birth)}`);
  lines.push(`・出生地：${core.meta.prefStr || "不明"}`);
  lines.push(`・太陽：${core.signs.Sun}　月：${core.signs.Moon}`);
  lines.push(`・数秘：${lpText}`);
  lines.push("");

  // ※表に出さない注意書きは出さない（代わりに自然な表現で吸収）
  //   月が境界付近なら、ふんわり補足だけ入れる（専門用語なし）
  if (core.flags.timeUnknown && core.flags.moonBoundary){
    lines.push(`※月の性質は、あなたが生まれた時間によって少し混ざりやすい日だよ。だから「どっちも当てはまる」感覚が出やすいかも。`);
    lines.push("");
  }

  lines.push(`■ 全体の流れ（${elemJP}の気質が強め）`);
  lines.push(pickPool("overall"));
  lines.push("");

  lines.push(`■ 仕事`);
  lines.push(pickPool("work"));
  lines.push("");

  lines.push(`■ お金`);
  lines.push(pickPool("money"));
  lines.push("");

  lines.push(`■ 恋愛`);
  lines.push(pickPool("love"));
  lines.push("");

  lines.push(`■ 健康`);
  lines.push(pickPool("health"));
  lines.push("");

  lines.push(TEXT_DB.tones[tone].outro);
  return lines.join("\n");
}

function setBadges(core){
  const typeInfo = TEXT_DB.types[core.typeKey];
  $("badgeType").textContent = typeInfo ? typeInfo.name : core.typeKey;
  $("badgeSun").textContent = core.signs.Sun;
  $("badgeMoon").textContent = core.signs.Moon;
  $("badgeLP").textContent = String(core.lp);
}

function renderSteps(steps){
  $("stepsBody").innerHTML = steps.map((s, i)=>(
    `<div class="step"><b>${i+1}</b> ${escapeHtml(s)}</div>`
  )).join("");
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ---- 初期化 ----

function initSelects(){
  const pref = $("pref");
  PREFS.forEach(p=>{
    const o = document.createElement("option");
    o.value = (p==="不明/未選択") ? "" : p;
    o.textContent = p;
    pref.appendChild(o);
  });

  const time = $("time");
  buildTimeOptions().forEach(t=>{
    const o = document.createElement("option");
    o.value = (t==="不明") ? "不明" : t;
    o.textContent = t;
    time.appendChild(o);
  });

  // デフォルト
  if (!pref.value) pref.value = "";
  if (!time.value) time.value = "不明";
}

function initVersion(){
  $("version").textContent = APP_VERSION;
}

function init(){
  initVersion();
  initSelects();
  loadSession();
  wireAutoSave();

  $("gen").addEventListener("click", () => {
    const dob = $("dob").value;
    if (!dob) return alert("生年月日を入力してね");

    const name = $("name").value.trim();
    const prefStr = $("pref").value;
    const timeStr = $("time").value;
    const tone = $("tone").value;

    // 入力から seed（同じ入力→同じ文章）
    const seedStr = `${name}|${dob}|${prefStr}|${timeStr}|${tone}`;
    const rng = mulberry32(hashString(seedStr));

    const core = computeFortuneCore({
      name,
      dobStr: dob,
      timeStr: (timeStr === "不明") ? "" : timeStr,
      prefStr,
      tone,
      seedStr
    });

    setBadges(core);

    // 今日の3ステップ（折りたたみ中身）
    const steps = buildSteps(core, tone, rng);
    renderSteps(steps);
    $("stepsBox").open = false;

    // 鑑定本文（出力ボタン1回で：タイプ宣言＋詳細鑑定）
    const text = buildReading(core, tone, rng);
    $("out").value = text;

    saveSession();
  });

  $("copy").addEventListener("click", async () => {
    const text = $("out").value;
    if (!text.trim()) return alert("先に出力してね");
    await navigator.clipboard.writeText(text);
    alert("コピーしたよ");
  });

  $("clear").addEventListener("click", () => {
    $("name").value = "";
    $("dob").value = "";
    $("pref").value = "";
    $("time").value = "不明";
    $("tone").value = "standard";
    $("out").value = "";
    $("badgeType").textContent = "-";
    $("badgeSun").textContent = "-";
    $("badgeMoon").textContent = "-";
    $("badgeLP").textContent = "-";
    $("stepsBody").innerHTML = "";
    sessionStorage.removeItem(STORE_KEY);
  });
}

init();
