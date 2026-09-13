// ===== 구조물: 포탑 / 억제기 / 넥서스 / 우물 =====
class Structure extends Unit {
  constructor(game, o) {
    super(game, o);
    this.isStructure = true;
    this.blocks = true;
    Nav.setBlocker(this.x, this.y, this.radius, true);
  }
  moveToward() { return false; }
  onDestroyed() {
    if (this.blocks) Nav.setBlocker(this.x, this.y, this.radius, false);
  }
}

class Turret extends Structure {
  constructor(game, team, lane, tier, pos) {
    const s = TURRET_STATS[tier], c = TURRET_COMMON;
    super(game, {
      kind: 'turret', name: s.name, team, x: pos.x, y: pos.y, radius: c.radius,
      hp: s.hp, armor: s.armor, ad: c.ad, as: c.as, range: c.range, projSpeed: c.projSpeed, sight: c.sight, windup: 0.15,
    });
    this.lane = lane;
    this.tier = tier;
    this.ramp = 0;
    this.rampTarget = null;
  }

  projStyle() { return { color: this.team === TEAM.BLUE ? '#7fd0ff' : '#ff8a5a', size: 12, glow: true }; }

  inRange(t, extra = 0) { return dist(this.x, this.y, t.x, t.y) - t.radius <= this.range + extra; }

  pickTarget() {
    let best = null, bs = Infinity;
    for (const u of this.game.units) {
      if (u.team === this.team || u.team === TEAM.NEUTRAL || !this.isValidTarget(u) || !this.inRange(u)) continue;
      const d = dist(this.x, this.y, u.x, u.y);
      const sc = (u.kind === 'hero' ? 100000 : 0) + d;
      if (sc < bs) { bs = sc; best = u; }
    }
    return best;
  }

  update(dt) {
    this.tickCombat(dt);
    const t = this.target;
    if (!t || !this.isValidTarget(t) || !this.inRange(t)) this.target = this.pickTarget();
    // 아군 영웅을 공격한 적 영웅이 사거리 안에 있으면 우선 공격 (챔피언 추가 대비)
    for (const u of this.game.heroes) {
      if (u.team !== this.team && u.alive && u.aggroOnHeroTime && this.game.time - u.aggroOnHeroTime < 0.5 && this.inRange(u) && this.isValidTarget(u)) this.target = u;
    }
    if (this.target) this.tryAttack(this.target);
  }

  attackDamageVs(t) {
    if (t.kind === 'minion') return t.maxHp * t.towerPct;
    const base = TURRET_COMMON.ad + TURRET_COMMON.adPerMin * (this.game.time / 60);
    if (t.kind === 'hero') {
      if (this.rampTarget !== t) { this.rampTarget = t; this.ramp = 0; }
      const dmg = base * (1 + this.ramp);
      this.ramp = Math.min(TURRET_COMMON.rampMax, this.ramp + TURRET_COMMON.rampPerHit);
      return dmg;
    }
    return base;
  }

  onAttackHit(t) {
    if (!t.alive) return;
    if (t.kind === 'minion') this.game.dealDamage(this, t, this.attackDamageVs(t), { isAttack: true, trueDmg: true });
    else this.game.dealDamage(this, t, this.attackDamageVs(t), { isAttack: true });
  }
}

class Inhibitor extends Structure {
  constructor(game, team, lane, pos) {
    const s = INHIB_STATS;
    super(game, { kind: 'inhibitor', name: s.name, team, x: pos.x, y: pos.y, radius: s.radius, hp: s.hp, armor: s.armor, sight: s.sight });
    this.lane = lane;
    this.respawnTimer = 0;
    this.blocks = false;
    Nav.setBlocker(this.x, this.y, this.radius, false);
  }
  update(dt) {
    if (this.alive) return;
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.alive = true;
      this.hp = this.maxHp;
      this.game.announce((this.team === this.game.player.team ? '아군' : '적') + ' 억제기가 재생성되었습니다', 'info');
    }
  }
  onDestroyed() {
    this.respawnTimer = CFG.INHIB_RESPAWN;
  }
}

class Nexus extends Structure {
  constructor(game, team, pos) {
    const s = NEXUS_STATS;
    super(game, { kind: 'nexus', name: s.name, team, x: pos.x, y: pos.y, radius: s.radius, hp: s.hp, armor: s.armor, sight: s.sight, hpRegen: s.regen });
  }
  update(dt) {
    if (this.alive && this.game.time - this.lastDamagedTime > 8) this.regen(dt);
  }
}

class Fountain extends Structure {
  constructor(game, team, pos) {
    super(game, { kind: 'fountain', name: '우물', team, x: pos.x, y: pos.y, radius: 90, hp: 99999, sight: 1400 });
    this.targetable = false;
    this.blocks = false;
    Nav.setBlocker(this.x, this.y, this.radius, false);
    this.laserRange = 1000;
    this.laserTargets = [];
  }
  update(dt) {
    this.laserTargets.length = 0;
    for (const u of this.game.units) {
      if (!u.alive || u.isStructure) continue;
      const d = dist(this.x, this.y, u.x, u.y);
      if (u.team === this.team) {
        if (d < CFG.FOUNTAIN_RADIUS && u.kind === 'hero') {
          u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.12 * dt);
        }
      } else if (u.team !== TEAM.NEUTRAL && d < this.laserRange) {
        this.laserTargets.push(u);
        this.game.dealDamage(this, u, 1200 * dt, { trueDmg: true, silent: true });
      }
    }
  }
}
