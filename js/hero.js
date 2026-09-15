// ===== 영웅 공통 기반 (챔피언은 이 클래스를 상속) =====
const CHAMPIONS = {};   // id -> { base, create(game, team, setup) }

const STAT_KEYS = ['ad', 'ap', 'hp', 'mana', 'armor', 'mr', 'asPct', 'crit', 'critDmg', 'lifesteal', 'omnivamp',
  'ah', 'basicAh', 'ultAh', 'lethality', 'armorPenPct', 'mpen', 'mpenPct', 'ms', 'msPct', 'baseHpRegenPct',
  'baseManaRegenPct', 'hp5', 'mp5', 'tenacity', 'slowResist', 'hsp', 'hsReceived', 'goldPer10', 'apPct', 'adaptive',
  'spellHaste', 'itemHaste', 'range', 'resistPct', 'bonusResistPct', 'itemHp'];
function emptyStats() { const s = {}; for (const k of STAT_KEYS) s[k] = 0; return s; }

class Hero extends Unit {
  constructor(game, team, base = HERO_BASE, setup = {}) {
    const f = LAYOUT[team].fountain;
    const off = team === TEAM.RED ? -150 : 150;
    super(game, {
      kind: 'hero', name: base.name, team, x: f.x + off, y: f.y - off, radius: base.radius,
      hp: base.hp, ad: base.ad, as: base.as, armor: base.armor, mr: base.mr, range: base.range,
      ms: base.ms, projSpeed: base.projSpeed, sight: base.sight, hpRegen: base.hpRegen, windup: base.windup,
    });
    this.base = base;
    this.champId = base.id;
    this.ranged = base.range >= 300;
    this.role = setup.role || base.defaultRole || 'mid';
    this.resource = base.resource || 'none';      // 'mana' | 'energy' | 'none'
    this.level = 1;
    this.levelCap = MAX_LEVEL;
    this.xp = 0;
    this.xpBonus = 0;
    this.gold = CFG.START_GOLD;
    this.goldEarned = 0;
    this.items = [null, null, null, null, null, null];   // { id, count, st }
    this.trinket = { id: '3340', count: 1, st: {} };
    this.questSlot = null;
    this.buffs = {};              // id -> { t, stacks }
    this.hots = [];               // 지속 회복 효과
    this.perm = {};               // 영구 스탯 (착취의 손아귀, 강철심장 등)
    this.cmd = null;
    this.path = [];
    this.repath = 0;
    this.moveInput = { x: 0, y: 0 };   // WASD 이동 방향 (단위 벡터)
    this.attackHeld = false;           // WASD: 좌클릭을 누르고 있는지
    this.cs = 0;
    this.deaths = 0;
    this.respawnTimer = 0;
    this.recall = null;
    this.empoweredRecall = null;  // 미드 퀘스트 보상
    this.dash = null;
    this.channel = null;
    this.itemCds = {};
    this.crit = 0; this.critDmg = 0; this.lifesteal = 0; this.omnivamp = 0; this.omnivampDyn = 0;
    this.ap = 0; this.ah = 0; this.basicAh = 0; this.ultAh = 0; this.spellHaste = 0; this.itemHaste = 0;
    this.lethality = 0; this.armorPenPct = 0; this.mpenFlat = 0; this.mpenPct = 0;
    this.maxMana = 0; this.mana = 0; this.manaRegen = 0; this.bonusMana = 0;
    this.bonusHp = 0; this.bonusArmor = 0; this.bonusMr = 0; this.bonusAd = 0; this.baseAd = base.ad;
    this.hsp = 0; this.goldPer10 = 0;
    this.resistBonus = 0;         // 외부에서 받는 방어력/마법 저항력 (예: 오리아나 E)
    this.aggroOnHeroTime = -99;
    this.costMult = 1; this.cdRate = 1; this.dynRange = 0; this.asCap = 2.5;
    this.lastCastT = -99; this.lastCastKey = null;
    this.effects = [];
    this.effectMap = new Map();
    this.extraFx = [];            // 퀘스트 보상·정글 동료 등 코드로 붙이는 효과 { key, tpl, p }
    this.runePage = setup.runes || null;
    this.spells = Spells.makeSlots(setup.spells || base.recSpells || ['SummonerFlash', 'SummonerHeal']);

    // 스킬: 챔피언 클래스가 abilityDefs 를 채우면 활성화
    this.abilityDefs = null;
    this.abilities = {};
    for (const k of ['Q', 'W', 'E', 'R']) this.abilities[k] = { lvl: 0, cd: 0, maxCd: 0 };
    this.skillPoints = 1;

    this.recalcStats();
    this.hp = this.maxHp;
    this.mana = this.maxMana;
  }

