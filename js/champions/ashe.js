// ===== 챔피언: 애쉬 (원딜 · 궁수) =====
// 수치 출처: 나무위키 「애쉬(리그 오브 레전드)」 문서 + 라이엇 Data Dragon 16.18.1 교차 검증
//   (체력/마나 재생은 5초당 수치를 초당으로 환산. Data Dragon은 모든 챔피언의 '레벨당 공격력'이
//    0으로 기록되는 데이터 누락이 있어, 레벨당 공격력만 나무위키 값 +3.5를 사용했습니다.)
// 문서에 없어서 정한 값: 일제 사격 부채꼴 60°·투사체 속도 1500·폭 40,
//   마법의 수정화살 투사체 속도 1600·폭 120, 기절 최대치까지의 비행 거리 1750
//   (이 맵은 실제 협곡보다 좁아 실제 값의 0.7배로 환산), 매 비행 속도 1600.

const ASHE_BASE = {
  id: 'ashe', name: '애쉬', title: '서리 궁수', role: '원딜 · 궁수', icon: '🏹', portrait: 'Ashe', order: 3,
  resource: 'mana', adaptive: 'ad', defaultRole: 'bot',
  recSpells: ['SummonerFlash', 'SummonerHeal'],
  recommended: ['1055', '2003', '6672', '3006', '3031', '3085', '3072', '3036'],
  hp: 610, hpPerLvl: 101,
  mana: 280, manaPerLvl: 35,
  hpRegen: 3.5 / 5, hpRegenPerLvl: 0.55 / 5,
  manaRegen: 7 / 5, manaRegenPerLvl: 0.65 / 5,
  ad: 59, adPerLvl: 3.5,
  as: 0.658, asPerLvl: 0.03,
  armor: 26, armorPerLvl: 4.6,
  mr: 33, mrPerLvl: 1.1,
  ms: 325,
  range: 600,
  projSpeed: 1600,
  radius: 28,
  sight: 1200,
  windup: 0.22,
};

const ASHE = {
  P: { dur: 2 },
  Q: { stacks: 4, stackDur: 4, dur: 6, arrows: 5, as: [0.20, 0.30, 0.40, 0.50, 0.60], flurry: [1.10, 1.15, 1.20, 1.25, 1.30] },
  W: { range: 1200, speed: 1500, width: 40, half: 30 * Math.PI / 180, arrows: [7, 8, 9, 10, 11], dmg: [60, 95, 130, 165, 200], bonusAd: 1.0 },
  E: { charges: 2, recharge: [90, 80, 70, 60, 50], speed: 1600, vision: 5, sight: 1000 },
  R: { range: 12000, speed: 1600, width: 120, dmg: [200, 400, 600], ap: 1.2, stunMin: 1, stunMax: 3.5, stunDist: 1750, aoe: 250, aoePct: 0.5 },
};

// 서리 화살 둔화: 1/4/7/10/13/16레벨마다 증가 (기본 20~30%, 치명타 40~60%)
const asheSlow = lvl => 0.20 + 0.02 * Math.floor((lvl - 1) / 3);
const asheCritSlow = lvl => 0.40 + 0.04 * Math.floor((lvl - 1) / 3);
const asheLv = (arr, l, f = v => v) => arr.map((v, i) => i === l - 1 ? '<u>' + f(v) + '</u>' : f(v)).join('/');
// 치명타 확률을 추가 피해로 바꾼 양 (치명타 확률 100% = 공격력의 100%)
const asheCritDmg = h => h.ad * h.crit * (1 + h.critDmg);

// 일제 사격 부채꼴 방향. 삼각함수 결과를 반올림해 두 컴퓨터에서 같은 값이 나오게 합니다 (1대1 동기화)
const ASHE_CONE = ASHE.W.arrows.map(n => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = -ASHE.W.half + 2 * ASHE.W.half * i / (n - 1);
    out.push([Math.round(Math.cos(a) * 1e6) / 1e6, Math.round(Math.sin(a) * 1e6) / 1e6]);
  }
  return out;
});

