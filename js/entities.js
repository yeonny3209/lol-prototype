// ===== 유닛 기본 클래스 / 미니언 / 정글 몬스터 / 투사체 =====
let NEXT_ID = 1;

class Unit {
  constructor(game, o) {
    this.game = game;
    this.id = NEXT_ID++;
    this.kind = o.kind;
    this.name = o.name;
    this.team = o.team;
    this.x = o.x; this.y = o.y;
    this.radius = o.radius || 30;
    this.maxHp = o.hp; this.hp = o.hp;
    this.armor = o.armor || 0; this.mr = o.mr || 0;
    this.ad = o.ad || 0; this.as = o.as || 1;
    this.range = o.range || 0; this.ms = o.ms || 0;
    this.projSpeed = o.projSpeed || 0;
    this.sight = o.sight || 800;
    this.hpRegen = o.hpRegen || 0;
    this.windupRatio = o.windup || 0.3;
    this.alive = true;
    this.targetable = true;
    this.isStructure = false;
    this.target = null;
    this.attackCd = 0;
    this.windup = -1;
    this.windupTarget = null;
    this.facing = 0;
    this.hitFlash = 0;
    this.attackAnim = 0;
    this.moving = false;
    this.lastAggroTime = -99;   // 마지막으로 누군가를 공격한 시간
    this.lastDamagedTime = -99;
    this.lastDamagedBy = null;
    this.ccImmune = !!o.ccImmune;

    // 상태 효과
    this.slows = null;        // id -> { pct, t, dur, decay }
    this.hastes = null;
    this.shields = null;      // id -> { amt, max, t, dur, type, decay }
    this.displace = null;     // 에어본 / 끌어당김 / 넉백
    this.asSlows = null;      // id -> { pct, t }  공격 속도 감소
    this.takenAmps = null;    // id -> { pct, t, src, type }  받는 피해 증가
    this.armorShred = null;   // id -> { pct, t }
    this.mrShred = null;
    this.grievousT = 0; this.grievousPct = 0;
    this.exhaustT = 0;        // 입히는 피해 35% 감소
    this.stasisT = 0;         // 경직 (무적·행동 불가)
    this.stunT = 0;           // 기절 (이동·공격·스킬 불가)
    this.ghostT = 0;          // 유닛 충돌 무시
    this.tenacity = 0;
    this.slowResist = 0;
    this.hsReceived = 1;      // 받는 회복·보호막 배율
    this.combatT = -99;       // 마지막으로 피해를 주고받은 시간
    this.champCombatT = -99;  // 챔피언(연습 규칙 포함)과 마지막으로 전투한 시간
    this.dynAs = 0; this.dynMsFlat = 0; this.dynMsPct = 0;
    this.damagedBy = null;    // 영웅 id -> 마지막 피해 시간 (처치 관여 판정)
  }

  // ---------- 상태 효과 ----------
  addSlow(id, pct, dur, decay) {
    if (this.isStructure) return;
    (this.slows || (this.slows = {}))[id] = { pct, t: dur, dur, decay };
  }
  addHaste(id, pct, dur, decay) { (this.hastes || (this.hastes = {}))[id] = { pct, t: dur, dur, decay }; }
  addAsSlow(id, pct, dur) { if (!this.isStructure) (this.asSlows || (this.asSlows = {}))[id] = { pct, t: dur }; }
  addTakenAmp(id, pct, dur, src, type) { (this.takenAmps || (this.takenAmps = {}))[id] = { pct, t: dur, src: src || null, type: type || null }; }
  addArmorShred(id, pct, dur) { (this.armorShred || (this.armorShred = {}))[id] = { pct, t: dur }; }
  addMrShred(id, pct, dur) { (this.mrShred || (this.mrShred = {}))[id] = { pct, t: dur }; }
  applyGrievous(pct, dur) { this.grievousT = Math.max(this.grievousT, dur); this.grievousPct = Math.max(this.grievousT > dur ? this.grievousPct : 0, pct); }

  // opts: { type: 'all' | 'magic' | 'physical', decay }
  addShield(id, amt, dur, opts = {}) {
    if (!this.alive || amt <= 0) return 0;
    amt *= this.hsReceived;
    (this.shields || (this.shields = {}))[id] = { amt, max: amt, t: dur, dur, type: opts.type || 'all', decay: !!opts.decay };
    if (this.fxEvent) this.fxEvent('shieldGained', amt, id);
    return amt;
  }