  // ---------- 스탯 ----------
  slotsWithItems() {
    const out = [];
    this.items.forEach((s, i) => { if (s) out.push({ s, ref: i }); });
    if (this.trinket) out.push({ s: this.trinket, ref: 'trinket' });
    if (this.questSlot) out.push({ s: this.questSlot, ref: 'quest' });
    return out;
  }

  recalcStats() {
    const b = this.base, L = this.level - 1, S = emptyStats();
    for (const { s, ref } of this.slotsWithItems()) {
      const it = ITEM_DB[s.id];
      if (!it || !it.stats || ref === 'trinket') continue;
      for (const k in it.stats) S[k] += it.stats[k];
      S.itemHp += it.stats.hp || 0;
    }
    for (const k in this.perm) S[k] += this.perm[k];

    this.rebuildEffects();
    for (const e of this.effects) if (e.tpl.statsFlat) e.tpl.statsFlat(this, e, S);

    const buff = id => this.buffs[id];
    if (buff('blue')) { S.hp5 += 6; S.mp5 += 5; S.ah += 10; S.msPct += 0.08; }
    if (buff('red')) S.ad += 15;
    if (buff('baron')) { S.ad += 40; S.ap += 40; }
    if (buff('haste')) S.msPct += 0.3;
    if (buff('elixirIron')) { S.hp += 300; S.tenacity += 0.25; }
    if (buff('elixirSorcery')) { S.ap += 50; S.baseManaRegenPct += 0.15; }
    if (buff('elixirWrath')) S.ad += 30;
    if (buff('elixirForce')) S.adaptive += 10;
    if (buff('elixirSkill')) S.ah += 10;

    for (const e of this.effects) if (e.tpl.statsDerived) e.tpl.statsDerived(this, e, S);

    // 적응형 능력치: 추가 공격력·주문력 중 큰 쪽 (같으면 챔피언 기본값)
    this.adaptiveType = S.ap > S.ad ? 'ap' : S.ad > S.ap ? 'ad' : (b.adaptive || 'ap');
    if (this.adaptiveType === 'ad') S.ad += S.adaptive * 0.6; else S.ap += S.adaptive;

    const dragon = buff('dragon') ? buff('dragon').stacks : 0;

    const oldMax = this.maxHp;
    this.bonusHp = S.hp;
    this.maxHp = Math.round(b.hp + b.hpPerLvl * L + S.hp);
    if (oldMax && this.maxHp > oldMax && this.alive) this.hp += this.maxHp - oldMax;
    this.hp = Math.min(this.hp, this.maxHp);

    const oldMana = this.maxMana;
    if (this.resource === 'mana') {
      this.bonusMana = S.mana;
      this.maxMana = Math.round(b.mana + (b.manaPerLvl || 0) * L + S.mana);
      this.manaRegen = ((b.manaRegen || 0) + (b.manaRegenPerLvl || 0) * L) * (1 + S.baseManaRegenPct) + S.mp5;
    } else if (this.resource === 'energy') {
      this.bonusMana = 0;
      this.maxMana = b.energy || 200;
      this.manaRegen = b.energyRegen || 10;
    } else {
      this.bonusMana = 0; this.maxMana = 0; this.manaRegen = 0;
    }
    if (oldMana && this.maxMana > oldMana && this.alive) this.mana += this.maxMana - oldMana;
    this.mana = Math.min(this.mana, this.maxMana);

    this.baseAd = b.ad + b.adPerLvl * L;
    this.ad = (this.baseAd + S.ad) * (1 + dragon * 0.06);
    this.bonusAd = this.ad - this.baseAd;
    this.ap = S.ap * (1 + S.apPct) * (1 + dragon * 0.06);
    this.asBase = b.as;
    this.asBonus = b.asPerLvl * L + S.asPct;
    this.bonusArmor = S.armor * (1 + S.bonusResistPct) + this.resistBonus;
    this.bonusMr = S.mr * (1 + S.bonusResistPct) + this.resistBonus;
    this.armor = ((b.armor + b.armorPerLvl * L) * (1 + dragon * 0.04) + this.bonusArmor) * (1 + S.resistPct);
    this.mr = (b.mr + b.mrPerLvl * L + this.bonusMr) * (1 + S.resistPct);
    this.ms = (b.ms + S.ms) * (1 + S.msPct);
    this.hpRegen = (b.hpRegen + b.hpRegenPerLvl * L) * (1 + S.baseHpRegenPct) + S.hp5;
    this.ah = S.ah; this.basicAh = S.basicAh; this.ultAh = S.ultAh;
    this.spellHaste = S.spellHaste; this.itemHaste = S.itemHaste;
    this.crit = Math.min(1, S.crit);
    this.critDmg = S.critDmg;
    this.lifesteal = S.lifesteal;
    this.omnivamp = S.omnivamp;
    this.lethality = S.lethality;
    this.armorPenPct = Math.min(0.9, S.armorPenPct);
    this.mpenFlat = S.mpen;
    this.mpenPct = Math.min(0.9, S.mpenPct);
    this.tenacity = Math.min(0.9, S.tenacity);
    this.slowResist = Math.min(0.9, S.slowResist);
    this.hsp = S.hsp;
    this.hsReceived = 1 + S.hsReceived;
    this.goldPer10 = S.goldPer10;
    this.range = b.range + S.range;
    this.as = this.getAS();
  }

