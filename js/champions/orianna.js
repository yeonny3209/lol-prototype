// ===== 챔피언: 오리아나 (미드 · 마법사) =====
// 수치 출처: 나무위키 「오리아나(리그 오브 레전드)」 문서
// 체력/마나 재생은 문서의 5초당 수치를 초당 수치로 환산했습니다.

const ORIANNA_BASE = {
  id: 'orianna', name: '오리아나', title: '시계태엽 소녀', role: '미드 · 마법사', icon: '⚙️', order: 1,
  hp: 565, hpPerLvl: 110,
  mana: 418, manaPerLvl: 25,
  hpRegen: 7 / 5, hpRegenPerLvl: 0.55 / 5,
  manaRegen: 8 / 5, manaRegenPerLvl: 0.8 / 5,
  ad: 44, adPerLvl: 2.6,
  as: 0.658, asPerLvl: 0.035,
  armor: 20, armorPerLvl: 4.2,
  mr: 26, mrPerLvl: 1.3,
  ms: 325,
  range: 525,
  projSpeed: 1450,
  radius: 30,
  sight: 1200,
  windup: 0.2,
  resource: 'mana', adaptive: 'ap', defaultRole: 'mid',
  recSpells: ['SummonerFlash', 'SummonerTeleport'],
  recommended: ['1056', '2003', '3802', '6655', '3020', '4645', '3089', '3135', '3157'],
};

const ORI = {
  leash: 1120,      // 이 거리 이상 떨어지면 구체가 돌아옴
  pickup: 70,       // 바닥의 구체를 줍는 거리
  ballRadius: 22,
  P: { ap: 0.15, stackPct: 0.15, maxStacks: 2, stackDur: 4 },
  Q: { range: 825, speed: 1400, width: 80, aoe: 175, falloff: 0.3, dmg: [60, 90, 120, 150, 180], ap: 0.55 },
  W: { radius: 250, fieldDur: 3, decay: 2, dmg: [70, 110, 150, 190, 230], ap: 0.8, slow: [0.2, 0.25, 0.3, 0.35, 0.4], haste: [0.2, 0.25, 0.3, 0.35, 0.4] },
  E: { range: 1120, speed: 1850, width: 80, dmg: [60, 90, 120, 150, 180], ap: 0.3, shield: [60, 100, 140, 180, 220], shieldAp: 0.45, shieldDur: 2.5, resist: [6, 12, 18, 24, 30] },
  R: { radius: 400, delay: 0.75, pull: 340, dmg: [225, 350, 475], ap: 1.1 },
};

// 패시브 기본 피해: 1/4/7/10/13/16 레벨에 10/18/26/34/42/50
const oriPassiveBase = lvl => 10 + 8 * Math.floor((lvl - 1) / 3);
const oriLv = (arr, lvl, f = v => v) => arr.map((v, i) => i === lvl - 1 ? '<u>' + f(v) + '</u>' : f(v)).join('/');
const oriPct = v => Math.round(v * 100) + '%';

