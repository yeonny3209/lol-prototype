// ===== 게임 상태 / 규칙 =====
const LANES = ['top', 'mid', 'bot'];

// 와드 (시야만 제공, 공격 대상이 아님)
class Ward {
  constructor(game, owner, x, y, type, dur) {
    this.id = NEXT_ID++;
    this.kind = 'ward';
    this.game = game;
    this.owner = owner;
    this.team = owner.team;
    this.name = type === 'control' ? '제어 와드' : type === 'farsight' ? '망원형 와드' : '투명 와드';
    this.x = x; this.y = y;
    this.type = type;
    this.radius = 22;
    this.alive = true;
    this.targetable = false;
    this.sight = type === 'farsight' ? 500 : 900;
    this.t = dur;
    this.maxT = dur;
  }
}

class Game {
  // setup: 혼자 하기 = { champ, role, spells, runes, practice } / 1대1 = { mode: 'pvp', seed, blue, red, localTeam }
  constructor(setup = {}) {
    this.setup = setup;
    this.mode = setup.mode === 'pvp' ? 'pvp' : 'solo';
    const localSetup = this.mode === 'pvp' ? (setup.localTeam === TEAM.RED ? setup.red : setup.blue) || {} : setup;
    this.champId = CHAMPIONS[localSetup.champ] ? localSetup.champ : 'orianna';
    CFG.PRACTICE_CHAMP_EFFECTS = this.mode === 'solo' && setup.practice !== false;
    this.seed = Number.isInteger(setup.seed) ? setup.seed : (Math.random() * 2147483647) | 0;
    this.kills = [0, 0];
    this.firstBlood = false;
    this.disconnected = false;
    this.time = 0;
    this.units = [];
    this.heroes = [];
    this.structures = [];
    this.projectiles = [];
    this.skillshots = [];
    this.effects = [];
    this.floaters = [];
    this.camps = [];
    this.wards = [];
    this.dots = [];
    this.zones = [];
    this.timers = [];
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
    // 1대1에서 두 컴퓨터가 같은 id·같은 난수로 시작하도록 초기화
    NEXT_ID = 1;
    Rng.seed(this.seed);
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
    if (this.mode === 'pvp') {
      const mk = (team, s) => { const st = Game.sanitize(s); return this.addUnit(CHAMPIONS[st.champ].create(this, team, st)); };
      const blue = mk(TEAM.BLUE, this.setup.blue);
      const red = mk(TEAM.RED, this.setup.red);
      this.player = this.setup.localTeam === TEAM.RED ? red : blue;
    } else {
      this.player = this.addUnit(CHAMPIONS[this.champId].create(this, TEAM.BLUE, this.setup));
    }
    for (const h of this.heroes) Quests.init(this, h);
    this.centerCamera();

    // 시간 이벤트 안내
    const pl = this.player;
    this.timeline = [
      { at: 0.5, fn: () => this.announce('전장에 오신 것을 환영합니다!', 'info') },
      { at: CFG.FIRST_WAVE - 15, fn: () => this.announce('15초 후 미니언이 생성됩니다', 'info') },
      { at: CFG.CAMP_FIRST - 0.1, fn: () => this.announce('정글 몬스터가 나타났습니다', 'info') },
      { at: 600, fn: () => this.announce('순간이동이 강력 순간이동으로 강화되었습니다', 'info') },
    ];
    if (pl.abilityDefs) this.timeline.push({ at: 2.5, fn: () => pl.skillPoints > 0 && this.announce((Controls.wasd() ? 'Alt + 1~4' : 'Shift + Q/W/E/R') + ' 로 스킬을 배우세요', 'info') });
    this.timeline.push({ at: 5, fn: () => this.announce(pl.base.name + ' · ' + ROLES[pl.role].name + ' 퀘스트를 진행하세요', 'info') });
    if (this.mode === 'pvp') {
      const foe = this.heroes.find(h => h !== pl);
      this.timeline.push({ at: 1.5, fn: () => this.announce('1대1 대결! 상대: ' + foe.base.name + ' — 적 넥서스를 파괴하세요', 'info') });
    }
    this.timeline.sort((a, b) => a.at - b.at);
  }

