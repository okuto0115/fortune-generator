/*
  utils.js / Version 2
  ------------------------------------------------------------
  目的：同じ入力なら同じ結果にしたい（当たり感を出す）
*/

export function hash01(str){
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

export function pickMany(list, seedBase, count){
  const out = [];
  for (let i=0; i<count; i++){
    const item = pickDeterministic(list, `${seedBase}|${i}`);
    out.push(item);
  }
  return out;
}

export function uniqN(list, seedBase, n){
  const out = [];
  let k = 0;
  while (out.length < n && k < 60){
    const item = pickDeterministic(list, `${seedBase}|${k}`);
    if (!out.includes(item)) out.push(item);
    k++;
  }
  while (out.length < n) out.push(list[out.length % list.length]);
  return out.slice(0,n);
}

export function pad2(n){ return String(n).padStart(2, "0"); }
