// ===== 게임 상태 / 규칙 =====
const LANES = ['top', 'mid', 'bot'];

class Game {
  constructor(champId = 'orianna') {
    this.champId = CHAMPIONS[champId] ? champId : 'orianna';
    this.time = 0;
    this.units = [];
    this.heroes = [];
    this.structures = [];
    this.projectiles = [];
    this.effects = [];
    this.floaters = [];
    this.camps = [];
    this.spawnQueue = [];
    this.waveCount = 0;
    this.nextWave = CFG.FIRST_WAVE;
    this.visible = [new Set(), new Set()];
    this.visTimer = 0;
    this.towersKilled = [0, 0];     // 팀별로 "파괴한" 포탑 수
    this.paused = false;
    this.over = false;
    this.winner = null;
    this.endTimer = 0;
    this.endShown = false;
    this.selected = null;
    this.cam = { x: 0, y: 0, zoom: 1, locked: true };
    this.timeline = [];
    this.init();
  }

  init() {
    Nav.block.fill(0);
    this.teamStructs = [0, 1].map(team => {
      const L = LAYOUT[team];
      const ts = { lanes: {}, nexusTurrets: [], nexus: null, fountain: null };
      for (const lane of LANES) {
        const l = L.lanes[lane];
        ts.lanes[lane] = {
          outer: this.addUnit(new Turret(this, team, lane, 'outer', l.outer)),
          inner: this.addUnit(new Turret(this, team, lane, 'inner', l.inner)),
          inhibTurret: this.addUnit(new Turret(this, team, lane, 'inhib', l.inhibTurret)),
          inhib: this.addUnit(new Inhibitor(this, team, lane, l.inhib)),
        };
      }
      ts.nexusTurrets = L.nexusTurrets.map(p => this.addUnit(new Turret(this, team, null, 'nexus', p)));
      ts.nexus = this.addUnit(new Nexus(this, team, L.nexus));
      ts.fountain = this.addUnit(new Fountain(this, team, L.fountain));
      return ts;
    });
    for (const def of CAMP_DEFS) this.camps.push(new Camp(this, def));
    this.player = this.addUnit(CHAMPIONS[this.champId].create(this, TEAM.BLUE));
    this.centerCamera();

    // 시간 이벤트 안내
    const pl = this.player;
    this.timeline = [
      { at: 0.5, fn: () => this.announce('전장에 오신 것을 환영합니다!', 'info') },
      { at: CFG.FIRST_WAVE - 15, fn: () => this.announce('15초 후 미니언이 생성됩니다', 'info') },
      { at: CFG.CAMP_FIRST - 0.1, fn: () => this.announce('정글 몬스터가 나타났습니다', 'info') },
    ];
    if (pl.abilityDefs) this.timeline.push({ at: 2.5, fn: () => pl.skillPoints > 0 && this.announce('Shift + Q/W/E/R 로 스킬을 배우세요', 'info') });
    if ((pl.base.role || '').includes('미드')) this.timeline.push({ at: 5, fn: () => this.announce(pl.base.name + ': 미드 라인으로 이동하세요', 'info') });
    this.timeline.sort((a, b) => a.at - b.at);
  }

  addUnit(u) {
    this.units.push(u);
    if (u.kind === 'hero') this.heroes.push(u);
    if (u.isStructure) this.structures.push(u);
    return u;
  }
  addProjectile(p) { this.projectiles.push(p); }
  addEffect(e) { e.t = 0; this.effects.push(e); }
  floatText(x, y, text, color, size = 16) {
    this.floaters.push({ x: x + rand(-12, 12), y, text, color, size, t: 0, dur: 1.0 });
  }
  announce(text, cls = 'info') { if (typeof UI !== 'undefined') UI.announce(text, cls); }

  centerCamera() { this.cam.x = this.player.x; this.cam.y = this.player.y; }

  canShop(hero) {
    const f = LAYOUT[hero.team].fountain;
    return !hero.alive || dist(hero.x, hero.y, f.x, f.y) < CFG.FOUNTAIN_RADIUS + 250;
  }