  shieldTotal(type) {
    let s = 0;
    if (this.shields) for (const k in this.shields) {
      const sh = this.shields[k];
      if (!type || sh.type === 'all' || sh.type === type) s += sh.amt;
    }
    return s;
  }

  absorbShield(dmg, type) {
    if (!this.shields) return dmg;
    for (const pass of [0, 1]) {
      for (const k in this.shields) {
        const s = this.shields[k];
        if (pass === 0 ? s.type !== type : s.type !== 'all') continue;
        const take = Math.min(s.amt, dmg);
        s.amt -= take; dmg -= take;
        if (s.amt <= 0.01) delete this.shields[k];
        if (dmg <= 0) return 0;
      }
    }
    return dmg;
  }

  static effPct(e) { return e.decay ? e.pct * (e.t / e.dur) : e.pct; }

  slowPct() {
    let slow = 0;
    if (this.slows) for (const k in this.slows) slow = Math.max(slow, Unit.effPct(this.slows[k]));
    return slow * (1 - (this.slowResist || 0));
  }

  getMS() {
    let haste = 0;
    if (this.hastes) for (const k in this.hastes) haste = Math.max(haste, Unit.effPct(this.hastes[k]));
    return Math.max(0, (this.ms + this.dynMsFlat) * (1 + haste + this.dynMsPct) * (1 - this.slowPct()));
  }

  asSlowPct() {
    let s = 0;
    if (this.asSlows) for (const k in this.asSlows) s = Math.max(s, this.asSlows[k].pct);
    return s;
  }

  getAS() { return this.as * (1 - this.asSlowPct()); }

  isImpaired() { return !!this.displace || this.slowPct() > 0 || this.stasisT > 0 || this.stunT > 0; }

  // 기절: 강인함만큼 짧아지며 용·공허의 군주·구조물에는 걸리지 않습니다.
  addStun(dur) {
    if (this.isStructure || this.ccImmune || !this.alive || this.stasisT > 0) return 0;
    const d = dur * (1 - clamp(this.tenacity || 0, 0, 0.8));
    this.stunT = Math.max(this.stunT, d);
    this.cancelWindup();
    if (this.cancelChannel) this.cancelChannel();
    return d;
  }

