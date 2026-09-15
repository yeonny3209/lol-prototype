// ===== 룬 =====
// 트리·이름·아이콘: Data Dragon / 효과 수치: 게임 내 룬 설명(패치 16.18) 기준, 설명문은 직접 요약
const RUNE_TREES = LOL_DATA.runes;
const RUNE_BY_ID = {};
const RUNE_TREE_OF = {};
for (const tree of RUNE_TREES) tree.slots.forEach((slot, si) => slot.forEach(r => { RUNE_BY_ID[r.id] = Object.assign({ slot: si, tree: tree.id }, r); RUNE_TREE_OF[r.id] = tree.id; }));
const runeIcon = icon => DD_CDN + 'img/' + icon;

const SHARDS = {
  5008: { name: '적응형 능력치', text: '적응형 능력치 +9', icon: 'perk-images/StatMods/StatModsAdaptiveForceIcon.png', apply: (h, S) => { S.adaptive += 9; } },
  5005: { name: '공격 속도', text: '공격 속도 +10%', icon: 'perk-images/StatMods/StatModsAttackSpeedIcon.png', apply: (h, S) => { S.asPct += 0.1; } },
  5007: { name: '스킬 가속', text: '스킬 가속 +8', icon: 'perk-images/StatMods/StatModsCDRScalingIcon.png', apply: (h, S) => { S.ah += 8; } },
  5010: { name: '이동 속도', text: '이동 속도 +2.5%', icon: 'perk-images/StatMods/StatModsMovementSpeedIcon.png', apply: (h, S) => { S.msPct += 0.025; } },
  5001: { name: '체력 증가', text: '체력 +10~180 (레벨 비례)', icon: 'perk-images/StatMods/StatModsHealthScalingIcon.png', apply: (h, S) => { S.hp += lvlScale(h, 10, 180); } },
  5011: { name: '체력', text: '체력 +65', icon: 'perk-images/StatMods/StatModsHealthPlusIcon.png', apply: (h, S) => { S.hp += 65; } },
  5013: { name: '강인함 및 둔화 저항', text: '강인함 및 둔화 저항 +15%', icon: 'perk-images/StatMods/StatModsTenacityIcon.png', apply: (h, S) => { S.tenacity += 0.15; S.slowResist += 0.15; } },
};
const SHARD_ROWS = [[5008, 5005, 5007], [5008, 5010, 5001], [5011, 5013, 5001]];
const SHARD_ROW_NAMES = ['공격', '유연', '방어'];

const RECOMMENDED_RUNES = {
  orianna: { primary: 8200, keys: [8229, 8226, 8210, 8237], secondary: 8300, sec: [8345, 8347], shards: [5008, 5008, 5001] },
  leesin: { primary: 8000, keys: [8010, 9111, 9105, 8014], secondary: 8100, sec: [8143, 8106], shards: [5005, 5008, 5001] },
  basic: { primary: 8000, keys: [8008, 9111, 9104, 8014], secondary: 8400, sec: [8444, 8453], shards: [5005, 5008, 5011] },
};

const RUNE_FX = {};
const adaptiveType = h => h.adaptiveType === 'ad' ? 'physical' : 'magic';
const hitInstance = (h, opts) => opts.isAttack ? 'a' + h.game.time : 'c' + h.lastCastT;
const LEGEND_PTS = t => t.kind === 'hero' || t.epic ? 1 : t.large ? 0.25 : 0.04;

