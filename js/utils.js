/* =========================================================================
  ユーティリティ（初心者向けに分離）
============================================================================ */

// 文字列ハッシュ（同じ入力→同じ出力になる）
function hashString(str){
  let h = 2166136261;
  for (let i=0; i<str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// 配列から決定的に1つ選ぶ
function pickDeterministic(list, seedStr){
  const h = hashString(seedStr);
  return list[h % list.length];
}

// 数秘：生年月日(YYYY-MM-DD) -> 1..9（簡易）
function calcLifePath(dobStr){
  const s = dobStr.replaceAll("-", "");
  let sum = 0;
  for (const ch of s) sum += Number(ch);
  while (sum > 9) sum = String(sum).split("").reduce((a,c)=>a+Number(c),0);
  return sum; // 1..9
}

// 太陽星座（一般的境界）
function calcZodiacSign(dateObj){
  const m = dateObj.getMonth()+1;
  const d = dateObj.getDate();
  if ((m==1 && d>=20) || (m==2 && d<=18)) return "水瓶座";
  if ((m==2 && d>=19) || (m==3 && d<=20)) return "魚座";
  if ((m==3 && d>=21) || (m==4 && d<=19)) return "牡羊座";
  if ((m==4 && d>=20) || (m==5 && d<=20)) return "牡牛座";
  if ((m==5 && d>=21) || (m==6 && d<=21)) return "双子座";
  if ((m==6 && d>=22) || (m==7 && d<=22)) return "蟹座";
  if ((m==7 && d>=23) || (m==8 && d<=22)) return "獅子座";
  if ((m==8 && d>=23) || (m==9 && d<=22)) return "乙女座";
  if ((m==9 && d>=23) || (m==10 && d<=23)) return "天秤座";
  if ((m==10 && d>=24) || (m==11 && d<=22)) return "蠍座";
  if ((m==11 && d>=23) || (m==12 && d<=21)) return "射手座";
  return "山羊座";
}

function getSignGroup(sign){
  for (const [k, arr] of Object.entries(TEXT_DB.signGroupMap)){
    if (arr.includes(sign)) return k;
  }
  return "earth";
}
