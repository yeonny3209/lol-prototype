// ===== 아이템 효과 템플릿 (3) — 중첩 · 사용 효과 · 서포터/정글 =====

// ---------------- 시작 아이템 ----------------
FX.enduringFocus = {
  desc: p => '초당 체력을 ' + p.hps + ' 회복합니다. 챔피언에게 피해를 받으면 ' + p.dur + '초 동안 초당 ' + p.bonus + '의 체력을 추가로 회복합니다.' + EST,
  statsFlat(h, e, S) { S.hp5 += e.p.hps; },
  damageTaken(h, e, src) { if (src && champLike(src)) e.st.until = now(h) + e.p.dur; },
  tick(h, e, dt) { if (now(h) < (e.st.until || 0)) h.heal(e.p.bonus * dt, 'regen'); },
};
FX.drain = {
  desc: p => '매초 마나를 ' + p.base + ' 회복하고, 적 챔피언에게 피해를 입힌 뒤 ' + p.dur + '초 동안은 ' + p.boosted + '로 늘어납니다. 마나를 쓰지 않으면 그 ' + pc(p.hpRatio) + '만큼 체력을 회복합니다.',
  damageDealt(h, e, t, dmg, opts) { if (champLike(t) && !opts.proc) e.st.boost = now(h) + e.p.dur; },
  tick(h, e, dt) {
    const rate = now(h) < (e.st.boost || 0) ? e.p.boosted : e.p.base;
    if (h.resource === 'mana') h.restoreResource(rate * dt); else h.heal(rate * e.p.hpRatio * dt, 'regen');
  },
};
FX.glory = {
  unique: () => 'glory',
  desc: p => '챔피언 처치 시 영광 ' + p.kill + '중첩, 관여 시 ' + p.assist + '중첩을 얻습니다 (최대 ' + p.max + '). 중첩당 주문력 ' + p.ap + (p.msAt ? ', ' + p.msAt + '중첩 이상이면 이동 속도 ' + pc(p.ms) : '') + '. 사망 시 ' + p.lose + '중첩을 잃습니다.',
  takedown(h, e, t, isKiller) {
    if (!champTakedownLike(t)) return;
    const st = e.src.slot.st;
    st.glory = Math.min(e.p.max, (st.glory || 0) + (isKiller ? e.p.kill : e.p.assist));
    h.recalcStats();
  },
  death(h, e) { const st = e.src.slot.st; st.glory = Math.max(0, (st.glory || 0) - e.p.lose); },
  statsFlat(h, e, S) {
    const g = Math.min(e.p.max, e.src.slot.st.glory || 0);
    S.ap += g * e.p.ap;
    if (e.p.msAt && g >= e.p.msAt) S.msPct += e.p.ms;
  },
};
FX.jungleCompanion = {
  unique: () => 'jungleCompanion',
  desc: p => '<b>' + ({ scorchclaw: '화염발톱', gustwalker: '바람돌이', mosstomper: '이끼쿵쿵이' })[p.pet] + '</b> 동료가 몬스터 사냥을 돕습니다: 몬스터에게 기본 공격·스킬 적중 시 20(+레벨당 3)의 고정 피해를 추가로 주고, 몬스터에게 받는 피해가 15% 감소하며, 대형 몬스터를 처치하면 체력을 45 + 잃은 체력의 10% 회복합니다. ' +
    '대형 몬스터를 사냥하면 간식을 얻어 강타가 강화되고(15개: 강화된 강타, 35개: 원시의 강타), 완전히 성장하면 정글 퀘스트가 완료됩니다. 강타가 필요합니다.' + EST,
  preHit(h, e, t, ctx) { if (t.kind === 'monster') ctx.bonus.push({ amt: 20 + 3 * h.level, type: 'true', silent: true }); },
  damageDealt(h, e, t, dmg, opts) {
    if (!opts.ability || opts.proc || t.kind !== 'monster' || now(h) < (e.st.cd || 0)) return;
    e.st.cd = now(h) + 1;
    proc(h, t, 20 + 3 * h.level, 'true', { silent: true });
  },
  dmgTaken(h, e, src, dmg) { return src && src.kind === 'monster' ? dmg * 0.85 : dmg; },
  kill(h, e, t) { if (t.kind === 'monster' && (t.large || t.epic)) h.heal(45 + (h.maxHp - h.hp) * 0.1, 'item'); },
};

