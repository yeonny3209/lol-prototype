// ===== 소환사 주문 =====
// 수치: LoL 공식 위키 (소환사의 협곡, 패치 16.18 기준)
const SPELL_INFO = {};
for (const s of LOL_DATA.spells) SPELL_INFO[s.key] = s;
const spellIcon = key => DD_CDN + DD_VER + '/img/spell/' + key + '.png';
const SPELL_ORDER = ['SummonerFlash', 'SummonerTeleport', 'SummonerDot', 'SummonerHeal', 'SummonerBarrier', 'SummonerExhaust', 'SummonerHaste', 'SummonerBoost', 'SummonerSmite'];
const lvl18 = (h, a, b) => a + (b - a) * clamp((h.level - 1) / 17, 0, 1);

const SPELL_DEFS = {
  SummonerFlash: {
    cd: () => 300,
    desc: () => '커서 방향으로 최대 425 거리를 순간이동합니다.',
    cast(h, slot, wx, wy) { h.blinkTo(wx, wy, 425); return true; },
  },
  SummonerHeal: {
    cd: () => 240,
    desc: h => '자신의 체력을 ' + Math.round(lvl18(h, 80, 346)) + '(80~346, 레벨 비례) 회복하고 1초 동안 이동 속도가 30% 증가합니다. 35초 안에 다시 회복을 받으면 효과가 절반입니다.',
    cast(h) {
      let amt = lvl18(h, 80, 346);
      if (h.game.time < (h.healedAt || -99) + 35) amt *= 0.5;
      h.healedAt = h.game.time;
      const got = h.heal(amt, 'spell');
      h.addHaste('healSpell', 0.3, 1);
      h.game.floatText(h.x, h.y - 50, '+' + Math.round(got), '#6dff8a', 20);
      h.game.addEffect({ type: 'heal', x: h.x, y: h.y, dur: 0.6, follow: h });
      return true;
    },
  },
  SummonerBarrier: {
    cd: () => 180,
    desc: h => '2.5초 동안 ' + Math.round(lvl18(h, 100, 502)) + '(100~502, 레벨 비례)의 피해를 흡수하는 보호막을 얻습니다.',
    cast(h) {
      h.addShield('barrier', lvl18(h, 100, 502.35), 2.5);
      h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 80, color: '#ffe38a', dur: 0.4, follow: h });
      return true;
    },
  },
  SummonerDot: {
    cd: () => 180, target: true, range: 600,
    desc: h => '대상 적(사거리 600)에게 5초에 걸쳐 ' + Math.round(lvl18(h, 70, 525)) + '(70~525)의 고정 피해를 입히고 40% 치유 감소를 적용합니다. <i class="est">※연습 규칙이 켜져 있으면 미니언·몬스터에게도 사용 가능</i>',
    valid: (h, u) => champLike(u),
    cast(h, slot, wx, wy, t) {
      h.game.addDot(h, t, 'ignite', { total: lvl18(h, 70, 525), dur: 5, tick: 1, type: 'true' });
      t.applyGrievous(0.4, 5);
      h.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 60, color: '#ff7a2e', dur: 0.4, follow: t });
      return true;
    },
  },
  SummonerExhaust: {
    cd: () => 240, target: true, range: 650,
    desc: () => '대상 적(사거리 650)을 3초 동안 40% 둔화시키고 입히는 피해를 35% 줄입니다. <i class="est">※연습 규칙이 켜져 있으면 미니언·몬스터에게도 사용 가능</i>',
    valid: (h, u) => champLike(u),
    cast(h, slot, wx, wy, t) {
      t.exhaustT = 3;
      h.game.applySlow(h, t, 'exhaust', 0.4, 3);
      h.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 60, color: '#b0a060', dur: 0.4, follow: t });
      return true;
    },
  },
  SummonerHaste: {
    cd: () => 240,
    desc: h => '10초 동안 이동 속도가 ' + pc(lvl18(h, 0.24, 0.5082)) + '(24~51%, 레벨 비례) 증가하고 유닛과 충돌하지 않습니다.',
    cast(h) { h.addHaste('ghost', lvl18(h, 0.24, 0.5082), 10); h.ghostT = 10; return true; },
  },
  SummonerBoost: {
    cd: () => 240,
    desc: () => '모든 이동 방해 효과(에어본 제외)와 점화·탈진을 제거하고 3초 동안 강인함 75%를 얻습니다.',
    cast(h) {
      h.cleanse();
      h.tenacityBoostT = h.game.time + 3;
      h.game.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 70, color: '#e0f4ff', dur: 0.4, follow: h });
      return true;
    },
  },
  SummonerTeleport: {
    cd: h => h.game.time >= 600 ? lvl18(h, 330, 240) : 300,
    targeting: true,
    desc: h => '3초 동안 정신을 집중한 뒤 아군 포탑·미니언·와드로 이동합니다. 10분 이후에는 강력 순간이동이 되어 재사용 대기시간이 330~240초로 바뀌고 도착 후 3초 동안 이동 속도가 50% 증가합니다.' +
      (h.questRewards && h.questRewards.topTp ? ' <b>탑 퀘스트 보상:</b> 도착하면 10초 동안 최대 체력의 35% 보호막을 얻습니다.' : ''),
    validTarget: (h, u) => u && u.alive && u.team === h.team && (u.kind === 'turret' || u.kind === 'minion' || u.kind === 'ward'),
  },
  SummonerSmite: {
    cd: () => 90, target: true, range: 500,
    desc: h => {
      const tier = h.smiteTier || 0;
      return ['몬스터 또는 미니언에게 600의 고정 피해를 입힙니다.', '<b>강화된 강타:</b> 몬스터·미니언에게 1000의 고정 피해를 입히고, 챔피언에게는 40 고정 피해와 2초 동안 20% 둔화를 줍니다.', '<b>원시의 강타:</b> 대상과 주변 몬스터에게 1400의 고정 피해를 입히고, 챔피언에게는 40 고정 피해와 2초 동안 20% 둔화를 줍니다.'][tier] +
        ' (최대 2회 충전, 충전 90초, 사용 간격 15초)';
    },
    valid: (h, u) => u.kind === 'monster' || u.kind === 'minion' || (u.kind === 'hero' && (h.smiteTier || 0) >= 1),
    cast(h, slot, wx, wy, t) {
      const tier = h.smiteTier || 0;
      const dmg = [600, 1000, 1400][tier];
      if (t.kind === 'hero') { h.game.dealDamage(h, t, 40, { type: 'true', proc: true }); h.game.applySlow(h, t, 'smite', 0.2, 2); }
      else {
        h.game.dealDamage(h, t, dmg, { type: 'true', proc: true });
        if (tier >= 2) for (const u of h.game.enemiesInRadius(h.team, t.x, t.y, 350)) if (u !== t && u.kind === 'monster') h.game.dealDamage(h, u, dmg, { type: 'true', proc: true, aoe: true });
      }
      h.game.addEffect({ type: 'smite', x: t.x, y: t.y, r: t.radius, dur: 0.45, tier });
      return true;
    },
  },
};