// ---------------- 정밀 ----------------
RUNE_FX[8005] = {
  desc: h => '같은 챔피언에게 기본 공격을 3회 연속으로 맞히면 ' + Math.round(lvlScale(h, 40, 160)) + '(40~160)의 적응형 피해를 입히고, 6초 동안 대상이 받는 피해가 8% 증가합니다.',
  hit(h, e, t) {
    if (!champLike(t)) return;
    if (e.st.tid !== t.id || h.game.time - e.st.t > 4) { e.st.tid = t.id; e.st.n = 0; }
    e.st.t = h.game.time;
    if (++e.st.n === 3) {
      proc(h, t, lvlScale(h, 40, 160), adaptiveType(h), {});
      t.addTakenAmp('pta' + h.id, 0.08, 6, h);
      h.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 70, color: '#ffd24a', dur: 0.4 });
    }
    if (e.st.n >= 3 && h.game.time - e.st.t < 6) e.st.n = 3;
  },
};
RUNE_FX[8008] = {
  desc: h => '챔피언을 기본 공격하면 6초 동안 공격 속도가 ' + (h.ranged ? 4 : 6) + '% 증가합니다 (최대 6회). 최대 중첩일 때 기본 공격이 ' + (h.ranged ? '6~24' : '9~30') + '의 적응형 피해를 추가로 입히며, 추가 공격 속도 1%당 1% 증가합니다.',
  attack(h, e, t) { if (champLike(t)) { e.st.n = Math.min(6, (h.game.time < (e.st.until || 0) ? e.st.n : 0) + 1); e.st.until = h.game.time + 6; } },
  tick(h, e) { if (h.game.time < (e.st.until || 0)) h.dynAs += e.st.n * (h.ranged ? 0.04 : 0.06); else e.st.n = 0; },
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || e.st.n < 6 || !champLike(t)) return;
    const base = h.ranged ? lvlScale(h, 6, 24) : lvlScale(h, 9, 30);
    ctx.bonus.push({ amt: base * (1 + h.asBonus + h.dynAs), type: adaptiveType(h) });
  },
};
RUNE_FX[8021] = {
  desc: h => '이동·공격하면 충전됩니다. 100 충전 시 다음 기본 공격이 체력을 ' + Math.round(lvlScale(h, 15, 160)) + '(+추가 공격력의 10%, +주문력의 5%) 회복하고 1초 동안 이동 속도가 20% 증가합니다. (원거리 챔피언은 회복 60%·이동 속도 75%, 미니언 대상은 회복 15%)',
  move(h, e, d) { e.st.s = Math.min(100, (e.st.s || 0) + d / 24); },
  attack(h, e) { e.st.s = Math.min(100, (e.st.s || 0) + 6); },
  hit(h, e, t) {
    if ((e.st.s || 0) < 100) return;
    e.st.s = 0;
    let heal = lvlScale(h, 15, 160) + 0.1 * h.bonusAd + 0.05 * h.ap;
    if (h.ranged) heal *= 0.6;
    if (t.kind === 'minion') heal *= 0.15;
    h.heal(heal, 'rune');
    h.addHaste('fleet', h.ranged ? 0.15 : 0.2, 1);
    h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 50, color: '#8dffb0', dur: 0.35, follow: h });
  },
};
RUNE_FX[8010] = {
  desc: h => '챔피언에게 기본 공격이나 스킬로 피해를 입히면 5초 동안 정복자 2중첩(원거리 기본 공격은 1)을 얻어 중첩당 ' + lvlScale(h, 1.8, 4).toFixed(1) + '(1.8~4)의 적응형 능력치를 얻습니다 (최대 12). 최대 중첩일 때 챔피언에게 입힌 피해의 ' + (h.ranged ? 5 : 8) + '%만큼 체력을 회복합니다.',
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t) || opts.proc || opts.dot) return;
    const inst = hitInstance(h, opts);
    if (e.st.inst !== inst) {
      e.st.inst = inst;
      const before = e.st.n || 0;
      e.st.n = Math.min(12, (h.game.time < (e.st.until || 0) ? before : 0) + (opts.isAttack && h.ranged ? 1 : 2));
      e.st.until = h.game.time + 5;
      if (e.st.n !== before) h.recalcStats();
    }
    if (e.st.n >= 12) h.heal(dmg * (h.ranged ? 0.05 : 0.08), 'rune');
  },
  tick(h, e) { if (e.st.n && h.game.time > e.st.until) { e.st.n = 0; h.recalcStats(); } },
  statsFlat(h, e, S) { S.adaptive += (e.st.n || 0) * lvlScale(h, 1.8, 4); },
};
RUNE_FX[9101] = {
  desc: h => '대상을 처치하면 체력을 ' + Math.round(lvlScale(h, 10, 30)) + ' 회복합니다.' + EST,
  kill(h) { h.heal(lvlScale(h, 10, 30), 'rune'); },
};
RUNE_FX[9111] = {
  desc: () => '챔피언 처치 관여 시 잃은 체력의 5% + 최대 체력의 2.5%를 회복하고 20골드를 추가로 얻습니다.',
  takedown(h, e, t) { if (champTakedownLike(t)) { h.heal((h.maxHp - h.hp) * 0.05 + h.maxHp * 0.025, 'rune'); h.addGold(20); } },
};
RUNE_FX[8009] = {
  desc: h => '챔피언에게 피해를 입히면 ' + (h.resource === 'energy' ? '기력 6' : '마나 ' + Math.round(lvlScale(h, 6, 50) * (h.ranged ? 0.8 : 1))) + '을(를) 회복합니다 (8초). 처치 관여 시 최대 자원의 15%를 돌려받습니다.',
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t) || opts.proc || h.game.time < (e.st.cd || 0)) return;
    e.st.cd = h.game.time + 8;
    h.restoreResource(h.resource === 'energy' ? 6 : lvlScale(h, 6, 50) * (h.ranged ? 0.8 : 1));
  },
  takedown(h, e, t) { if (champTakedownLike(t)) h.restoreResource(h.maxMana * 0.15); },
};
const legend = (desc, apply, max) => {
  const gain = (h, e, t) => {
    const before = Math.floor(e.st.pts || 0);
    e.st.pts = Math.min(max, (e.st.pts || 0) + LEGEND_PTS(t));
    if (Math.floor(e.st.pts) !== before) h.recalcStats();
  };
  return {
    desc,
    kill(h, e, t) { gain(h, e, t); },
    takedown(h, e, t, isKiller) { if (!isKiller && (t.kind === 'hero' || t.epic)) gain(h, e, t); },
    statsFlat(h, e, S) { apply(h, S, Math.floor(e.st.pts || 0)); },
  };
};
RUNE_FX[9104] = legend(() => '공격 속도 +3%, 전설 중첩당 +1.5% (최대 10중첩). 챔피언·에픽 몬스터 처치 관여, 대형 몬스터·미니언 처치로 전설 중첩을 얻습니다.', (h, S, n) => { S.asPct += 0.03 + 0.015 * n; }, 10);
RUNE_FX[9105] = legend(() => '전설 중첩당 기본 스킬 가속 +1.5 (최대 10중첩). 챔피언·에픽 몬스터 처치 관여, 대형 몬스터·미니언 처치로 전설 중첩을 얻습니다.', (h, S, n) => { S.basicAh += 1.5 * n; }, 10);
RUNE_FX[9103] = legend(() => '전설 중첩당 생명력 흡수 +0.45% (최대 15중첩). 최대 중첩 시 최대 체력 +85.', (h, S, n) => { S.lifesteal += 0.0045 * n; if (n >= 15) S.hp += 85; }, 15);
RUNE_FX[8014] = { desc: () => '체력이 40% 이하인 챔피언에게 주는 피해가 8% 증가합니다.', dmgAmp: (h, e, t) => champLike(t) && t.hp < t.maxHp * 0.4 ? 0.08 : 0 };
RUNE_FX[8017] = { desc: () => '체력이 60% 이상인 챔피언에게 주는 피해가 8% 증가합니다.', dmgAmp: (h, e, t) => champLike(t) && t.hp > t.maxHp * 0.6 ? 0.08 : 0 };
RUNE_FX[8299] = {
  desc: () => '자신의 체력이 60% 이하일 때 챔피언에게 주는 피해가 5~11% 증가합니다 (체력 30%에서 최대).',
  dmgAmp: (h, e, t) => champLike(t) && h.hp < h.maxHp * 0.6 ? 0.05 + 0.06 * clamp((0.6 - h.hp / h.maxHp) / 0.3, 0, 1) : 0,
};