  heal(amount, src) {
    if (!this.alive || amount <= 0) return 0;
    let a = amount * this.hsReceived;
    if (this.grievousT > 0) a *= 1 - this.grievousPct;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + a);
    const gained = this.hp - before;
    if (this.fxEvent && a > gained + 0.01) this.fxEvent('overheal', a - gained, src);
    return gained;
  }

  cleanse() {
    this.slows = null;
    this.asSlows = null;
    this.exhaustT = 0;
    this.grievousT = 0;
    this.stunT = 0;
  }

  tickStatus(dt) {
    for (const bag of [this.slows, this.hastes, this.shields, this.asSlows, this.takenAmps, this.armorShred, this.mrShred]) {
      if (!bag) continue;
      for (const k in bag) {
        const e = bag[k];
        e.t -= dt;
        if (e.t <= 0) { delete bag[k]; continue; }
        if (e.decay && e.max) e.amt = Math.min(e.amt, e.max * e.t / e.dur);
      }
    }
    if (this.grievousT > 0) this.grievousT -= dt;
    if (this.exhaustT > 0) this.exhaustT -= dt;
    if (this.stasisT > 0) this.stasisT -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    if (this.ghostT > 0) this.ghostT -= dt;
  }

  knockTo(tx, ty, dur, height, opts = {}) {
    if (this.isStructure || this.ccImmune || !this.alive || this.stasisT > 0) return false;
    const p = Nav.isWalkable(tx, ty) ? P(tx, ty) : Nav.nearestWalkablePoint(tx, ty);
    this.displace = { sx: this.x, sy: this.y, tx: p.x, ty: p.y, t: 0, dur, h: height, src: opts.src || null, onStep: opts.onStep || null };
    this.cancelWindup();
    return true;
  }

  // 에어본·기절 중이면 true (행동 불가)
  updateCC(dt) {
    const d = this.displace;
    if (!d) return this.stunT > 0;
    d.t += dt;
    const k = Math.min(1, d.t / d.dur), e = 1 - (1 - k) * (1 - k);
    this.x = lerp(d.sx, d.tx, e);
    this.y = lerp(d.sy, d.ty, e);
    if (d.onStep) d.onStep(this);
    if (k >= 1) this.displace = null;
    return true;
  }

  airHeight() {
    const d = this.displace;
    return d ? Math.sin(Math.min(1, d.t / d.dur) * Math.PI) * d.h : 0;
  }

  getBaseAS() { return this.getAS(); }
  windupTime() { return Math.min(0.5, this.windupRatio / this.getAS()); }

  edgeDist(t) { return dist(this.x, this.y, t.x, t.y) - this.radius - t.radius; }
  inRange(t, extra = 0) { return this.edgeDist(t) <= this.range + extra; }

  isValidTarget(t) {
    return t && t.alive && t.targetable && t.team !== this.team && this.game.isVulnerable(t) && this.game.isVisible(this.team, t);
  }

  tickCombat(dt) {
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.attackAnim > 0) this.attackAnim -= dt;
    if (this.windup >= 0) {
      const t = this.windupTarget;
      if (!t || !t.alive || !this.game.isVulnerable(t) || !this.inRange(t, 150)) {
        this.cancelWindup();
      } else {
        this.facing = Math.atan2(t.y - this.y, t.x - this.x);
        this.windup -= dt;
        if (this.windup <= 0) {
          this.windup = -1;
          this.attackAnim = 0.15;
          this.lastAggroTime = this.game.time;
          if (this.onAttackLaunch) this.onAttackLaunch(t);
          this.fireAttack(t);
        }
      }
    }
  }

  cancelWindup() {
    if (this.windup >= 0) { this.windup = -1; this.attackCd = 0; }
  }

  // 사거리 안의 대상에게 공격 시작 (쿨이 돌았을 때만)
  tryAttack(t) {
    this.facing = Math.atan2(t.y - this.y, t.x - this.x);
    if (this.windup >= 0 || this.attackCd > 0) return;
    this.windup = this.windupTime();
    this.windupTarget = t;
    this.attackCd = 1 / this.getAS();
  }

  fireAttack(t) {
    if (this.projSpeed > 0) {
      this.game.addProjectile(new Projectile(this.game, this, t, this.projSpeed, () => this.onAttackHit(t), this.projStyle()));
    } else {
      this.onAttackHit(t);
    }
  }

  projStyle() { return { color: TEAM_COLOR[this.team], size: 6 }; }

  attackDamageVs(t) { return this.ad; }

  onAttackHit(t) {
    if (!t.alive) return;
    this.game.dealDamage(this, t, this.attackDamageVs(t), { isAttack: true });
  }

  onDamaged(src, amount) {}

  regen(dt) {
    if (this.hp < this.maxHp && this.hpRegen > 0) this.heal(this.hpRegen * dt, 'regen');
  }

  // 이동: 구조물 주변은 미끄러지듯 돌아가고, 벽은 축별로 미끄러짐
  moveToward(tx, ty, dt, speed = this.getMS()) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return true;
    const step = Math.min(d, speed * dt);
    let vx = dx / d, vy = dy / d;
    for (const s of this.game.structures) {
      if (!s.alive || s === this || !s.blocks) continue;
      const ox = s.x - this.x, oy = s.y - this.y;
      const od = Math.sqrt(ox * ox + oy * oy);
      const rr = s.radius + this.radius + 8;
      if (od > 0 && od < rr + step + 6 && dist2(tx, ty, s.x, s.y) > rr * rr) {
        const nx = ox / od, ny = oy / od;
        const dot = vx * nx + vy * ny;
        if (dot > 0) {
          vx -= nx * dot; vy -= ny * dot;
          const l = Math.sqrt(vx * vx + vy * vy);
          if (l < 0.25) { vx = -ny; vy = nx; } else { vx /= l; vy /= l; }
        }
      }
    }
    this.facing = Math.atan2(vy, vx);   // 그리기용
    this.dirX = vx; this.dirY = vy;     // 게임 로직용 이동 방향
    this.tryMove(vx * step, vy * step);
    this.moving = true;
    return d <= step + 0.5;
  }

  tryMove(mx, my) {
    const nx = this.x + mx, ny = this.y + my;
    if (Nav.isWalkable(nx, ny)) { this.x = nx; this.y = ny; return true; }
    if (Math.abs(mx) > 0.01 && Nav.isWalkable(nx, this.y)) { this.x = nx; return true; }
    if (Math.abs(my) > 0.01 && Nav.isWalkable(this.x, ny)) { this.y = ny; return true; }
    return false;
  }
}