const ASHE_ABILITIES = {
  P: {
    name: '서리 화살', icon: '❄️',
    desc: h => '기본 공격과 일제 사격이 대상을 <b>' + pc(asheSlow(h.level)) + '</b>(20~30%) 둔화시킵니다 (' + ASHE.P.dur + '초).<br>' +
      '애쉬의 치명타는 추가 피해를 입히지 않는 대신 <b>' + pc(asheCritSlow(h.level)) + '</b>(40~60%)로 더 강하게 둔화시키며, ' +
      '그 대신 치명타 확률 1%마다 기본 공격이 공격력의 1%만큼 추가 물리 피해를 입힙니다 (현재 <b>+' + Math.round(asheCritDmg(h)) + '</b>).',
  },
  Q: {
    name: '궁사의 집중', icon: '🎯', maxLvl: 5, cost: [30, 30, 30, 30, 30], cd: [0, 0, 0, 0, 0],
    desc: (h, l) => '<u>기본 지속 효과</u>: 기본 공격 시 ' + ASHE.Q.stackDur + '초 동안 유지되는 집중이 1중첩 쌓입니다 (최대 ' + ASHE.Q.stacks + '중첩). ' +
      '현재 <b>' + h.focus + '</b>중첩.<br>' +
      '<u>사용 시</u> (집중 ' + ASHE.Q.stacks + '중첩 필요): ' + ASHE.Q.dur + '초 동안 공격 속도가 <b>' + pc(ASHE.Q.as[l - 1]) + '</b>(' + asheLv(ASHE.Q.as, l, pc) + ') 증가하고, ' +
      '기본 공격이 화살 ' + ASHE.Q.arrows + '발을 연달아 쏴 합쳐서 공격력의 <b>' + pc(ASHE.Q.flurry[l - 1]) + '</b>(' + asheLv(ASHE.Q.flurry, l, pc) + ')만큼 피해를 입힙니다.',
  },
  W: {
    name: '일제 사격', icon: '🏹', maxLvl: 5, cost: [75, 70, 65, 60, 55], cd: [18, 14.5, 11, 7.5, 4],
    desc: (h, l) => '부채꼴로 화살 <b>' + ASHE.W.arrows[l - 1] + '</b>발(' + asheLv(ASHE.W.arrows, l) + ')을 쏘아 각각 <b>' +
      Math.round(ASHE.W.dmg[l - 1] + ASHE.W.bonusAd * h.bonusAd) + '</b>(' + asheLv(ASHE.W.dmg, l) + ' + 추가 공격력의 100%)의 물리 피해를 입히고 서리 화살로 둔화시킵니다. ' +
      '한 대상은 여러 화살에 맞아도 첫 화살에만 피해를 입습니다. 사거리 ' + ASHE.W.range + '.',
  },
  E: {
    name: '매 날리기', icon: '🦅', maxLvl: 5, cost: [0, 0, 0, 0, 0], cd: [0, 0, 0, 0, 0],
    desc: (h, l) => '매를 지정한 곳으로 날려 지나가는 길과 도착 지점의 시야를 ' + ASHE.E.vision + '초 동안 밝힙니다 (맵 전 지역, 시야 ' + ASHE.E.sight + ').<br>' +
      '충전 ' + ASHE.E.charges + '회까지 모아 둘 수 있고, 재충전에 <b>' + ASHE.E.recharge[l - 1] + '초</b>(' + asheLv(ASHE.E.recharge, l) + ')가 걸립니다. ' +
      '현재 충전 <b>' + h.hawkCharges + ' / ' + ASHE.E.charges + '</b>.',
  },
  R: {
    name: '마법의 수정화살', icon: '💠', maxLvl: 3, cost: [100, 100, 100], cd: [100, 80, 60],
    desc: (h, l) => '얼음 화살을 맵 전 지역으로 날려 처음 맞은 <u>적 챔피언</u>에게 <b>' + Math.round(ASHE.R.dmg[l - 1] + ASHE.R.ap * h.ap) + '</b>(' +
      asheLv(ASHE.R.dmg, l) + ' + 주문력의 120%)의 마법 피해를 입히고 <b>' + ASHE.R.stunMin + '~' + ASHE.R.stunMax + '초</b> 기절시킵니다 (멀리 날아갈수록 길어짐).<br>' +
      '주변 ' + ASHE.R.aoe + ' 안의 적은 절반의 피해를 입고 서리 화살로 둔화됩니다. 화살은 미니언을 통과합니다.' +
      (CFG.PRACTICE_CHAMP_EFFECTS ? '<br><i class="est">※연습 규칙이 켜져 있어 미니언·몬스터도 맞습니다</i>' : ''),
  },
};