// ---------------- 지배 ----------------
RUNE_FX[8112] = {
  desc: h => '3초 안에 같은 챔피언을 서로 다른 공격·스킬로 3회 맞히면 ' + Math.round(lvlScale(h, 70, 240)) + '(70~240, +추가 공격력의 10%, +주문력의 5%)의 적응형 피해를 입힙니다. (재사용 대기시간 20초)',
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t) || opts.proc || opts.dot || h.game.time < (e.st.cd || 0)) return;
    const inst = hitInstance(h, opts);
    if (e.st.tid !== t.id || h.game.time - e.st.t0 > 3) { e.st.tid = t.id; e.st.t0 = h.game.time; e.st.hits = new Set(); }
    e.st.hits.add(inst);
    if (e.st.hits.size >= 3) {
      e.st.cd = h.game.time + 20;
      e.st.tid = null;
      proc(h, t, lvlScale(h, 70, 240) + 0.1 * h.bonusAd + 0.05 * h.ap, adaptiveType(h), {});
      h.game.addEffect({ type: 'bolt', x: t.x, y: t.y - 250, x2: t.x, y2: t.y, dur: 0.3 });
    }
  },
};
RUNE_FX[8128] = {
  desc: (h, e) => '체력이 50% 미만인 챔피언에게 피해를 입히면 30(+영혼당 11, +추가 공격력의 10%, +주문력의 5%)의 적응형 피해를 입히고 영혼을 수확합니다. (재사용 대기시간 35초)',
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t) || opts.proc || !t.alive || t.hp >= t.maxHp * 0.5 || h.game.time < (e.st.cd || 0)) return;
    e.st.cd = h.game.time + 35;
    proc(h, t, 30 + 11 * (e.st.souls || 0) + 0.1 * h.bonusAd + 0.05 * h.ap, adaptiveType(h), {});
    e.st.souls = (e.st.souls || 0) + 1;
    h.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 70, color: '#c03050', dur: 0.4 });
  },
};
RUNE_FX[9923] = {
  desc: () => '적 챔피언에 대한 처음 3회의 기본 공격 속도가 90%(원거리 60%) 증가하고 2~20(+추가 공격력의 12%, +주문력의 10%)의 추가 피해를 입힙니다. 3초 안에 공격하지 않으면 끝납니다. (재사용 대기시간 10초)',
  attack(h, e, t) {
    if (!champLike(t)) return;
    if (!e.st.left && h.game.time >= (e.st.cd || 0)) { e.st.left = 3; }
    if (e.st.left) e.st.last = h.game.time;
  },
  tick(h, e) {
    if (!e.st.left) return;
    if (h.game.time - e.st.last > 3) { e.st.left = 0; e.st.cd = h.game.time + 10; return; }
    h.dynAs += h.ranged ? 0.6 : 0.9;
    h.asCap = 3;
  },
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || !e.st.left || !champLike(t)) return;
    ctx.bonus.push({ amt: lvlScale(h, 2, 20) + 0.12 * h.bonusAd + 0.1 * h.ap, type: 'true' });
    if (--e.st.left <= 0) { e.st.left = 0; e.st.cd = h.game.time + 10; }
  },
};
RUNE_FX[8126] = {
  desc: h => '이동이나 행동을 방해받은 챔피언에게 피해를 주면 ' + Math.round(lvlScale(h, 10, 45)) + '(10~45)의 추가 고정 피해를 입힙니다. (재사용 대기시간 4초)',
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t) || opts.proc || !t.alive || !t.isImpaired() || h.game.time < (e.st.cd || 0)) return;
    e.st.cd = h.game.time + 4;
    proc(h, t, lvlScale(h, 10, 45), 'true', {});
  },
};
RUNE_FX[8139] = {
  desc: h => '적 챔피언에게 피해를 입히면 체력을 ' + Math.round(lvlScale(h, 16, 40)) + '(16~40, +추가 공격력의 10%, +주문력의 5%) 회복합니다. (재사용 대기시간 20초)',
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t) || opts.proc || h.game.time < (e.st.cd || 0)) return;
    e.st.cd = h.game.time + 20;
    h.heal(lvlScale(h, 16, 40) + 0.1 * h.bonusAd + 0.05 * h.ap, 'rune');
  },
};
RUNE_FX[8143] = {
  desc: h => '돌진·도약·점멸·순간이동 후 4초 안에 챔피언에게 피해를 주면 ' + Math.round(lvlScale(h, 20, 80)) + '(20~80)의 추가 고정 피해를 입힙니다. (재사용 대기시간 10초)',
  dash(h, e) { e.st.until = h.game.time + 4; },
  spellCast(h, e, key) { if (key === 'SummonerFlash' || key === 'SummonerTeleport' || key === 'Hexflash') e.st.until = h.game.time + 4; },
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t) || opts.proc || h.game.time > (e.st.until || 0) || h.game.time < (e.st.cd || 0)) return;
    e.st.cd = h.game.time + 10;
    e.st.until = 0;
    proc(h, t, lvlScale(h, 20, 80), 'true', {});
  },
};
RUNE_FX[8137] = { desc: () => '주변의 보이지 않는 와드를 찾아냅니다. <i class="est">※적 와드가 없어 현재는 효과 없음</i>' };
RUNE_FX[8140] = { desc: () => '챔피언 처치 관여 시 기념품을 얻어 장신구 가속이 6씩 증가합니다 (최대 18). <i class="est">※적 챔피언이 없어 현재는 효과 없음</i>' };
RUNE_FX[8141] = { desc: () => '정글·강에 설치한 와드가 깊은 와드가 되어 지속시간이 45초 늘어납니다.' };
RUNE_FX[8135] = { desc: () => '적 챔피언 처치에 처음 관여할 때마다 현상금 사냥꾼 중첩을 얻고 추가 골드(50 + 중첩당 20)를 받습니다. <i class="est">※적 챔피언이 없어 현재는 효과 없음</i>' };
RUNE_FX[8105] = {
  desc: () => '전투에서 벗어나 있을 때 이동 속도가 8 증가합니다 (현상금 사냥꾼 중첩마다 추가 증가).',
  tick(h) { if (!h.inCombat()) h.dynMsFlat += 8; },
};
RUNE_FX[8106] = { desc: () => '궁극기 가속 +6 (현상금 사냥꾼 중첩당 +5).', statsFlat(h, e, S) { S.ultAh += 6; } };

