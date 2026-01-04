/*
  utils.js / Version 1
  ------------------------------------------------------------
  いじりたい人向け：汎用処理
*/

export function hash01(str){
  // 0.0000〜0.9999の決定的乱数
  let h = 2166136261;
  for (let i=0; i<str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export function pickDeterministic(list, seedStr){
  const x = hash01(seedStr);
  const idx = Math.floor(x * list.length);
  return list[Math.min(idx, list.length - 1)];
}

export function uniq3(list, seedBase){
  // 同じものが出たらseedをずらして3つ作る（初心者でも追える）
  const out = [];
  let n = 0;
  while (out.length < 3 && n < 30){
    const item = pickDeterministic(list, `${seedBase}|${n}`);
    if (!out.includes(item)) out.push(item);
    n++;
  }
  // 足りない時はそのまま
  while (out.length < 3) out.push(list[out.length % list.length]);
  return out.slice(0,3);
}

export function pad2(n){ return String(n).padStart(2, "0"); }