const Spells = {
  makeSlots(keys) {
    return keys.slice(0, 2).map(key => ({ key, cd: 0, charges: key === 'SummonerSmite' ? 1 : null, recharge: key === 'SummonerSmite' ? 90 : 0 }));
  },

  cooldown(h, slot) { return (slot.quest ? 420 : SPELL_DEFS[slot.key].cd(h)) * 100 / (100 + h.spellHaste); },

  tick(h, dt) {
    for (const s of h.spells) {
      if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
      if (s.key === 'SummonerSmite' && s.charges < 2) {
        s.recharge -= dt;
        if (s.recharge <= 0) { s.charges++; s.recharge = s.charges < 2 ? 90 * 100 / (100 + h.spellHaste) : 0; }
      }
    }
    if (h.hexflash && h.hexflash.cd > 0) h.hexflash.cd -= dt;
    if (h.tenacityBoostT && h.game.time > h.tenacityBoostT) { h.tenacityBoostT = 0; }
  },

  // 커서 아래 유닛, 없으면 커서 근처(250)의 가장 가까운 유효 대상
  pickEnemy(h, wx, wy, hover, valid) {
    const ok = u => u && u.alive && u.team !== h.team && h.game.isVulnerable(u) && h.game.isVisible(h.team, u) && (!valid || valid(u));
    if (ok(hover)) return hover;
    let best = null, bd = 250;
    for (const u of h.game.units) {
      if (!ok(u)) continue;
      const d = dist(wx, wy, u.x, u.y) - u.radius;
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  },

  ready(h, slot) {
    if (slot.key === 'SummonerSmite') return slot.charges > 0 && slot.cd <= 0;
    return slot.cd <= 0;
  },

  cast(h, i, wx, wy, hover) {
    const slot = h.spells[i];
    if (!slot) return false;
    const def = SPELL_DEFS[slot.key];
    if (!this.ready(h, slot)) {
      if (slot.key === 'SummonerFlash' && h.effectMap.has('r:8306')) return this.hexflash(h, wx, wy);
      return false;
    }
    let t = null;
    if (def.target) {
      t = this.pickEnemy(h, wx, wy, hover, u => !u.isStructure && def.valid(h, u));
      if (!t) { h.hint('대상이 없습니다'); return false; }
      if (h.edgeDist(t) > def.range) { h.hint('사거리 밖입니다'); return false; }
    }
    if (def.targeting) {
      if (h === h.game.player) { Input.beginTargeting({ type: 'teleport', slot: i }); UI.announce('순간이동할 아군 포탑·미니언·와드를 클릭하세요', 'info'); }
      return false;
    }
    if (!def.cast(h, slot, wx, wy, t)) return false;
    this.afterCast(h, slot);
    return true;
  },

  afterCast(h, slot) {
    if (slot.key === 'SummonerSmite') {
      slot.charges--;
      slot.cd = 15;
      if (slot.recharge <= 0) slot.recharge = 90 * 100 / (100 + h.spellHaste);
    } else {
      slot.cd = this.cooldown(h, slot);
    }
    h.fxEvent('spellCast', slot.key);
  },

  teleport(h, i, target) {
    const slot = h.spells[i];
    const def = SPELL_DEFS.SummonerTeleport;
    if (!slot || slot.key !== 'SummonerTeleport' || !this.ready(h, slot) || !h.alive) return false;
    if (!def.validTarget(h, target)) { h.hint('아군 포탑·미니언·와드를 선택하세요'); return false; }
    const unleashed = h.game.time >= 600;
    h.startChannel('순간이동', 3, () => {
      if (!target.alive && target.kind !== 'turret') { slot.cd = 60; return; }
      const dir = DIR16[Math.floor(rng() * 16)];
      const p = Nav.nearestWalkablePoint(target.x + dir[0] * ((target.radius || 20) + 60), target.y + dir[1] * ((target.radius || 20) + 60));
      h.game.addEffect({ type: 'flash', x: h.x, y: h.y, dur: 0.5 });
      h.x = p.x; h.y = p.y;
      h.game.addEffect({ type: 'flash', x: h.x, y: h.y, dur: 0.5 });
      if (unleashed) h.addHaste('teleport', 0.5, 3);
      if (h.questRewards && h.questRewards.topTp) h.addShield('empoweredTp', h.maxHp * 0.35, 10);
      if (h === h.game.player) h.game.centerCamera();
      this.afterCast(h, slot);
    }, () => { slot.cd = Math.max(slot.cd, 20); });
    h.channel.target = target;
    return true;
  },

  // 봉인 풀린 주문서 룬: 전투 밖에서 소환사 주문 교체
  swapBook(h, i, key) {
    const g = h.game;
    if (!h.effectMap.has('r:8360') || g.time < 360 || h.inCombat()) return false;
    const sb = h.spellbook || (h.spellbook = { cd: 0, used: [] });
    if (g.time < sb.cd || !SPELL_DEFS[key] || !h.spells[i] || h.spells.some(s => s.key === key)) return false;
    if (!sb.used.includes(key)) sb.used.push(key);
    h.spells[i] = { key, cd: 0, charges: key === 'SummonerSmite' ? 1 : null, recharge: key === 'SummonerSmite' ? 90 : 0 };
    sb.cd = g.time + Math.max(60, 300 - 25 * sb.used.length);
    return true;
  },

  // 마법공학 점멸기 룬: 점멸이 재사용 대기 중일 때 2초 정신 집중 후 도약
  hexflash(h, wx, wy) {
    h.hexflash = h.hexflash || { cd: 0 };
    if (h.hexflash.cd > 0) return false;
    const tx = wx, ty = wy;
    h.startChannel('마법공학 점멸', 2, () => {
      h.blinkTo(tx, ty, 650);
      h.hexflash.cd = h.inChampCombat() ? 10 : 20;
      h.fxEvent('spellCast', 'Hexflash');
    });
    return true;
  },
};
