// ===== 챔피언: 리 신 (정글 · 전사) =====
// 수치 출처: 나무위키 「리 신」 문서 (체력 재생은 5초당 수치를 초당으로, 기력 재생 50/5초 = 10/초)
// 문서에 없어서 정한 값: Q 투사체 속도 1800·폭 60, 돌진 속도 1350, R 넥백 시간 0.75초

const LEESIN_BASE = {
  id: 'leesin', name: '리 신', title: '맹목의 수도승', role: '정글 · 전사', icon: '🥋', portrait: 'LeeSin', order: 2,
  resource: 'energy', energy: 200, energyRegen: 10, adaptive: 'ad', defaultRole: 'jungle',
  recSpells: ['SummonerFlash', 'SummonerSmite'],
  recommended: ['1102', '2003', '3047', '6692', '3071', '6333', '3053', '6610', '3111'],
  hp: 645, hpPerLvl: 108,
  hpRegen: 7.5 / 5, hpRegenPerLvl: 0.7 / 5,
  ad: 66, adPerLvl: 3.4,
  as: 0.651, asPerLvl: 0.03,
  armor: 36, armorPerLvl: 4.5,
  mr: 32, mrPerLvl: 2.05,
  ms: 345,
  range: 125,
  projSpeed: 0,
  radius: 32,
  sight: 1200,
  windup: 0.25,
};

const LEE = {
  P: { as: 0.4, hits: 2, dur: 3 },
  Q: { range: 1200, speed: 1800, width: 60, mark: 3, dmg: [60, 90, 120, 150, 180], bonusAd: 0.9, dash: 1350 },
  W: { range: 700, shield: [60, 105, 150, 195, 240], ap: 0.8, shieldDur: 2, vamp: [0.10, 0.14, 0.18, 0.22, 0.26], vampDur: 4, window: 3, dash: 1350 },
  E: { radius: 450, dmg: [35, 60, 85, 110, 135], ad: 0.9, window: 3, slow: [0.35, 0.45, 0.55, 0.65, 0.75], slowDur: 4, range2: 600 },
  R: { range: 375, dmg: [175, 400, 625], bonusAd: 2.0, hpPct: [0.12, 0.15, 0.18], knock: 1200, knockDur: 0.75, air: 1 },
};
const leeEnergy = lvl => lvl >= 13 ? 40 : lvl >= 7 ? 30 : 20;
const leeLv = (arr, l, f = v => v) => arr.map((v, i) => i === l - 1 ? '<u>' + f(v) + '</u>' : f(v)).join('/');

const LEESIN_ABILITIES = {
  P: {
    name: '질풍격', icon: '👊',
    desc: h => '스킬을 사용하면 3초 동안 다음 기본 공격 2회의 공격 속도가 40% 증가합니다. 첫 번째 공격은 기력을 <b>' + leeEnergy(h.level) + '</b>(20/30/40, 1·7·13레벨), 두 번째 공격은 그 절반을 회복합니다.',
  },
  Q: {
    name: '음파 / 공명의 일격', icon: '🌀', maxLvl: 5, cost: [50, 50, 50, 50, 50], cd: [10, 9, 8, 7, 6],
    desc: (h, l) => '<u>음파</u>: 지정 방향(최대 ' + LEE.Q.range + ')으로 음파를 날려 처음 맞은 적에게 <b>' + Math.round(LEE.Q.dmg[l - 1] + LEE.Q.bonusAd * h.bonusAd) + '</b>(' + leeLv(LEE.Q.dmg, l) + ' + 추가 공격력의 90%)의 물리 피해를 입히고 3초 동안 표식을 남깁니다.<br>' +
      '<u>공명의 일격</u> (기력 25): 표식이 남은 적에게 돌진해 같은 피해를 입히며, 대상이 잃은 체력에 비례해 최대 2배까지 증가합니다.',
  },
  W: {
    name: '방호 / 강철의 의지', icon: '🛡️', maxLvl: 5, cost: [50, 50, 50, 50, 50], cd: [7, 7, 7, 7, 7],
    desc: (h, l) => '<u>방호</u>: 마우스 아래의 아군 유닛·와드(최대 ' + LEE.W.range + ')로 돌진합니다. 자신이나 아군 챔피언이 대상이면 2초 동안 <b>' + Math.round(LEE.W.shield[l - 1] + LEE.W.ap * h.ap) + '</b>(' + leeLv(LEE.W.shield, l) + ' + 주문력의 80%)의 보호막을 얻습니다. 대상이 없으면 자신에게 씁니다.<br>' +
      '<u>강철의 의지</u> (기력 25): 4초 동안 모든 피해 흡혈 ' + leeLv(LEE.W.vamp, l, pc) + '를 얻습니다.',
  },
  E: {
    name: '폭풍 / 무력화', icon: '💨', maxLvl: 5, cost: [50, 50, 50, 50, 50], cd: [8, 8, 8, 8, 8],
    desc: (h, l) => '<u>폭풍</u>: 주변(' + LEE.E.radius + ') 적에게 <b>' + Math.round(LEE.E.dmg[l - 1] + LEE.E.ad * h.ad) + '</b>(' + leeLv(LEE.E.dmg, l) + ' + 공격력의 90%)의 마법 피해를 입힙니다.<br>' +
      '<u>무력화</u> (기력 25): 폭풍에 맞은 적(' + LEE.E.range2 + ' 안)을 ' + leeLv(LEE.E.slow, l, pc) + ' 둔화시키며, 둔화는 4초에 걸쳐 사라집니다.',
  },
  R: {
    name: '용의 분노', icon: '🐉', maxLvl: 3, cost: [0, 0, 0], cd: [110, 85, 60],
    desc: (h, l) => '대상 적(사거리 ' + LEE.R.range + ')을 걷어차 <b>' + Math.round(LEE.R.dmg[l - 1] + LEE.R.bonusAd * h.bonusAd) + '</b>(' + leeLv(LEE.R.dmg, l) + ' + 추가 공격력의 200%)의 물리 피해를 입히고 ' + LEE.R.knock + ' 거리만큼 날려 보냅니다. ' +
      '날아가는 대상과 부딪힌 적은 같은 피해 + 최초 대상 추가 체력의 ' + leeLv(LEE.R.hpPct, l, pc) + '를 받고 1초 동안 공중에 뜹니다. (용·공허의 군주는 날아가지 않음)',
  },
};