// 서리 화살(패시브)과 궁사의 집중은 매 틱·매 공격마다 작동하므로 효과로 등록
const ASHE_FX = {
  tick(h, e) {
    if (h.game.time < h.qUntil) h.dynAs += ASHE.Q.as[Math.max(1, h.abilities.Q.lvl) - 1];
    if (h.focus > 0 && h.game.time > h.focusUntil) h.focus = 0;
  },
  preHit(h, e, t, ctx) {
    if (ctx.onHitOnly) return;
    e.st.crit = ctx.crit;                  // 둔화 세기를 정하는 데만 사용
    ctx.crit = false;                      // 애쉬의 치명타는 추가 피해를 입히지 않음
    if (h.crit > 0) ctx.bonus.push({ amt: asheCritDmg(h), type: 'physical', lifestealable: true });
    if (h.game.time < h.qUntil) ctx.mult *= ASHE.Q.flurry[Math.max(1, h.abilities.Q.lvl) - 1];
  },
  hit(h, e, t) {
    h.frostShot(t, !!e.st.crit);
    h.focus = Math.min(ASHE.Q.stacks, h.focus + 1);
    h.focusUntil = h.game.time + ASHE.Q.stackDur;
  },
};

class Ashe extends Hero {
  constructor(game, team, setup) {
    super(game, team, ASHE_BASE, setup);
    this.abilityDefs = ASHE_ABILITIES;
    this.focus = 0;            // 궁사의 집중 중첩
    this.focusUntil = 0;
    this.qUntil = 0;           // 궁사의 집중 지속 종료 시각
    this.hawkCharges = ASHE.E.charges;
    this.hawkRecharge = 0;
    this.hawk = null;          // 날아가는 중인 매
    this.extraFx.push({ key: 'asheFrost', tpl: ASHE_FX, p: {} });
    this.recalcStats();
  }

  projStyle() { return { color: '#9fe6ff', size: 6, glow: true }; }

  // 서리 화살 둔화
  frostShot(t, crit) {
    if (!t || !t.alive || t.isStructure) return;
    this.game.applySlow(this, t, 'asheFrost', crit ? asheCritSlow(this.level) : asheSlow(this.level), ASHE.P.dur, true);
  }

  // ---------- Q: 궁사의 집중 ----------
  castQ(lvl) {
    if (this.focus < ASHE.Q.stacks) { this.hint('집중 ' + ASHE.Q.stacks + '중첩이 필요합니다 (현재 ' + this.focus + ')'); return false; }
    this.focus = 0;
    this.qUntil = this.game.time + ASHE.Q.dur;
    this.game.addEffect({ type: 'pulse', x: this.x, y: this.y, r: 70, color: '#9fe6ff', dur: 0.45, follow: this });
    return true;
  }

  // ---------- W: 일제 사격 ----------
  castW(lvl, wx, wy) {
    const g = this.game;
    const d = dist(this.x, this.y, wx, wy) || 1;
    const ux = (wx - this.x) / d, uy = (wy - this.y) / d;
    this.facing = Math.atan2(wy - this.y, wx - this.x);
    this.attackAnim = 0.25;
    const dmg = ASHE.W.dmg[lvl - 1] + ASHE.W.bonusAd * this.bonusAd;
    const hit = new Set();                 // 한 대상은 첫 화살에만 피해
    for (const [c, s] of ASHE_CONE[lvl - 1]) {
      const dx = ux * c - uy * s, dy = ux * s + uy * c;
      g.addSkillShot(new SkillShot(g, this, this.x, this.y, this.x + dx * ASHE.W.range, this.y + dy * ASHE.W.range, {
        range: ASHE.W.range, speed: ASHE.W.speed, width: ASHE.W.width, color: '#9fe6ff',
        onHit: u => {
          if (hit.has(u.id)) return;
          hit.add(u.id);
          g.dealDamage(this, u, dmg, { type: 'physical', ability: true, aoe: true });
          this.frostShot(u, false);
        },
      }));
    }
    return true;
  }