const ORIANNA_ABILITIES = {
  P: {
    name: '시계태엽 감기', icon: '⚙️',
    desc: h => '기본 공격이 <b>' + Math.round(oriPassiveBase(h.level) + ORI.P.ap * h.ap) + '</b>(10~50 + 주문력의 15%)의 추가 마법 피해를 입힙니다. ' +
      '4초 안에 같은 대상을 다시 공격하면 추가 피해가 15%씩 늘어나며 최대 2회 중첩됩니다.' +
      '<br><br><u>구체</u>: 모든 스킬은 구체를 중심으로 발동합니다. 구체가 ' + ORI.leash + ' 이상 떨어지면 오리아나에게 돌아오고, 바닥에 놓인 구체에 다가가면 다시 줍습니다.',
  },
  Q: {
    name: '명령: 공격', icon: '🎯', maxLvl: 5, cost: [35, 35, 35, 35, 35], cd: [7, 6, 5, 4, 3],
    desc: (h, l) => '구체를 지정한 위치(최대 ' + ORI.Q.range + ')로 날립니다. 경로와 도착 지점(반경 ' + ORI.Q.aoe + ')의 적에게 <b>' +
      Math.round(ORI.Q.dmg[l - 1] + ORI.Q.ap * h.ap) + '</b>(' + oriLv(ORI.Q.dmg, l) + ' + 주문력의 55%)의 마법 피해를 입힙니다. ' +
      '두 번째 적부터는 피해량이 30% 감소합니다. 구체는 도착한 자리에 머뭅니다.',
  },
  W: {
    name: '명령: 불협화음', icon: '⚡', maxLvl: 5, cost: [60, 65, 70, 75, 80], cd: [7, 7, 7, 7, 7],
    desc: (h, l) => '구체 주변(반경 ' + ORI.W.radius + ')의 적에게 <b>' + Math.round(ORI.W.dmg[l - 1] + ORI.W.ap * h.ap) + '</b>(' +
      oriLv(ORI.W.dmg, l) + ' + 주문력의 80%)의 마법 피해를 입히고 ' + ORI.W.fieldDur + '초 동안 자기장을 남깁니다. ' +
      '자기장 안의 적은 ' + oriLv(ORI.W.slow, l, oriPct) + ' 둔화되고, 아군은 같은 수치만큼 이동 속도가 빨라집니다. 효과는 2초에 걸쳐 사라집니다.',
  },
  E: {
    name: '명령: 보호', icon: '🛡️', maxLvl: 5, cost: [60, 60, 60, 60, 60], cd: [9, 9, 9, 9, 9],
    desc: (h, l) => '<u>기본 지속 효과</u>: 구체가 붙어 있는 아군(자신 포함)의 방어력과 마법 저항력이 ' + oriLv(ORI.E.resist, l) + ' 증가합니다.<br>' +
      '<u>사용 시</u>: 구체를 아군(마우스 아래의 아군, 없으면 자신)에게 보내 ' + ORI.E.shieldDur + '초 동안 <b>' +
      Math.round(ORI.E.shield[l - 1] + ORI.E.shieldAp * h.ap) + '</b>(' + oriLv(ORI.E.shield, l) + ' + 주문력의 45%)의 보호막을 씌웁니다. ' +
      '구체가 지나가는 경로의 적은 <b>' + Math.round(ORI.E.dmg[l - 1] + ORI.E.ap * h.ap) + '</b>(' + oriLv(ORI.E.dmg, l) + ' + 주문력의 30%)의 마법 피해를 입습니다. 사거리 ' + ORI.E.range + '.',
  },
  R: {
    name: '명령: 충격파', icon: '💥', maxLvl: 3, cost: [100, 100, 100], cd: [110, 95, 80],
    desc: (h, l) => ORI.R.delay + '초 후 구체가 충격파를 방출해 반경 ' + ORI.R.radius + ' 안의 적에게 <b>' + Math.round(ORI.R.dmg[l - 1] + ORI.R.ap * h.ap) + '</b>(' +
      oriLv(ORI.R.dmg, l) + ' + 주문력의 110%)의 마법 피해를 입히고 구체 쪽으로 끌어당깁니다.<br>(용과 공허의 군주는 끌려오지 않습니다)',
  },
};

class Orianna extends Hero {
  constructor(game, team, setup) {
    super(game, team, ORIANNA_BASE, setup);
    this.abilityDefs = ORIANNA_ABILITIES;
    // 구체 상태: held(누군가에게 붙음) / ground(바닥) / flying(이동 중)
    this.ball = { state: 'held', holder: this, x: this.x, y: this.y, mode: null, target: null, tx: 0, ty: 0, speed: 0, lvl: 0, hitIds: null, hitCount: 0, trail: [] };
    this.fields = [];       // W 자기장
    this.pendingR = null;   // R 시전 지연
    this.queue = [];        // 구체 이동 중에 누른 W/R
    this.pStacks = 0; this.pTarget = null; this.pTime = -99;
  }

  projStyle() { return { color: '#ffd98a', size: 7, glow: true }; }