// ---------------- 서포터 퀘스트 ----------------
FX.sharedRiches = {
  unique: () => 'sharedRiches',
  desc: p => '20초마다 충전을 얻습니다 (최대 3회). 충전이 있을 때 체력 50% 이하 미니언을 기본 공격하면 처치하고 ' + p.gold + '골드를 얻으며, 적 챔피언·구조물에 피해를 주면 ' + p.dmgGold + '골드를 얻습니다.' +
    ' <i class="est">※원래는 아군 챔피언이 근처에 있어야 하지만, 혼자 하는 프로토타입이라 조건을 뺐습니다. 처치 기준 체력 추정</i>',
  tick(h, e, dt) {
    if (e.st.charges == null) { e.st.charges = 3; e.st.next = now(h) + 20; }
    if (e.st.charges < 3 && now(h) >= e.st.next) { e.st.charges++; e.st.next = now(h) + 20; }
    if (e.st.charges >= 3) e.st.next = now(h) + 20;
  },
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly || t.kind !== 'minion' || !(e.st.charges > 0) || t.hp > t.maxHp * 0.5) return;
    e.st.charges--;
    ctx.bonus.push({ amt: t.hp + 5, type: 'true', silent: true });
    h.addGold(e.p.gold, t.x, t.y - 20);
    e.src.slot.st.earned = (e.src.slot.st.earned || 0) + e.p.gold;
  },
  damageDealt(h, e, t, dmg, opts) {
    if (opts.proc || !(e.st.charges > 0) || !(t.isStructure || (champLike(t) && t.kind !== 'minion'))) return;
    if (!opts.isAttack && !castOnce(h, e)) return;
    e.st.charges--;
    h.addGold(e.p.dmgGold, h.x, h.y);
    e.src.slot.st.earned = (e.src.slot.st.earned || 0) + e.p.dmgGold;
  },
};
FX.supportQuest = {
  desc: p => '<b>서포터 퀘스트:</b> 이 아이템으로 ' + p.need + '골드를 벌면 ' + ITEM_DB[p.into].name + '(으)로 업그레이드됩니다.',
  tick(h, e, dt) {
    const st = e.src.slot.st;
    if (now(h) > CFG.PASSIVE_GOLD_START) st.earned = (st.earned || 0) + h.goldPer10 / 10 * dt;
    if ((st.earned || 0) >= e.p.need && st.doneFor !== e.src.id) {
      st.doneFor = e.src.id;
      st.earned = 0;
      h.game.later(0, () => Items.transform(h, e.src.ref, e.p.into));
    }
  },
};
FX.bountyUpgrade = {
  desc: () => '<b>서포터 퀘스트 완료!</b> 상점에서 이 아이템을 무료로 피의 노래·천상의 이의·꿈 생성기·자자크의 세계가시·태양의 썰매 중 하나로 업그레이드할 수 있습니다.',
};
FX.allyOnly = {
  desc: p => '<b>' + p.name + '</b>: ' + p.text + (p.enemy ? ' <i class="est">※적 챔피언이 없어 현재는 발동하지 않음</i>' : ALLY_ONLY),
};
FX.spellShield = {
  unique: () => 'spellShield',
  desc: p => '적의 다음 스킬을 막는 주문 방어막을 얻습니다 (재사용 대기시간 ' + p.cd + '초). <i class="est">※적 챔피언 스킬이 없어 현재는 발동하지 않음</i>',
};
FX.goingSledding = {
  desc: p => '적 챔피언을 둔화·이동 불가 상태로 만들면 ' + p.dur + '초 동안 이동 속도가 ' + pc(p.ms) + ' 증가했다가 점차 감소합니다.',
  impairApplied(h, e, t) { if (champLike(t) && now(h) >= (e.st.cd || 0)) { e.st.cd = now(h) + 1; h.addHaste('sled', e.p.ms, e.p.dur, true); } },
};