// ---------------- 영감 ----------------
RUNE_FX[8351] = {
  desc: () => '적 챔피언을 이동 불가 상태로 만들면 대상 위치에 3초 동안 20% 둔화 빙결 영역을 만듭니다. (재사용 대기시간 25초)',
  impairApplied(h, e, t, kind) {
    if (kind !== 'immobilize' || !champLike(t) || h.game.time < (e.st.cd || 0)) return;
    e.st.cd = h.game.time + 25;
    h.game.addZone({ x: t.x, y: t.y, r: 280, dur: 3, team: h.team, slow: 0.2, src: h, key: 'glacial', color: '#9fe6ff' });
  },
};
RUNE_FX[8360] = {
  desc: () => '6분부터 전투 밖에서 소환사 주문을 한 번 쓸 수 있는 새 주문으로 바꿀 수 있습니다 (HUD의 주문서 버튼). 처음 바꾼 뒤 재사용 대기시간 300초, 새 주문을 쓸 때마다 25초씩 줄어듭니다.' + EST,
};
RUNE_FX[8369] = {
  desc: h => '챔피언과 전투를 시작한 뒤 0.25초 안에 피해를 입히면 10골드를 얻고 3초 동안 챔피언에게 주는 피해가 7% 증가하며, 추가 피해의 ' + (h.ranged ? 35 : 50) + '%를 골드로 얻습니다. (재사용 대기시간 25~15초)',
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t)) return;
    const tm = h.game.time;
    if (tm - (e.st.last ?? -99) > 3) e.st.start = tm;
    e.st.last = tm;
    if (tm - e.st.start <= 0.25 && tm >= (e.st.cd || 0) && !(tm < (e.st.until || 0))) {
      e.st.until = tm + 3;
      e.st.cd = tm + lvlScale(h, 25, 15);
      h.addGold(10);
    } else if (tm < (e.st.until || 0) && !opts.proc) {
      h.addGold(dmg * 0.07 / 1.07 * (h.ranged ? 0.35 : 0.5));
    }
  },
  dmgAmp: (h, e, t) => champLike(t) && h.game.time < (e.st.until || 0) ? 0.07 : 0,
};
RUNE_FX[8306] = { desc: () => '점멸이 재사용 대기 중이면 점멸 키로 마법공학 점멸을 씁니다: 2초 정신 집중 후 도약합니다 (재사용 대기시간 20초, 전투 중 10초).' + EST };
RUNE_FX[8304] = {
  desc: () => '게임 시작 12분 후 약간 신비한 신발(이동 속도 +35)을 얻습니다. 그전에는 신발을 살 수 없습니다. 챔피언 처치 관여마다 45초씩 앞당겨집니다.',
  tick(h, e) {
    if (e.st.given) return;
    if (h.bootsLockedUntil == null) h.bootsLockedUntil = 720;
    if (h.game.time >= h.bootsLockedUntil) {
      e.st.given = true;
      h.bootsLockedUntil = 0;
      const slot = h.items.findIndex(s => !s);
      if (slot >= 0 && !h.items.some(s => s && isBoots(ITEM_DB[s.id]))) { h.items[slot] = { id: '2422', count: 1, st: {} }; h.recalcStats(); if (h === h.game.player) UI.announce('약간 신비한 신발을 얻었습니다!', 'good'); }
    }
  },
  takedown(h, e, t) { if (t.kind === 'hero' && h.bootsLockedUntil) h.bootsLockedUntil -= 45; },
};
RUNE_FX[8321] = {
  desc: () => '전설급 아이템을 사면 가격의 7.5%를 돌려받습니다.',
  itemBought(h, e, id, cost) { if (isLegendary(ITEM_DB[id]) && cost > 0) { h.addGold(cost * 0.075, h.x, h.y); } },
};
RUNE_FX[8313] = {
  desc: () => '3레벨에 탐욕의 영약, 6레벨에 힘의 영약, 9레벨에 숙련의 영약을 얻습니다.' + EST,
  levelUp(h, e) {
    const give = { 3: '2150', 6: '2151', 9: '2152' };
    for (const lv in give) {
      if (h.level >= +lv && !e.st['g' + lv]) {
        e.st['g' + lv] = true;
        const slot = h.items.findIndex(s => !s);
        if (slot >= 0) h.items[slot] = { id: give[lv], count: 1, st: {} };
        else { h.buffs[ITEM_USE[give[lv]].buff] = { t: 180, stacks: 1 }; }
        h.recalcStats();
      }
    }
  },
};
RUNE_FX[8352] = {
  desc: () => '물약을 사용하면 회복량의 40%를 즉시 회복합니다.',
  potion(h, e, amount) { h.heal(amount * 0.4, 'rune'); },
};
RUNE_FX[8345] = {
  desc: () => '게임 시작 후 6분까지 2분마다 비스킷을 받습니다. 비스킷은 20 + 최대 체력의 2%를 회복하고(잃은 체력에 비례해 최대 2배), 먹으면 최대 체력이 영구히 30 증가합니다.',
  tick(h, e) {
    const n = Math.min(3, Math.floor(h.game.time / 120));
    while ((e.st.given || 0) < n) {
      e.st.given = (e.st.given || 0) + 1;
      const same = h.items.find(s => s && s.id === '2010');
      if (same) same.count++;
      else { const slot = h.items.findIndex(s => !s); if (slot >= 0) h.items[slot] = { id: '2010', count: 1, st: {} }; else h.perm.hp = (h.perm.hp || 0) + 30; }
      if (h === h.game.player) UI.announce('비스킷이 배달되었습니다', 'good');
      h.recalcStats();
    }
  },
};
RUNE_FX[8347] = { desc: () => '소환사 주문 가속 +18, 아이템 가속 +10.', statsFlat(h, e, S) { S.spellHaste += 18; S.itemHaste += 10; } };
RUNE_FX[8410] = {
  desc: () => '이동 방해를 받은 근처 적 챔피언에게 다가갈 때 이동 속도가 7.5% 증가합니다. 자신이 방해한 대상이면 15%.',
  tick(h, e) {
    if (!h.moving || h.dirX == null) return;
    for (const u of h.game.enemiesInRadius(h.team, h.x, h.y, 1000)) {
      if (!champLike(u) || !u.isImpaired()) continue;
      const dx = u.x - h.x, dy = u.y - h.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if ((dx * h.dirX + dy * h.dirY) / d > 0.7) { h.dynMsPct += u.impairedBy === h ? 0.15 : 0.075; return; }
    }
  },
  impairApplied(h, e, t) { t.impairedBy = h; },
};
RUNE_FX[8316] = {
  desc: () => '아이템으로 얻은 서로 다른 능력치 하나당 스킬 가속 +1. 5종에서 적응형 능력치 +8, 10종에서 +20.',
  statsFlat(h, e, S) {
    const keys = new Set();
    for (const s of h.items) if (s && ITEM_DB[s.id]) for (const k in ITEM_DB[s.id].stats) keys.add(k);
    const n = keys.size;
    S.ah += n;
    S.adaptive += n >= 10 ? 20 : n >= 5 ? 8 : 0;
  },
};

