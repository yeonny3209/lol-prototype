// ===== 아이템 효과 템플릿 (2) — 피해 증감 · 보호막 · 스킬 적중 효과 =====

// ---------------- 피해 증감 ----------------
FX.grievous = {
  unique: () => 'grievous',
  desc: p => '챔피언에게 ' + (p.type ? TYPE_KO[p.type] + ' ' : '') + '피해를 입히면 3초 동안 ' + pc(p.pct) + '의 치유 감소를 적용합니다.',
  damageDealt(h, e, t, dmg, opts) { if (champLike(t) && (!e.p.type || opts.type === e.p.type)) t.applyGrievous(e.p.pct, 3); },
};
FX.giantSlayer = {
  desc: p => '대상의 추가 체력에 비례해 챔피언에게 최대 ' + pc(p.max) + '의 추가 피해를 입힙니다 (추가 체력 ' + p.hp + '일 때 최대).',
  dmgAmp(h, e, t) { return champLike(t) ? e.p.max * clamp((t.bonusHp || 0) / e.p.hp, 0, 1) : 0; },
};
FX.madness = {
  unique: () => 'madness',
  rank: p => p.per * p.max,
  desc: p => '챔피언과 전투 중 매초 피해량이 ' + pc(p.per) + ' 증가합니다 (최대 ' + pc(p.per * p.max) + ')' + (p.vamp ? '. 최대 중첩일 때 모든 피해 흡혈 ' + pc(p.vamp) + '를 얻습니다' + EST : '') + '.',
  tick(h, e, dt) {
    if (h.inChampCombat()) e.st.s = Math.min(e.p.max, (e.st.s || 0) + dt); else e.st.s = 0;
    if (e.p.vamp && e.st.s >= e.p.max) h.omnivampDyn += e.p.vamp;
  },
  dmgAmp(h, e, t) { return champLike(t) ? Math.floor(e.st.s || 0) * e.p.per : 0; },
};
FX.cinderbloom = {
  desc: p => '마법·고정 피해가 체력 ' + pc(p.threshold) + ' 미만인 적에게 ' + pc(p.mult) + ' 증가합니다.',
  dmgAmp(h, e, t, opts) { return (opts.type === 'magic' || opts.type === 'true') && t.hp < t.maxHp * e.p.threshold ? e.p.mult : 0; },
};
FX.magnification = {
  desc: p => '기본 공격 시 대상과의 거리에 따라 피해량이 최대 ' + pc(p.max) + ' 증가합니다 (' + p.dist + ' 거리에서 최대).',
  dmgAmp(h, e, t, opts) { return opts.isAttack ? e.p.max * clamp(dist(h.x, h.y, t.x, t.y) / e.p.dist, 0, 1) : 0; },
};
FX.focusedWill = {
  desc: p => '스킬로 피해를 입히면 6초 동안 스킬 피해량이 ' + pc(p.per) + ' 증가합니다 (최대 ' + p.max + '회).',
  damageDealt(h, e, t, dmg, opts) {
    if (opts.ability && !opts.proc && castOnce(h, e)) { e.st.s = Math.min(e.p.max, (now(h) < (e.st.until || 0) ? e.st.s : 0) + 1); e.st.until = now(h) + 6; }
  },
  dmgAmp(h, e, t, opts) { return opts.ability && now(h) < (e.st.until || 0) ? e.st.s * e.p.per : 0; },
};
FX.foreverForward = {
  desc: p => '체력이 절반 이상이면 입히는 피해가 ' + pc(p.dmg) + ' 증가하고, 절반 미만이면 받는 체력 회복·보호막 효과가 ' + pc(p.heal) + ' 증가합니다.',
  dmgAmp(h, e) { return h.hp >= h.maxHp * 0.5 ? e.p.dmg : 0; },
  tick(h, e) { const b = h.hp < h.maxHp * 0.5; if (b !== !!e.st.b) { e.st.b = b; h.recalcStats(); } },
  statsFlat(h, e, S) { if (e.st.b) S.hsReceived += e.p.heal; },
};
FX.plating = {
  unique: () => 'plating',
  desc: p => '기본 공격으로 받는 피해가 ' + pc(p.pct) + ' 감소합니다 (포탑 제외).',
  dmgTaken(h, e, src, dmg, opts) { return opts.isAttack && src && !src.isStructure ? dmg * (1 - e.p.pct) : dmg; },
};
FX.rockSolid = {
  desc: p => '기본 공격으로 받는 피해가 ' + p.flat + ' 감소합니다 (최대 ' + pc(p.maxPct) + ').',
  dmgTaken(h, e, src, dmg, opts) { return opts.isAttack ? dmg - Math.min(e.p.flat, dmg * e.p.maxPct) : dmg; },
};
FX.undaunted = {
  desc: p => '챔피언에게 받는 기본 공격·스킬 피해가 ' + p.flat + ' 감소합니다 (지속 피해는 25%).',
  dmgTaken(h, e, src, dmg, opts) { return src && champLike(src) ? Math.max(0, dmg - (opts.dot ? e.p.flat * 0.25 : e.p.flat)) : dmg; },
};
FX.resilience = {
  desc: p => '치명타로 받는 피해가 ' + pc(p.v) + ' 감소합니다.',
  dmgTaken(h, e, src, dmg, opts) { return opts.crit ? dmg * (1 - e.p.v) : dmg; },
};
FX.ignorePain = {
  desc: p => '받는 물리·마법 피해의 ' + pc(p.pct) + '를 저장했다가 3초에 걸쳐 고정 피해로 받습니다.',
  dmgTaken(h, e, src, dmg, opts) {
    if (opts.type === 'true' || opts.selfPain) return dmg;
    e.st.pool = (e.st.pool || 0) + dmg * e.p.pct;
    e.st.rate = e.st.pool / 3;
    return dmg * (1 - e.p.pct);
  },
  tick(h, e, dt) {
    if (!(e.st.pool > 0)) return;
    const amt = Math.min(e.st.pool, e.st.rate * dt);
    e.st.pool -= amt;
    h.game.dealDamage(null, h, amt, { type: 'true', silent: true, noVamp: true, selfPain: true, proc: true });
  },
};
FX.defy = {
  desc: p => '피해를 입힌 챔피언이 3초 안에 죽으면 저장된 피해가 사라지고 2초에 걸쳐 추가 공격력의 ' + pc(p.bonusAd) + '만큼 체력을 회복합니다.',
  takedown(h, e, t) {
    if (!champTakedownLike(t)) return;
    const ip = h.effects.find(x => x.tpl === FX.ignorePain);
    if (ip) ip.st.pool = 0;
    h.hots.push({ src: 'defy', perSec: h.bonusAd * e.p.bonusAd / 2, t: 2 });
  },
};