  // ---------- E: 매 날리기 ----------
  castE(lvl, wx, wy) {
    const g = this.game;
    if (this.hawkCharges <= 0) { this.hint('매 충전이 없습니다'); return false; }
    if (this.hawk) { this.hint('매가 이미 날아가는 중입니다'); return false; }
    this.hawkCharges--;
    if (this.hawkRecharge <= 0) this.hawkRecharge = ASHE.E.recharge[lvl - 1];
    const w = new Ward(g, this, this.x, this.y, 'hawk', 999);
    w.sight = ASHE.E.sight;
    w.name = '매';
    g.wards.push(w);
    this.hawk = { w, tx: wx, ty: wy };
    return true;
  }

  // ---------- R: 마법의 수정화살 ----------
  castR(lvl, wx, wy) {
    const g = this.game;
    const d = dist(this.x, this.y, wx, wy) || 1;
    const sx = this.x, sy = this.y;
    this.facing = Math.atan2(wy - this.y, wx - this.x);
    const dmg = ASHE.R.dmg[lvl - 1] + ASHE.R.ap * this.ap;
    g.addSkillShot(new SkillShot(g, this, sx, sy, sx + (wx - sx) / d * ASHE.R.range, sy + (wy - sy) / d * ASHE.R.range, {
      range: ASHE.R.range, speed: ASHE.R.speed, width: ASHE.R.width, color: '#7fd3ff',
      // 챔피언에게만 맞습니다 (연습 규칙이 켜져 있으면 미니언·몬스터도 대상)
      filter: u => u.kind === 'hero' || (CFG.PRACTICE_CHAMP_EFFECTS && champLike(u)),
      onHit: u => {
        const traveled = dist(sx, sy, u.x, u.y);
        const stun = ASHE.R.stunMin + (ASHE.R.stunMax - ASHE.R.stunMin) * clamp(traveled / ASHE.R.stunDist, 0, 1);
        g.dealDamage(this, u, dmg, { type: 'magic', ability: true, ult: true });
        g.applyStun(this, u, stun);
        g.addEffect({ type: 'pulse', x: u.x, y: u.y, r: ASHE.R.aoe, color: '#7fd3ff', dur: 0.5 });
        for (const v of g.enemiesInRadius(this.team, u.x, u.y, ASHE.R.aoe)) {
          if (v === u) continue;
          g.dealDamage(this, v, dmg * ASHE.R.aoePct, { type: 'magic', ability: true, ult: true, aoe: true });
          this.frostShot(v, true);
        }
      },
    }));
    return true;
  }

  championTick(dt) {
    // 매 충전
    if (this.hawkCharges < ASHE.E.charges) {
      const lvl = Math.max(1, this.abilities.E.lvl);
      this.hawkRecharge -= dt;
      if (this.hawkRecharge <= 0) {
        this.hawkCharges++;
        this.hawkRecharge = this.hawkCharges < ASHE.E.charges ? ASHE.E.recharge[lvl - 1] : 0;
      }
      // 충전이 없으면 HUD에 재충전 시간을 표시
      const ea = this.abilities.E;
      if (this.hawkCharges <= 0 && ea.lvl > 0) { ea.cd = this.hawkRecharge; ea.maxCd = ASHE.E.recharge[lvl - 1]; }
    }
    // 매 비행 (도착하면 그 자리에서 5초 동안 시야 유지)
    const h = this.hawk;
    if (h) {
      const w = h.w;
      if (!w.alive) { this.hawk = null; return; }
      w.t = 999;
      const d = dist(w.x, w.y, h.tx, h.ty), step = ASHE.E.speed * dt;
      if (d <= step) {
        w.x = h.tx; w.y = h.ty;
        w.t = ASHE.E.vision; w.maxT = ASHE.E.vision;
        this.hawk = null;
      } else {
        w.x += (h.tx - w.x) / d * step;
        w.y += (h.ty - w.y) / d * step;
      }
    }
  }