  // 아이템·룬·퀘스트 효과 목록 재구성 (같은 키의 상태는 유지)
  rebuildEffects() {
    const prev = this.effectMap, map = new Map();
    const put = (key, tpl, p, src) => {
      if (!tpl) return;
      const old = map.get(key);
      const rank = tpl.rank ? tpl.rank(p) : 0;
      if (old && rank <= old.rank) return;
      const reuse = prev.get(key);
      const e = reuse && reuse.tpl === tpl ? reuse : { key, tpl, st: {} };
      e.p = p; e.src = src; e.rank = rank;
      map.set(key, e);
    };
    for (const { s, ref } of this.slotsWithItems()) {
      const list = ITEM_EFFECTS[s.id];
      if (!list) continue;
      list.forEach(([tplName, p = {}], i) => {
        const tpl = FX[tplName];
        if (!tpl) { console.warn('알 수 없는 효과 템플릿', tplName); return; }
        const uniq = tpl.unique ? tpl.unique(p) : null;
        put(uniq ? 'u:' + uniq : 'i:' + ref + ':' + s.id + ':' + i, tpl, p, { type: 'item', id: s.id, ref, slot: s });
      });
    }
    if (this.runePage) for (const id of Runes.selectedIds(this.runePage)) {
      if (RUNE_FX[id]) put('r:' + id, RUNE_FX[id], RUNE_FX[id].p || {}, { type: 'rune', id });
    }
    for (const x of this.extraFx) put('x:' + x.key, x.tpl, x.p || {}, { type: 'extra' });
    this.effectMap = map;
    this.effects = [...map.values()];
  }

  addExtraFx(key, tpl, p) {
    this.extraFx = this.extraFx.filter(x => x.key !== key);
    this.extraFx.push({ key, tpl, p });
    this.recalcStats();
  }

  fxEvent(name, a, b, c, d) {
    for (let i = 0; i < this.effects.length; i++) {
      const e = this.effects[i], f = e.tpl[name];
      if (f) f(this, e, a, b, c, d);
    }
  }

  fxDamageMult(t, opts) {
    let add = 0;
    for (const e of this.effects) if (e.tpl.dmgAmp) add += e.tpl.dmgAmp(this, e, t, opts) || 0;
    return 1 + add;
  }

