// ===== 플레이어 유닛 (챔피언 자리) =====
class Hero extends Unit {
  constructor(game, team, base = HERO_BASE) {
    const f = LAYOUT[team].fountain;
    super(game, {
      kind: 'hero', name: base.name, team, x: f.x + 150, y: f.y - 150, radius: base.radius,
      hp: base.hp, ad: base.ad, as: base.as, armor: base.armor, mr: base.mr, range: base.range,
      ms: base.ms, projSpeed: base.projSpeed, sight: base.sight, hpRegen: base.hpRegen, windup: base.windup,
    });
    this.base = base;
    this.level = 1;
    this.xp = 0;
    this.gold = CFG.START_GOLD;
    this.goldEarned = 0;
    this.items = [null, null, null, null, null, null];
    this.buffs = {};              // id -> { t, stacks }
    this.hots = [];               // 지속 회복 효과
    this.cmd = null;
    this.path = [];
    this.repath = 0;
    this.cs = 0;
    this.deaths = 0;
    this.respawnTimer = 0;
    this.recall = null;
    this.spellCd = { heal: 0, flash: 0 };
    this.crit = 0; this.critDmg = 0; this.lifesteal = 0; this.thorns = false;
    this.aggroOnHeroTime = -99;
    this.recalcStats();
    this.hp = this.maxHp;
  }

  recalcStats() {
    const b = this.base, L = this.level - 1;
    const bonus = {};
    for (const s of this.items) {
      if (!s) continue;
      const st = ITEM_BY_ID[s.id].stats;
      if (st) for (const k in st) bonus[k] = (bonus[k] || 0) + st[k];
    }
    const buff = id => this.buffs[id];
    const dragon = buff('dragon') ? buff('dragon').stacks : 0;

    const oldMax = this.maxHp;
    this.maxHp = Math.round(b.hp + b.hpPerLvl * L + (bonus.hp || 0));
    if (oldMax && this.maxHp > oldMax && this.alive) this.hp += this.maxHp - oldMax;
    this.hp = Math.min(this.hp, this.maxHp);

    this.baseAd = b.ad + b.adPerLvl * L;
    let bonusAd = (bonus.ad || 0) + (buff('red') ? 15 : 0) + (buff('baron') ? 40 : 0);
    this.ad = (this.baseAd + bonusAd) * (1 + dragon * 0.06);
    this.bonusAd = this.ad - this.baseAd;
    this.as = Math.min(2.5, b.as * (1 + b.asPerLvl * L + (bonus.asPct || 0)));
    this.armor = (b.armor + b.armorPerLvl * L + (bonus.armor || 0)) * (1 + dragon * 0.04);
    this.mr = b.mr + b.mrPerLvl * L + (bonus.mr || 0);
    this.ms = (b.ms + (bonus.ms || 0)) * (1 + (bonus.msPct || 0) + (buff('blue') ? 0.08 : 0) + (buff('haste') ? 0.3 : 0));
    this.hpRegen = b.hpRegen + b.hpRegenPerLvl * L + (bonus.regen || 0) + (buff('blue') ? 6 : 0);
    this.crit = Math.min(1, bonus.crit || 0);
    this.critDmg = bonus.critDmg || 0;
    this.lifesteal = bonus.lifesteal || 0;
    this.thorns = !!bonus.thorns;
  }

  addBuff(id) {
    const info = BUFF_INFO[id];
    if (id === 'dragon') {
      const b = this.buffs.dragon || { t: Infinity, stacks: 0 };
      b.stacks++;
      this.buffs.dragon = b;
    } else {
      this.buffs[id] = { t: info ? info.dur : 1, stacks: 1 };
    }
    this.recalcStats();
  }

  // ---------- 명령 ----------
  orderMove(x, y) {
    if (!this.alive) return;
    this.cancelRecall();
    this.cancelWindup();
    this.cmd = { type: 'move', x, y };
    this.path = Nav.findPath(this.x, this.y, x, y);
  }

  orderAttack(t) {
    if (!this.alive || !t) return;
    this.cancelRecall();
    if (this.cmd && this.cmd.type === 'attack' && this.cmd.target === t) return;
    if (this.windupTarget !== t) this.cancelWindup();
    this.cmd = { type: 'attack', target: t };
    this.path = [];
    this.repath = 0;
  }

  orderAttackMove(x, y) {
    if (!this.alive) return;
    this.cancelRecall();
    this.cmd = { type: 'amove', x, y, target: null };
    this.path = Nav.findPath(this.x, this.y, x, y);
  }

