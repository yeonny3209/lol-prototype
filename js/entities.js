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
  }

  getAS() { return this.as; }
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
    if (this.hp < this.maxHp && this.hpRegen > 0) this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * dt);
  }

  // 이동: 구조물 주변은 미끄러지듯 돌아가고, 벽은 축별로 미끄러짐
  moveToward(tx, ty, dt, speed = this.ms) {
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
    this.facing = Math.atan2(vy, vx);
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
      kind: 'minion', name: s.name, team, x: sp.x + rand(-20, 20), y: sp.y + rand(-20, 20),
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
    this.retarget = Math.random() * 0.3;
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
    this.stuckT = moved < this.ms * dt * 0.25 ? (this.stuckT || 0) + dt : 0;
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
      hp: s.hp, ad: s.ad, as: s.as, armor: s.armor, range: s.range, ms: s.ms, projSpeed: s.projSpeed || 0, sight: 600, windup: 0.35,
    });
    this.mtype = mtype;
    this.stats = s;
    this.camp = camp;
    this.home = P(x, y);
    this.gold = s.gold; this.xp = s.xp;
    this.aggro = null;
    this.resetting = false;
    this.facing = Math.random() * Math.PI * 2;
    if (mtype === 'dragon' || mtype === 'baron') {
      const mins = game.time / 60;
      this.maxHp = this.hp = Math.round(s.hp * (1 + mins * 0.03));
      this.ad = s.ad * (1 + mins * 0.02);
    }
  }

  projStyle() { return { color: this.stats.color, size: this.mtype === 'baron' ? 14 : 10 }; }

  isValidTarget(t) { return t && t.alive && t.targetable && t.team !== this.team; }

  onDamaged(src) {
    if (!src || src.team === TEAM.NEUTRAL || this.resetting) return;
    if (!this.aggro) this.camp.aggroAll(src);
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
      const leash = this.mtype === 'baron' || this.mtype === 'dragon' ? 900 : 750;
      const bored = this.game.time - this.lastDamagedTime > 6 && !this.inRange(a);
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
        x += Math.cos(a) * 95; y += Math.sin(a) * 95;
      }
      const m = new Monster(this.game, this, type, x, y);
      this.monsters.push(m);
      this.game.addUnit(m);
    });
    if (this.type === 'dragon' || this.type === 'baron') this.game.announce(this.info.label + '이(가) 나타났습니다!', 'info');
  }

  aggroAll(src) {
    for (const m of this.monsters) if (m.alive && !m.resetting && !m.aggro) m.aggro = src;
  }
}

// ---------------- 투사체 ----------------
class Projectile {
  constructor(game, src, target, speed, onHit, style) {
    this.game = game;
    this.x = src.x + Math.cos(src.facing) * src.radius * 0.6;
    this.y = src.y + Math.sin(src.facing) * src.radius * 0.6 - (src.isStructure ? src.radius * 1.4 : 10);
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