  fxDamageTaken(src, dmg, opts) {
    for (const e of this.effects) if (e.tpl.dmgTaken) dmg = e.tpl.dmgTaken(this, e, src, dmg, opts);
    return dmg;
  }

  fxTryRevive(src) {
    for (const e of this.effects) if (e.tpl.tryRevive && e.tpl.tryRevive(this, e, src)) return true;
    return false;
  }

  getAS() {
    if (this.asBase == null) return this.as;
    return Math.min(this.asCap, this.asBase * (1 + this.asBonus + this.dynAs)) * (1 - this.asSlowPct());
  }

  critMult() { return CFG.CRIT_MULT + this.critDmg; }
  inCombat(sec = 3) { return this.game.time - this.combatT < sec; }
  inChampCombat(sec = 3) { return this.game.time - this.champCombatT < sec; }
  inRange(t, extra = 0) { return this.edgeDist(t) <= this.range + this.dynRange + extra; }

  restoreResource(amount) {
    if (this.maxMana > 0) this.mana = Math.min(this.maxMana, this.mana + amount);
  }

  addBuff(id, dur) {
    const info = BUFF_INFO[id];
    if (id === 'dragon') {
      const b = this.buffs.dragon || { t: Infinity, stacks: 0 };
      b.stacks++;
      this.buffs.dragon = b;
    } else {
      this.buffs[id] = { t: dur || (info ? info.dur : 1), stacks: 1 };
    }
    this.recalcStats();
  }

  // ---------- 스킬 (챔피언 공통) ----------
  canLevelAbility(key) {
    const defs = this.abilityDefs;
    if (!defs || !defs[key] || this.skillPoints <= 0) return false;
    const a = this.abilities[key];
    if (a.lvl >= defs[key].maxLvl) return false;
    if (key === 'R') return a.lvl < (this.level >= 16 ? 3 : this.level >= 11 ? 2 : this.level >= 6 ? 1 : 0);
    return a.lvl < Math.ceil(this.level / 2);
  }

  levelAbility(key) {
    if (!this.canLevelAbility(key)) return false;
    this.abilities[key].lvl++;
    this.skillPoints--;
    this.onAbilityLeveled(key);
    return true;
  }

  abilityCd(key, lvl) {
    const haste = this.ah + (key === 'R' ? this.ultAh : this.basicAh);
    return this.abilityDefs[key].cd[lvl - 1] * 100 / (100 + haste);
  }

  startCd(key) {
    const a = this.abilities[key];
    if (a.lvl > 0) a.cd = a.maxCd = this.abilityCd(key, a.lvl);
  }

  resourceName() { return this.resource === 'energy' ? '기력' : '마나'; }

  castAbility(key, wx, wy, hover) {
    const defs = this.abilityDefs;
    if (!defs || !defs[key] || !this.alive || this.stasisT > 0 || this.displace || this.channel) return false;
    const a = this.abilities[key], def = defs[key];
    if (a.lvl <= 0) { this.hint(def.name + ': 아직 배우지 않았습니다 (' + Controls.levelKey(key) + ')'); return false; }
    const recast = this.abilityRecast ? this.abilityRecast(key) : null;
    if (!recast && a.cd > 0) return false;
    let cost = recast ? recast.cost : def.cost[a.lvl - 1];
    if (this.resource === 'mana') cost *= this.costMult;
    if (this.resource !== 'none' && this.mana < cost) { this.hint(this.resourceName() + '이(가) 부족합니다'); return false; }
    this.lastCastT = this.game.time;
    this.lastCastKey = key;
    const res = this['cast' + key](a.lvl, wx, wy, hover, !!recast);
    if (!res) return false;
    if (this.resource !== 'none') this.mana -= cost;
    if (!recast && res !== 'noCd') this.startCd(key);
    this.cancelRecall();
    this.fxEvent('abilityCast', key, !!recast, cost);
    return true;
  }

  hint(text) { if (this === this.game.player) UI.hint(text); }

  // 챔피언별 훅
  championTick(dt) {}
  onAbilityLeveled(key) {}
  onDeathHook() {}

  // ---------- 명령 ----------
  busy() { return !this.alive || this.stasisT > 0 || this.displace || this.dash; }