// ---------------- 결의 ----------------
RUNE_FX[8437] = {
  desc: h => '챔피언과 전투 중 4초마다 다음 기본 공격이 최대 체력의 3.5%만큼 마법 피해를 추가로 입히고, 최대 체력의 1.3%를 회복하며, 최대 체력이 영구히 5 증가합니다. (원거리 챔피언은 40%) · 지금까지 +' + Math.round(h.perm.grasp || 0),
  tick(h, e, dt) { if (h.inChampCombat()) e.st.c = Math.min(4, (e.st.c || 0) + dt); },
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || !champLike(t) || (e.st.c || 0) < 4) return;
    e.st.c = 0;
    const k = h.ranged ? 0.4 : 1;
    ctx.bonus.push({ amt: h.maxHp * 0.035 * k, type: 'magic' });
    h.heal(h.maxHp * 0.013 * k, 'rune');
    h.perm.hp = (h.perm.hp || 0) + 5 * k;
    h.perm.grasp = (h.perm.grasp || 0) + 5 * k;
    h.recalcStats();
    h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 60, color: '#6dff8a', dur: 0.35, follow: h });
  },
};
RUNE_FX[8439] = {
  desc: h => '적 챔피언을 이동 불가 상태로 만들면 2.5초 동안 방어력·마법 저항력이 35 + 추가 저항력의 80%(최대 80~150) 증가한 뒤 폭발해 주변 적에게 ' + Math.round(lvlScale(h, 25, 120)) + '(+추가 체력의 8%) 마법 피해를 입힙니다. (재사용 대기시간 20초)',
  impairApplied(h, e, t, kind) {
    if (kind !== 'immobilize' || !champLike(t) || h.game.time < (e.st.cd || 0)) return;
    e.st.cd = h.game.time + 20;
    e.st.until = h.game.time + 2.5;
    h.recalcStats();
    h.game.later(2.5, () => {
      e.st.until = 0;
      h.recalcStats();
      for (const u of h.game.enemiesInRadius(h.team, h.x, h.y, 300)) proc(h, u, lvlScale(h, 25, 120) + 0.08 * h.bonusHp, 'magic', { aoe: true });
      h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 300, color: '#ffcf6a', dur: 0.4 });
    });
  },
  statsFlat(h, e, S) {
    if (!(h.game.time < (e.st.until || 0))) return;
    const bonus = Math.min(lvlScale(h, 80, 150), 35 + 0.8 * Math.max(S.armor, S.mr));
    S.armor += bonus; S.mr += bonus;
  },
};
RUNE_FX[8465] = { desc: () => '근처 아군을 보호하다가 둘 중 한 명이 피해를 입으면 둘 다 보호막을 얻습니다.' + ALLY_ONLY };
RUNE_FX[8446] = {
  desc: h => '포탑에 기본 공격을 3회 하면 ' + (h.ranged ? '50 + 최대 체력의 20%' : '85 + 최대 체력의 28%') + '의 추가 물리 피해를 입힙니다. (재사용 대기시간 30초)',
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || t.kind !== 'turret' || h.game.time < (e.st.cd || 0)) return;
    if (e.st.tid !== t.id || h.game.time - e.st.t > 4) { e.st.tid = t.id; e.st.n = 0; }
    e.st.t = h.game.time;
    if (++e.st.n >= 3) {
      e.st.n = 0;
      e.st.cd = h.game.time + 30;
      ctx.bonus.push({ amt: h.ranged ? 50 + h.maxHp * 0.2 : 85 + h.maxHp * 0.28, type: 'physical' });
    }
  },
};
RUNE_FX[8463] = {
  desc: h => '적 챔피언의 이동을 방해하면 자신과 주변의 가장 다친 아군이 체력을 ' + Math.round(lvlScale(h, 20, 60) * (h.ranged ? 0.7 : 1)) + ' 회복합니다. (재사용 대기시간 20초)' + EST,
  impairApplied(h, e, t) {
    if (!champLike(t) || h.game.time < (e.st.cd || 0)) return;
    e.st.cd = h.game.time + 20;
    h.heal(lvlScale(h, 20, 60) * (h.ranged ? 0.7 : 1), 'rune');
  },
};
RUNE_FX[8401] = {
  desc: h => '새 보호막을 얻으면 챔피언 대상 다음 기본 공격이 ' + Math.round(lvlScale(h, 5, 30)) + '(+추가 체력의 2.5%, +보호막 흡수량의 15%)의 적응형 피해를 추가로 입힙니다.',
  shieldGained(h, e, amt) { e.st.until = h.game.time + 4; e.st.amt = amt; },
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || !champLike(t) || h.game.time > (e.st.until || 0)) return;
    e.st.until = 0;
    ctx.bonus.push({ amt: lvlScale(h, 5, 30) + 0.025 * h.bonusHp + 0.15 * (e.st.amt || 0), type: adaptiveType(h) });
  },
};
RUNE_FX[8429] = {
  desc: () => '12분 후 방어력·마법 저항력이 8 증가하고, 총 방어력·마법 저항력이 3% 증가합니다.',
  tick(h, e) { const on = h.game.time >= 720; if (on !== !!e.st.on) { e.st.on = on; h.recalcStats(); } },
  statsFlat(h, e, S) { if (e.st.on) { S.armor += 8; S.mr += 8; S.resistPct += 0.03; } },
};
RUNE_FX[8444] = {
  desc: () => '적 챔피언에게 피해를 받으면 10초 동안 잃은 체력의 4%를 회복합니다.',
  damageTaken(h, e, src) {
    if (!src || !champLike(src) || h.hots.some(x => x.src === 'secondWind')) return;
    h.hots.push({ src: 'secondWind', perSec: (h.maxHp - h.hp) * 0.04 / 10, t: 10 });
  },
};
RUNE_FX[8473] = {
  desc: h => '챔피언에게 피해를 받은 뒤 1.5초 동안 그 적의 다음 공격·스킬 3회의 피해가 ' + Math.round(lvlScale(h, 30, 60)) + '(30~60) 감소합니다. (재사용 대기시간 55초)',
  dmgTaken(h, e, src, dmg, opts) {
    if (!src || !champLike(src) || opts.dot) return dmg;
    const tm = h.game.time;
    if (e.st.src === src && tm < e.st.until && e.st.left > 0) { e.st.left--; return Math.max(0, dmg - lvlScale(h, 30, 60)); }
    if (tm >= (e.st.cd || 0)) { e.st.cd = tm + 55; e.st.src = src; e.st.until = tm + 1.5; e.st.left = 3; }
    return dmg;
  },
};
RUNE_FX[8451] = {
  desc: h => '근처에서 몬스터나 적 미니언이 8마리 죽을 때마다 최대 체력이 3 증가합니다. 120마리를 흡수하면 최대 체력이 3.5% 더 증가합니다.',
  nearbyDeath(h, e, t) {
    if (t.kind !== 'minion' && t.kind !== 'monster') return;
    e.st.n = (e.st.n || 0) + 1;
    if (e.st.n % 8 === 0 || e.st.n === 120) h.recalcStats();
  },
  statsFlat(h, e, S) { S.hp += Math.floor((e.st.n || 0) / 8) * 3; },
  statsDerived(h, e, S) { if ((e.st.n || 0) >= 120) S.hp += (h.base.hp + h.base.hpPerLvl * (h.level - 1) + S.hp) * 0.035; },
};
RUNE_FX[8453] = {
  desc: () => '회복·보호막 효과가 5% 증가합니다. 체력이 40% 이하인 대상에게는 10% 더 강화됩니다.',
  tick(h, e) { const low = h.hp < h.maxHp * 0.4; if (low !== !!e.st.low) { e.st.low = low; h.recalcStats(); } },
  statsFlat(h, e, S) { S.hsp += 0.05; S.hsReceived += 0.05 + (e.st.low ? 0.1 : 0); },
};
RUNE_FX[8242] = {
  desc: () => '군중 제어에 걸린 동안과 그 후 2초 동안 방어력·마법 저항력이 10 증가합니다.',
  tick(h, e) {
    if (h.isImpaired()) e.st.until = h.game.time + 2;
    const on = h.game.time < (e.st.until || 0);
    if (on !== !!e.st.on) { e.st.on = on; h.recalcStats(); }
  },
  statsFlat(h, e, S) { if (e.st.on) { S.armor += 10; S.mr += 10; } },
};