// ---------------- 미니언 ----------------
class Minion extends Unit {
  constructor(game, team, lane, mtype, upgrades) {
    const s = MINION_STATS[mtype];
    const sp = LAYOUT[team].spawn[lane];
    super(game, {
      kind: 'minion', name: s.name, team, x: sp.x + srand(-20, 20), y: sp.y + srand(-20, 20),
      radius: s.radius, hp: Math.round(s.hp + s.hpUp * upgrades), ad: s.ad + s.adUp * upgrades,
      as: s.as, armor: s.armor, range: s.range, ms: s.ms, projSpeed: s.projSpeed, sight: s.sight, windup: 0.3,
    });
    this.mtype = mtype;
    this.lane = lane;
    this.path = LAYOUT[team].path[lane];
    this.wp = 0;
    this.gold = s.gold;
    this.xp = s.xp;
    this.towerPct = s.towerPct;
    this.aggroRange = 650;
    this.retarget = rng() * 0.3;
    this.bonusResist = 0;     // 선체파괴자 '승선 부대'
  }

  projStyle() {
    return this.mtype === 'siege' ? { color: '#ffb347', size: 9 } : { color: this.team === TEAM.BLUE ? '#8fc3ff' : '#ff9a9a', size: 5 };
  }

  targetScore(u) {
    const d = this.edgeDist(u);
    let prio;
    if (u.kind === 'minion') prio = 0;
    else if (u.kind === 'hero') prio = (this.game.time - u.lastAggroTime < 2.5) ? 1 : 2;
    else prio = 2;
    return prio * 2000 + d;
  }

  pickTarget() {
    let best = null, bs = Infinity;
    for (const u of this.game.units) {
      if (u.team === this.team || u.team === TEAM.NEUTRAL || !this.isValidTarget(u)) continue;
      if (this.edgeDist(u) > this.aggroRange) continue;
      let sc = this.targetScore(u);
      if (u === this.target) sc -= 400;   // 기존 대상 유지 경향
      if (sc < bs) { bs = sc; best = u; }
    }
    return best;
  }

  update(dt) {
    this.moving = false;
    this.tickCombat(dt);
    this.retarget -= dt;
    if (this.target && (!this.isValidTarget(this.target) || this.edgeDist(this.target) > this.aggroRange + 250)) this.target = null;
    if (this.retarget <= 0) { this.retarget = 0.35; this.target = this.pickTarget(); }

    const t = this.target;
    if (t) {
      this.navPath = null;
      if (this.inRange(t)) { this.tryAttack(t); return; }
      if (this.windup >= 0) return;
      this.moveToward(t.x, t.y, dt);
      return;
    }
    if (this.windup >= 0) return;
    this.followLane(dt);
  }

  // 라인 중심선 위의 앞쪽 지점을 향해 이동 (밀려나도 라인으로 복귀)
  followLane(dt) {
    const p = this.path, n = p.length;
    while (this.wp < n - 2) {
      const a = p[this.wp], b = p[this.wp + 1], c = p[this.wp + 2];
      const dCur = distToSegment(this.x, this.y, a.x, a.y, b.x, b.y);
      const dNext = distToSegment(this.x, this.y, b.x, b.y, c.x, c.y);
      if (dNext <= dCur || dist(this.x, this.y, b.x, b.y) < 120) this.wp++;
      else break;
    }
    const a = p[this.wp], b = p[this.wp + 1];
    const abx = b.x - a.x, aby = b.y - a.y, len = Math.sqrt(abx * abx + aby * aby);
    if (this.wp >= n - 2 && dist(this.x, this.y, b.x, b.y) < 80) return;   // 적 넥서스 도착
    const t = clamp(((this.x - a.x) * abx + (this.y - a.y) * aby) / (len * len), 0, 1);
    const along = t * len + 220;
    let tx, ty;
    if (along <= len || this.wp >= n - 2) {
      const k = Math.min(along, len) / len;
      tx = a.x + abx * k; ty = a.y + aby * k;
    } else {
      const c = p[this.wp + 2], bl = dist(b.x, b.y, c.x, c.y);
      const k = Math.min(along - len, bl) / bl;
      tx = b.x + (c.x - b.x) * k; ty = b.y + (c.y - b.y) * k;
    }
    this.moveSmart(tx, ty, dt);
  }