// ---------------- 중첩형 ----------------
FX.manaflow = {
  unique: () => 'manaflow',
  desc: p => '8초마다 충전을 얻습니다 (최대 ' + p.charges + '회). ' + (p.onHit ? '기본 공격이나 ' : '') + '스킬로 적을 맞히면 충전을 소모해 최대 마나가 ' + p.per + ' 증가합니다 (챔피언은 2배, 최대 360).' + (p.into ? ' 360에 도달하면 ' + ITEM_DB[p.into].name + '(으)로 변합니다.' : ''),
  tick(h, e) {
    if (e.st.charges == null) { e.st.charges = e.p.charges; e.st.next = now(h) + 8; }
    if (e.st.charges < e.p.charges && now(h) >= e.st.next) { e.st.charges++; e.st.next = now(h) + 8; }
    if (e.st.charges >= e.p.charges) e.st.next = now(h) + 8;
  },
  gain(h, e, t) {
    if (!(e.st.charges > 0)) return;
    const st = e.src.slot.st;
    if ((st.mana || 0) >= 360) return;
    e.st.charges--;
    st.mana = Math.min(360, (st.mana || 0) + e.p.per * (champLike(t) ? 2 : 1));
    h.recalcStats();
    if (st.mana >= 360 && e.p.into) {
      h.game.later(0, () => Items.transform(h, e.src.ref, e.p.into));
      if (h === h.game.player) UI.announce(ITEM_DB[e.p.into].name + '(으)로 변했습니다!', 'good');
    }
  },
  damageDealt(h, e, t, dmg, opts) { if (opts.ability && !opts.proc && castOnce(h, e)) FX.manaflow.gain(h, e, t); },
  hit(h, e, t) { if (e.p.onHit) FX.manaflow.gain(h, e, t); },
  statsFlat(h, e, S) { S.mana += (e.src.slot && e.src.slot.st.mana) || 0; },
};
FX.slaughter = {
  desc: p => '챔피언 처치 관여 시 모든 피해 흡혈이 ' + pc(p.per) + ' 증가합니다 (최대 ' + p.max + '회).',
  takedown(h, e, t) { if (champTakedownLike(t)) { const st = e.src.slot.st; st.slaughter = Math.min(e.p.max, (st.slaughter || 0) + 1); h.recalcStats(); } },
  statsFlat(h, e, S) { S.omnivamp += ((e.src.slot && e.src.slot.st.slaughter) || 0) * e.p.per; },
};
FX.eminence = {
  desc: p => '피해를 입힌 챔피언이 3초 안에 죽으면 영구 중첩을 얻고, ' + p.dur + '초 동안 공격력이 ' + p.base + ' (+중첩당 ' + p.per + ') 증가합니다.',
  takedown(h, e, t) {
    if (!champTakedownLike(t)) return;
    const st = e.src.slot.st;
    st.perm = (st.perm || 0) + 1;
    e.st.until = now(h) + e.p.dur;
    h.recalcStats();
  },
  tick(h, e) { if (e.st.until && now(h) > e.st.until) { e.st.until = 0; h.recalcStats(); } },
  statsFlat(h, e, S) { if (e.st.until) S.ad += e.p.base + e.p.per * (e.src.slot.st.perm || 0); },
};
FX.timeless = {
  desc: p => '1분마다 체력 ' + p.hp + ', 마나 ' + p.mana + ', 주문력 ' + p.ap + '이 증가합니다 (최대 ' + p.max + '회). 최대 중첩이 되면 레벨이 1 오릅니다.',
  tick(h, e) {
    const st = e.src.slot.st;
    if (st.boughtAt == null) st.boughtAt = now(h);
    const stacks = Math.min(e.p.max, Math.floor((now(h) - st.boughtAt) / 60));
    if (stacks !== (st.stacks || 0)) {
      st.stacks = stacks;
      if (stacks >= e.p.max && !st.leveled) { st.leveled = true; h.gainXp(xpToNext(h.level) - h.xp); }
      h.recalcStats();
    }
  },
  statsFlat(h, e, S) { const n = (e.src.slot && e.src.slot.st.stacks) || 0; S.hp += n * e.p.hp; S.mana += n * e.p.mana; S.ap += n * e.p.ap; },
};
FX.fanfare = {
  desc: p => '적 챔피언을 둔화·이동 불가 상태로 만들면 ' + p.dur + '초 동안 이동 속도 ' + p.ms + ', 공격 속도 ' + pc(p.as) + '를 얻습니다.' + EST,
  impairApplied(h, e, t) { if (champLike(t)) e.st.until = now(h) + e.p.dur; },
  tick(h, e) { if (now(h) < (e.st.until || 0)) { h.dynMsFlat += e.p.ms; h.dynAs += e.p.as; } },
};
FX.feast = {
  desc: p => '피해를 입힌 챔피언이 3초 안에 죽으면 ' + p.dur + '초 동안 모든 피해 흡혈 ' + pc(p.vamp) + '를 얻습니다.',
  takedown(h, e, t) { if (champTakedownLike(t)) e.st.until = now(h) + e.p.dur; },
  tick(h, e) { if (now(h) < (e.st.until || 0)) h.omnivampDyn += e.p.vamp; },
};
FX.arcaneAim = {
  desc: p => '피해를 입힌 챔피언이 3초 안에 죽으면 ' + p.dur + '초 동안 공격 사거리가 ' + p.range + ' 증가합니다.',
  takedown(h, e, t) { if (champTakedownLike(t)) e.st.until = now(h) + e.p.dur; },
  tick(h, e) { if (now(h) < (e.st.until || 0)) h.dynRange += e.p.range; },
};
FX.overdrive = {
  desc: p => '궁극기를 사용하면 ' + p.dur + '초 동안 공격 속도 ' + pc(p.as) + ', 이동 속도 ' + pc(p.ms) + '를 얻습니다 (재사용 대기시간 ' + p.cd + '초).',
  abilityCast(h, e, key) { if (key === 'R' && now(h) >= (e.st.cd || 0)) { e.st.cd = now(h) + e.p.cd; e.st.until = now(h) + e.p.dur; } },
  tick(h, e) { if (now(h) < (e.st.until || 0)) { h.dynAs += e.p.as; h.dynMsPct += e.p.ms; } },
};
FX.haunt = {
  desc: p => '챔피언과의 전투에서 벗어나 있으면 이동 속도가 ' + p.melee + ' (원거리 ' + p.ranged + ') 증가합니다.',
  tick(h, e) { if (!h.inChampCombat()) h.dynMsFlat += h.ranged ? e.p.ranged : e.p.melee; },
};
FX.spelldance = {
  desc: p => '챔피언에게 마법·고정 피해를 입히면 ' + p.dur + '초 동안 이동 속도가 ' + p.ms + ' 증가합니다.',
  damageDealt(h, e, t, dmg, opts) { if ((opts.type === 'magic' || opts.type === 'true') && champLike(t)) e.st.until = now(h) + e.p.dur; },
  tick(h, e) { if (now(h) < (e.st.until || 0)) h.dynMsFlat += e.p.ms; },
};
FX.noxianHaste = {
  desc: p => '스킬로 챔피언에게 피해를 주거나 소환사 주문을 사용하면 ' + p.dur + '초 동안 이동 속도가 ' + pc(p.ms) + ' 증가합니다.' + EST,
  damageDealt(h, e, t, dmg, opts) { if (opts.ability && !opts.proc && champLike(t)) e.st.until = now(h) + e.p.dur; },
  spellCast(h, e) { e.st.until = now(h) + e.p.dur; },
  tick(h, e) { if (now(h) < (e.st.until || 0)) h.dynMsPct += e.p.ms; },
};
FX.bullseye = {
  unique: () => 'bullseye',
  rank: p => p.dmg,
  desc: p => '챔피언에게 피해를 입히면 ' + p.dmg + '의 추가 마법 피해를 입힙니다 (재사용 대기시간 ' + p.cd + '초' + (p.reduce ? ', 기본 공격 시 ' + p.reduce + '초 감소' : '') + ').',
  damageDealt(h, e, t, dmg, opts) {
    if (opts.proc || !champLike(t) || now(h) < (e.st.cd || 0)) return;
    e.st.cd = now(h) + e.p.cd;
    proc(h, t, e.p.dmg, 'magic', {});
  },
  attack(h, e) { if (e.p.reduce && e.st.cd) e.st.cd -= e.p.reduce; },
};
FX.navori = {
  desc: p => '기본 공격 시 기본 스킬의 남은 재사용 대기시간이 ' + pc(p.reduce) + ' 감소합니다.',
  attack(h, e) { for (const k of ['Q', 'W', 'E']) { const a = h.abilities[k]; if (a.cd > 0) a.cd *= 1 - e.p.reduce; } },
};
FX.flux = {
  desc: p => '피해를 입힌 챔피언이 3초 안에 죽으면 궁극기 전체 재사용 대기시간의 ' + pc(p.refund) + '를 돌려받습니다.',
  takedown(h, e, t) { if (champTakedownLike(t)) { const a = h.abilities.R; if (a.cd > 0) a.cd = Math.max(0, a.cd - a.maxCd * e.p.refund); } },
};
FX.taxes = {
  desc: p => '챔피언을 처치하면 ' + p.gold + '골드를 추가로 얻습니다.',
  kill(h, e, t) { if (champTakedownLike(t)) h.addGold(e.p.gold, t.x, t.y - 20); },
};
FX.lifeFromDeath = {
  desc: p => '피해를 입힌 챔피언이 3초 안에 죽으면 그 자리에서 치유의 파동이 퍼져 ' + p.heal + '(+주문력의 ' + pc(p.ap) + ')의 체력을 회복시킵니다.',
  takedown(h, e, t) { if (champTakedownLike(t)) { h.heal((e.p.heal + e.p.ap * h.ap) * (1 + h.hsp), 'item'); h.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 300, color: '#7dffa0', dur: 0.5 }); } },
};
FX.enlighten = {
  desc: p => '레벨이 오르면 3초 동안 최대 마나의 ' + pc(p.pct) + '를 회복합니다.',
  levelUp(h, e) { e.st.until = now(h) + 3; },
  tick(h, e, dt) { if (now(h) < (e.st.until || 0)) h.restoreResource(h.maxMana * e.p.pct / 3 * dt); },
};
FX.eternity = {
  unique: () => 'eternity',
  desc: p => '챔피언에게 받은 피해의 ' + pc(p.mana) + '를 마나로 회복하고, 스킬에 쓴 마나의 ' + pc(p.heal) + '만큼 체력을 회복합니다 (스킬당 최대 ' + p.cap + ').',
  damageTaken(h, e, src, dmg) { if (src && champLike(src) && h.resource === 'mana') h.restoreResource(dmg * e.p.mana); },
  abilityCast(h, e, key, recast, cost) { if (h.resource === 'mana' && cost > 0) h.heal(Math.min(e.p.cap, cost * e.p.heal), 'item'); },
};
FX.boardingParty = {
  desc: p => '주변(1050) 아군 공성·슈퍼 미니언이 방어력·마법 저항력을 ' + p.min + '~' + p.max + '(레벨 비례) 얻습니다.',
  tick(h, e, dt) {
    e.st.acc = (e.st.acc || 0) + dt;
    if (e.st.acc < 0.5) return;
    e.st.acc = 0;
    const bonus = lvlScale(h, e.p.min, e.p.max);
    for (const u of h.game.alliesInRadius(h.team, h.x, h.y, 1050, ['minion'])) {
      if (u.mtype === 'siege' || u.mtype === 'super') u.addTakenAmp('boarding', -(1 - 100 / (100 + bonus)), 0.6);
    }
  },
};

