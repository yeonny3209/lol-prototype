// ===== 아이템 효과 템플릿 =====
// 각 템플릿은 훅 함수(h: 영웅, e: 효과 인스턴스 {p: 매개변수, st: 상태, src})와 desc(p)를 가집니다.
// 훅: statsFlat, statsDerived, tick, attack, preHit, hit, abilityCast, damageDealt, damageTaken, dmgAmp, dmgTaken,
//     lowHealth, tryRevive, kill, takedown, nearbyDeath, turretTakedown, levelUp, death, move, dash, overheal,
//     shieldGained, impairApplied, spellCast   / 사용 효과: use(h, e, wx, wy, hover), cd(p, h)
const FX = {};

const TYPE_KO = { physical: '물리', magic: '마법', true: '고정' };
const pc = v => (Math.round(v * 1000) / 10) + '%';
const lvlScale = (h, a, b, maxLvl = 18) => a + (b - a) * clamp((h.level - 1) / (maxLvl - 1), 0, 1);
const EST = ' <i class="est">※수치 일부 추정</i>';
const ALLY_ONLY = ' <i class="est">※아군 챔피언이 없어 현재는 발동하지 않음</i>';
const now = h => h.game.time;
// 챔피언 처치 관여로 취급: 영웅, 또는 연습 규칙일 때 대형·에픽 몬스터
const champTakedownLike = t => t && (t.kind === 'hero' || (CFG.PRACTICE_CHAMP_EFFECTS && (t.large || t.epic)));
const proc = (h, t, amt, type, extra) => h.game.dealDamage(h, t, amt, Object.assign({ type, proc: true }, extra));
const castOnce = (h, e, key = 'cast') => { if (e.st[key] === h.lastCastT) return false; e.st[key] = h.lastCastT; return true; };