  orderStop() {
    this.cmd = null;
    this.path = [];
    this.cancelWindup();
  }

  startRecall() {
    if (!this.alive || this.recall) return;
    this.orderStop();
    this.recall = { t: 0, dur: this.buffs.baron ? 4 : CFG.RECALL_TIME };
  }

  cancelRecall() {
    if (this.recall) this.recall = null;
  }

  castFlash(wx, wy) {
    if (!this.alive || this.spellCd.flash > 0) return false;
    const d = dist(this.x, this.y, wx, wy);
    const r = Math.min(d, SPELLS.flash.range);
    const ux = d > 0 ? (wx - this.x) / d : Math.cos(this.facing), uy = d > 0 ? (wy - this.y) / d : Math.sin(this.facing);
    let tx = this.x + ux * r, ty = this.y + uy * r;
    if (!Nav.isWalkable(tx, ty)) {
      const near = Nav.nearestWalkablePoint(tx, ty);
      if (dist(near.x, near.y, tx, ty) < 160) { tx = near.x; ty = near.y; }
      else {
        let k = r;
        while (k > 0 && !Nav.isWalkable(this.x + ux * k, this.y + uy * k)) k -= 20;
        tx = this.x + ux * Math.max(0, k); ty = this.y + uy * Math.max(0, k);
      }
    }
    this.game.addEffect({ type: 'flash', x: this.x, y: this.y, dur: 0.4 });
    this.x = tx; this.y = ty;
    this.game.addEffect({ type: 'flash', x: tx, y: ty, dur: 0.4 });
    this.cancelRecall();
    this.spellCd.flash = SPELLS.flash.cd;
    if (this.cmd && this.cmd.type === 'move') this.path = Nav.findPath(this.x, this.y, this.cmd.x, this.cmd.y);
    return true;
  }

  castHeal() {
    if (!this.alive || this.spellCd.heal > 0) return false;
    const amt = 90 + 15 * this.level;
    this.hp = Math.min(this.maxHp, this.hp + amt);
    this.game.floatText(this.x, this.y - 50, '+' + amt, '#6dff8a', 20);
    this.game.addEffect({ type: 'heal', x: this.x, y: this.y, dur: 0.6, follow: this });
    this.buffs.haste = { t: 1, stacks: 1 };
    this.recalcStats();
    this.spellCd.heal = SPELLS.heal.cd;
    return true;
  }

  useItem(idx) {
    const s = this.items[idx];
    if (!s || !this.alive) return;
    if (s.id === 'potion') {
      if (this.hots.length >= 1 && this.hots.some(h => h.src === 'potion')) return;
      this.hots.push({ src: 'potion', perSec: 10, t: 15 });
      s.count--;
      if (s.count <= 0) this.items[idx] = null;
      this.recalcStats();
    }
  }

  // ---------- 경험치 / 사망 ----------
  gainXp(amount) {
    if (this.level >= MAX_LEVEL) return;
    this.xp += amount;
    let leveled = false;
    while (this.level < MAX_LEVEL && this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
      leveled = true;
    }
    if (this.level >= MAX_LEVEL) this.xp = 0;
    if (leveled) {
      this.recalcStats();
      this.game.floatText(this.x, this.y - 70, '레벨 업!', '#e2c2ff', 22);
      this.game.addEffect({ type: 'levelup', x: this.x, y: this.y, dur: 0.8, follow: this });
    }
  }

  addGold(amount, x, y) {
    this.gold += amount;
    this.goldEarned += amount;
    if (x != null) this.game.floatText(x, y - 30, '+' + Math.round(amount), '#ffd34d', 17);
  }

  die() {
    this.alive = false;
    this.deaths++;
    this.respawnTimer = 6 + this.level * 2.2 + this.game.time / 60 * 0.4;
    this.cmd = null; this.path = []; this.recall = null; this.windup = -1;
    this.hots = [];
    for (const id of ['red', 'blue', 'baron', 'haste']) delete this.buffs[id];
    this.recalcStats();
  }

  respawn() {
    const f = LAYOUT[this.team].fountain;
    this.alive = true;
    this.x = f.x + 150; this.y = f.y - 150;
    if (this.team === TEAM.RED) { this.x = f.x - 150; this.y = f.y + 150; }
    this.hp = this.maxHp;
    this.attackCd = 0;
    this.game.announce('부활했습니다', 'good');
  }