// ---------------- 사용 효과 ----------------
FX.stasis = {
  unique: () => 'stasis',
  desc: p => '<b>사용:</b> ' + p.dur + '초 동안 경직 상태가 되어 대상으로 지정할 수 없고 피해를 받지 않지만 행동할 수 없습니다.' + (p.once ? ' (한 번만 사용 가능)' : ' (재사용 대기시간 ' + p.cd + '초)'),
  cd: p => p.cd,
  use(h, e) {
    h.stasisT = e.p.dur;
    h.cancelWindup(); h.cancelRecall(); h.cancelChannel(); h.cmd = null; h.path = [];
    h.game.addEffect({ type: 'stasis', x: h.x, y: h.y, dur: e.p.dur, follow: h });
    return e.p.once ? 'transform:2421' : true;
  },
};
FX.quicksilver = {
  unique: () => 'quicksilver',
  desc: p => '<b>사용:</b> 모든 이동 방해 효과(에어본 제외)를 제거합니다' + (p.ms ? '. 2초 동안 이동 속도가 ' + pc(p.ms) + ' 증가하고 유체화됩니다' : '') + '. (재사용 대기시간 ' + p.cd + '초)',
  cd: p => p.cd,
  use(h, e) {
    h.cleanse();
    if (e.p.ms) { h.addHaste('mercurial', e.p.ms, 2); h.ghostT = 2; }
    h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 70, color: '#e0e8ff', dur: 0.4, follow: h });
    return true;
  },
};
FX.wraithStep = {
  desc: p => '<b>사용:</b> ' + p.dur + '초 동안 이동 속도가 ' + pc(p.ms) + ' 증가하고 유체화됩니다. (재사용 대기시간 ' + p.cd + '초)' + EST,
  cd: p => p.cd,
  use(h, e) { h.addHaste('youmuu', e.p.ms, e.p.dur); h.ghostT = e.p.dur; return true; },
};
FX.teamHaste = {
  desc: p => '<b>사용:</b> 자신과 주변(1000) 아군의 이동 속도가 ' + p.dur + '초 동안 ' + pc(p.ms) + ' 증가합니다. (재사용 대기시간 ' + p.cd + '초)' + EST,
  cd: p => p.cd,
  use(h, e) {
    for (const u of h.game.alliesInRadius(h.team, h.x, h.y, 1000, ['hero'])) u.addHaste('shurelya', e.p.ms, e.p.dur);
    h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 1000, color: '#9fe8ff', dur: 0.5 });
    return true;
  },
};
FX.humility = {
  desc: p => '<b>사용:</b> 주변(500) 적을 ' + p.dur + '초 동안 ' + pc(p.slow) + ' 둔화시킵니다. (재사용 대기시간 ' + p.cd + '초)' + EST,
  cd: p => p.cd,
  use(h, e) {
    for (const u of h.game.enemiesInRadius(h.team, h.x, h.y, 500)) h.game.applySlow(h, u, 'randuin', e.p.slow, e.p.dur);
    h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 500, color: '#c8c8c8', dur: 0.4 });
    return true;
  },
};
FX.devotion = {
  desc: p => '<b>사용:</b> 자신과 주변(850) 아군에게 2.5초에 걸쳐 감소하는 ' + p.shield[0] + '~' + p.shield[1] + '(레벨 비례)의 보호막을 씌웁니다. (재사용 대기시간 ' + p.cd + '초)' + EST,
  cd: p => p.cd,
  use(h, e) {
    const amt = lvlScale(h, e.p.shield[0], e.p.shield[1]) * (1 + h.hsp);
    for (const u of h.game.alliesInRadius(h.team, h.x, h.y, 850, ['hero'])) u.addShield('solari', amt, 2.5, { decay: true });
    h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 850, color: '#ffe38a', dur: 0.5 });
    return true;
  },
};
FX.intervention = {
  desc: p => '<b>사용:</b> 지정한 위치(최대 5500)에 2.5초 뒤 빛이 내려와 반경 550 안의 아군을 ' + p.heal[0] + '~' + p.heal[1] + ' 회복시키고, 적 챔피언에게 최대 체력의 ' + pc(p.champPct) + ' 고정 피해를 입힙니다. (재사용 대기시간 ' + p.cd + '초)' + EST,
  cd: p => p.cd,
  use(h, e, wx, wy) {
    if (dist(h.x, h.y, wx, wy) > 5500) { h.hint('사거리 밖입니다'); return false; }
    const amt = lvlScale(h, e.p.heal[0], e.p.heal[1]) * (1 + h.hsp);
    h.game.addZone({ x: wx, y: wy, r: 550, dur: 2.5, team: h.team, src: h, color: '#fff2a8' });
    h.game.later(2.5, () => {
      for (const u of h.game.alliesInRadius(h.team, wx, wy, 550, ['hero'])) u.heal(amt, 'item');
      for (const u of h.game.enemiesInRadius(h.team, wx, wy, 550)) if (champLike(u)) proc(h, u, Math.min(u.kind === 'hero' ? 1e9 : 400, u.maxHp * e.p.champPct), 'true', {});
      h.game.addEffect({ type: 'pulse', x: wx, y: wy, r: 550, color: '#fff2a8', dur: 0.5 });
    });
    return true;
  },
};
FX.actualizer = {
  desc: p => '<b>사용:</b> ' + p.dur + '초 동안 스킬 마나 소모량이 2배가 되지만 스킬 피해가 ' + pc(p.amp) + ' 증가하고 기본 스킬 재사용 대기시간이 ' + pc(p.cdRate) + ' 빠르게 돌아갑니다. (재사용 대기시간 ' + p.cd + '초)' + EST,
  cd: p => p.cd,
  use(h, e) { e.st.until = now(h) + e.p.dur; return true; },
  tick(h, e) { if (now(h) < (e.st.until || 0)) { h.costMult = 2; h.cdRate = 1 + e.p.cdRate; } },
  dmgAmp(h, e, t, opts) { return opts.ability && now(h) < (e.st.until || 0) ? e.p.amp : 0; },
};
FX.lightningBolt = {
  desc: p => '<b>사용:</b> 대상 적(사거리 ' + p.range + ')에게 ' + p.dmg + '(+주문력의 ' + pc(p.ap) + ')의 마법 피해를 입히고 ' + p.dur + '초 동안 ' + pc(p.slow) + ' 둔화시킵니다. (재사용 대기시간 ' + p.cd + '초)' + EST,
  cd: p => p.cd,
  use(h, e, wx, wy, hover) {
    const t = Spells.pickEnemy(h, wx, wy, hover, u => !u.isStructure);
    if (!t) { h.hint('대상이 없습니다'); return false; }
    if (h.edgeDist(t) > e.p.range) { h.hint('사거리 밖입니다'); return false; }
    proc(h, t, e.p.dmg + e.p.ap * h.ap, 'magic', {});
    h.game.applySlow(h, t, 'gunblade', e.p.slow, e.p.dur);
    h.game.addEffect({ type: 'bolt', x: h.x, y: h.y, x2: t.x, y2: t.y, dur: 0.25 });
    return true;
  },
};
FX.supersonic = {
  desc: p => '<b>사용:</b> 지정 방향으로 ' + p.dash + '만큼 돌진한 뒤 앞쪽에 로켓을 흩뿌려 ' + p.dmg + '(+주문력의 ' + pc(p.ap) + ')의 마법 피해를 입힙니다. (재사용 대기시간 ' + p.cd + '초)' + EST,
  cd: p => p.cd,
  use(h, e, wx, wy) {
    const d = dist(h.x, h.y, wx, wy) || 1;
    const ux = (wx - h.x) / d, uy = (wy - h.y) / d;
    let tx = h.x + ux * e.p.dash, ty = h.y + uy * e.p.dash;
    if (!Nav.isWalkable(tx, ty)) { const q = Nav.nearestWalkablePoint(tx, ty); tx = q.x; ty = q.y; }
    h.startDash({
      x: tx, y: ty, speed: 1500, onEnd: () => {
        const cx = h.x + ux * 220, cy = h.y + uy * 220;
        for (const u of h.game.enemiesInRadius(h.team, cx, cy, 260)) proc(h, u, e.p.dmg + e.p.ap * h.ap, 'magic', { aoe: true });
        h.game.addEffect({ type: 'pulse', x: cx, y: cy, r: 260, color: '#ff9f5a', dur: 0.35 });
      },
    });
    return true;
  },
};