  addUnit(u) {
    this.units.push(u);
    if (u.kind === 'hero') this.heroes.push(u);
    if (u.isStructure) this.structures.push(u);
    return u;
  }
  addProjectile(p) { this.projectiles.push(p); }
  addSkillShot(s) { this.skillshots.push(s); return s; }
  addEffect(e) { e.t = 0; this.effects.push(e); }
  floatText(x, y, text, color, size = 16) {
    this.floaters.push({ x: x + rand(-12, 12), y, text, color, size, t: 0, dur: 1.0 });
  }
  announce(text, cls = 'info') { if (typeof UI !== 'undefined') UI.announce(text, cls); }
  later(delay, fn) { this.timers.push({ at: this.time + delay, fn }); }

  centerCamera() { this.cam.x = this.player.x; this.cam.y = this.player.y; }

  canShop(hero) {
    const f = LAYOUT[hero.team].fountain;
    return !hero.alive || dist(hero.x, hero.y, f.x, f.y) < CFG.FOUNTAIN_RADIUS + 250;
  }

  // ---------- 와드 ----------
  addWard(owner, x, y, type, dur) {
    const p = Nav.isWalkable(x, y) ? P(x, y) : Nav.nearestWalkablePoint(x, y);
    const w = new Ward(this, owner, p.x, p.y, type, dur);
    const mine = this.wards.filter(o => o.alive && o.owner === owner && (o.type === 'control') === (type === 'control'));
    const limit = type === 'control' ? 1 : 3;
    if (mine.length >= limit) mine[0].alive = false;
    this.wards.push(w);
    this.addEffect({ type: 'pulse', x: w.x, y: w.y, r: 60, color: type === 'control' ? '#ff6a6a' : '#ffe27a', dur: 0.4 });
    return w;
  }

  // ---------- 지속 피해 / 장판 ----------
  // o: { total, dur, type, tick, monsterBonusPerTick, cap }
  addDot(src, t, key, o) {
    const id = src.id + ':' + t.id + ':' + key;
    const old = this.dots.find(d => d.id === id);
    const tick = o.tick || 0.5;
    const d = { id, src, t, key, perTick: o.total / Math.max(1, Math.round(o.dur / tick)), tick, left: o.dur, next: tick, type: o.type || 'magic', monsterBonusPerTick: o.monsterBonusPerTick || 0, cap: o.cap || 0, perTickFn: o.perTickFn || null };
    if (old) Object.assign(old, d); else this.dots.push(d);
  }

  // o: { x, y, r, dur, team, follow, slow, dps, src, color, onTick }
  addZone(o) {
    const z = Object.assign({ t: 0, acc: 0 }, o);
    this.zones.push(z);
    return z;
  }

  applySlow(src, t, id, pct, dur, decay) {
    if (!t.alive || t.isStructure) return;
    t.addSlow(id, pct, dur, decay);
    if (src && src.fxEvent && champLike(t)) src.fxEvent('impairApplied', t, 'slow');
  }

  applyKnock(src, t, tx, ty, dur, height, opts) {
    if (!t.knockTo(tx, ty, dur, height, opts)) return false;
    if (src && src.fxEvent && champLike(t)) src.fxEvent('impairApplied', t, 'immobilize');
    return true;
  }