  ballPos() {
    const b = this.ball;
    return b.state === 'held' ? P(b.holder.x, b.holder.y) : P(b.x, b.y);
  }

  // ---------- 구체 부착 / E 기본 지속 효과 ----------
  setHolder(h) {
    const b = this.ball;
    if (b.state === 'held' && b.holder !== h && b.holder.resistBonus) { b.holder.resistBonus = 0; b.holder.recalcStats(); }
    b.state = 'held'; b.holder = h; b.mode = null; b.target = null;
    this.refreshResist();
  }

  refreshResist() {
    const b = this.ball;
    if (b.state !== 'held') return;
    const lvl = this.abilities.E.lvl;
    const v = lvl > 0 ? ORI.E.resist[lvl - 1] : 0;
    if (b.holder.resistBonus !== v) { b.holder.resistBonus = v; b.holder.recalcStats(); }
  }

  onAbilityLeveled(key) { if (key === 'E') this.refreshResist(); }

  launchBall(mode, lvl, tx, ty, target) {
    const b = this.ball, p = this.ballPos();
    if (b.state === 'held' && b.holder.resistBonus) { b.holder.resistBonus = 0; b.holder.recalcStats(); }
    b.x = p.x; b.y = p.y;
    b.state = 'flying'; b.mode = mode; b.lvl = lvl;
    b.tx = tx; b.ty = ty; b.target = target || null;
    b.speed = mode === 'Q' ? ORI.Q.speed : ORI.E.speed;
    b.hitIds = new Set(); b.hitCount = 0;
    b.trail = [];
  }

  returnBall() {
    const p = this.ballPos();
    this.game.addEffect({ type: 'pulse', x: p.x, y: p.y, r: 45, color: '#ffd98a', dur: 0.3 });
    this.setHolder(this);
  }

  // ---------- 스킬 ----------
  castQ(lvl, wx, wy) {
    const dx = wx - this.x, dy = wy - this.y, d = Math.hypot(dx, dy);
    if (d > ORI.Q.range) { wx = this.x + dx / d * ORI.Q.range; wy = this.y + dy / d * ORI.Q.range; }
    this.launchBall('Q', lvl, clamp(wx, 0, M), clamp(wy, 0, M), null);
    if (d > 0) this.facing = Math.atan2(dy, dx);
    return true;
  }

  castW(lvl) {
    if (this.ball.state === 'flying') this.queue.push({ key: 'W', lvl });
    else this.doW(lvl);
    return true;
  }

  castE(lvl, wx, wy, hover) {
    let t = this;
    if (hover && hover !== this && hover.kind === 'hero' && hover.team === this.team && hover.alive && dist(this.x, this.y, hover.x, hover.y) <= ORI.E.range) t = hover;
    const b = this.ball;
    if (b.state === 'held' && b.holder === t) { this.applyShield(t, lvl); return true; }
    this.launchBall('E', lvl, t.x, t.y, t);
    return true;
  }

  castR(lvl) {
    if (this.pendingR) return false;
    if (this.ball.state === 'flying') this.queue.push({ key: 'R', lvl });
    else this.pendingR = { t: 0, dur: ORI.R.delay, lvl };
    return true;
  }

  doW(lvl) {
    const p = this.ballPos(), W = ORI.W;
    const dmg = W.dmg[lvl - 1] + W.ap * this.ap;
    for (const u of this.game.enemiesInRadius(this.team, p.x, p.y, W.radius)) this.game.dealDamage(this, u, dmg, { magic: true, ability: true });
    this.fields.push({ x: p.x, y: p.y, t: 0, dur: W.fieldDur, lvl });
    this.game.addEffect({ type: 'pulse', x: p.x, y: p.y, r: W.radius, color: '#8fe3ff', dur: 0.35 });
  }