// ---------------- 스탯 계열 ----------------
FX.statBonus = {
  desc: p => p.text,
  statsFlat(h, e, S) { for (const k in e.p.stats) S[k] += e.p.stats[k]; },
};
FX.regen = {
  desc: p => (p.hps ? '초당 체력 ' + p.hps + ' 회복' : '') + (p.mps ? '초당 마나 ' + p.mps + ' 회복' : ''),
  statsFlat(h, e, S) { S.hp5 += e.p.hps || 0; S.mp5 += e.p.mps || 0; },
};
FX.recovery = {
  desc: p => '마나를 초당 ' + p.mps + ' 회복합니다. 마나를 쓰지 않으면 대신 체력을 초당 ' + p.hps + ' 회복합니다.',
  statsFlat(h, e, S) { if (h.resource === 'mana') S.mp5 += e.p.mps; else S.hp5 += e.p.hps; },
};
FX.ultHaste = { desc: p => '궁극기 가속 +' + p.v, statsFlat(h, e, S) { S.ultAh += e.p.v; } };
FX.basicHaste = { desc: p => '기본 스킬 가속 +' + p.v, statsFlat(h, e, S) { S.basicAh += e.p.v; } };
FX.spellHaste = { desc: p => '소환사 주문 가속 +' + p.v, statsFlat(h, e, S) { S.spellHaste += e.p.v; } };
FX.slowResist = { desc: p => '둔화 저항 +' + pc(p.v), statsFlat(h, e, S) { S.slowResist += e.p.v; } };
FX.apAmp = { unique: () => 'apAmp', desc: p => '총 주문력이 ' + pc(p.v) + ' 증가합니다.', statsFlat(h, e, S) { S.apPct += e.p.v; } };
FX.boundless = { desc: p => '받는 체력 회복·보호막 효과와 체력 재생이 ' + pc(p.v) + ' 증가합니다.', statsFlat(h, e, S) { S.hsReceived += e.p.v; } };
FX.ghosted = { desc: () => '항상 유체화 상태가 되어 유닛과 충돌하지 않습니다.', tick(h) { h.ghostT = Math.max(h.ghostT, 0.2); } };
FX.clawsThatCatch = {
  desc: p => '기본 공격력의 ' + pc(p.pct) + '만큼 추가 공격력을 얻습니다.',
  statsDerived(h, e, S) { S.ad += e.p.pct * (h.base.ad + h.base.adPerLvl * (h.level - 1)); },
};
FX.tyranny = {
  desc: p => '추가 체력의 ' + pc(p.pct) + '만큼 공격력을 얻습니다.',
  statsDerived(h, e, S) { S.ad += S.hp * e.p.pct; },
};
FX.retribution = {
  desc: p => '잃은 체력에 비례해 공격력이 최대 ' + pc(p.max) + ' 증가합니다.',
  tick(h, e) { const b = Math.round((1 - h.hp / h.maxHp) * 20); if (b !== e.st.b) { e.st.b = b; h.recalcStats(); } },
  statsDerived(h, e, S) { S.ad += (h.base.ad + h.base.adPerLvl * (h.level - 1) + S.ad) * e.p.max * ((e.st.b || 0) / 20); },
};
FX.voidInfusion = { desc: p => '추가 체력의 ' + pc(p.pct) + '만큼 주문력을 얻습니다.', statsDerived(h, e, S) { S.ap += S.hp * e.p.pct; } };
FX.awe = {
  desc: p => p.ap ? '추가 마나의 ' + pc(p.ap) + '만큼 주문력을 얻습니다.' : p.ad ? '최대 마나의 ' + pc(p.ad) + '만큼 추가 공격력을 얻습니다.' : '추가 마나의 ' + pc(p.hp) + '만큼 체력을 얻습니다.',
  statsDerived(h, e, S) {
    if (h.resource !== 'mana') return;
    if (e.p.ap) S.ap += S.mana * e.p.ap;
    if (e.p.hp) S.hp += S.mana * e.p.hp;
    if (e.p.ad) S.ad += (h.base.mana + (h.base.manaPerLvl || 0) * (h.level - 1) + S.mana) * e.p.ad;
  },
};
FX.warmogVitality = {
  desc: p => '아이템으로 얻은 체력의 ' + pc(p.pct) + '만큼 추가 체력을 얻습니다.',
  statsDerived(h, e, S) { S.hp += S.itemHp * e.p.pct; },
};
FX.warmogHeart = {
  desc: p => '추가 체력이 ' + p.min + ' 이상이면, ' + p.delay + '초 동안 챔피언에게(미니언·몬스터는 ' + p.delayNon + '초) 피해를 받지 않았을 때 초당 최대 체력의 ' + pc(p.pct) + '를 회복합니다.',
  damageTaken(h, e, src) { e.st.hit = now(h); if (src && src.kind === 'hero') e.st.champHit = now(h); },
  tick(h, e, dt) {
    const t = now(h);
    if (h.bonusHp >= e.p.min && t - (e.st.champHit ?? -99) >= e.p.delay && t - (e.st.hit ?? -99) >= e.p.delayNon && h.hp < h.maxHp) h.heal(h.maxHp * e.p.pct * dt, 'regen');
  },
};
FX.firstLight = {
  desc: p => '추가 기본 마나 재생 100%당 체력 회복·보호막 효과가 ' + pc(p.hsp) + ', 주문력이 ' + p.ap + ' 증가합니다.',
  statsDerived(h, e, S) { const v = S.baseManaRegenPct; S.hsp += e.p.hsp * v; S.ap += e.p.ap * v; },
};
FX.noxianFervor = {
  desc: p => '이동 속도의 ' + pc(p.pct) + '만큼 적응형 능력치를 얻습니다.',
  statsDerived(h, e, S) { S.adaptive += e.p.pct * (h.base.ms + S.ms) * (1 + S.msPct); },
};
FX.famine = {
  desc: p => '스킬 가속 ' + p.ah + ' (+추가 공격력의 ' + pc(p.adPct) + ')을 얻습니다.',
  statsDerived(h, e, S) { S.ah += e.p.ah + S.ad * e.p.adPct; },
};