  onDeathHook() {
    this.focus = 0;
    this.qUntil = 0;
  }

  // ---------- 그리기 ----------
  drawBody(ctx, R, game) {
    const x = this.x, y = this.y, r = this.radius, a = this.facing, t = game.time;
    const qOn = game.time < this.qUntil;
    R.shadow(ctx, this);
    R.circle(ctx, x, y, r + 5, TEAM_COLOR[this.team]);
    // 뒤로 흩날리는 망토
    const back = a + Math.PI;
    ctx.fillStyle = '#2f5d86';
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(back - 0.5) * r * 0.8, y + Math.sin(back - 0.5) * r * 0.8);
    ctx.quadraticCurveTo(x + Math.cos(back) * (r * 1.9 + Math.sin(t * 5) * 5), y + Math.sin(back) * (r * 1.9 + Math.sin(t * 5) * 5),
      x + Math.cos(back + 0.5) * r * 0.8, y + Math.sin(back + 0.5) * r * 0.8);
    ctx.closePath(); ctx.fill();
    // 몸통과 얼굴
    R.circle(ctx, x, y, r, '#5b8fc0', '#24405e', 3);
    R.circle(ctx, x, y, r * 0.6, '#f0dcc0', '#b08d6a', 2);
    // 은발
    ctx.strokeStyle = '#e8f2ff'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, r * 0.52, back - 1.5, back + 1.5); ctx.stroke();
    // 활 (항상 금색이라 서리 효과와 겹쳐도 잘 보입니다)
    const bx = x + Math.cos(a) * r * 0.8, by = y + Math.sin(a) * r * 0.8;
    const pull = this.attackAnim > 0 ? 8 : 2;
    const tipA = a - 1.25, tipB = a + 1.25, br = r * 0.72;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#6b4a12'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(bx, by, br, tipA, tipB); ctx.stroke();
    ctx.strokeStyle = '#e8b93c'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(bx, by, br, tipA, tipB); ctx.stroke();
    // 시위와 메긴 화살
    const nx = bx - Math.cos(a) * pull, ny = by - Math.sin(a) * pull;
    ctx.strokeStyle = 'rgba(235,248,255,0.9)'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(tipA) * br, by + Math.sin(tipA) * br);
    ctx.lineTo(nx, ny);
    ctx.lineTo(bx + Math.cos(tipB) * br, by + Math.sin(tipB) * br);
    ctx.stroke();
    ctx.strokeStyle = '#dff3ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(bx + Math.cos(a) * (br + 8), by + Math.sin(a) * (br + 8)); ctx.stroke();
    R.circle(ctx, bx + Math.cos(a) * (br + 10), by + Math.sin(a) * (br + 10), 3.5, '#9fe6ff');
    // 궁사의 집중: 푸른 서리 기운
    if (qOn) {
      ctx.strokeStyle = 'rgba(159,230,255,' + (0.45 + 0.35 * Math.sin(t * 9)).toFixed(2) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r + 9, 0, TAU); ctx.stroke();
    }
  }

  drawOver(ctx, R, game) {
    // 집중 중첩 표시 (내 화면에서만)
    if (this !== game.player || this.focus <= 0 || game.time < this.qUntil) return;
    for (let i = 0; i < ASHE.Q.stacks; i++) {
      const px = this.x - 18 + i * 12, py = this.y - this.radius - 26;
      R.circle(ctx, px, py, 4, i < this.focus ? '#9fe6ff' : 'rgba(255,255,255,0.18)', '#12324a', 1.5);
    }
  }

  drawAbilityRange(ctx, key) {
    if (key !== 'W') return;
    ctx.fillStyle = 'rgba(159,230,255,0.06)';
    ctx.strokeStyle = 'rgba(159,230,255,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(this.x, this.y, ASHE.W.range, 0, TAU); ctx.fill(); ctx.stroke();
  }
}

CHAMPIONS.ashe = { base: ASHE_BASE, create: (game, team, setup) => new Ashe(game, team, setup) };