  // ---------- 업데이트 ----------
  update(dt) {
    if (this.over) {
      this.updateFx(dt);
      this.endTimer -= dt;
      if (this.endTimer <= 0 && !this.endShown) { this.endShown = true; UI.showEnd(this); }
      return;
    }
    this.time += dt;

    while (this.timeline.length && this.time >= this.timeline[0].at) this.timeline.shift().fn();

    if (this.time > CFG.PASSIVE_GOLD_START) {
      for (const h of this.heroes) { h.gold += CFG.PASSIVE_GOLD * dt; h.goldEarned += CFG.PASSIVE_GOLD * dt; }
    }

    if (this.time >= this.nextWave) {
      this.spawnWave();
      this.nextWave += CFG.WAVE_INTERVAL;
    }
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.time) {
      const q = this.spawnQueue.shift();
      this.addUnit(new Minion(this, q.team, q.lane, q.type, q.upgrades));
    }

    for (const c of this.camps) c.update(dt);

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (u.alive) {
        u.tickStatus(dt);
        if (u.updateCC(dt)) continue;     // 에어본 중에는 행동 불가
      }
      if (u.alive || u.kind === 'hero' || u.kind === 'inhibitor') u.update(dt);
    }

    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter(p => p.alive);

    this.separate();
    this.updateFx(dt);

    this.visTimer -= dt;
    if (this.visTimer <= 0) { this.visTimer = 0.1; this.updateVision(); }

    this.units = this.units.filter(u => u.alive || u.isStructure || u.kind === 'hero');
    if (this.selected && !this.selected.alive && !this.selected.isStructure) this.selected = null;
  }

  updateFx(dt) {
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter(e => e.t < e.dur);
    for (const f of this.floaters) { f.t += dt; f.y -= 40 * dt; }
    this.floaters = this.floaters.filter(f => f.t < f.dur);
  }

  spawnWave() {
    this.waveCount++;
    const upgrades = Math.floor(this.time / CFG.MINION_UPGRADE_EVERY);
    for (const team of [TEAM.BLUE, TEAM.RED]) {
      const enemy = this.teamStructs[1 - team];
      const allDown = LANES.every(l => !enemy.lanes[l].inhib.alive);
      for (const lane of LANES) {
        const types = [];
        if (!enemy.lanes[lane].inhib.alive) { types.push('super'); if (allDown) types.push('super'); }
        types.push('melee', 'melee', 'melee');
        if (types[0] !== 'super' && this.waveCount % CFG.SIEGE_EVERY === 0) types.push('siege');
        types.push('caster', 'caster', 'caster');
        types.forEach((type, i) => this.spawnQueue.push({ at: this.time + i * CFG.MINION_SPAWN_GAP, team, lane, type, upgrades }));
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    if (this.waveCount === 1) this.announce('미니언이 생성되었습니다!', 'info');
  }

  // 유닛끼리 겹치지 않게 밀어내기
  separate() {
    const arr = [];
    for (const u of this.units) if (u.alive && !u.isStructure && !u.displace) arr.push(u);
    const n = arr.length;
    for (let i = 0; i < n; i++) {
      const a = arr[i];
      for (let j = i + 1; j < n; j++) {
        const b = arr[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const minD = (a.radius + b.radius) * 0.8;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        const d = Math.sqrt(d2) || 0.01;
        const overlap = (minD - d) * 0.5;
        const nx = d2 > 0 ? dx / d : Math.random() - 0.5, ny = d2 > 0 ? dy / d : Math.random() - 0.5;
        const wa = this.pushWeight(a), wb = this.pushWeight(b);
        const sa = wb / (wa + wb), sb = wa / (wa + wb);
        a.tryMove(-nx * overlap * sa * 2, -ny * overlap * sa * 2);
        b.tryMove(nx * overlap * sb * 2, ny * overlap * sb * 2);
      }
      for (const s of this.structures) {
        if (!s.alive || !s.blocks) continue;
        const dx = a.x - s.x, dy = a.y - s.y;
        const minD = s.radius + a.radius * 0.7;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        const d = Math.sqrt(d2) || 0.01;
        a.tryMove(dx / d * (minD - d), dy / d * (minD - d));
      }
    }
  }

  pushWeight(u) {
    if (u.kind === 'monster') return u.ms <= 0 ? 1000 : (u.radius > 50 ? 6 : 2);
    if (u.kind === 'hero') return u.windup >= 0 ? 4 : 1.5;
    if (u.kind === 'minion') return (u.windup >= 0 || u.attackCd > 0 && !u.moving) ? 2.5 : 1;
    return 1;
  }

  // ---------- 시야 ----------
  updateVision() {
    for (const team of [TEAM.BLUE, TEAM.RED]) {
      const srcs = this.units.filter(u => u.alive && u.team === team);
      const vis = this.visible[team];
      vis.clear();
      for (const u of this.units) {
        if (!u.alive || u.team === team || u.isStructure) continue;
        for (const s of srcs) {
          const r = s.sight + u.radius;
          if (dist2(s.x, s.y, u.x, u.y) <= r * r) { vis.add(u.id); break; }
        }
      }
    }
  }

  isVisible(team, u) {
    if (u.team === team || u.isStructure) return true;
    return this.visible[team].has(u.id);
  }

  // ---------- 구조물 보호 규칙 ----------
  anyInhibDown(team) {
    const ts = this.teamStructs[team];
    return LANES.some(l => !ts.lanes[l].inhib.alive);
  }

  isVulnerable(u) {
    if (!u.alive || !u.targetable) return false;
    if (u.kind === 'monster') return !u.resetting;
    if (!u.isStructure) return true;
    const ts = this.teamStructs[u.team];
    if (u.kind === 'turret') {
      if (u.tier === 'outer') return true;
      if (u.tier === 'inner') return !ts.lanes[u.lane].outer.alive;
      if (u.tier === 'inhib') return !ts.lanes[u.lane].inner.alive;
      if (u.tier === 'nexus') return this.anyInhibDown(u.team);
    }
    if (u.kind === 'inhibitor') return !ts.lanes[u.lane].inhibTurret.alive;
    if (u.kind === 'nexus') return ts.nexusTurrets.every(t => !t.alive) && this.anyInhibDown(u.team);
    return true;
  }

  protectionReason(u) {
    if (u.kind === 'turret') {
      if (u.tier === 'inner') return '외곽 포탑을 먼저 파괴해야 합니다';
      if (u.tier === 'inhib') return '내부 포탑을 먼저 파괴해야 합니다';
      if (u.tier === 'nexus') return '억제기를 먼저 파괴해야 합니다';
    }
    if (u.kind === 'inhibitor') return '억제기 포탑을 먼저 파괴해야 합니다';
    if (u.kind === 'nexus') return '넥서스 포탑과 억제기를 먼저 파괴해야 합니다';
    return '';
  }

  baronNear(u) {
    for (const h of this.heroes) {
      if (h.team === u.team && h.alive && h.buffs.baron && dist2(h.x, h.y, u.x, u.y) < 1100 * 1100) return true;
    }
    return false;
  }

  // ---------- 스킬 대상 찾기 (구조물 제외, 시야와 무관) ----------
  enemiesInRadius(team, x, y, r) {
    const out = [];
    for (const u of this.units) {
      if (!u.alive || u.isStructure || u.team === team || !this.isVulnerable(u)) continue;
      const rr = r + u.radius;
      if (dist2(u.x, u.y, x, y) <= rr * rr) out.push(u);
    }
    return out;
  }

  enemiesNearSegment(team, ax, ay, bx, by, width) {
    const out = [];
    for (const u of this.units) {
      if (!u.alive || u.isStructure || u.team === team || !this.isVulnerable(u)) continue;
      if (distToSegment(u.x, u.y, ax, ay, bx, by) <= width + u.radius) out.push(u);
    }
    return out;
  }

  // ---------- 피해 / 사망 ----------
  // opts: isAttack(기본 공격), crit, magic(마법 피해), trueDmg(고정 피해), ability, silent
  dealDamage(src, t, amount, opts = {}) {
    if (!t.alive || !this.isVulnerable(t)) return 0;
    let dmg = amount;
    if (src && src.kind === 'minion') {
      if (this.baronNear(src)) dmg *= 1.5;
      if (t.isStructure) dmg *= 0.6;
    }
    if (t.kind === 'minion' && this.baronNear(t)) dmg *= 0.5;
    if (opts.magic) {
      let mr = t.mr || 0;
      if (src && mr > 0) mr = Math.max(0, mr * (1 - (src.mpenPct || 0)) - (src.mpenFlat || 0));
      dmg = mitigate(dmg, mr);
    } else if (!opts.trueDmg) {
      dmg = mitigate(dmg, t.armor);
    }
    dmg = Math.max(0, dmg);
    const dealt = dmg;
    if (t.shields) dmg = t.absorbShield(dmg);

    t.hp -= dmg;
    t.hitFlash = 0.1;
    t.lastDamagedTime = this.time;
    t.lastDamagedBy = src;
    if (src && src.kind === 'hero' && t.kind === 'hero') src.aggroOnHeroTime = this.time;
    if (src && src.kind === 'hero') src.lastAggroTime = this.time;
    t.onDamaged(src, dmg);
    if (t.kind === 'hero' && t.recall) t.cancelRecall();

    if (!opts.silent) {
      if (src === this.player) {
        const color = opts.crit ? '#ff9a2e' : opts.magic ? '#c9a0ff' : '#ffffff';
        this.floatText(t.x, t.y - t.radius - 10, Math.round(dealt) + (opts.crit ? '!' : ''), color, opts.crit ? 22 : opts.ability ? 18 : 15);
      } else if (t === this.player) {
        this.floatText(t.x, t.y - t.radius - 10, '-' + Math.round(dealt), '#ff5a5a', 15);
      }
    }

    if (opts.isAttack && t.thorns && src && src.alive && !src.isStructure) {
      this.dealDamage(t, src, 15 + t.armor * 0.15, { trueDmg: true, silent: true });
    }

    if (t.hp <= 0) { t.hp = 0; this.onDeath(t, src); }
    return dealt;
  }

  onDeath(t, killer) {
    const mine = t.team === this.player.team;
    this.addEffect({ type: 'death', x: t.x, y: t.y, r: t.radius, color: TEAM_COLOR[t.team], dur: t.isStructure ? 1.2 : 0.5, big: t.isStructure });

    if (t.kind === 'hero') {
      t.die();
      if (t === this.player) this.announce('당하셨습니다!', 'bad');
      return;
    }
    t.alive = false;
    t.windup = -1;
    t.displace = null;
    if (t.isStructure) t.onDestroyed();

    const killerHero = killer && killer.kind === 'hero' ? killer : null;

    if (t.kind === 'minion' || t.kind === 'monster') {
      if (killerHero) { killerHero.addGold(t.gold, t.x, t.y); killerHero.cs++; }
      for (const h of this.heroes) {
        if (h.alive && h.team !== t.team && dist(h.x, h.y, t.x, t.y) < CFG.XP_RANGE) {
          if (t.kind === 'monster' && h !== killerHero) continue;
          h.gainXp(t.xp);
        }
      }
      if (t.kind === 'monster' && killerHero && t.stats.buff) {
        const b = t.stats.buff;
        if (b === 'dragon' || b === 'baron') {
          for (const h of this.heroes) if (h.team === killerHero.team && h.alive) h.addBuff(b);
          for (const h of this.heroes) if (h.team === killerHero.team) h.addGold(t.gold);
          this.announce((killerHero.team === this.player.team ? '아군이 ' : '적이 ') + t.name + '을(를) 처치했습니다!', killerHero.team === this.player.team ? 'good' : 'bad');
        } else {
          killerHero.addBuff(b);
          if (killerHero === this.player) this.announce(BUFF_INFO[b].name + ' 획득!', 'good');
        }
      }
      return;
    }

    if (t.kind === 'turret') {
      this.towersKilled[1 - t.team]++;
      for (const h of this.heroes) {
        if (h.team === t.team) continue;
        const near = h.alive && dist(h.x, h.y, t.x, t.y) < 1500;
        h.addGold(near ? TURRET_COMMON.gold : 100, near ? h.x : null, h.y);
        if (near) h.gainXp(TURRET_COMMON.xp);
      }
      this.announce(mine ? '아군 포탑이 파괴되었습니다' : '적 포탑을 파괴했습니다', mine ? 'bad' : 'good');
      return;
    }

    if (t.kind === 'inhibitor') {
      for (const h of this.heroes) if (h.team !== t.team) h.addGold(50);
      this.announce(mine ? '아군 억제기가 파괴되었습니다' : '적 억제기를 파괴했습니다', mine ? 'bad' : 'good');
      return;
    }

    if (t.kind === 'nexus') {
      this.over = true;
      this.winner = 1 - t.team;
      this.endTimer = 2.8;
      this.player.orderStop();
      this.announce(this.winner === this.player.team ? '승리!' : '패배!', this.winner === this.player.team ? 'good' : 'bad');
    }
  }

  // 화면 표시용: 마우스 아래 유닛 찾기
  unitAt(wx, wy, team) {
    let best = null, bd = Infinity;
    for (const u of this.units) {
      if (!u.alive || !u.targetable || !this.isVisible(team, u)) continue;
      const d = dist(wx, wy, u.x, u.y - (u.isStructure ? u.radius * 0.5 : 0));
      const r = u.radius + (u.isStructure ? 30 : 18);
      if (d > r) continue;
      const sc = d - (u.team !== team ? 40 : 0) + (u.isStructure ? 60 : 0);
      if (sc < bd) { bd = sc; best = u; }
    }
    return best;
  }
}