// ---------------- 적중 시 / 기본 공격 ----------------
FX.onHitFlat = {
  desc: p => (p.vs === 'minion' ? '미니언에게 ' : '') + '기본 공격 적중 시 ' + p.dmg + (p.ap ? '(+주문력의 ' + pc(p.ap) + ')' : '') + '의 추가 ' + TYPE_KO[p.type] + ' 피해를 입힙니다.',
  preHit(h, e, t, ctx) {
    if (e.p.vs === 'minion' && t.kind !== 'minion') return;
    ctx.bonus.push({ amt: e.p.dmg + (e.p.ap || 0) * h.ap, type: e.p.type });
  },
};
FX.helpingHand = {
  unique: () => 'helpingHand',
  desc: p => '미니언에게 기본 공격 시 ' + p.dmg + '의 추가 물리 피해를 입힙니다.',
  preHit(h, e, t, ctx) { if (t.kind === 'minion') ctx.bonus.push({ amt: e.p.dmg, type: 'physical', silent: true }); },
};
FX.spellblade = {
  unique: () => 'spellblade',
  rank: p => p.baseAd + (p.ap || 0) * 2,
  desc: p => '스킬을 사용한 후 10초 안에 하는 다음 기본 공격이 기본 공격력의 ' + pc(p.baseAd) + (p.ap ? ' (+주문력의 ' + pc(p.ap) + ')' : '') + '의 추가 ' + TYPE_KO[p.type || 'physical'] + ' 피해를 입힙니다 (재사용 대기시간 1.5초).' +
    (p.manaRestore ? ' 피해량의 ' + pc(p.manaRestore) + '만큼 마나를 회복합니다.' : '') +
    (p.onHitAgain ? ' 적중 시 효과를 한 번 더 적용합니다.' : '') +
    (p.frost ? ' 적중 지점에 2초 동안 ' + pc(p.frost) + ' 둔화 장판을 만듭니다.' : '') +
    (p.expose ? ' 대상이 챔피언이면 4초 동안 받는 피해가 ' + pc(p.expose) + ' 증가합니다.' : '') +
    (p.frost ? EST : ''),
  abilityCast(h, e) { if (now(h) >= (e.st.cd || 0)) { e.st.ready = true; e.st.until = now(h) + 10; } },
  tick(h, e) { if (e.st.ready && now(h) > e.st.until) e.st.ready = false; },
  preHit(h, e, t, ctx) {
    if (!e.st.ready || ctx.onHitOnly) return;
    e.st.ready = false;
    e.st.cd = now(h) + 1.5;
    const amt = e.p.baseAd * h.baseAd + (e.p.ap || 0) * h.ap;
    ctx.bonus.push({ amt, type: e.p.type || 'physical' });
    if (e.p.manaRestore) h.restoreResource(amt * e.p.manaRestore);
    if (e.p.expose && champLike(t)) t.addTakenAmp('bloodsong', e.p.expose, 4);
    if (e.p.frost) h.game.addZone({ x: t.x, y: t.y, r: 300, dur: 2, team: h.team, slow: e.p.frost, src: h, key: 'iceborn', color: '#9fdcff' });
    if (e.p.onHitAgain) h.game.later(0.2, () => h.applyOnHit(t));
    h.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 60, color: '#7fd8ff', dur: 0.3 });
  },
};
FX.cleave = {
  unique: () => 'cleave',
  rank: p => p.adPct,
  desc: p => '기본 공격 적중 시 대상 주변 ' + p.radius + ' 범위의 다른 적에게 공격력의 ' + pc(p.adPct) + '만큼 물리 피해를 입힙니다' + (p.vamp ? ' (생명력 흡수 적용)' : '') + '.' + EST,
  hit(h, e, t) {
    const k = h.ranged ? 0.5 : 1;
    for (const u of h.game.enemiesInRadius(h.team, t.x, t.y, e.p.radius)) if (u !== t) proc(h, u, h.ad * e.p.adPct * k, 'physical', { aoe: true, silent: true, lifestealable: e.p.vamp });
  },
};
FX.titanicCleave = {
  unique: () => 'cleave',
  rank: () => 1,
  desc: p => '기본 공격 적중 시 최대 체력의 ' + pc(p.primary) + '만큼 추가 물리 피해를 입히고, 대상 뒤쪽 적에게 최대 체력의 ' + pc(p.secondary) + '만큼 물리 피해를 입힙니다.' + EST,
  preHit(h, e, t, ctx) {
    let amt = h.maxHp * e.p.primary;
    if (e.st.empowered) { amt += h.maxHp * e.p.primary * 2; }
    ctx.bonus.push({ amt, type: 'physical' });
  },
  hit(h, e, t) {
    const mult = e.st.empowered ? 2 : 1;
    e.st.empowered = false;
    const dx = t.x - h.x, dy = t.y - h.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    const cx = t.x + dx / d * 150, cy = t.y + dy / d * 150;
    for (const u of h.game.enemiesInRadius(h.team, cx, cy, 250)) if (u !== t) proc(h, u, h.maxHp * e.p.secondary * mult, 'physical', { aoe: true, silent: true });
  },
};
FX.crescent = {
  unique: () => 'hydraActive',
  desc: p => '<b>사용:</b> 주변 ' + p.radius + ' 범위의 적에게 공격력의 ' + pc(p.adPct) + '만큼 물리 피해를 입힙니다' + (p.slow ? '. 적중한 적을 ' + p.slowDur + '초 동안 ' + pc(p.slow) + ' 둔화시키고 챔피언 하나당 이동 속도가 ' + pc(p.msPerHit) + ' 증가합니다' : '') + '. (재사용 대기시간 ' + p.cd + '초)' + EST,
  cd: p => p.cd,
  use(h, e) {
    let champs = 0;
    for (const u of h.game.enemiesInRadius(h.team, h.x, h.y, e.p.radius)) {
      proc(h, u, h.ad * e.p.adPct, 'physical', { aoe: true, lifestealable: e.p.vamp });
      if (e.p.slow) h.game.applySlow(h, u, 'stridebreaker', e.p.slow, e.p.slowDur);
      if (champLike(u)) champs++;
    }
    if (e.p.msPerHit && champs) h.addHaste('stridebreaker', e.p.msPerHit * Math.min(champs, 3), 3, true);
    h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: e.p.radius, color: '#ff9f6a', dur: 0.35 });
    return true;
  },
};
FX.titanicCrescent = {
  unique: () => 'hydraActive',
  desc: p => '<b>사용:</b> 10초 안에 하는 다음 기본 공격의 쪼개기 피해가 크게 증가합니다. (재사용 대기시간 ' + p.cd + '초)',
  cd: p => p.cd,
  use(h) {
    const c = h.effects.find(x => x.tpl === FX.titanicCleave);
    if (c) c.st.empowered = true;
    return true;
  },
};
FX.rage = {
  desc: p => (p.trigger === 'phys' ? '물리 피해를 입히면' : '기본 공격 적중 시') + ' ' + p.dur + '초 동안 이동 속도가 ' + p.ms + ' 증가합니다.',
  hit(h, e) { if (e.p.trigger !== 'phys') e.st.until = now(h) + e.p.dur; },
  damageDealt(h, e, t, dmg, opts) { if (e.p.trigger === 'phys' && opts.type === 'physical') e.st.until = now(h) + e.p.dur; },
  tick(h, e) { if (now(h) < (e.st.until || 0)) h.dynMsFlat += e.p.ms; },
};
FX.mistsEdge = {
  desc: p => '기본 공격 적중 시 대상 현재 체력의 ' + pc(p.melee) + '(원거리 ' + pc(p.ranged) + ')만큼 추가 물리 피해를 입힙니다. 미니언·몬스터에게는 최대 ' + p.cap + '.' + EST,
  preHit(h, e, t, ctx) {
    let amt = t.hp * (h.ranged ? e.p.ranged : e.p.melee);
    if (t.kind !== 'hero') amt = Math.min(amt, e.p.cap);
    ctx.bonus.push({ amt, type: 'physical' });
  },
};
FX.clawingShadows = {
  desc: p => '챔피언에게 기본 공격을 ' + p.hits + '회 적중하면 ' + p.dur + '초 동안 ' + pc(p.slow) + ' 둔화시킵니다.',
  hit(h, e, t) {
    if (!champLike(t)) return;
    t.borkStacks = (t.borkT > now(h) ? t.borkStacks : 0) + 1;
    t.borkT = now(h) + 6;
    if (t.borkStacks >= e.p.hits) { t.borkStacks = 0; h.game.applySlow(h, t, 'bork', e.p.slow, e.p.dur); }
  },
};
FX.bringItDown = {
  desc: p => '기본 공격 세 번째마다 ' + p.dmg + '의 추가 물리 피해를 입히며, 대상이 잃은 체력에 비례해 최대 ' + pc(p.missing) + ' 증가합니다.' + EST,
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly) return;
    e.st.n = ((e.st.n || 0) + 1) % 3;
    if (e.st.n === 0) ctx.bonus.push({ amt: e.p.dmg * (1 + e.p.missing * (1 - t.hp / t.maxHp)), type: 'physical' });
  },
};
FX.energized = {
  unique: () => 'energized',
  rank: p => p.dmg,
  desc: p => '이동하거나 공격하면 충전 중첩이 쌓입니다. 100 중첩이 되면 다음 기본 공격이 ' + p.dmg + '의 추가 ' + TYPE_KO[p.type] + ' 피해를 입힙니다' +
    (p.rangePct ? ', 충전된 공격은 사거리가 ' + pc(p.rangePct) + '(최대 ' + p.rangeCap + ') 증가합니다' : '') +
    (p.msPct ? ', ' + p.msDur + '초 동안 이동 속도가 ' + pc(p.msPct) + ' 증가합니다' : '') +
    (p.slow ? ', 대상을 ' + p.slowDur + '초 동안 ' + pc(p.slow) + ' 둔화시킵니다' : '') + '.' + (p.est ? EST : ''),
  move(h, e, d) { e.st.stacks = Math.min(100, (e.st.stacks || 0) + d / 24); },
  dash(h, e) { if (e.p.dashBonus) e.st.stacks = Math.min(100, (e.st.stacks || 0) + 25); },
  attack(h, e) { e.st.stacks = Math.min(100, (e.st.stacks || 0) + 6); },
  tick(h, e) { if (e.st.stacks >= 100 && e.p.rangePct) h.dynRange += Math.min(e.p.rangeCap, h.range * e.p.rangePct); },
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || (e.st.stacks || 0) < 100) return;
    e.st.stacks = 0;
    ctx.bonus.push({ amt: e.p.dmg, type: e.p.type });
    if (e.p.msPct) h.addHaste('energized', e.p.msPct, e.p.msDur, true);
    if (e.p.slow) h.game.applySlow(h, t, 'energized', e.p.slow, e.p.slowDur);
    h.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 50, color: '#ffe36b', dur: 0.3 });
  },
};
FX.electrospark = {
  desc: p => '6초 재사용 대기시간마다 다음 기본 공격 ' + p.attacks + '회가 연쇄 번개를 일으켜 최대 ' + p.bounces + '명에게 ' + p.dmg + '(챔피언이 아니면 ' + p.nonChamp + ')의 마법 피해를 입힙니다. 챔피언 처치 관여 시 재사용 대기시간이 초기화됩니다.' + EST,
  tick(h, e) {
    if (e.st.charges == null) e.st.charges = e.p.attacks;
    if (e.st.charges > 0 && e.st.window && now(h) > e.st.window) { e.st.charges = 0; e.st.cd = now(h) + e.p.cd; e.st.window = 0; }
    if (e.st.charges === 0 && now(h) >= (e.st.cd || 0)) e.st.charges = e.p.attacks;
  },
  hit(h, e, t) {
    if (!(e.st.charges > 0)) return;
    if (e.st.charges === e.p.attacks) e.st.window = now(h) + 8;
    e.st.charges--;
    if (e.st.charges === 0) { e.st.cd = now(h) + e.p.cd; e.st.window = 0; }
    const hit = new Set();
    let cur = t;
    for (let i = 0; i < e.p.bounces && cur; i++) {
      hit.add(cur.id);
      proc(h, cur, cur.kind === 'hero' ? e.p.dmg : e.p.nonChamp, 'magic', { silent: i > 0 });
      let next = null, bd = e.p.radius;
      for (const u of h.game.enemiesInRadius(h.team, cur.x, cur.y, e.p.radius)) {
        if (hit.has(u.id)) continue;
        const d = dist(cur.x, cur.y, u.x, u.y);
        if (d < bd) { bd = d; next = u; }
      }
      if (next) h.game.addEffect({ type: 'bolt', x: cur.x, y: cur.y, x2: next.x, y2: next.y, dur: 0.2 });
      cur = next;
    }
  },
  takedown(h, e, t) { if (champTakedownLike(t)) { e.st.cd = 0; } },
};
FX.windsFury = {
  desc: p => '기본 공격 시 주변 적 최대 ' + p.bolts + '명에게 공격력의 ' + pc(p.adPct) + '만큼 물리 피해를 입히는 탄환을 추가로 발사합니다 (치명타·적중 시 효과 적용).',
  attack(h, e, t) {
    const list = h.game.enemiesInRadius(h.team, h.x, h.y, h.range + 150).filter(u => u !== t).sort((a, b) => dist(h.x, h.y, a.x, a.y) - dist(h.x, h.y, b.x, b.y)).slice(0, e.p.bolts);
    for (const u of list) {
      h.game.addProjectile(new Projectile(h.game, h, u, 1800, () => {
        if (!u.alive) return;
        const crit = h.crit > 0 && rng() < h.crit;
        proc(h, u, h.ad * e.p.adPct * (crit ? h.critMult() : 1), 'physical', { crit });
        h.applyOnHit(u);
      }, { color: '#cfe8a0', size: 5 }));
    }
  },
};
FX.seething = {
  desc: p => '기본 공격 시 ' + p.dur + '초 동안 공격 속도가 ' + pc(p.as) + ' 증가합니다 (최대 ' + p.max + '회). 최대 중첩일 때 세 번째 기본 공격마다 적중 시 효과를 두 번 적용합니다.',
  attack(h, e) {
    e.st.stacks = now(h) < (e.st.until || 0) ? Math.min(e.p.max, e.st.stacks + 1) : 1;
    e.st.until = now(h) + e.p.dur;
    if (e.st.stacks >= e.p.max) e.st.phantom = (e.st.phantom || 0) + 1;
  },
  tick(h, e) { if (now(h) < (e.st.until || 0)) h.dynAs += e.p.as * e.st.stacks; else { e.st.stacks = 0; e.st.phantom = 0; } },
  hit(h, e, t) { if (e.st.phantom >= 3) { e.st.phantom = 0; h.game.later(0.15, () => h.applyOnHit(t)); } },
};
FX.shipwrecker = {
  desc: p => '이동하면 추진력이 쌓여 최대 ' + p.ms + '의 이동 속도를 얻습니다. 다음 기본 공격이 추진력을 모두 소모해 최대 ' + p.dmg + ' (+기본 공격력의 ' + pc(p.baseAd) + ')의 추가 물리 피해를 입힙니다.' + EST,
  tick(h, e, dt) { if (h.moving) e.st.m = Math.min(100, (e.st.m || 0) + 28 * dt); h.dynMsFlat += e.p.ms * (e.st.m || 0) / 100; },
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || !(e.st.m > 0)) return;
    ctx.bonus.push({ amt: (e.p.dmg + e.p.baseAd * h.baseAd) * e.st.m / 100, type: 'physical' });
    e.st.m = 0;
  },
};
FX.lightshield = {
  desc: p => '챔피언에게 처음 가하는 기본 공격이 치명타로 적용되어 ' + pc(p.crit) + '의 추가 피해를 입히고, 기본 공격력의 ' + pc(p.heal) + ' (+잃은 체력의 ' + pc(p.missing) + ')만큼 체력을 회복합니다 (대상별 ' + p.cd + '초).',
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || !champLike(t)) return;
    const m = e.st.cds || (e.st.cds = new Map());
    if (now(h) < (m.get(t.id) || 0)) return;
    m.set(t.id, now(h) + e.p.cd);
    ctx.crit = true;
    ctx.critMult = Math.max(ctx.critMult, 1 + e.p.crit);
    h.heal((h.ranged ? e.p.heal / 2 : e.p.heal) * h.baseAd + e.p.missing * (h.maxHp - h.hp), 'item');
  },
};
FX.openingBarrage = {
  desc: p => '궁극기를 사용하면 8초 안에 하는 다음 기본 공격 ' + p.hits + '회의 공격 속도가 ' + pc(p.as) + ' 증가하고 치명타 피해의 ' + pc(p.critPct) + '로 치명타가 적용됩니다. 원래 치명타였다면 대신 피해량의 ' + pc(p.bonusTrue) + '만큼 고정 피해를 추가로 입힙니다.',
  abilityCast(h, e, key) { if (key === 'R') { e.st.hits = e.p.hits; e.st.until = now(h) + 8; } },
  tick(h, e) { if (e.st.hits > 0 && now(h) < e.st.until) h.dynAs += e.p.as; else e.st.hits = 0; },
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || !(e.st.hits > 0)) return;
    e.st.hits--;
    if (ctx.crit) ctx.bonus.push({ amt: h.ad * ctx.critMult * e.p.bonusTrue, type: 'true' });
    else { ctx.crit = true; ctx.critMult = h.critMult() * e.p.critPct; }
  },
};
FX.practiceMakesLethal = {
  desc: p => '기본 공격 시 치명타 확률이 영구적으로 ' + pc(p.per) + '씩 증가합니다 (최대 ' + pc(p.max) + ').',
  attack(h, e) {
    const st = e.src.slot.st;
    if ((st.crit || 0) < e.p.max) { st.crit = Math.min(e.p.max, (st.crit || 0) + e.p.per); h.recalcStats(); }
  },
  statsFlat(h, e, S) { S.crit += (e.src.slot && e.src.slot.st.crit) || 0; },
};
FX.flurry = {
  desc: p => '챔피언을 공격하면 ' + p.dur + '초 동안 공격 속도가 ' + pc(p.as) + ' 증가합니다 (재사용 대기시간 ' + p.cd + '초, 기본 공격 적중 시 1초·치명타 시 2초 감소).',
  attack(h, e, t) { if (champLike(t) && now(h) >= (e.st.cd || 0)) { e.st.until = now(h) + e.p.dur; e.st.cd = now(h) + e.p.cd; } },
  hit(h, e, t, ctx) { if (e.st.cd) e.st.cd -= ctx.crit ? 2 : 1; },
  tick(h, e) { if (now(h) < (e.st.until || 0)) h.dynAs += e.p.as; },
};
FX.skipper = {
  desc: p => '기본 공격 시 중첩을 얻습니다 (최대 5). 최대 중첩에서 챔피언·에픽 몬스터·구조물을 공격하면 기본 공격력의 ' + pc(p.baseAd) + ' (+최대 체력의 ' + pc(p.hp) + ')의 추가 물리 피해를 입히며, 구조물에는 피해량이 ' + pc(p.structMult) + ' 적용됩니다.' + EST,
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly) return;
    if (now(h) > (e.st.until || 0)) e.st.stacks = 0;
    if ((e.st.stacks || 0) >= 4 && (champLike(t) || t.epic || t.isStructure) && t.kind !== 'minion') {
      e.st.stacks = 0;
      let amt = e.p.baseAd * h.baseAd + e.p.hp * h.maxHp;
      if (t.isStructure) amt *= e.p.structMult;
      ctx.bonus.push({ amt, type: 'physical' });
      h.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 80, color: '#ffb060', dur: 0.35 });
    } else {
      e.st.stacks = Math.min(5, (e.st.stacks || 0) + 1);
      e.st.until = now(h) + 10;
    }
  },
};
FX.nightstalker = {
  desc: p => '적에게 1초 이상 보이지 않으면 챔피언 대상 다음 기본 공격이 ' + p.dmg + '의 추가 고정 피해를 입힙니다.',
  tick(h, e, dt) {
    if (!h.seenByEnemy) { e.st.hidden = (e.st.hidden || 0) + dt; if (e.st.hidden >= 1) e.st.until = Infinity; }
    else { e.st.hidden = 0; if (e.st.until === Infinity) e.st.until = now(h) + 4; }
  },
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || !champLike(t) || now(h) > (e.st.until || 0)) return;
    e.st.until = 0; e.st.hidden = 0;
    ctx.bonus.push({ amt: e.p.dmg, type: 'true' });
  },
};
FX.juxtaposition = {
  desc: p => '챔피언에게 기본 공격 시 빛과 어둠이 번갈아 적용됩니다. 빛: 5초 동안 방어력·마법 저항력 +' + p.res + ' (최대 3회), 어둠: 방어구·마법 관통력 +' + pc(p.pen) + ' (최대 3회).',
  hit(h, e, t) {
    if (!champLike(t)) return;
    e.st.light = !e.st.light;
    const k = e.st.light ? 'l' : 'd';
    e.st[k] = Math.min(3, (now(h) < (e.st[k + 'T'] || 0) ? e.st[k] : 0) + 1);
    e.st[k + 'T'] = now(h) + 5;
    h.recalcStats();
  },
  tick(h, e) { for (const k of ['l', 'd']) if (e.st[k] && now(h) > e.st[k + 'T']) { e.st[k] = 0; h.recalcStats(); } },
  statsFlat(h, e, S) {
    S.armor += (e.st.l || 0) * e.p.res; S.mr += (e.st.l || 0) * e.p.res;
    S.armorPenPct += (e.st.d || 0) * e.p.pen; S.mpenPct += (e.st.d || 0) * e.p.pen;
  },
};
FX.colossal = {
  desc: p => '챔피언 근처(700)에 3초 있으면 해당 대상에게 다음 기본 공격이 ' + p.dmg + ' (+최대 체력의 ' + pc(p.hp) + ')의 추가 물리 피해를 입히고 피해량의 ' + pc(p.gain) + '만큼 영구 체력을 얻습니다 (대상별 ' + p.cd + '초).',
  tick(h, e, dt) {
    const near = e.st.near || (e.st.near = new Map());
    for (const u of h.game.enemiesInRadius(h.team, h.x, h.y, 700)) if (champLike(u)) near.set(u.id, Math.min(3, (near.get(u.id) || 0) + dt));
  },
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || !champLike(t)) return;
    const near = e.st.near || new Map(), cds = e.st.cds || (e.st.cds = new Map());
    if ((near.get(t.id) || 0) < 3 || now(h) < (cds.get(t.id) || 0)) return;
    cds.set(t.id, now(h) + e.p.cd);
    near.set(t.id, 0);
    const amt = e.p.dmg + e.p.hp * h.maxHp;
    ctx.bonus.push({ amt, type: 'physical' });
    h.perm.hp = (h.perm.hp || 0) + amt * e.p.gain;
    h.recalcStats();
  },
};
FX.cull = {
  desc: p => '기본 공격 적중 시 체력을 ' + p.heal + ' 회복합니다. 미니언 처치 시 1골드를 추가로 얻고, ' + p.max + '마리를 처치하면 ' + p.bonus + '골드를 더 얻습니다.',
  hit(h, e) { h.heal(e.p.heal, 'item'); },
  kill(h, e, t) {
    if (t.kind !== 'minion') return;
    const st = e.src.slot.st;
    if ((st.cull || 0) >= e.p.max) return;
    st.cull = (st.cull || 0) + 1;
    h.addGold(1);
    if (st.cull === e.p.max) { h.addGold(e.p.bonus, h.x, h.y); h.hint && h === h.game.player && UI.announce('수확의 낫 완료! +' + e.p.bonus + '골드', 'good'); }
  },
};