  orderMove(x, y) {
    if (!this.alive) return;
    this.cancelRecall();
    this.cancelChannel();
    this.cancelWindup();
    this.cmd = { type: 'move', x, y };
    this.path = Nav.findPath(this.x, this.y, x, y);
  }

  orderAttack(t) {
    if (!this.alive || !t) return;
    this.cancelRecall();
    this.cancelChannel();
    if (this.cmd && this.cmd.type === 'attack' && this.cmd.target === t) return;
    if (this.windupTarget !== t) this.cancelWindup();
    this.cmd = { type: 'attack', target: t };
    this.path = [];
    this.repath = 0;
  }

  orderAttackMove(x, y) {
    if (!this.alive) return;
    this.cancelRecall();
    this.cancelChannel();
    this.cmd = { type: 'amove', x, y, target: null };
    this.path = Nav.findPath(this.x, this.y, x, y);
  }

  orderStop() {
    this.cmd = null;
    this.path = [];
    this.cancelWindup();
  }

  startRecall() {
    if (!this.alive || this.recall || this.channel || this.dash) return;
    this.orderStop();
    const er = this.empoweredRecall;
    const empowered = !!(er && er.cd <= 0);
    this.recall = { t: 0, dur: this.buffs.baron || empowered ? 4 : CFG.RECALL_TIME, empowered };
  }

  cancelRecall() {
    if (this.recall) this.recall = null;
  }

  // ---------- 돌진 / 정신 집중 ----------
  startDash(o) {
    this.cancelWindup();
    this.cancelRecall();
    this.cancelChannel();
    this.path = [];
    this.dash = { tx: o.x, ty: o.y, target: o.target || null, speed: o.speed || 1350, onEnd: o.onEnd || null, t: 0, maxT: o.maxT || 2, stopDist: o.stopDist || 0 };
    this.fxEvent('dash');
  }

  updateDash(dt) {
    const d = this.dash;
    d.t += dt;
    const tx = d.target ? d.target.x : d.tx, ty = d.target ? d.target.y : d.ty;
    const total = dist(this.x, this.y, tx, ty);
    const rem = total - d.stopDist;
    const step = d.speed * dt;
    if (rem > 0 && total > 0) {
      const mv = Math.min(step, rem);
      this.x += (tx - this.x) / total * mv;
      this.y += (ty - this.y) / total * mv;
      this.facing = Math.atan2(ty - this.y, tx - this.x);
    }
    if (rem <= step + 0.5 || d.t >= d.maxT || (d.target && !d.target.alive)) {
      this.dash = null;
      if (!Nav.isWalkable(this.x, this.y)) { const p = Nav.nearestWalkablePoint(this.x, this.y); this.x = p.x; this.y = p.y; }
      if (d.onEnd) d.onEnd();
    }
  }

  startChannel(name, dur, onDone, onCancel) {
    this.orderStop();
    this.cancelRecall();
    this.channel = { name, t: 0, dur, onDone, onCancel };
  }

  cancelChannel() {
    if (!this.channel) return;
    const c = this.channel;
    this.channel = null;
    if (c.onCancel) c.onCancel();
  }

  blinkTo(wx, wy, maxRange) {
    const d = dist(this.x, this.y, wx, wy);
    const r = Math.min(d, maxRange);
    const ux = d > 0 ? (wx - this.x) / d : (this.dirX ?? 1), uy = d > 0 ? (wy - this.y) / d : (this.dirY ?? 0);
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
    this.fxEvent('dash');
    if (this.cmd && this.cmd.type === 'move') this.path = Nav.findPath(this.x, this.y, this.cmd.x, this.cmd.y);
  }

  castSpell(i, wx, wy, hover) {
    if (!this.alive || this.stasisT > 0) return false;
    return Spells.cast(this, i, wx, wy, hover);
  }

  useItem(ref, wx, wy, hover) {
    if (!this.alive || this.stasisT > 0) return false;
    return Items.use(this, ref, wx == null ? this.x : wx, wy == null ? this.y : wy, hover || null);
  }