  // 직진하다가 막히면 잠시 길찾기 경로를 따라감
  moveSmart(tx, ty, dt) {
    if (this.navPath && this.navPath.length) {
      const q = this.navPath[0];
      if (this.moveToward(q.x, q.y, dt)) this.navPath.shift();
      this.navTimer -= dt;
      if (this.navTimer <= 0) this.navPath = null;
      return;
    }
    const ox = this.x, oy = this.y;
    this.moveToward(tx, ty, dt);
    const moved = dist(ox, oy, this.x, this.y);
    this.stuckT = moved < this.getMS() * dt * 0.25 ? (this.stuckT || 0) + dt : 0;
    if (this.stuckT > 0.6) {
      this.stuckT = 0;
      this.navPath = Nav.findPath(this.x, this.y, tx, ty);
      this.navTimer = 2;
    }
  }
}

// ---------------- 정글 몬스터 ----------------
class Monster extends Unit {
  constructor(game, camp, mtype, x, y) {
    const s = MONSTER_STATS[mtype];
    super(game, {
      kind: 'monster', name: s.name, team: TEAM.NEUTRAL, x, y, radius: s.radius,
      hp: s.hp, ad: s.ad, as: s.as, armor: s.armor, mr: s.mr || 0, ccImmune: !!s.ccImmune,
      range: s.range, ms: s.ms, projSpeed: s.projSpeed || 0, sight: 600, windup: 0.35,
    });
    this.mtype = mtype;
    this.stats = s;
    this.camp = camp;
    this.home = P(x, y);
    this.gold = s.gold; this.xp = s.xp;
    this.large = LARGE_MONSTERS.has(mtype);
    this.epic = EPIC_MONSTERS.has(mtype);
    this.aggro = null;
    this.resetting = false;
    this.facing = rng() * Math.PI * 2;
    if (this.epic) {
      const mins = game.time / 60;
      this.maxHp = this.hp = Math.round(s.hp * (1 + mins * 0.03));
      this.ad = s.ad * (1 + mins * 0.02);
    }
  }

  projStyle() { return { color: this.stats.color, size: this.mtype === 'baron' ? 14 : 10 }; }

  isValidTarget(t) { return t && t.alive && t.targetable && t.team !== this.team && t.stasisT <= 0; }

  onDamaged(src) {
    if (!src || src.team === TEAM.NEUTRAL || this.resetting) return;
    this.camp.lastHit = this.game.time;
    if (!this.aggro) this.camp.aggroAll(src.owner || src);
  }

  startReset() {
    for (const m of this.camp.monsters) { if (m.alive) { m.aggro = null; m.resetting = true; m.cancelWindup(); } }
  }

  update(dt) {
    this.moving = false;
    this.tickCombat(dt);
    if (this.resetting) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3 * dt);
      if (this.ms <= 0 || this.moveToward(this.home.x, this.home.y, dt, this.ms * 1.5)) {
        if (this.hp >= this.maxHp - 1) { this.resetting = false; this.hp = this.maxHp; }
      }
      return;
    }
    const a = this.aggro;
    if (a) {
      const leash = this.epic ? 900 : 750;
      // 캠프 전체 기준으로 6초 동안 맞지 않고 대상이 사거리 밖이면 초기화 (같은 캠프의 안 맞은 몬스터가 바로 초기화하지 않도록)
      const lastHit = Math.max(this.lastDamagedTime, this.camp.lastHit ?? -99);
      const bored = this.game.time - lastHit > 6 && !this.inRange(a);
      if (!this.isValidTarget(a) || dist(this.x, this.y, this.home.x, this.home.y) > leash || bored) { this.startReset(); return; }
      if (this.inRange(a)) this.tryAttack(a);
      else if (this.windup < 0 && this.ms > 0) this.moveToward(a.x, a.y, dt);
      return;
    }
    if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02 * dt);
    if (this.ms > 0 && dist(this.x, this.y, this.home.x, this.home.y) > 20) this.moveToward(this.home.x, this.home.y, dt);
  }
}

