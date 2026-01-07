/* =========================================================
  data.js / Base (FOUNDATION)
  ==========================
  目的：
  - ここは「触らない土台」：壊れない基盤だけ置く
  - 文章は data.custom.js 側で上書きして育てる
  - data.custom.js が無くても app が落ちない（保険つき）

  読み込み順（index.html）：
    <script src="./js/data.js"></script>
    <script src="./js/data.custom.js"></script>  // あなたが触る場所
    <script src="./js/utils.js"></script>
    <script src="./js/fortune.js"></script>
    <script src="./js/app.js"></script>
========================================================= */
(function () {
  "use strict";

  /* =========================
    1) 基本データ：都道府県 / 時刻
  ========================= */
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

  /* =========================
    2) クマタイプ（20タイプ）
      - fortune.js が返す typeKey と合わせる
      - ここも将来増やせる
  ========================= */
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

  /* =========================
    3) 文章生成の土台（初心者向け）
    - ここは data.custom.js からも使える
  ========================= */

  // 安全：今日禁止（保険）※ custom で使ってOK
  function banToday(s) {
    return String(s ?? "").replace(/今日/g, "今");
  }

  // N個生成（例：20/40/60…に増やせる）
  function genN(n, makeLine) {
    const out = [];
    const N = Math.max(1, Math.floor(Number(n) || 1));
    for (let i = 0; i < N; i++) out.push(makeLine(i));
    return out;
  }

  // 配列から i に応じて回す（雑に使いやすい）
  function pick(arr, i) {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    return arr[i % arr.length];
  }

  // typeKey → タイプ情報
  function findTypeObj(typeKey) {
    return TYPES.find(t => t.key === typeKey) || null;
  }
  function typeName(typeKey) {
    return findTypeObj(typeKey)?.name || String(typeKey || "");
  }

  /* =========================
    4) POOLS の“空”を用意（保険）
    - data.custom.js が上書きしなくても落ちない
    - app.js は window.POOLS を見る前提
  ========================= */
  const EMPTY_POOL = {
    byType: {},     // { t01:[...], t02:[...], ... }
    default: []     // fallback
  };

  function ensureSectionShell() {
    const makeBand = () => ({ byType: {}, default: [] });
    const makeTone = () => ({ high: makeBand(), mid: makeBand(), low: makeBand() });

    return {
      soft: makeTone(),
      standard: makeTone(),
      toxic: makeTone()
    };
  }

  const POOLS = {
    // sections.overall.soft.high.byType.t01 = [...]
    sections: {
      overall: ensureSectionShell(),
      work: ensureSectionShell(),
      money: ensureSectionShell(),
      love: ensureSectionShell(),
      health: ensureSectionShell(),
    },
    // 最後にメッセージ（tone→band→pool）
    finalMessage: {
      soft: { high: EMPTY_POOL, mid: EMPTY_POOL, low: EMPTY_POOL },
      standard: { high: EMPTY_POOL, mid: EMPTY_POOL, low: EMPTY_POOL },
      toxic: { high: EMPTY_POOL, mid: EMPTY_POOL, low: EMPTY_POOL },
    },

    // 文章数（20→40→60…）はここで統一管理できる
    // custom 側で上書きしてOK
    RESULT_VARIANTS: 20,
  };

  /* =========================
    5) 公開（グローバル）
    - ここが“土台”
    - custom が window.POOLS を上書き/拡張する
  ========================= */
  window.PREFS = PREFS;
  window.HOURS = HOURS;
  window.TYPES = TYPES;

  // 便利関数（custom 用）
  window.DataBase = window.DataBase || {};
  window.DataBase.pick = pick;
  window.DataBase.genN = genN;
  window.DataBase.banToday = banToday;
  window.DataBase.typeName = typeName;
  window.DataBase.findTypeObj = findTypeObj;

  // POOLS（空の保険入り）
  window.POOLS = POOLS;
})();