  // ---------- 경험치 / 골드 / 사망 ----------
  gainXp(amount) {
    if (this.level >= this.levelCap) return;
    this.xp += amount * (1 + this.xpBonus);
    let gained = 0;
    while (this.level < this.levelCap && this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
      gained++;
    }
    if (this.level >= this.levelCap) this.xp = 0;
    if (gained) {
      if (this.abilityDefs) this.skillPoints += gained;
      this.recalcStats();
      this.fxEvent('levelUp', gained);
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
    this.onDeathHook();
    this.fxEvent('death');
    this.alive = false;
    this.deaths++;
    this.respawnTimer = 6 + this.level * 2.2 + this.game.time / 60 * 0.4;
    this.cmd = null; this.path = []; this.recall = null; this.windup = -1; this.dash = null; this.channel = null;
    this.hots = [];
    this.shields = null; this.slows = null; this.hastes = null; this.displace = null; this.asSlows = null;
    for (const id of ['red', 'blue', 'baron', 'haste']) delete this.buffs[id];
    this.recalcStats();
  }

  respawn() {
    const f = LAYOUT[this.team].fountain;
    this.alive = true;
    this.x = f.x + 150; this.y = f.y - 150;
    if (this.team === TEAM.RED) { this.x = f.x - 150; this.y = f.y + 150; }
    this.recalcStats();
    this.hp = this.maxHp;
    this.mana = this.maxMana;
    this.attackCd = 0;
    if (this === this.game.player) this.game.announce('부활했습니다', 'good');
  }

  // ---------- 공격 ----------
  onAttackLaunch(t) {
    if (this.cmd && this.cmd.clicks > 0) this.cmd.clicks--;
    this.fxEvent('attack', t);
  }

  onAttackHit(t) {
    if (!t.alive) return;
    const ctx = { crit: this.crit > 0 && rng() < this.crit, critMult: this.critMult(), mult: 1, bonus: [], onHitOnly: false };
    this.fxEvent('preHit', t, ctx);
    let dmg = this.ad * ctx.mult;
    if (ctx.crit) dmg *= ctx.critMult;
    const dealt = this.game.dealDamage(this, t, dmg, { type: 'physical', isAttack: true, crit: ctx.crit });
    for (const b of ctx.bonus) if (t.alive) this.game.dealDamage(this, t, b.amt, { type: b.type, onHit: true, proc: true, silent: b.silent, lifestealable: b.lifestealable });
    this.fxEvent('hit', t, ctx, dealt);
    if (this.buffs.red && t.alive) this.game.dealDamage(this, t, 8 + 2 * this.level, { type: 'true', proc: true, silent: true });
  }

  // 적중 시 효과만 다시 적용 (구인수의 격노검 유령 타격, 황혼과 새벽 등)
  applyOnHit(t) {
    if (!t || !t.alive) return;
    const ctx = { crit: false, critMult: this.critMult(), mult: 1, bonus: [], onHitOnly: true };
    this.fxEvent('preHit', t, ctx);
    for (const b of ctx.bonus) if (t.alive) this.game.dealDamage(this, t, b.amt, { type: b.type, onHit: true, proc: true, silent: b.silent });
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
    const moved = this.px == null ? 0 : dist(this.px, this.py, this.x, this.y);
    this.px = this.x; this.py = this.y;
    this.championTick(dt);
    Spells.tick(this, dt);
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }
    if (moved > 0 && moved < 400) this.fxEvent('move', moved);

    this.dynAs = 0; this.dynMsFlat = 0; this.dynMsPct = 0; this.omnivampDyn = 0;
    this.costMult = 1; this.cdRate = 1; this.dynRange = 0; this.asCap = 2.5;

    // 버프 / 효과 / 쿨다운 / 회복
    let changed = false;
    for (const id in this.buffs) {
      const b = this.buffs[id];
      b.t -= dt;
      if (b.t <= 0) { delete this.buffs[id]; changed = true; }
    }
    if (changed) this.recalcStats();
    this.fxEvent('tick', dt);
    for (const k in this.abilities) { const a = this.abilities[k]; if (a.cd > 0) a.cd = Math.max(0, a.cd - dt * this.cdRate); }
    for (const k in this.itemCds) if (this.itemCds[k] > 0) this.itemCds[k] = Math.max(0, this.itemCds[k] - dt);
    Items.tick(this, dt);
    if (this.tenacityBoostT) this.tenacity = Math.max(this.tenacity, 0.75);
    if (this.empoweredRecall && this.empoweredRecall.cd > 0) this.empoweredRecall.cd -= dt;
    for (const h of this.hots) { this.heal(h.perSec * dt, 'hot'); h.t -= dt; }
    this.hots = this.hots.filter(h => h.t > 0);
    this.regen(dt);
    if (this.maxMana > 0) this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);
    if (this.goldPer10 > 0 && this.game.time > CFG.PASSIVE_GOLD_START) this.addGold(this.goldPer10 / 10 * dt);
    if (this.game.canShop(this)) { if (!this.inShop) { this.inShop = true; Items.onShopVisit(this); } } else this.inShop = false;