// ---------------- 생명선 / 보호막 / 부활 ----------------
FX.lifelineShield = {
  unique: () => 'lifeline',
  rank: p => (p.flat || 0) + (p.max || 0) + (p.bonusHp || 0) * 1000 + (p.maxMana || 0) * 1000,
  desc: p => {
    const parts = [];
    if (p.flat) parts.push(p.flat);
    if (p.min != null) parts.push(p.min + '~' + p.max + '(레벨 비례)');
    if (p.bonusHp) parts.push('추가 체력의 ' + pc(p.bonusHp));
    if (p.maxMana) parts.push('최대 마나의 ' + pc(p.maxMana));
    if (p.bonusAd) parts.push('추가 공격력의 ' + pc(p.bonusAd));
    return (p.type === 'magic' ? '마법 피해로 ' : '피해로 ') + '체력이 30% 아래로 떨어지면 ' + p.dur + '초 동안 ' + parts.join(' + ') + '의 ' + (p.type === 'magic' ? '마법 ' : '') + '보호막을 얻습니다' +
      (p.decay ? ' (점점 감소)' : '') + (p.vamp ? '. 전투가 끝날 때까지 모든 피해 흡혈 ' + pc(p.vamp) + '를 얻습니다' : '') + '. (재사용 대기시간 ' + p.cd + '초)' + (p.est ? EST : '');
  },
  lowHealth(h, e, src, dmg, opts) {
    if (now(h) < (e.st.cd || 0) || (e.p.type && opts.type !== e.p.type)) return;
    const p = e.p;
    const amt = (p.flat || 0) + (p.min != null ? lvlScale(h, p.min, p.max) : 0) + (p.bonusHp || 0) * h.bonusHp + (p.maxMana || 0) * h.maxMana + (p.bonusAd || 0) * h.bonusAd;
    h.addShield('lifeline', amt, p.dur, { type: p.type || 'all', decay: p.decay });
    e.st.cd = now(h) + p.cd;
    if (p.vamp) e.st.vamp = true;
    h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 70, color: '#ffe9a0', dur: 0.5, follow: h });
  },
  tick(h, e) { if (e.st.vamp) { if (h.inCombat()) h.omnivampDyn += e.p.vamp; else e.st.vamp = false; } },
};
FX.protoplasm = {
  unique: () => 'lifeline',
  rank: () => 500,
  desc: p => '피해로 체력이 30% 아래로 떨어지면 5초 동안 최대 체력이 ' + p.min + '~' + p.max + ' 증가하고 같은 양의 체력을 회복하며, 이동 속도 10%·강인함 25%를 얻습니다. (재사용 대기시간 ' + p.cd + '초)' + EST,
  lowHealth(h, e) {
    if (now(h) < (e.st.cd || 0)) return;
    e.st.cd = now(h) + e.p.cd;
    e.st.until = now(h) + 5;
    e.st.amt = lvlScale(h, e.p.min, e.p.max);
    h.recalcStats();
    h.hots.push({ src: 'protoplasm', perSec: e.st.amt / 5, t: 5 });
  },
  tick(h, e) {
    if (now(h) < (e.st.until || 0)) h.dynMsPct += 0.1;
    else if (e.st.amt) { e.st.amt = 0; h.recalcStats(); }
  },
  statsFlat(h, e, S) { if (e.st.amt) { S.hp += e.st.amt; S.tenacity += 0.25; } },
};
FX.rebirth = {
  unique: () => 'rebirth',
  desc: p => '치명적인 피해를 입으면 ' + p.dur + '초 동안 경직된 뒤 기본 체력의 ' + pc(p.hp) + ', 최대 마나의 100%를 회복하며 부활합니다. (재사용 대기시간 ' + p.cd + '초)',
  tryRevive(h, e) {
    if (now(h) < (e.st.cd || 0)) return false;
    e.st.cd = now(h) + e.p.dur + e.p.cd;
    h.stasisT = e.p.dur;
    h.cancelWindup(); h.cancelRecall(); h.cancelChannel(); h.dash = null;
    h.game.addEffect({ type: 'revive', x: h.x, y: h.y, dur: e.p.dur, follow: h });
    h.game.later(e.p.dur, () => {
      if (!h.alive) return;
      h.hp = Math.min(h.maxHp, h.hp + (h.base.hp + h.base.hpPerLvl * (h.level - 1)) * e.p.hp);
      h.mana = h.maxMana;
    });
    return true;
  },
};
FX.magebane = {
  desc: p => p.delay + '초 동안 마법 피해를 받지 않으면 최대 체력의 ' + pc(p.pct) + '만큼 마법 피해를 흡수하는 보호막을 얻습니다.',
  damageTaken(h, e, src, dmg, opts) { if (opts.type === 'magic') e.st.last = now(h); },
  tick(h, e) {
    if (now(h) - (e.st.last ?? -99) >= e.p.delay && !(h.shields && h.shields.kaenic)) h.addShield('kaenic', h.maxHp * e.p.pct, 1e9, { type: 'magic' });
  },
};
FX.noxianShield = {
  desc: p => '챔피언에게 ' + TYPE_KO[p.type] + ' 피해를 받으면 5초 동안 ' + p.min + '~' + p.max + ' (+추가 체력의 ' + pc(p.bonusHp) + ')의 ' + TYPE_KO[p.type] + ' 보호막을 얻습니다. (재사용 대기시간 ' + p.cd + '초)' + EST,
  damageTaken(h, e, src, dmg, opts) {
    if (!src || !champLike(src) || opts.type !== e.p.type || now(h) < (e.st.cd || 0)) return;
    e.st.cd = now(h) + e.p.cd;
    h.addShield('noxian' + e.p.type, lvlScale(h, e.p.min, e.p.max) + e.p.bonusHp * h.bonusHp, 5, { type: e.p.type });
  },
};
FX.everlasting = {
  desc: p => '적 챔피언을 이동 불가 또는 둔화시키면 3초 동안 ' + p.shield + '의 보호막을 얻습니다. (재사용 대기시간 ' + p.cd + '초)',
  impairApplied(h, e, t) {
    if (!champLike(t) || now(h) < (e.st.cd || 0)) return;
    e.st.cd = now(h) + e.p.cd;
    h.addShield('everlasting', e.p.shield, 3);
  },
};
FX.ichorshield = {
  desc: p => '생명력 흡수로 최대 체력을 넘겨 회복한 양을 보호막으로 바꿉니다 (최대 ' + p.min + '~' + p.max + ').',
  overheal(h, e, amt, src) {
    if (src !== 'lifesteal') return;
    const cap = lvlScale(h, e.p.min, e.p.max);
    const cur = h.shields && h.shields.ichor ? h.shields.ichor.amt : 0;
    const next = Math.min(cap, cur + amt);
    if (next > cur) (h.shields || (h.shields = {})).ichor = { amt: next, max: next, t: 1e9, dur: 1e9, type: 'all' };
  },
};
FX.voidborn = {
  desc: p => '챔피언과 5초 이상 전투하면 전투가 끝날 때까지 추가 방어력·마법 저항력이 ' + pc(p.pct) + ' 증가합니다.',
  tick(h, e, dt) {
    if (h.inChampCombat()) e.st.t = (e.st.t || 0) + dt; else e.st.t = 0;
    const on = e.st.t >= 5;
    if (on !== !!e.st.on) { e.st.on = on; h.recalcStats(); }
  },
  statsFlat(h, e, S) { if (e.st.on) S.bonusResistPct += e.p.pct; },
};
FX.steadfast = {
  desc: p => '챔피언에게 마법 피해를 받으면 중첩이 쌓입니다 (최대 ' + p.max + '). 최대 중첩일 때 마법 저항력 ' + p.mr + '와 이동 속도 ' + pc(p.ms) + '를 얻습니다.',
  damageTaken(h, e, src, dmg, opts) {
    if (!src || !champLike(src) || opts.type !== 'magic' || now(h) < (e.st.gate || 0)) return;
    e.st.gate = now(h) + 1;
    e.st.s = Math.min(e.p.max, (now(h) < (e.st.until || 0) ? e.st.s : 0) + 1);
    e.st.until = now(h) + 7;
    h.recalcStats();
  },
  tick(h, e) {
    if (e.st.s && now(h) > e.st.until) { e.st.s = 0; h.recalcStats(); }
    if (e.st.s >= e.p.max) h.dynMsPct += e.p.ms;
  },
  statsFlat(h, e, S) { if (e.st.s >= e.p.max) S.mr += e.p.mr; },
};
FX.blessing = {
  desc: p => '챔피언에게 피해를 받으면 2초 동안 챔피언에게 받는 피해가 ' + pc(p.reduce) + ' 감소합니다. 효과가 끝나면 주변 적을 1.5초 동안 ' + pc(p.slow) + ' 둔화시킵니다. (재사용 대기시간 ' + p.cd + '초)',
  dmgTaken(h, e, src, dmg) {
    if (!src || !champLike(src)) return dmg;
    if (!e.st.on && now(h) >= (e.st.cd || 0)) e.st.on = true;
    if (e.st.on) { e.st.until = now(h) + 2; return dmg * (1 - e.p.reduce); }
    return dmg;
  },
  tick(h, e) {
    if (e.st.on && now(h) > e.st.until) {
      e.st.on = false;
      e.st.cd = now(h) + e.p.cd;
      for (const u of h.game.enemiesInRadius(h.team, h.x, h.y, 500)) h.game.applySlow(h, u, 'celestial', e.p.slow, 1.5);
      h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 500, color: '#bfe8ff', dur: 0.4 });
    }
  },
};