  applyStun(src, t, dur) {
    if (!t.alive || !t.addStun) return 0;
    const d = t.addStun(dur);
    if (d > 0 && src && src.fxEvent && champLike(t)) src.fxEvent('impairApplied', t, 'immobilize');
    return d;
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
    if (this.timers.length) {
      const due = this.timers.filter(t => t.at <= this.time);
      if (due.length) { this.timers = this.timers.filter(t => t.at > this.time); for (const t of due) t.fn(); }
    }

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
        if (u.updateCC(dt)) { if (u.kind === 'hero') { u.championTick(dt); Spells.tick(u, dt); } continue; }
      }
      if (u.alive || u.kind === 'hero' || u.kind === 'inhibitor') u.update(dt);
    }

    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter(p => p.alive);
    for (const s of this.skillshots) s.update(dt);
    this.skillshots = this.skillshots.filter(s => s.alive);

    this.updateDots(dt);
    this.updateZones(dt);
    for (const w of this.wards) { w.t -= dt; if (w.t <= 0) w.alive = false; }
    this.wards = this.wards.filter(w => w.alive);

    this.separate();
    this.updateFx(dt);

    this.visTimer -= dt;
    if (this.visTimer <= 0) { this.visTimer = 0.1; this.updateVision(); }

    this.units = this.units.filter(u => u.alive || u.isStructure || u.kind === 'hero');
    if (this.selected && !this.selected.alive && !this.selected.isStructure) this.selected = null;
  }

  updateDots(dt) {
    for (const d of this.dots) {
      if (!d.t.alive) { d.left = 0; continue; }
      d.left -= dt;
      d.next -= dt;
      while (d.next <= 1e-6 && d.t.alive) {
        d.next += d.tick;
        let amt = d.perTickFn ? d.perTickFn(d) : d.perTick;
        if (d.t.kind === 'monster') { amt += d.monsterBonusPerTick; if (d.cap) amt = Math.min(amt, d.cap); }
        this.dealDamage(d.src, d.t, amt, { type: d.type, dot: true, proc: true, silent: d.src !== this.player });
      }
    }
    this.dots = this.dots.filter(d => d.left > 0 && d.t.alive);
  }

  updateZones(dt) {
    for (const z of this.zones) {
      z.t += dt;
      if (z.follow) { z.x = z.follow.x; z.y = z.follow.y; }
      if (z.slow) {
        for (const u of this.enemiesInRadius(z.team, z.x, z.y, z.r)) this.applySlow(z.src, u, 'zone:' + (z.key || 'z'), z.slow, 0.25);
      }
      if (z.dps) {
        z.acc += dt;
        while (z.acc >= 0.25) {
          z.acc -= 0.25;
          for (const u of this.enemiesInRadius(z.team, z.x, z.y, z.r)) this.dealDamage(z.src, u, z.dps * 0.25, { type: z.type || 'magic', dot: true, proc: true, aoe: true, silent: true });
        }
      }
      if (z.onTick) z.onTick(z, dt);
    }
    this.zones = this.zones.filter(z => z.t < z.dur);
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
    for (const u of this.units) if (u.alive && !u.isStructure && !u.displace && u.stasisT <= 0) arr.push(u);
    const n = arr.length;
    for (let i = 0; i < n; i++) {
      const a = arr[i];
      for (let j = i + 1; j < n; j++) {
        const b = arr[j];
        if (a.ghostT > 0 || b.ghostT > 0 || a.dash || b.dash) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const minD = (a.radius + b.radius) * 0.8;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        const d = Math.sqrt(d2) || 0.01;
        const overlap = (minD - d) * 0.5;
        const nx = d2 > 0 ? dx / d : rng() - 0.5, ny = d2 > 0 ? dy / d : rng() - 0.5;
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
      const srcs = this.units.filter(u => u.alive && u.team === team).concat(this.wards.filter(w => w.team === team));
      const vis = this.visible[team];
      vis.clear();
      for (const u of this.units) {
        if (!u.alive || u.team === team || u.isStructure) continue;
        for (const s of srcs) {
          const r = s.sight + u.radius;
          if (dist2(s.x, s.y, u.x, u.y) <= r * r) { vis.add(u.id); break; }
        }
      }
      // 영웅이 적에게 보이는지 (그림자 검 '밤의 추적자' 등)
      for (const h of this.heroes) {
        if (h.team !== team) continue;
        const enemySrcs = this.units.filter(u => u.alive && u.team === 1 - team);
        h.seenByEnemy = enemySrcs.some(s => dist2(s.x, s.y, h.x, h.y) <= (s.sight + h.radius) ** 2);
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
    if (!u.alive || !u.targetable || u.stasisT > 0) return false;
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

  alliesInRadius(team, x, y, r, kinds) {
    const out = [];
    for (const u of this.units) {
      if (!u.alive || u.team !== team || u.isStructure) continue;
      if (kinds && !kinds.includes(u.kind)) continue;
      if (dist2(u.x, u.y, x, y) <= (r + u.radius) ** 2) out.push(u);
    }
    return out;
  }

  // ---------- 피해 / 사망 ----------
  // opts: type('physical'|'magic'|'true'), isAttack(기본 공격), crit, onHit, ability(챔피언 스킬), ult, proc(아이템·룬 효과),
  //       dot, aoe, silent, noVamp, lifestealable   (예전 방식 magic:true / trueDmg:true 도 지원)
  dealDamage(src, t, amount, opts = {}) {
    if (!t.alive || !this.isVulnerable(t) || !(amount > 0)) return 0;
    const type = opts.type || (opts.magic ? 'magic' : opts.trueDmg ? 'true' : 'physical');
    opts.type = type;
    let dmg = amount;
    if (src) {
      if (src.kind === 'minion') {
        if (this.baronNear(src)) dmg *= 1.5;
        if (t.isStructure) dmg *= 0.6;
      }
      if (src.exhaustT > 0) dmg *= 0.65;
      if (src.fxDamageMult) dmg *= src.fxDamageMult(t, opts);
    }
    if (t.kind === 'minion' && this.baronNear(t)) dmg *= 0.5;
    if (t.takenAmps) {
      let amp = 0;
      for (const k in t.takenAmps) {
        const a = t.takenAmps[k];
        if ((!a.src || a.src === src) && (!a.type || a.type === type)) amp += a.pct;
      }
      dmg *= Math.max(0.1, 1 + amp);
    }
    if (type === 'physical') {
      let ar = t.armor || 0;
      if (t.armorShred) { let s = 0; for (const k in t.armorShred) s += t.armorShred[k].pct; ar *= 1 - Math.min(0.9, s); }
      if (src && ar > 0) ar = Math.max(0, ar * (1 - (src.armorPenPct || 0)) - (src.lethality || 0));
      dmg = mitigate(dmg, ar);
    } else if (type === 'magic') {
      let mr = t.mr || 0;
      if (t.mrShred) { let s = 0, f = 0; for (const k in t.mrShred) { s += t.mrShred[k].pct; f += t.mrShred[k].flat || 0; } mr = mr * (1 - Math.min(0.9, s)) - f; }
      if (src && mr > 0) mr = Math.max(0, mr * (1 - (src.mpenPct || 0)) - (src.mpenFlat || 0));
      dmg = mitigate(dmg, mr);
    }
    if (t.fxDamageTaken) dmg = t.fxDamageTaken(src, dmg, opts);
    dmg = Math.max(0, dmg);
    if (dmg <= 0) return 0;

    if (t.kind === 'hero' && t.hp - dmg + t.shieldTotal(type) < t.maxHp * 0.3) t.fxEvent('lowHealth', src, dmg, opts);
    const dealt = dmg;
    if (t.shields) dmg = t.absorbShield(dmg, type);

    if (t.kind === 'hero' && t.hp - dmg <= 0 && t.fxTryRevive(src)) t.hp = 1;
    else t.hp -= dmg;

    t.hitFlash = 0.1;
    t.lastDamagedTime = this.time;
    t.lastDamagedBy = src;
    t.combatT = this.time;
    if (src) {
      src.combatT = this.time;
      if (champLike(t)) src.champCombatT = this.time;
      if (champLike(src)) t.champCombatT = this.time;
      const owner = src.kind === 'hero' ? src : src.owner;
      if (owner && owner.kind === 'hero') (t.damagedBy || (t.damagedBy = {}))[owner.id] = this.time;
    }
    if (src && src.kind === 'hero' && t.kind === 'hero') src.aggroOnHeroTime = this.time;
    if (src && src.kind === 'hero') src.lastAggroTime = this.time;
    t.onDamaged(src, dealt);
    if (t.kind === 'hero') { if (t.recall) t.cancelRecall(); }

    // 흡혈
    if (src && src.kind === 'hero' && src.alive && !opts.noVamp) {
      let v = src.omnivamp + src.omnivampDyn;
      if (opts.isAttack || opts.lifestealable) v += src.lifesteal;
      if (v > 0) src.heal(dealt * v, opts.isAttack || opts.lifestealable ? 'lifesteal' : 'omnivamp');
    }

    if (!opts.silent) {
      if (src === this.player) {
        const color = opts.crit ? '#ff9a2e' : type === 'magic' ? '#c9a0ff' : type === 'true' ? '#ffffff' : '#ffd9b0';
        this.floatText(t.x, t.y - t.radius - 10, Math.round(dealt) + (opts.crit ? '!' : ''), color, opts.crit ? 22 : opts.ability ? 18 : 15);
      } else if (t === this.player) {
        this.floatText(t.x, t.y - t.radius - 10, '-' + Math.round(dealt), '#ff5a5a', 15);
      }
    }

    if (src && src.fxEvent) src.fxEvent('damageDealt', t, dealt, opts);
    if (t.fxEvent && t.alive) t.fxEvent('damageTaken', src, dealt, opts);

    if (t.hp <= 0 && t.alive) { t.hp = 0; this.onDeath(t, src); }
    return dealt;
  }

  onDeath(t, killer) {
    const mine = t.team === this.player.team;
    this.addEffect({ type: 'death', x: t.x, y: t.y, r: t.radius, color: TEAM_COLOR[t.team], dur: t.isStructure ? 1.2 : 0.5, big: t.isStructure });

    const killerHero = killer && killer.kind === 'hero' ? killer : (killer && killer.owner && killer.owner.kind === 'hero' ? killer.owner : null);
    // 처치 관여: 최근 10초 안에 피해를 준 영웅
    const takers = [];
    if (t.damagedBy) for (const h of this.heroes) {
      const at = t.damagedBy[h.id];
      if (h.team !== t.team && at != null && this.time - at <= 10) takers.push(h);
    }
    if (killerHero && !takers.includes(killerHero)) takers.push(killerHero);

    if (t.kind === 'hero') {
      // 포탑·미니언에게 죽어도 최근 10초 안에 피해를 준 적 챔피언이 처치를 가져감
      let killer = killerHero && killerHero.team !== t.team ? killerHero : null;
      if (!killer) killer = takers.find(h => h.team !== t.team) || null;
      t.die();
      let first = false;
      if (killer) {
        first = !this.firstBlood;
        this.firstBlood = true;
        this.kills[killer.team]++;
        killer.addGold(300 + (first ? 100 : 0), killer === this.player ? t.x : null, t.y);   // 처치 300, 선취점 +100
        killer.gainXp(Math.round(xpToNext(t.level) * 0.5));                                   // 처치 경험치 (추정)
      }
      for (const h of takers) h.fxEvent('takedown', t, h === killer);
      if (t === this.player) this.announce('당하셨습니다!', 'bad');
      else if (killer === this.player) this.announce(first ? '선취점!' : '적을 처치했습니다!', 'good');
      return;
    }
    t.alive = false;
    t.windup = -1;
    t.displace = null;
    if (t.isStructure) t.onDestroyed();

    if (t.kind === 'minion' || t.kind === 'monster') {
      if (killerHero) { killerHero.addGold(t.gold, t.x, t.y); killerHero.cs++; }
      for (const h of this.heroes) {
        if (h.alive && h.team !== t.team && dist(h.x, h.y, t.x, t.y) < CFG.XP_RANGE) {
          if (t.kind === 'monster' && h !== killerHero) continue;
          h.gainXp(t.xp);
        }
        if (h.alive && h.team !== t.team && dist(h.x, h.y, t.x, t.y) < 1400) h.fxEvent('nearbyDeath', t);
      }
      if (killerHero) killerHero.fxEvent('kill', t);
      for (const h of takers) h.fxEvent('takedown', t, h === killerHero);
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
      if (t.kind === 'monster' && t.mtype === 'herald' && killerHero) {
        if (Items.grantFree(killerHero, 'heraldEye', 1) && killerHero === this.player) this.announce('전령의 눈을 얻었습니다! (사용: 적 구조물 근처에서)', 'good');
      }
      if (t.kind === 'monster' && t.mtype === 'voidgrub' && killerHero) {
        for (const h of this.heroes) if (h.team === killerHero.team) h.voidStacks = Math.min(3, (h.voidStacks || 0) + 1);
        if (killerHero === this.player) this.announce('공허의 손길 중첩! (' + killerHero.voidStacks + '/3)', 'good');
      }
      if (t.kind === 'monster' && t.mtype === 'crab' && killerHero) {
        const wv = new Ward(this, { team: killerHero.team }, t.x, t.y, 'shrine', 90);
        wv.sight = 525;
        this.wards.push(wv);
        this.addEffect({ type: 'pulse', x: t.x, y: t.y, r: 90, color: '#8ff0ff', dur: 0.6 });
        // 속도의 신단: 90초 동안, 최근 5초 안에 공방이 없던 아군이 안에 들어오면 이동 속도 30%를 잠깐 얻습니다
        this.addZone({
          x: t.x, y: t.y, r: 400, dur: 90, team: killerHero.team, key: 'scuttleSpeed',
          onTick: z => { for (const h of this.heroes) if (h.team === z.team && h.alive && !h.inCombat(5) && dist(h.x, h.y, z.x, z.y) <= z.r) h.addHaste('scuttleSpeed', 0.3, 1.5, false); },
        });
      }
      return;
    }

    if (t.kind === 'turret') {
      this.towersKilled[1 - t.team]++;
      for (const h of this.heroes) {
        if (h.team === t.team) continue;
        const near = h.alive && dist(h.x, h.y, t.x, t.y) < 1500;
        h.addGold(near ? TURRET_COMMON.gold : 100, near ? h.x : null, h.y);
        if (near) { h.gainXp(TURRET_COMMON.xp); h.fxEvent('turretTakedown', t); }
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
      this.announce(this.winner === this.player.team ? '승리!' : '패배!', this.winner === this.player.team ? 'good' : 'bad');
    }
  }

  // 1대1에서 상대 연결이 끊기면 남은 쪽 승리
  endByDisconnect(winnerTeam) {
    if (this.over) return;
    this.over = true;
    this.winner = winnerTeam;
    this.disconnected = true;
    this.endTimer = 1.5;
    this.announce('상대와 연결이 끊어졌습니다', 'bad');
  }

  // 상대가 보낸 구성은 그대로 믿지 않고 유효한 값으로 고침
  static sanitize(s) {
    s = s && typeof s === 'object' ? s : {};
    const champ = CHAMPIONS[s.champ] ? s.champ : 'orianna';
    const base = CHAMPIONS[champ].base;
    const role = QUEST_INFO[s.role] ? s.role : (base.defaultRole || 'mid');
    let spells = Array.isArray(s.spells) ? [...new Set(s.spells.filter(k => SPELL_DEFS[k]))].slice(0, 2) : [];
    if (spells.length < 2) spells = (base.recSpells || ['SummonerFlash', 'SummonerHeal']).slice();
    return { champ, role, spells, runes: Runes.validate(s.runes), practice: false };
  }

  // 화면 표시용: 마우스 아래 유닛 찾기 (opts.wards: 아군 와드 포함)
  unitAt(wx, wy, team, opts = {}) {
    let best = null, bd = Infinity;
    for (const u of this.units) {
      if (!u.alive || !u.targetable || !this.isVisible(team, u)) continue;
      const d = dist(wx, wy, u.x, u.y - (u.isStructure ? u.radius * 0.5 : 0));
      const r = u.radius + (u.isStructure ? 30 : 18);
      if (d > r) continue;
      const sc = d - (u.team !== team ? 40 : 0) + (u.isStructure ? 60 : 0);
      if (sc < bd) { bd = sc; best = u; }
    }
    if (opts.wards) for (const w of this.wards) {
      if (w.team !== team) continue;
      const d = dist(wx, wy, w.x, w.y);
      if (d < 45 && d < bd) { bd = d; best = w; }
    }
    return best;
  }
}