    if (this.stasisT > 0) { this.cancelWindup(); return; }
    this.tickCombat(dt);
    if (this.dash) { this.updateDash(dt); return; }

    // WASD 이동: 키 입력이 있으면 클릭 명령보다 우선. 좌클릭으로 지정한 대상이 사거리 안이면 멈춰서 공격한 뒤 다시 이동
    const mi = this.moveInput;
    if (mi && (mi.x || mi.y)) {
      if (this.channel) this.cancelChannel();
      if (this.recall) this.cancelRecall();
      this.path = [];
      const c = this.cmd;
      if (c && c.type === 'attack') {
        const t = c.target;
        const wantsAttack = this.attackHeld || c.clicks > 0;
        if (!wantsAttack || !this.isValidTarget(t)) this.cmd = null;
        else if (this.windup >= 0 || (this.inRange(t) && this.attackCd <= 0)) { this.tryAttack(t); return; }
      } else if (c) {
        this.cmd = null;
      }
      if (this.windup >= 0) return;
      this.moveToward(this.x + mi.x * 200, this.y + mi.y * 200, dt);
      return;
    }

    if (this.channel) {
      const c = this.channel;
      c.t += dt;
      if (c.t >= c.dur) { this.channel = null; c.onDone(); }
      return;
    }

    if (this.recall) {
      this.recall.t += dt;
      if (this.recall.t >= this.recall.dur) {
        const f = LAYOUT[this.team].fountain;
        this.game.addEffect({ type: 'flash', x: this.x, y: this.y, dur: 0.5 });
        this.x = f.x + (this.team === TEAM.BLUE ? 150 : -150);
        this.y = f.y + (this.team === TEAM.BLUE ? -150 : 150);
        if (this.recall.empowered && !this.buffs.baron) this.empoweredRecall.cd = 300;
        this.recall = null;
        this.game.addEffect({ type: 'flash', x: this.x, y: this.y, dur: 0.5 });
        if (this === this.game.player) this.game.centerCamera();
      }
      return;
    }

    const c = this.cmd;
    if (!c) {
      if (this.windup < 0) {
        const t = this.autoAcquire(this.range + this.dynRange);
        if (t) this.tryAttack(t);
      }
      return;
    }

    if (c.type === 'move') {
      if (this.followPath(dt)) this.cmd = null;
      return;
    }

    if (c.type === 'attack' || c.type === 'amove') {
      let t = c.target;
      if (c.type === 'amove') {
        if (!t || !this.isValidTarget(t) || this.edgeDist(t) > this.range + this.dynRange + 250) {
          t = c.target = this.autoAcquire(this.range + this.dynRange + 150);
          this.path = t ? [] : this.path;
        }
        if (!t) {
          if (!this.path.length) this.path = Nav.findPath(this.x, this.y, c.x, c.y);
          if (this.followPath(dt)) this.cmd = null;
          return;
        }
      }
      if (!this.isValidTarget(t)) {
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
    if (t && t.team === TEAM.NEUTRAL) return t.alive && t.targetable && t.stasisT <= 0 && this.game.isVisible(this.team, t);
    return super.isValidTarget(t);
  }
}

CHAMPIONS.basic = { base: HERO_BASE, create: (game, team, setup) => new Hero(game, team, HERO_BASE, setup) };