// ---------------- 마법 ----------------
RUNE_FX[8214] = {
  desc: h => '챔피언을 공격하면 콩콩이가 날아가 ' + Math.round(lvlScale(h, 10, 50)) + '(+주문력의 5%, +추가 공격력의 10%)의 적응형 피해를 입힙니다. 자신에게 보호막을 씌우면 콩콩이가 ' + Math.round(lvlScale(h, 20, 100)) + '의 보호막을 더합니다. 콩콩이는 돌아온 뒤 다시 보낼 수 있습니다.',
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t) || opts.proc || h.game.time < (e.st.back || 0)) return;
    e.st.back = h.game.time + 0.6 + dist(h.x, h.y, t.x, t.y) / 700;
    const tx = t;
    h.game.later(0.3, () => tx.alive && proc(h, tx, lvlScale(h, 10, 50) + 0.05 * h.ap + 0.1 * h.bonusAd, adaptiveType(h), {}));
    h.game.addEffect({ type: 'bolt', x: h.x, y: h.y, x2: t.x, y2: t.y, dur: 0.3, color: '#d8b0ff' });
  },
  shieldGained(h, e, amt, id) {
    if (id === 'aery' || h.game.time < (e.st.back || 0)) return;
    e.st.back = h.game.time + 1.5;
    h.addShield('aery', lvlScale(h, 20, 100), 2);
  },
};
RUNE_FX[8229] = {
  desc: h => '챔피언에게 스킬로 피해를 입히면 그 위치에 유성을 떨어뜨려 ' + Math.round(lvlScale(h, 15, 100)) + '(+주문력의 5%, +추가 공격력의 10%)의 적응형 피해를 입힙니다. 거리가 멀수록 최대 100% 증가합니다. (재사용 대기시간 ' + Math.round(lvlScale(h, 20, 8)) + '초)',
  damageDealt(h, e, t, dmg, opts) {
    if (!opts.ability || opts.proc || !champLike(t) || h.game.time < (e.st.cd || 0)) return;
    e.st.cd = h.game.time + lvlScale(h, 20, 8);
    const amt = (lvlScale(h, 15, 100) + 0.05 * h.ap + 0.1 * h.bonusAd) * (1 + clamp(dist(h.x, h.y, t.x, t.y) / 750, 0, 1));
    const x = t.x, y = t.y;
    h.game.addEffect({ type: 'comet', x, y, dur: 1 });
    h.game.later(1, () => { for (const u of h.game.enemiesInRadius(h.team, x, y, 140)) { proc(h, u, amt, adaptiveType(h), {}); break; } });
  },
};
RUNE_FX[8230] = {
  desc: h => '3초 안에 챔피언 최대 체력의 25%만큼 피해를 입히면 4초 동안 이동 속도가 ' + (h.ranged ? 36 : 48) + '%, 둔화 저항이 50% 증가합니다. (재사용 대기시간 ' + Math.round(lvlScale(h, 20, 10)) + '초)',
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t) || h.game.time < (e.st.cd || 0)) return;
    const log = e.st.log || (e.st.log = []);
    log.push({ t: h.game.time, d: dmg, id: t.id });
    while (log.length && h.game.time - log[0].t > 3) log.shift();
    if (log.filter(x => x.id === t.id).reduce((s, x) => s + x.d, 0) >= t.maxHp * 0.25) {
      e.st.cd = h.game.time + lvlScale(h, 20, 10);
      e.st.until = h.game.time + 4;
      e.st.log = [];
      h.addHaste('phaseRush', h.ranged ? 0.36 : 0.48, 4);
    }
  },
  tick(h, e) { if (h.game.time < (e.st.until || 0)) h.slowResist = Math.max(h.slowResist, 0.5); },
};
RUNE_FX[8992] = {
  desc: h => '스킬로 챔피언에게 피해를 입히면 화상을 입혀 초당 ' + lvlScale(h, 3, 12).toFixed(1) + '(+주문력의 2.5%, +추가 공격력의 7%)의 마법 피해를 줍니다 (단일 4초, 광역 2초). 3초 이상 불타면 화상 피해가 75% 증가합니다.',
  damageDealt(h, e, t, dmg, opts) {
    if (!opts.ability || opts.proc || !champLike(t)) return;
    const old = h.game.dots.find(d => d.src === h && d.t === t && d.key === 'deathfire');
    const started = old ? old.started : h.game.time;
    h.game.addDot(h, t, 'deathfire', {
      total: 0, dur: opts.aoe ? 2 : 4, tick: 1, type: 'magic',
      perTickFn: d => (lvlScale(h, 3, 12) + 0.025 * h.ap + 0.07 * h.bonusAd) * (h.game.time - started >= 3 ? 1.75 : 1),
    });
    const d = h.game.dots.find(x => x.src === h && x.t === t && x.key === 'deathfire');
    if (d) d.started = started;
  },
};
RUNE_FX[8224] = {
  desc: () => '궁극기의 피해량·회복량·보호막이 12% 증가합니다 (광역 피해는 8%). 챔피언 처치 관여 시 궁극기의 남은 재사용 대기시간이 7% 감소합니다.',
  dmgAmp: (h, e, t, opts) => opts.ult ? (opts.aoe ? 0.08 : 0.12) : 0,
  takedown(h, e, t) { if (champTakedownLike(t)) h.abilities.R.cd *= 0.93; },
};
RUNE_FX[8226] = {
  desc: h => '적 챔피언에게 스킬을 적중하면 최대 마나가 25 증가합니다 (최대 250, 15초마다). 250에 도달하면 5초마다 잃은 마나의 1%를 회복합니다. · 현재 +' + (h.effectMap.get('r:8226') ? h.effectMap.get('r:8226').st.mana || 0 : 0),
  damageDealt(h, e, t, dmg, opts) {
    if (!opts.ability || opts.proc || !champLike(t) || h.game.time < (e.st.cd || 0) || (e.st.mana || 0) >= 250) return;
    e.st.cd = h.game.time + 15;
    e.st.mana = (e.st.mana || 0) + 25;
    h.recalcStats();
  },
  tick(h, e, dt) { if ((e.st.mana || 0) >= 250) h.restoreResource((h.maxMana - h.mana) * 0.01 / 5 * dt); },
  statsFlat(h, e, S) { if (h.resource === 'mana') S.mana += e.st.mana || 0; },
};
RUNE_FX[8275] = {
  desc: () => '소환사 주문을 사용하면 2초 동안 이동 속도가 15~45%(주문 재사용 대기시간이 길수록 높음) 증가하고 유닛을 통과합니다.',
  spellCast(h, e, key) {
    const cd = SPELL_DEFS[key] ? SPELL_DEFS[key].cd(h) : 20;
    h.addHaste('nimbus', lerp(0.15, 0.45, clamp((cd - 60) / 240, 0, 1)), 2);
    h.ghostT = Math.max(h.ghostT, 2);
  },
};
RUNE_FX[8210] = {
  desc: () => '5레벨: 스킬 가속 +5 / 8레벨: 스킬 가속 +5 / 11레벨: 챔피언 처치 관여 시 기본 스킬의 남은 재사용 대기시간 20% 감소.',
  statsFlat(h, e, S) { S.ah += (h.level >= 5 ? 5 : 0) + (h.level >= 8 ? 5 : 0); },
  takedown(h, e, t) { if (h.level >= 11 && champTakedownLike(t)) for (const k of ['Q', 'W', 'E']) h.abilities[k].cd *= 0.8; },
};
RUNE_FX[8234] = {
  desc: () => '모든 추가 이동 속도 효과가 7% 증가하고 이동 속도를 1% 추가로 얻습니다.',
  statsFlat(h, e, S) { S.msPct += 0.01; },
  tick(h) { h.dynMsFlat *= 1.07; h.dynMsPct *= 1.07; },
};
RUNE_FX[8233] = {
  desc: h => '체력이 70% 이상이면 적응형 능력치를 최대 ' + Math.round(lvlScale(h, 3, 30)) + '(공격력 1.8~18 또는 주문력 3~30) 얻습니다.',
  tick(h, e) { const on = h.hp >= h.maxHp * 0.7; if (on !== !!e.st.on || (on && e.st.lv !== h.level)) { e.st.on = on; e.st.lv = h.level; h.recalcStats(); } },
  statsFlat(h, e, S) { if (e.st.on) S.adaptive += lvlScale(h, 3, 30); },
};
RUNE_FX[8237] = {
  desc: h => '다음 스킬 적중 시 챔피언에게 불을 붙여 1초 뒤 ' + Math.round(lvlScale(h, 20, 40)) + '(20~40)의 마법 피해를 입힙니다. (재사용 대기시간 10초)',
  damageDealt(h, e, t, dmg, opts) {
    if (!opts.ability || opts.proc || !champLike(t) || h.game.time < (e.st.cd || 0)) return;
    e.st.cd = h.game.time + 10;
    h.game.later(1, () => t.alive && proc(h, t, lvlScale(h, 20, 40), 'magic', {}));
  },
};
RUNE_FX[8232] = {
  desc: h => '강에 있을 때 이동 속도가 10, 적응형 능력치가 ' + Math.round(lvlScale(h, 13, 30)) + '(13~30) 증가합니다.',
  tick(h, e) {
    const on = MapData.zoneAt(h.x, h.y) === 'river';
    if (on) h.dynMsFlat += 10;
    if (on !== !!e.st.on) { e.st.on = on; h.recalcStats(); }
  },
  statsFlat(h, e, S) { if (e.st.on) S.adaptive += lvlScale(h, 13, 30); },
};
RUNE_FX[8236] = {
  desc: () => '10분마다 적응형 능력치가 증가합니다: 10분 8 / 20분 24 / 30분 48 / 40분 80 / 50분 120 / 60분 168 (공격력은 약 60%).',
  tick(h, e) { const k = Math.floor(h.game.time / 600); if (k !== (e.st.k || 0)) { e.st.k = k; h.recalcStats(); } },
  statsFlat(h, e, S) { S.adaptive += [0, 8, 24, 48, 80, 120, 168][Math.min(6, e.st.k || 0)] + Math.max(0, (e.st.k || 0) - 6) * 60; },
};