// 패시브 · 강철의 의지는 매 틱 스탯을 바꾸므로 효과로 등록
const LEESIN_FX = {
  abilityCast(h, e) { e.st.hits = LEE.P.hits; e.st.until = h.game.time + LEE.P.dur; },
  tick(h, e) {
    if (e.st.hits > 0 && h.game.time < e.st.until) h.dynAs += LEE.P.as; else e.st.hits = 0;
    if (h.game.time < (h.wVampUntil || 0)) h.omnivampDyn += h.wVampPct;
  },
  hit(h, e) {
    if (!(e.st.hits > 0) || h.game.time > e.st.until) return;
    h.restoreResource(e.st.hits === 2 ? leeEnergy(h.level) : leeEnergy(h.level) / 2);
    e.st.hits--;
  },
};

class LeeSin extends Hero {
  constructor(game, team, setup) {
    super(game, team, LEESIN_BASE, setup);
    this.abilityDefs = LEESIN_ABILITIES;
    this.qMark = null;     // { target, until }
    this.wWindow = 0;
    this.eWindow = null;   // { until, hits }
    this.kick = null;
    this.extraFx.push({ key: 'leePassive', tpl: LEESIN_FX, p: {} });
    this.recalcStats();
  }

  abilityRecast(key) {
    const t = this.game.time;
    if (key === 'Q' && this.qMark && t < this.qMark.until && this.qMark.target.alive) return { cost: 25 };
    if (key === 'W' && this.wWindow && t < this.wWindow) return { cost: 25 };
    if (key === 'E' && this.eWindow && t < this.eWindow.until) return { cost: 25 };
    return null;
  }