  // ---------- 공격 ----------
  onAttackHit(t) {
    if (!t.alive) return;
    let dmg = this.ad;
    let crit = false;
    if (this.crit > 0 && Math.random() < this.crit) { dmg *= CFG.CRIT_MULT + this.critDmg; crit = true; }
    const dealt = this.game.dealDamage(this, t, dmg, { isAttack: true, crit });
    if (this.buffs.red && t.alive) this.game.dealDamage(this, t, 8 + 2 * this.level, { trueDmg: true, silent: true });
    if (this.lifesteal > 0 && dealt > 0) this.hp = Math.min(this.maxHp, this.hp + dealt * this.lifesteal);
  }

  projStyle() { return { color: '#bfe3ff', size: 7, glow: true }; }

  autoAcquire(range) {
    let best = null, bd = Infinity;
    for (const u of this.game.units) {
      if (u.team === this.team || u.team === TEAM.NEUTRAL || !this.isValidTarget(u)) continue;
      const d = this.edgeDist(u);
      if (d > range) continue;
      const sc = d + (u.isStructure ? 300 : 0);
      if (sc < bd) { bd = sc; best = u; }
    }
    return best;
  }

  followPath(dt) {
    while (this.path.length) {
      const p = this.path[0];
      if (this.moveToward(p.x, p.y, dt)) { this.path.shift(); break; }
      return false;
    }
    return this.path.length === 0;
  }

  chase(t, dt) {
    this.repath -= dt;
    if (Nav.los(this.x, this.y, t.x, t.y) || dist(this.x, this.y, t.x, t.y) < 120) {
      this.path = [];
      this.moveToward(t.x, t.y, dt);
    } else {
      if (this.repath <= 0 || !this.path.length) { this.path = Nav.findPath(this.x, this.y, t.x, t.y); this.repath = 0.3; }
      this.followPath(dt);
    }
  }

  update(dt) {
    this.moving = false;
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }
    // 버프 / 쿨다운 / 회복
    let changed = false;
    for (const id in this.buffs) {
      const b = this.buffs[id];
      b.t -= dt;
      if (b.t <= 0) { delete this.buffs[id]; changed = true; }
    }
    if (changed) this.recalcStats();
    for (const k in this.spellCd) this.spellCd[k] = Math.max(0, this.spellCd[k] - dt);
    for (const h of this.hots) { this.hp = Math.min(this.maxHp, this.hp + h.perSec * dt); h.t -= dt; }
    this.hots = this.hots.filter(h => h.t > 0);
    this.regen(dt);
    this.tickCombat(dt);

    if (this.recall) {
      this.recall.t += dt;
      if (this.recall.t >= this.recall.dur) {
        const f = LAYOUT[this.team].fountain;
        this.game.addEffect({ type: 'flash', x: this.x, y: this.y, dur: 0.5 });
        this.x = f.x + (this.team === TEAM.BLUE ? 150 : -150);
        this.y = f.y + (this.team === TEAM.BLUE ? -150 : 150);
        this.recall = null;
        this.game.addEffect({ type: 'flash', x: this.x, y: this.y, dur: 0.5 });
        if (this === this.game.player) this.game.centerCamera();
      }
      return;
    }

    const c = this.cmd;
    if (!c) {
      if (this.windup < 0) {
        const t = this.autoAcquire(this.range);
        if (t) this.tryAttack(t);
      }
      return;
    }

    if (c.type === 'move') {
      if (this.followPath(dt)) this.cmd = null;
      return;
    }

    if (c.type === 'attack' || c.type === 'amove') {
      let t = c.type === 'attack' ? c.target : c.target;
      if (c.type === 'amove') {
        if (!t || !this.isValidTarget(t) || this.edgeDist(t) > this.range + 250) {
          t = c.target = this.autoAcquire(this.range + 150);
          this.path = t ? [] : this.path;
        }
        if (!t) {
          if (!this.path.length) this.path = Nav.findPath(this.x, this.y, c.x, c.y);
          if (this.followPath(dt)) this.cmd = null;
          return;
        }
      }
      if (!this.isValidTarget(t) && !(t && t.alive && t.team === TEAM.NEUTRAL && this.game.isVisible(this.team, t))) {
        if (c.type === 'attack') { this.cmd = null; return; }
        c.target = null;
        return;
      }
      if (this.inRange(t)) {
        this.path = [];
        this.tryAttack(t);
      } else if (this.windup < 0) {
        this.chase(t, dt);
      }
    }
  }

  isValidTarget(t) {
    if (t && t.team === TEAM.NEUTRAL) return t.alive && t.targetable && this.game.isVisible(this.team, t);
    return super.isValidTarget(t);
  }
}