// ---------------- 스킬 적중 효과 ----------------
FX.burn = {
  unique: p => 'burn:' + p.key,
  desc: p => '스킬로 피해를 입히면 3초 동안 ' + p.total + (p.ap ? '(+주문력의 ' + pc(p.ap) + ')' : '') + '의 마법 피해를 입힙니다' +
    (p.monsterTotal ? '. 몬스터에게는 ' + p.monsterTotal + '의 추가 피해' : '') + (p.monsterTick ? '. 몬스터에게는 0.5초마다 ' + p.monsterTick + '의 추가 피해' : '') + '.',
  damageDealt(h, e, t, dmg, opts) {
    if (!opts.ability || opts.proc || !t.alive) return;
    const p = e.p;
    h.game.addDot(h, t, p.key, { total: p.total + (p.ap || 0) * h.ap + (t.kind === 'monster' ? (p.monsterTotal || 0) : 0), dur: 3, tick: 0.5, type: 'magic', monsterBonusPerTick: p.monsterTick || 0 });
  },
};
FX.blackfire = {
  desc: p => '불태우는 효과가 적용된 챔피언·에픽·대형 몬스터 하나당 주문력이 ' + pc(p.apPct) + ' 증가합니다.',
  tick(h, e) {
    const n = h.game.dots.filter(d => d.src === h && d.key === 'blackfire' && (champLike(d.t) || d.t.large || d.t.epic)).length;
    if (n !== (e.st.n || 0)) { e.st.n = n; h.recalcStats(); }
  },
  statsDerived(h, e, S) { S.apPct += (e.st.n || 0) * e.p.apPct; },
};
FX.torment = {
  unique: () => 'burn:torment',
  desc: p => '스킬로 피해를 입히면 3초 동안 매초 대상 최대 체력의 ' + pc(p.hpPct) + '만큼 마법 피해를 입힙니다 (몬스터 대상 틱당 최대 ' + p.cap + ').' + EST,
  damageDealt(h, e, t, dmg, opts) {
    if (!opts.ability || opts.proc || !t.alive) return;
    h.game.addDot(h, t, 'torment', { total: 0, dur: 3, tick: 1, type: 'magic', perTickFn: d => d.t.maxHp * e.p.hpPct, cap: e.p.cap });
  },
};
FX.echo = {
  desc: p => '스킬로 적에게 피해를 입히면 메아리 6개를 소모해 대상과 주변(600) 적에게 ' + p.dmg + '(+주문력의 ' + pc(p.ap) + ')의 마법 피해를 입힙니다. 남은 메아리는 주 대상에게 개당 20% 피해를 추가합니다. 메아리는 ' + p.cd + '초 뒤 다시 채워집니다.' + EST,
  damageDealt(h, e, t, dmg, opts) {
    if (!opts.ability || opts.proc || now(h) < (e.st.cd || 0) || !t.alive) return;
    e.st.cd = now(h) + e.p.cd;
    const amt = e.p.dmg + e.p.ap * h.ap;
    const others = h.game.enemiesInRadius(h.team, t.x, t.y, 600).filter(u => u !== t).slice(0, 5);
    proc(h, t, amt * (1 + 0.2 * (5 - others.length)), 'magic', {});
    for (const u of others) h.game.later(0.5, () => u.alive && proc(h, u, amt, 'magic', { aoe: true }));
    h.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 90, color: '#b58cff', dur: 0.4 });
  },
};
FX.rimefrost = {
  desc: p => '스킬로 피해를 입히면 ' + p.dur + '초 동안 ' + pc(p.slow) + ' 둔화시킵니다.',
  damageDealt(h, e, t, dmg, opts) { if (opts.ability && !opts.proc && t.alive) h.game.applySlow(h, t, 'rylai', e.p.slow, e.p.dur); },
};
FX.bitterCold = {
  desc: p => '스킬로 체력 50% 이하인 적에게 피해를 입히면 ' + p.dur + '초 동안 ' + pc(p.slow) + ' 둔화시킵니다.',
  damageDealt(h, e, t, dmg, opts) { if (opts.ability && !opts.proc && t.alive && t.hp <= t.maxHp * 0.5) h.game.applySlow(h, t, 'serylda', e.p.slow, e.p.dur); },
};
FX.shapedCharge = {
  desc: p => '챔피언 스킬로 챔피언·에픽 몬스터에게 주는 첫 피해에 ' + p.dmg + ' (+물리 관통력 1당 ' + p.perLeth + ')의 고정 피해를 추가합니다.' + EST,
  abilityCast(h, e) { e.st.armed = true; },
  damageDealt(h, e, t, dmg, opts) {
    if (!e.st.armed || !opts.ability || opts.proc || !(champLike(t) || t.epic)) return;
    e.st.armed = false;
    proc(h, t, e.p.dmg + e.p.perLeth * h.lethality, 'true', {});
  },
};
FX.sabotage = {
  desc: p => '챔피언 처치 관여 시 90초 동안 파괴 공작을 얻어, 다음 포탑·에픽 몬스터 기본 공격이 3초에 걸쳐 ' + p.dmg + '의 고정 피해를 입힙니다.',
  takedown(h, e, t) { if (champTakedownLike(t)) e.st.until = now(h) + 90; },
  hit(h, e, t) {
    if (now(h) > (e.st.until || 0) || !(t.isStructure || t.epic)) return;
    e.st.until = 0;
    h.game.addDot(h, t, 'sabotage', { total: e.p.dmg, dur: 3, tick: 0.5, type: 'true' });
  },
};
FX.voidExplosion = {
  desc: p => '스킬로 챔피언에게 피해를 입히면 0.5초 뒤 폭발해 주변 적에게 ' + p.dmg + ' (+주문력의 ' + pc(p.ap) + ' +대상 최대 체력의 ' + pc(p.hpPct) + ')의 마법 피해를 입힙니다 (몬스터 대상 최대 ' + p.cap + ').' + EST,
  damageDealt(h, e, t, dmg, opts) {
    if (!opts.ability || opts.proc || !champLike(t) || !castOnce(h, e)) return;
    const x = t.x, y = t.y;
    h.game.later(0.5, () => {
      for (const u of h.game.enemiesInRadius(h.team, x, y, 250)) {
        let amt = e.p.dmg + e.p.ap * h.ap + e.p.hpPct * u.maxHp;
        if (u.kind === 'monster') amt = Math.min(amt, e.p.cap);
        proc(h, u, amt, 'magic', { aoe: true });
      }
      h.game.addEffect({ type: 'pulse', x, y, r: 250, color: '#c07cff', dur: 0.4 });
    });
  },
};
FX.stormraider = {
  desc: p => '2.5초 안에 챔피언 최대 체력의 ' + pc(p.pct) + '에 해당하는 피해를 주면 2초 뒤 번개가 떨어져 ' + p.dmg + '(+주문력의 ' + pc(p.ap) + ')의 마법 피해를 입힙니다. (재사용 대기시간 ' + p.cd + '초)',
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t) || opts.proc || now(h) < (e.st.cd || 0)) return;
    const log = e.st.log || (e.st.log = new Map());
    const arr = (log.get(t.id) || []).filter(x => now(h) - x.t <= 2.5);
    arr.push({ t: now(h), d: dmg });
    log.set(t.id, arr);
    if (arr.reduce((s, x) => s + x.d, 0) >= t.maxHp * e.p.pct) {
      e.st.cd = now(h) + e.p.cd;
      log.clear();
      h.game.later(2, () => { if (t.alive) { proc(h, t, e.p.dmg + e.p.ap * h.ap, 'magic', {}); h.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 120, color: '#9fdcff', dur: 0.4 }); } });
    }
  },
};
FX.hypershot = {
  desc: p => '챔피언 스킬로 ' + p.dist + ' 이상 떨어진 챔피언에게 피해를 주면 6초 동안 대상이 받는 피해가 ' + pc(p.amp) + ' 증가합니다.',
  damageDealt(h, e, t, dmg, opts) { if (opts.ability && !opts.proc && champLike(t) && dist(h.x, h.y, t.x, t.y) >= e.p.dist) t.addTakenAmp('hypershot' + h.id, e.p.amp, 6, h); },
};
FX.vileDecay = {
  desc: p => '챔피언 스킬로 마법 피해를 입히면 6초 동안 대상의 마법 저항력이 ' + pc(p.per) + ' 감소합니다 (최대 ' + p.max + '회).',
  damageDealt(h, e, t, dmg, opts) {
    if (!opts.ability || opts.proc || opts.type !== 'magic' || !champLike(t)) return;
    t.vileStacks = Math.min(e.p.max, (t.vileT > now(h) ? t.vileStacks : 0) + 1);
    t.vileT = now(h) + 6;
    t.addMrShred('vile', t.vileStacks * e.p.per, 6);
  },
};
FX.carve = {
  desc: p => '챔피언에게 물리 피해를 입히면 6초 동안 방어력을 ' + pc(p.per) + ' 감소시킵니다 (최대 ' + p.max + '회).',
  damageDealt(h, e, t, dmg, opts) {
    if (opts.type !== 'physical' || !champLike(t) || opts.dot) return;
    t.carveStacks = Math.min(e.p.max, (t.carveT > now(h) ? t.carveStacks : 0) + 1);
    t.carveT = now(h) + 6;
    t.addArmorShred('carve', t.carveStacks * e.p.per, 6);
  },
};
FX.shock = {
  desc: p => '챔피언에게 기본 공격 시 최대 마나의 ' + pc(p.onHit) + ', 스킬로 피해를 주면 최대 마나의 ' + pc(p.ability) + '만큼 추가 물리 피해를 입힙니다.',
  preHit(h, e, t, ctx) { if (champLike(t) && h.resource === 'mana') ctx.bonus.push({ amt: h.maxMana * e.p.onHit, type: 'physical' }); },
  damageDealt(h, e, t, dmg, opts) { if (opts.ability && !opts.proc && champLike(t) && h.resource === 'mana' && castOnce(h, e)) proc(h, t, h.maxMana * e.p.ability, 'physical', {}); },
};
FX.everRisingMoon = {
  desc: p => '2초 안에 한 챔피언을 서로 다른 공격·스킬로 2회 공격하면 최대 체력의 ' + pc(p.hpPct) + '만큼 물리 피해를 입히고 2초 동안 ' + p.shield + '의 보호막을 얻습니다. (재사용 대기시간 ' + p.cd + '초)' + EST,
  damageDealt(h, e, t, dmg, opts) {
    if (opts.proc || opts.dot || !champLike(t) || now(h) < (e.st.cd || 0)) return;
    const inst = opts.isAttack ? 'a' + now(h) : 'c' + h.lastCastT;
    if (e.st.tid === t.id && now(h) - e.st.t0 <= 2 && e.st.inst !== inst) {
      e.st.cd = now(h) + e.p.cd;
      e.st.tid = null;
      let amt = t.maxHp * e.p.hpPct;
      if (t.kind !== 'hero') amt = Math.min(amt, 250);
      proc(h, t, amt, 'physical', {});
      h.addShield('eclipse', e.p.shield, 2);
    } else { e.st.tid = t.id; e.st.t0 = now(h); e.st.inst = inst; }
  },
};
FX.execute = {
  desc: p => '피해를 입혀 챔피언의 체력이 ' + pc(p.threshold) + ' 미만이 되면 처형합니다.',
  damageDealt(h, e, t, dmg, opts) {
    if (!champLike(t) || !t.alive || t.hp >= t.maxHp * e.p.threshold || opts.execute) return;
    h.game.dealDamage(h, t, t.hp + 1, { type: 'true', proc: true, execute: true });
  },
};
FX.unmake = {
  desc: p => '주변 ' + p.radius + ' 안의 적 챔피언이 받는 마법 피해가 ' + pc(p.amp) + ' 증가합니다.',
  tick(h, e, dt) {
    e.st.acc = (e.st.acc || 0) + dt;
    if (e.st.acc < 0.25) return;
    e.st.acc = 0;
    for (const u of h.game.enemiesInRadius(h.team, h.x, h.y, e.p.radius)) if (champLike(u)) u.addTakenAmp('abyssal', e.p.amp, 0.35, null, 'magic');
  },
};
FX.wintersCaress = {
  desc: p => '주변 ' + p.radius + ' 안의 적 챔피언 공격 속도를 ' + pc(p.as) + ' 감소시킵니다.',
  tick(h, e, dt) {
    e.st.acc = (e.st.acc || 0) + dt;
    if (e.st.acc < 0.25) return;
    e.st.acc = 0;
    for (const u of h.game.enemiesInRadius(h.team, h.x, h.y, e.p.radius)) if (champLike(u)) u.addAsSlow('frozenHeart', e.p.as, 0.35);
  },
};
FX.thorns = {
  unique: () => 'thorns',
  rank: p => p.dmg,
  desc: p => '기본 공격에 맞으면 공격자에게 ' + p.dmg + (p.bonusArmor ? ' (+추가 방어력의 ' + pc(p.bonusArmor) + ')' : '') + '의 마법 피해를 입히고, 챔피언이면 3초 동안 40% 치유 감소를 적용합니다.',
  damageTaken(h, e, src, dmg, opts) {
    if (!opts.isAttack || !src || src.isStructure || !src.alive) return;
    proc(h, src, e.p.dmg + (e.p.bonusArmor || 0) * h.bonusArmor, 'magic', { silent: true });
    if (champLike(src)) src.applyGrievous(0.4, 3);
  },
};
FX.immolate = {
  unique: () => 'immolate',
  rank: p => p.base + (p.bonusHp || 0) * 1000,
  desc: p => '피해를 주거나 받으면 3초 동안 주변 ' + p.radius + ' 범위의 적에게 매초 ' + p.base + (p.bonusHp ? ' (+추가 체력의 ' + pc(p.bonusHp) + ')' : '') + '의 마법 피해를 입힙니다 (미니언 ' + pc(p.minion) + ', 몬스터 ' + pc(p.monster) + ' 적용).' + (p.est ? EST : ''),
  damageDealt(h, e, t, dmg, opts) { if (!opts.selfPain) e.st.until = now(h) + 3; },
  damageTaken(h, e, src, dmg, opts) { if (!opts.selfPain) e.st.until = now(h) + 3; },
  tick(h, e) {
    if (now(h) > (e.st.until || 0) || now(h) < (e.st.next || 0)) return;
    e.st.next = now(h) + 1;
    const base = e.p.base + (e.p.bonusHp || 0) * h.bonusHp;
    for (const u of h.game.enemiesInRadius(h.team, h.x, h.y, e.p.radius)) {
      const amt = base * (u.kind === 'minion' ? e.p.minion : u.kind === 'monster' ? e.p.monster : 1);
      proc(h, u, amt, 'magic', { dot: true, aoe: true, silent: true });
    }
  },
};
FX.desolate = {
  desc: p => '챔피언이 아닌 적을 처치하면 주변 ' + p.radius + ' 범위에 불사르기 피해의 200%를 입힙니다.',
  kill(h, e, t) {
    if (t.kind === 'hero') return;
    const im = h.effects.find(x => x.tpl === FX.immolate);
    const base = im ? im.p.base + (im.p.bonusHp || 0) * h.bonusHp : 15;
    for (const u of h.game.enemiesInRadius(h.team, t.x, t.y, e.p.radius)) proc(h, u, base * 2, 'magic', { aoe: true, silent: true });
    h.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: e.p.radius, color: '#b07cff', dur: 0.35 });
  },
};
FX.anguish = {
  desc: p => '챔피언과 전투 중 4초마다 주변 650 범위의 적 챔피언에게 추가 체력의 ' + pc(p.hpPct) + '만큼 마법 피해를 입히고 피해량의 ' + pc(p.heal) + '만큼 체력을 회복합니다.',
  tick(h, e) {
    if (!h.inChampCombat() || now(h) < (e.st.next || 0)) return;
    e.st.next = now(h) + 4;
    let total = 0;
    for (const u of h.game.enemiesInRadius(h.team, h.x, h.y, 650)) if (champLike(u)) total += proc(h, u, h.bonusHp * e.p.hpPct, 'magic', { aoe: true, silent: true });
    if (total > 0) { h.heal(total * e.p.heal, 'item'); h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 650, color: '#8a6aff', dur: 0.4 }); }
  },
};
FX.frostfire = {
  desc: p => '궁극기를 사용하면 5초 동안 주변(350)에 폭풍을 소환해 적에게 매초 ' + p.dps + '의 마법 피해를 입히고 30% 둔화시킵니다. (재사용 대기시간 45초)' + EST,
  abilityCast(h, e, key) {
    if (key !== 'R' || now(h) < (e.st.cd || 0)) return;
    e.st.cd = now(h) + 45;
    h.game.addZone({ x: h.x, y: h.y, r: 350, dur: 5, team: h.team, follow: h, slow: 0.3, dps: e.p.dps, src: h, key: 'zeke', color: '#ffb080' });
  },
};
FX.hatefog = {
  desc: p => '궁극기로 챔피언에게 피해를 주면 3초 동안 대상 발밑을 불태워 매초 ' + p.dps + '의 마법 피해를 입히고 마법 저항력을 ' + p.shred + ' 감소시킵니다.' + EST,
  damageDealt(h, e, t, dmg, opts) {
    if (!opts.ult || opts.proc || !champLike(t)) return;
    const cds = e.st.cds || (e.st.cds = new Map());
    if (now(h) < (cds.get(t.id) || 0)) return;
    cds.set(t.id, now(h) + 3);
    h.game.addZone({
      x: t.x, y: t.y, r: 250, dur: 3, team: h.team, dps: e.p.dps, src: h, color: '#7a3cff',
      onTick: z => { for (const u of h.game.enemiesInRadius(h.team, z.x, z.y, z.r)) u.addMrShred('hatefog', 0, 0.3, e.p.shred); },
    });
  },
};