  // ---------- Q ----------
  castQ(lvl, wx, wy, hover, recast) {
    const g = this.game;
    if (recast) {
      const t = this.qMark.target;
      this.qMark = null;
      this.startDash({
        target: t, speed: LEE.Q.dash, stopDist: this.radius + t.radius, maxT: 1.5,
        onEnd: () => {
          if (t.alive && dist(this.x, this.y, t.x, t.y) < this.radius + t.radius + 80) {
            const base = LEE.Q.dmg[lvl - 1] + LEE.Q.bonusAd * this.bonusAd;
            g.dealDamage(this, t, base * (1 + (1 - t.hp / t.maxHp)), { type: 'physical', ability: true });
            g.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 80, color: '#ffe27a', dur: 0.35 });
          }
        },
      });
      this.startCd('Q');
      return true;
    }
    if (this.qFlying) return false;
    const d = dist(this.x, this.y, wx, wy) || 1;
    this.facing = Math.atan2(wy - this.y, wx - this.x);
    this.qFlying = true;
    g.addSkillShot(new SkillShot(g, this, this.x, this.y, this.x + (wx - this.x) / d * LEE.Q.range, this.y + (wy - this.y) / d * LEE.Q.range, {
      range: LEE.Q.range, speed: LEE.Q.speed, width: LEE.Q.width, color: '#ffe27a',
      onHit: u => {
        this.qFlying = false;
        g.dealDamage(this, u, LEE.Q.dmg[lvl - 1] + LEE.Q.bonusAd * this.bonusAd, { type: 'physical', ability: true });
        if (u.alive) this.qMark = { target: u, until: g.time + LEE.Q.mark };
        else this.startCd('Q');
      },
      onEnd: () => { this.qFlying = false; this.startCd('Q'); },
    }));
    return 'noCd';
  }

  // ---------- W ----------
  castW(lvl, wx, wy, hover, recast) {
    const g = this.game;
    if (recast) {
      this.wWindow = 0;
      this.wVampUntil = g.time + LEE.W.vampDur;
      this.wVampPct = LEE.W.vamp[lvl - 1];
      g.addEffect({ type: 'pulse', x: this.x, y: this.y, r: 60, color: '#ffcf5a', dur: 0.4, follow: this });
      this.startCd('W');
      return true;
    }
    const ok = u => u && u.alive && u.team === this.team && (u.kind === 'hero' || u.kind === 'minion' || u.kind === 'ward') && dist(this.x, this.y, u.x, u.y) <= LEE.W.range + (u.radius || 0);
    let t = ok(hover) ? hover : null;
    if (!t) {
      let bd = 120;
      for (const u of g.units.concat(g.wards)) {
        if (!ok(u) || u === this) continue;
        const dd = dist(wx, wy, u.x, u.y);
        if (dd < bd) { bd = dd; t = u; }
      }
    }
    if (!t) t = this;
    const shieldAmt = (LEE.W.shield[lvl - 1] + LEE.W.ap * this.ap) * (1 + this.hsp);
    const applyShield = () => {
      if (t.kind === 'hero') {
        this.addShield('leeW', shieldAmt, LEE.W.shieldDur);
        if (t !== this) t.addShield('leeW', shieldAmt, LEE.W.shieldDur);
      }
    };
    if (t === this) applyShield();
    else this.startDash({ target: t, speed: LEE.W.dash, stopDist: this.radius + (t.radius || 20), maxT: 1, onEnd: applyShield });
    this.wWindow = g.time + LEE.W.window;
    return 'noCd';
  }

  // ---------- E ----------
  castE(lvl, wx, wy, hover, recast) {
    const g = this.game;
    if (recast) {
      for (const u of this.eWindow.hits) {
        if (!u.alive || dist(this.x, this.y, u.x, u.y) > LEE.E.range2 + u.radius) continue;
        g.applySlow(this, u, 'leeE', LEE.E.slow[lvl - 1], LEE.E.slowDur, true);
      }
      this.eWindow = null;
      g.addEffect({ type: 'pulse', x: this.x, y: this.y, r: LEE.E.range2, color: '#8fd8ff', dur: 0.35 });
      this.startCd('E');
      return true;
    }
    const hits = g.enemiesInRadius(this.team, this.x, this.y, LEE.E.radius);
    const dmg = LEE.E.dmg[lvl - 1] + LEE.E.ad * this.ad;
    for (const u of hits) g.dealDamage(this, u, dmg, { type: 'magic', ability: true, aoe: hits.length > 1 });
    g.addEffect({ type: 'shockwave', x: this.x, y: this.y, r: LEE.E.radius, dur: 0.4 });
    if (!hits.length) return true;
    this.eWindow = { until: g.time + LEE.E.window, hits };
    return 'noCd';
  }

  // ---------- R ----------
  castR(lvl, wx, wy, hover) {
    const g = this.game;
    const t = Spells.pickEnemy(this, wx, wy, hover, u => !u.isStructure);
    if (!t) { this.hint('대상이 없습니다'); return false; }
    if (this.edgeDist(t) > LEE.R.range) { this.hint('사거리 밖입니다'); return false; }
    const dmg = LEE.R.dmg[lvl - 1] + LEE.R.bonusAd * this.bonusAd;
    const extra = LEE.R.hpPct[lvl - 1] * (t.bonusHp || 0);
    this.facing = Math.atan2(t.y - this.y, t.x - this.x);
    this.attackAnim = 0.3;
    g.dealDamage(this, t, dmg, { type: 'physical', ability: true, ult: true });
    g.addEffect({ type: 'kick', x: t.x, y: t.y, dur: 0.4, a: this.facing });
    if (!t.alive || t.ccImmune) return true;
    const dx = t.x - this.x, dy = t.y - this.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / d, uy = dy / d;
    let k = LEE.R.knock;
    for (let s = 25; s <= LEE.R.knock; s += 25) if (!Nav.isWalkable(t.x + ux * s, t.y + uy * s)) { k = s - 25; break; }
    const hit = new Set([t.id]);
    g.applyKnock(this, t, t.x + ux * k, t.y + uy * k, LEE.R.knockDur, 25, {
      src: this,
      onStep: u => {
        for (const v of g.enemiesInRadius(this.team, u.x, u.y, u.radius + 20)) {
          if (hit.has(v.id)) continue;
          hit.add(v.id);
          g.dealDamage(this, v, dmg + extra, { type: 'physical', ability: true, ult: true, aoe: true });
          if (v.alive) g.applyKnock(this, v, v.x, v.y, LEE.R.air, 60);
          g.addEffect({ type: 'pulse', x: v.x, y: v.y, r: 70, color: '#ffb347', dur: 0.3 });
        }
      },
    });
    this.kick = { target: t, until: g.time + LEE.R.knockDur };
    return true;
  }

  championTick(dt) {
    const t = this.game.time;
    if (this.qMark && (t >= this.qMark.until || !this.qMark.target.alive)) { this.qMark = null; this.startCd('Q'); }
    if (this.wWindow && t >= this.wWindow) { this.wWindow = 0; this.startCd('W'); }
    if (this.eWindow && t >= this.eWindow.until) { this.eWindow = null; this.startCd('E'); }
    if (this.kick && t > this.kick.until) this.kick = null;
  }

  onDeathHook() {
    this.qMark = null;
    if (this.wWindow) { this.wWindow = 0; this.startCd('W'); }
    if (this.eWindow) { this.eWindow = null; this.startCd('E'); }
  }

  // 재시전 가능 여부 (HUD 표시용)
  recastReady(key) { return !!this.abilityRecast(key); }

  // ---------- 그리기 ----------
  drawBody(ctx, R, game) {
    const x = this.x, y = this.y, r = this.radius, a = this.facing, t = game.time;
    R.shadow(ctx, this);
    R.circle(ctx, x, y, r + 5, TEAM_COLOR[this.team]);
    // 어깨와 팔
    const punch = this.attackAnim > 0 ? 14 : 0;
    for (const side of [-1, 1]) {
      const ang = a + side * 0.7;
      const reach = side === (Math.floor(t * 2) % 2 ? 1 : -1) ? punch : 0;
      const fx = x + Math.cos(a) * (r * 0.55 + reach) + Math.cos(ang) * r * 0.55;
      const fy = y + Math.sin(a) * (r * 0.55 + reach) + Math.sin(ang) * r * 0.55;
      ctx.strokeStyle = '#c88a5c'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.6); ctx.lineTo(fx, fy); ctx.stroke();
      R.circle(ctx, fx, fy, 6.5, '#e8b07a', '#7a4a2a', 2);
    }
    R.circle(ctx, x, y, r, '#3a3d4a', '#1d1f26', 3);
    R.circle(ctx, x, y, r * 0.62, '#e3ad7d', '#9a6a44', 2);
    // 붉은 머리띠와 뒤로 날리는 끈
    ctx.strokeStyle = '#d8342c'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, r * 0.5, a - 1.3, a + 1.3); ctx.stroke();
    const back = a + Math.PI;
    ctx.lineWidth = 4;
    for (const off of [-0.25, 0.25]) {
      const wave = Math.sin(t * 9 + off * 10) * 6;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(back) * r * 0.45, y + Math.sin(back) * r * 0.45);
      ctx.quadraticCurveTo(x + Math.cos(back + off) * r * 1.1 + wave, y + Math.sin(back + off) * r * 1.1 - wave, x + Math.cos(back + off * 1.8) * r * 1.6, y + Math.sin(back + off * 1.8) * r * 1.6);
      ctx.stroke();
    }
  }

  drawOver(ctx, R, game) {
    if (this.qMark && this.qMark.target.alive) {
      const u = this.qMark.target, k = (this.qMark.until - game.time) / LEE.Q.mark;
      ctx.strokeStyle = 'rgba(255,226,122,' + (0.5 + 0.4 * Math.sin(game.time * 10)).toFixed(2) + ')';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(u.x, u.y, u.radius + 16, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
      ctx.fillStyle = '#ffe27a'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('〰', u.x, u.y - u.radius - 30);
    }
    if (this.eWindow && this === game.player) {
      ctx.strokeStyle = 'rgba(143,216,255,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, LEE.E.range2, 0, TAU); ctx.stroke();
    }
    if (game.time < (this.wVampUntil || 0)) {
      ctx.strokeStyle = 'rgba(255,207,90,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 10 + Math.sin(game.time * 8) * 3, 0, TAU); ctx.stroke();
    }
  }

  drawAbilityRange(ctx, key) {
    const r = { Q: LEE.Q.range, W: LEE.W.range, E: LEE.E.radius, R: LEE.R.range }[key];
    ctx.fillStyle = 'rgba(255,226,122,0.07)';
    ctx.strokeStyle = 'rgba(255,226,122,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(this.x, this.y, r + this.radius, 0, TAU); ctx.fill(); ctx.stroke();
  }
}

CHAMPIONS.leesin = { base: LEESIN_BASE, create: (game, team, setup) => new LeeSin(game, team, setup) };
