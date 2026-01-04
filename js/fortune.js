/* =========================================================================
  占いロジック本体（見た目に専門用語は出さない方針）
============================================================================ */

function pickTypeKey({ sign, lifepath, timeblock, pref }){
  // 20タイプの選び方（“それっぽい”一致を作るためのルール）
  // ・土台：lifepath(1..9) と signGroup と timeblock で偏りを作る
  // ・pref も少し混ぜて「出生地が意味ある感」を演出（厳密占術ではない）
  const signG = getSignGroup(sign);
  const base = lifepath * 7;

  const signBias = ({fire:5, earth:9, air:12, water:16}[signG] ?? 0);
  const timeBias = ({unknown:0, morning:2, day:4, evening:6, night:8, late:10}[timeblock] ?? 0);
  const prefBias = hashString(pref) % 7;

  const idx = (base + signBias + timeBias + prefBias) % 20;
  return TEXT_DB.TYPE_LINES[TEXT_DB.TYPE_LINES ? `T${String(idx+1).padStart(2,"0")}` : "T01"];
}

function resolveType({ sign, lifepath, timeblock, pref }){
  const signG = getSignGroup(sign);
  const base = lifepath * 7;
  const signBias = ({fire:5, earth:9, air:12, water:16}[signG] ?? 0);
  const timeBias = ({unknown:0, morning:2, day:4, evening:6, night:8, late:10}[timeblock] ?? 0);
  const prefBias = hashString(pref) % 7;

  const idx = (base + signBias + timeBias + prefBias) % 20;
  return TYPES[idx];
}

function pickGroup({ sign, lifepath }){
  // A/B/Cの大枠（AとB強化）
  // ・earth は堅実→B寄り
  // ・fire は挑戦→C寄り
  // ・lifepath 4/8 は積み上げ→A
  // ・lifepath 5 は変化→C
  const signG = getSignGroup(sign);
  if (lifepath === 5) return "C";
  if (lifepath === 4 || lifepath === 8) return "A";
  if (signG === "earth") return "B";
  if (signG === "fire") return "C";
  if (lifepath === 7) return "A";
  return "B";
}

function buildFortune({ name, dobStr, pref, timeblock, tone }){
  const birth = new Date(dobStr);
  const sign = calcZodiacSign(birth);
  const lp = calcLifePath(dobStr);
  const group = pickGroup({ sign, lifepath: lp });
  const type = resolveType({ sign, lifepath: lp, timeblock, pref });

  // バッジに表示（表に出していい情報だけ）
  const badges = {
    type: `${type.name}`,
    sign: `${sign}`,
    lp: `${lp}`
  };

  // タイプ宣言（20タイプ別）
  const typeLine = TEXT_DB.TYPE_LINES[type.key]?.[tone] ?? "";

  // 本文候補は「tone × group」から選ぶ（占い結果に準じて候補が変わる）
  const seedBase = `${name}|${dobStr}|${pref}|${timeblock}|${tone}|${type.key}|${sign}|${lp}|${group}`;

  const flow = pickDeterministic(TEXT_DB.POOLS.flow[tone][group], seedBase + "|flow");
  const work = pickDeterministic(TEXT_DB.POOLS.work[tone][group], seedBase + "|work");
  const money = pickDeterministic(TEXT_DB.POOLS.money[tone][group], seedBase + "|money");
  const love = pickDeterministic(TEXT_DB.POOLS.love[tone][group], seedBase + "|love");

  // 今日の一言＋3ステップ（折りたたみで別表示）
  const today = pickDeterministic(TEXT_DB.POOLS.today[tone], seedBase + "|today");
  const steps = TEXT_DB.POOLS.today.steps[tone].map((s, i) => ({
    text: s,
    // 根拠っぽいタグ（表には出さないけど、将来ロジック拡張に使える）
    reason: `${group}/${sign}/${lp}/${timeblock}`
  }));

  const tpack = TONES[tone];

  // 本文（箇条書き感を減らして話し言葉へ寄せる）
  const lines = [];
  lines.push(`🐻 ${name || "あなた"}のクマ占い`);
  lines.push("");
  lines.push(`【タイプ】${type.name}`);
  if (typeLine) lines.push(typeLine);
  lines.push("");
  lines.push(tpack.header);
  lines.push("");
  lines.push(`まずね、全体の流れはこういう感じ。`);
  lines.push(flow);
  lines.push("");
  lines.push(`それで、ここから大事な3つ。仕事・お金・恋愛を順番にいくね。`);
  lines.push("");
  lines.push(`◆ 仕事`);
  lines.push(work);
  lines.push("");
  lines.push(`◆ お金`);
  lines.push(money);
  lines.push("");
  lines.push(`◆ 恋愛`);
  lines.push(love);
  lines.push("");
  lines.push(tpack.close);

  return {
    badges,
    type,
    today,
    steps,
    text: lines.join("\n")
  };
}