  doR(lvl) {
    const p = this.ballPos(), R = ORI.R;
    const dmg = R.dmg[lvl - 1] + R.ap * this.ap;
    for (const u of this.game.enemiesInRadius(this.team, p.x, p.y, R.radius)) {
      this.game.dealDamage(this, u, dmg, { magic: true, ability: true, ult: true, aoe: true });
      if (!u.alive) continue;
      const d = dist(u.x, u.y, p.x, p.y);
      const move = Math.min(R.pull, Math.max(0, d - 40));
      if (move > 5) this.game.applyKnock(this, u, u.x + (p.x - u.x) / d * move, u.y + (p.y - u.y) / d * move, 0.45, 60);
      else this.game.applyKnock(this, u, u.x, u.y, 0.45, 60);
    }
    this.game.addEffect({ type: 'shockwave', x: p.x, y: p.y, r: R.radius, dur: 0.55 });
  }

  applyShield(t, lvl) {
    const E = ORI.E;
    t.addShield('oriE', (E.shield[lvl - 1] + E.shieldAp * this.ap) * (1 + this.hsp), E.shieldDur);
    this.game.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 70, color: '#ffd98a', dur: 0.35, follow: t });
  }

  // ---------- 패시브 ----------
  onAttackHit(t) {
    super.onAttackHit(t);
    if (!t.alive) return;
    const PS = ORI.P, now = this.game.time;
    if (this.pTarget === t && now - this.pTime < PS.stackDur) this.pStacks = Math.min(PS.maxStacks, this.pStacks + 1);
    else this.pStacks = 0;
    this.pTarget = t; this.pTime = now;
    const dmg = (oriPassiveBase(this.level) + PS.ap * this.ap) * (1 + PS.stackPct * this.pStacks);
    this.game.dealDamage(this, t, dmg, { magic: true });
  }

  // ---------- 매 틱 ----------
  championTick(dt) {
    const b = this.ball, g = this.game;
    if (!this.alive) {
      if (b.state !== 'held' || b.holder !== this) this.setHolder(this);
      return;
    }

    // W 자기장: 안에 있는 적은 둔화, 아군 영웅은 가속 (나가면 2초에 걸쳐 사라짐)
    const W = ORI.W;
    for (const f of this.fields) {
      f.t += dt;
      for (const u of g.units) {
        if (!u.alive || u.isStructure) continue;
        const rr = W.radius + u.radius;
        if (dist2(u.x, u.y, f.x, f.y) > rr * rr) continue;
        if (u.team === this.team) { if (u.kind === 'hero') u.addHaste('oriW', W.haste[f.lvl - 1], W.decay, true); }
        else if (g.isVulnerable(u)) g.applySlow(this, u, 'oriW', W.slow[f.lvl - 1], W.decay, true);
      }
    }
    this.fields = this.fields.filter(f => f.t < f.dur);

    // 구체
    if (b.state === 'flying') this.updateFlight(dt);
    else if (b.state === 'held') {
      const h = b.holder;
      if (h !== this && (!h.alive || dist(h.x, h.y, this.x, this.y) > ORI.leash)) this.returnBall();
    } else {
      const d = dist(b.x, b.y, this.x, this.y);
      if (d > ORI.leash) this.returnBall();
      else if (d < ORI.pickup + this.radius) this.setHolder(this);
    }

    // R 지연 후 발동 (발동 순간의 구체 위치 기준)
    const r = this.pendingR;
    if (r) {
      r.t += dt;
      if (r.t >= r.dur) { this.pendingR = null; this.doR(r.lvl); }
    }
  }

  updateFlight(dt) {
    const b = this.ball;
    let tx = b.tx, ty = b.ty;
    if (b.mode === 'E') {
      if (!b.target || !b.target.alive) b.target = this;
      tx = b.target.x; ty = b.target.y;
    }
    const d = dist(b.x, b.y, tx, ty), step = b.speed * dt;
    const arrived = d <= step;
    const nx = arrived ? tx : b.x + (tx - b.x) / d * step;
    const ny = arrived ? ty : b.y + (ty - b.y) / d * step;
    this.hitAlong(b.x, b.y, nx, ny);
    b.trail.push(P(b.x, b.y));
    if (b.trail.length > 6) b.trail.shift();
    b.x = nx; b.y = ny;
    if (arrived) this.arrive();
  }

  ballHit(u) {
    const b = this.ball;
    if (b.hitIds.has(u.id)) return;
    b.hitIds.add(u.id);
    const spec = b.mode === 'Q' ? ORI.Q : ORI.E;
    let dmg = spec.dmg[b.lvl - 1] + spec.ap * this.ap;
    if (b.mode === 'Q' && b.hitCount > 0) dmg *= 1 - ORI.Q.falloff;
    b.hitCount++;
    this.game.dealDamage(this, u, dmg, { magic: true, ability: true });
  }

  hitAlong(ax, ay, bx, by) {
    const w = this.ball.mode === 'Q' ? ORI.Q.width : ORI.E.width;
    for (const u of this.game.enemiesNearSegment(this.team, ax, ay, bx, by, w)) this.ballHit(u);
  }

  arrive() {
    const b = this.ball, g = this.game;
    if (b.mode === 'Q') {
      for (const u of g.enemiesInRadius(this.team, b.x, b.y, ORI.Q.aoe)) this.ballHit(u);
      g.addEffect({ type: 'pulse', x: b.x, y: b.y, r: ORI.Q.aoe, color: '#ffd98a', dur: 0.3 });
      b.state = 'ground'; b.mode = null;
      if (dist(b.x, b.y, this.x, this.y) < ORI.pickup + this.radius) this.setHolder(this);
    } else {
      const t = b.target && b.target.alive ? b.target : this;
      this.setHolder(t);
      this.applyShield(t, b.lvl);
    }
    const q = this.queue;
    this.queue = [];
    for (const c of q) {
      if (c.key === 'W') this.doW(c.lvl);
      else if (!this.pendingR) this.pendingR = { t: 0, dur: ORI.R.delay, lvl: c.lvl };
    }
  }

  onDeathHook() {
    this.pendingR = null;
    this.queue = [];
    this.fields = [];
    this.setHolder(this);
  }

  // ---------- 그리기 ----------
  drawBody(ctx, R, game) {
    const x = this.x, y = this.y, r = this.radius, t = game.time;
    R.shadow(ctx, this);
    R.circle(ctx, x, y, r + 5, TEAM_COLOR[this.team]);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.6);
    ctx.fillStyle = '#b48a3c';
    for (let i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.fillRect(-4, -r - 10, 8, 10); }
    ctx.restore();
    R.circle(ctx, x, y, r, '#efe3c6', '#8a6a2e', 3);
    R.circle(ctx, x, y, r * 0.6, '#2f3540', '#d8b060', 2);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8fe3ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(this.facing) * r * 0.52, y + Math.sin(this.facing) * r * 0.52); ctx.stroke();
    ctx.strokeStyle = '#d8b060'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(t * 2) * r * 0.36, y + Math.sin(t * 2) * r * 0.36); ctx.stroke();
    R.circle(ctx, x, y, 3.5, '#8fe3ff');
    // 등 뒤의 태엽 열쇠
    const back = this.facing + Math.PI;
    const kx = x + Math.cos(back) * (r + 12), ky = y + Math.sin(back) * (r + 12);
    ctx.strokeStyle = '#c9a04a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(back) * r, y + Math.sin(back) * r); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate(t * 3);
    ctx.fillStyle = '#c9a04a';
    ctx.fillRect(-10, -3.5, 20, 7);
    ctx.restore();
    if (this.attackAnim > 0) R.circle(ctx, x + Math.cos(this.facing) * (r + 8), y + Math.sin(this.facing) * (r + 8), 10, 'rgba(255,230,160,0.85)');
  }

  drawGround(ctx, R, game) {
    const W = ORI.W;
    for (const f of this.fields) {
      const k = f.t / f.dur, a = k < 0.8 ? 1 : (1 - k) / 0.2;
      ctx.fillStyle = 'rgba(120,210,255,' + (0.14 * a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(f.x, f.y, W.radius, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(170,235,255,' + (0.7 * a).toFixed(3) + ')'; ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(210,248,255,' + (0.8 * a).toFixed(3) + ')'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a0 = game.time * (2 + i) + i * 2.1;
        ctx.beginPath(); ctx.arc(f.x, f.y, W.radius * (0.35 + i * 0.2), a0, a0 + 1.2); ctx.stroke();
      }
    }
    if (!this.alive) return;
    const bp = this.ballPos();
    const r = this.pendingR;
    if (r) {
      const k = r.t / r.dur;
      ctx.fillStyle = 'rgba(60,120,220,' + (0.12 + 0.18 * k).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(bp.x, bp.y, ORI.R.radius * (1 - k * 0.85), 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(130,205,255,' + (0.4 + 0.5 * k).toFixed(3) + ')'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(bp.x, bp.y, ORI.R.radius, 0, TAU); ctx.stroke();
    }
    // 구체가 멀어지면 회수 거리 표시 (플레이어 본인만)
    const b = this.ball;
    if (this === game.player && !(b.state === 'held' && b.holder === this)) {
      const d = dist(bp.x, bp.y, this.x, this.y);
      if (d > ORI.leash * 0.6) {
        const a = clamp((d - ORI.leash * 0.6) / (ORI.leash * 0.4), 0, 1) * 0.4;
        ctx.strokeStyle = 'rgba(255,217,138,' + a.toFixed(3) + ')';
        ctx.lineWidth = 3;
        ctx.setLineDash([18, 14]);
        ctx.beginPath(); ctx.arc(this.x, this.y, ORI.leash, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  drawOver(ctx, R, game) {
    if (!this.alive) return;
    const b = this.ball, t = game.time, p = this.ballPos();
    const held = b.state === 'held';
    const lift = (held ? b.holder.radius + 34 : b.state === 'flying' ? 26 : 16) + Math.sin(t * 3) * 4;
    const air = held && b.holder.displace ? b.holder.airHeight() : 0;
    if (b.state === 'flying') {
      for (let i = 0; i < b.trail.length; i++) {
        const q = b.trail[i];
        R.circle(ctx, q.x, q.y - lift, 8 + i * 1.6, 'rgba(255,217,138,' + (0.08 + i * 0.05).toFixed(2) + ')');
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 18, 8, 0, 0, TAU); ctx.fill();
    const bx = p.x, by = p.y - lift - air, br = ORI.ballRadius;
    const grd = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.35, 2, bx, by, br);
    grd.addColorStop(0, '#fff5d0');
    grd.addColorStop(0.45, '#e0b050');
    grd.addColorStop(1, '#6a4818');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3b2a10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(bx, by, br, br * 0.35, Math.sin(t) * 0.3, 0, TAU); ctx.stroke();
    R.circle(ctx, bx, by, 5, 'rgba(143,227,255,' + (0.7 + 0.3 * Math.sin(t * 6)).toFixed(2) + ')');

    // 오리아나 → 구체 방향 화살표
    if (this === game.player && !(held && b.holder === this)) {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      const ax = this.x + Math.cos(a) * (this.radius + 28), ay = this.y + Math.sin(a) * (this.radius + 28);
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(a) * 13, ay + Math.sin(a) * 13);
      ctx.lineTo(ax + Math.cos(a + 2.4) * 10, ay + Math.sin(a + 2.4) * 10);
      ctx.lineTo(ax + Math.cos(a - 2.4) * 10, ay + Math.sin(a - 2.4) * 10);
      ctx.fill();
    }
  }

  // 스킬 아이콘에 마우스를 올렸을 때 범위 표시
  drawAbilityRange(ctx, key) {
    const bp = this.ballPos();
    const ring = (x, y, r) => {
      ctx.fillStyle = 'rgba(143,227,255,0.08)';
      ctx.strokeStyle = 'rgba(143,227,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    };
    if (key === 'Q') ring(this.x, this.y, ORI.Q.range);
    else if (key === 'W') ring(bp.x, bp.y, ORI.W.radius);
    else if (key === 'E') ring(this.x, this.y, ORI.E.range);
    else if (key === 'R') ring(bp.x, bp.y, ORI.R.radius);
  }
}

CHAMPIONS.orianna = { base: ORIANNA_BASE, create: (game, team, setup) => new Orianna(game, team, setup) };