class Camp {
  constructor(game, def) {
    this.game = game;
    this.type = def.type;
    this.info = CAMP_TYPES[def.type];
    this.pos = def.pos;
    this.timer = this.info.first != null ? this.info.first : CFG.CAMP_FIRST;
    this.monsters = [];
    this.up = false;
  }

  update(dt) {
    if (this.up) {
      if (this.monsters.every(m => !m.alive)) { this.up = false; this.timer = this.info.respawn; this.monsters = []; }
      return;
    }
    this.timer -= dt;
    if (this.timer <= 0) this.spawn();
  }

  spawn() {
    this.up = true;
    const n = this.info.units.length;
    this.info.units.forEach((type, i) => {
      let x = this.pos.x, y = this.pos.y;
      if (i > 0) {
        const a = (i - 1) / Math.max(1, n - 1) * Math.PI * 2 + 0.6;
        // 브라우저마다 삼각함수 끝자리가 다를 수 있어 정수로 반올림 (1대1 동기화)
        x += Math.round(Math.cos(a) * 95); y += Math.round(Math.sin(a) * 95);
      }
      const m = new Monster(this.game, this, type, x, y);
      this.monsters.push(m);
      this.game.addUnit(m);
    });
    if (this.type === 'dragon' || this.type === 'baron') this.game.announce(this.info.label + '이(가) 나타났습니다!', 'info');
  }

  aggroAll(src) {
    if (!src || !src.alive || src.kind === 'ward') return;
    for (const m of this.monsters) if (m.alive && !m.resetting && !m.aggro) m.aggro = src;
  }
}

// ---------------- 투사체 ----------------
class Projectile {
  constructor(game, src, target, speed, onHit, style) {
    this.game = game;
    const dx = target.x - src.x, dy = target.y - src.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
    this.x = src.x + dx / dd * src.radius * 0.6;
    this.y = src.y + dy / dd * src.radius * 0.6 - (src.isStructure ? src.radius * 1.4 : 10);
    this.target = target;
    this.speed = speed;
    this.onHit = onHit;
    this.style = style || { color: '#fff', size: 5 };
    this.alive = true;
    this.trail = [];
  }

  update(dt) {
    const t = this.target;
    if (!t.alive) { this.alive = false; return; }
    const tx = t.x, ty = t.y - (t.isStructure ? t.radius * 0.5 : 0);
    const d = dist(this.x, this.y, tx, ty);
    const step = this.speed * dt;
    this.trail.push(P(this.x, this.y));
    if (this.trail.length > 5) this.trail.shift();
    if (d <= step + 4) {
      this.alive = false;
      this.onHit();
      return;
    }
    this.x += (tx - this.x) / d * step;
    this.y += (ty - this.y) / d * step;
  }
}

// 직선으로 날아가 처음 맞은 적에게 효과를 주는 스킬 투사체 (리 신 Q 등)
class SkillShot {
  constructor(game, owner, sx, sy, tx, ty, o) {
    this.game = game;
    this.owner = owner;
    this.x = sx; this.y = sy;
    const d = dist(sx, sy, tx, ty) || 1;
    this.dx = (tx - sx) / d; this.dy = (ty - sy) / d;
    this.range = o.range; this.speed = o.speed; this.width = o.width;
    this.traveled = 0;
    this.filter = o.filter || null;   // 맞힐 대상 제한 (예: 챔피언만)
    this.onHit = o.onHit; this.onEnd = o.onEnd || null;
    this.color = o.color || '#fff';
    this.alive = true;
    this.trail = [];
  }

  update(dt) {
    const step = Math.min(this.speed * dt, this.range - this.traveled);
    const nx = this.x + this.dx * step, ny = this.y + this.dy * step;
    let best = null, bd = Infinity;
    for (const u of this.game.enemiesNearSegment(this.owner.team, this.x, this.y, nx, ny, this.width)) {
      if (this.filter && !this.filter(u)) continue;
      const d = dist(this.x, this.y, u.x, u.y);
      if (d < bd) { bd = d; best = u; }
    }
    this.trail.push(P(this.x, this.y));
    if (this.trail.length > 6) this.trail.shift();
    if (best) {
      this.alive = false;
      this.x = best.x; this.y = best.y;
      this.onHit(best);
      return;
    }
    this.x = nx; this.y = ny;
    this.traveled += step;
    if (this.traveled >= this.range - 0.5) { this.alive = false; if (this.onEnd) this.onEnd(); }
  }
}
