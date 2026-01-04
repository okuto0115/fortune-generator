/* =========================================================================
  UIの動き（入力保持 / コピー / クリア）
============================================================================ */

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "kuma_fortune_v31";

// 都道府県プルダウン生成
function initPref(){
  const sel = $("pref");
  sel.innerHTML = "";
  for (const p of PREFS){
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  }
}

// 入力保存・復元
function saveState(){
  const state = {
    name: $("name").value,
    dob: $("dob").value,
    pref: $("pref").value,
    timeblock: $("timeblock").value,
    tone: $("tone").value
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.name != null) $("name").value = s.name;
    if (s.dob != null) $("dob").value = s.dob;
    if (s.pref != null) $("pref").value = s.pref;
    if (s.timeblock != null) $("timeblock").value = s.timeblock;
    if (s.tone != null) $("tone").value = s.tone;
  }catch(e){}
}

function clearState(){
  localStorage.removeItem(STORAGE_KEY);
}

function renderResult(res){
  $("bType").textContent = `タイプ：${res.badges.type}`;
  $("bSign").textContent = `星座：${res.badges.sign}`;
  $("bLP").textContent = `数秘：${res.badges.lp}`;

  $("typeBox").hidden = false;
  $("typeName").textContent = `🐻 ${res.type.name}`;
  $("typeDesc").textContent = res.type.desc;

  // ここは将来、タイプ別に画像を置いたら表示できる
  // 例：assets/illust/T01.png を置く → 自動表示、みたいに拡張可能
  const img = $("typeImg");
  img.hidden = true;

  $("out").value = res.text;

  // 今日の3ステップ（折りたたみ）
  $("stepsBox").hidden = false;
  const ol = $("stepsList");
  ol.innerHTML = "";
  for (const s of res.steps){
    const li = document.createElement("li");
    li.textContent = s.text;
    ol.appendChild(li);
  }
}

function wireAutoSave(){
  const ids = ["name","dob","pref","timeblock","tone"];
  for (const id of ids){
    $(id).addEventListener("change", saveState);
    $(id).addEventListener("input", saveState);
  }
}

function main(){
  initPref();
  loadState();
  wireAutoSave();

  $("gen").addEventListener("click", () => {
    const dob = $("dob").value;
    if (!dob) return alert("生年月日を入力してね");

    const res = buildFortune({
      name: $("name").value.trim() || "あなた",
      dobStr: dob,
      pref: $("pref").value,
      timeblock: $("timeblock").value,
      tone: $("tone").value
    });

    renderResult(res);
    saveState();
  });

  $("copy").addEventListener("click", async () => {
    const t = $("out").value;
    if (!t.trim()) return alert("先に出力してね");
    await navigator.clipboard.writeText(t);
    alert("コピーしたよ");
  });

  $("clear").addEventListener("click", () => {
    $("name").value = "";
    $("dob").value = "";
    $("pref").value = "不明";
    $("timeblock").value = "unknown";
    $("tone").value = "soft";

    $("out").value = "";
    $("bType").textContent = "タイプ：-";
    $("bSign").textContent = "星座：-";
    $("bLP").textContent = "数秘：-";
    $("typeBox").hidden = true;
    $("stepsBox").hidden = true;

    clearState();
  });
}

main();