// 능력치 파편 (행마다 하나)
for (let i = 0; i < 3; i++) {
  RUNE_FX['shard' + i] = { shard: i, statsFlat(h, e, S) { const id = h.runePage && h.runePage.shards[i]; if (SHARDS[id]) SHARDS[id].apply(h, S); } };
}

const Runes = {
  selectedIds(page) {
    if (!page) return [];
    return page.keys.concat(page.sec).concat(['shard0', 'shard1', 'shard2']);
  },

  clone(page) { return JSON.parse(JSON.stringify(page)); },

  tree(id) { return RUNE_TREES.find(t => t.id === id); },

  // 규칙에 맞게 고치기 (주 트리 핵심 룬 + 슬롯별 1개, 보조 트리 서로 다른 슬롯 2개, 파편 3개)
  validate(page) {
    const p = page ? this.clone(page) : this.clone(RECOMMENDED_RUNES.basic);
    const prim = this.tree(p.primary) || RUNE_TREES[0];
    p.primary = prim.id;
    p.keys = prim.slots.map((slot, i) => (slot.find(r => r.id === (p.keys || [])[i]) || slot[0]).id);
    let sec = this.tree(p.secondary);
    if (!sec || sec.id === prim.id) sec = RUNE_TREES.find(t => t.id !== prim.id);
    p.secondary = sec.id;
    const valid = (p.sec || []).filter(id => RUNE_BY_ID[id] && RUNE_BY_ID[id].tree === sec.id && RUNE_BY_ID[id].slot > 0);
    const out = [];
    for (const id of valid) if (!out.some(x => RUNE_BY_ID[x].slot === RUNE_BY_ID[id].slot) && out.length < 2) out.push(id);
    for (let s = 1; out.length < 2 && s < sec.slots.length; s++) if (!out.some(x => RUNE_BY_ID[x].slot === s)) out.push(sec.slots[s][0].id);
    p.sec = out;
    p.shards = [0, 1, 2].map(i => SHARD_ROWS[i].includes((p.shards || [])[i]) ? p.shards[i] : SHARD_ROWS[i][0]);
    return p;
  },

  // 보조 트리 룬 선택: 같은 슬롯이면 교체, 다르면 가장 오래된 것을 밀어냄
  pickSecondary(page, id) {
    const slot = RUNE_BY_ID[id].slot;
    const same = page.sec.findIndex(x => RUNE_BY_ID[x].slot === slot);
    if (same >= 0) page.sec[same] = id;
    else { page.sec.shift(); page.sec.push(id); }
  },

  desc(id, h) {
    const fx = RUNE_FX[id];
    if (!fx || !fx.desc) return '';
    return fx.desc(h || { level: 1, ranged: false, resource: 'mana', ap: 0, bonusAd: 0, bonusHp: 0, maxMana: 0, perm: {}, effectMap: new Map(), game: { time: 0 } });
  },
};
