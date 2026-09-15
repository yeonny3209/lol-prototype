// ===== 아이템 데이터 / 상점 / 인벤토리 =====
const DD_VER = LOL_DATA.version;
const DD_CDN = 'https://ddragon.leagueoflegends.com/cdn/';

const ITEM_DB = {};
for (const id in LOL_DATA.items) ITEM_DB[id] = Object.assign({}, LOL_DATA.items[id]);

// 룬으로 얻는 아이템 (상점 목록 밖)
ITEM_DB['2422'] = { id: '2422', name: '약간 신비한 신발', cost: 300, base: 300, sell: 210, from: [], into: ITEM_DB['1001'].into.slice(), depth: 1, tags: ['Boots'], stats: { ms: 35 }, shop: false, alias: '1001' };
ITEM_DB['2010'] = { id: '2010', name: '굳건한 의지의 완전한 비스킷', cost: 0, base: 0, sell: 0, from: [], into: [], depth: 1, tags: ['Consumable'], stats: {}, shop: false, icon: '2003' };
ITEM_DB['2150'] = { id: '2150', name: '탐욕의 영약', cost: 0, base: 0, sell: 0, from: [], into: [], depth: 1, tags: ['Consumable'], stats: {}, shop: false, icon: '2139' };
ITEM_DB['2151'] = { id: '2151', name: '힘의 영약', cost: 0, base: 0, sell: 0, from: [], into: [], depth: 1, tags: ['Consumable'], stats: {}, shop: false, icon: '2140' };
ITEM_DB['2152'] = { id: '2152', name: '숙련의 영약', cost: 0, base: 0, sell: 0, from: [], into: [], depth: 1, tags: ['Consumable'], stats: {}, shop: false, icon: '2138' };

const TIER3_BOOTS = ['3168', '3170', '3171', '3172', '3173', '3174', '3175'];
const SUPPORT_UPGRADES = ['3869', '3870', '3871', '3876', '3877'];
const TRINKETS = new Set(['3340', '3363', '3364']);
for (const id of TIER3_BOOTS.concat(SUPPORT_UPGRADES)) if (ITEM_DB[id]) ITEM_DB[id].shop = false;

const ITEM_USE = {
  '2003': { kind: 'potion', stack: 5, heal: 120, dur: 15, desc: '<b>사용:</b> 15초에 걸쳐 체력을 120 회복합니다.' },
  '2031': { kind: 'refill', charges: 2, heal: 100, dur: 12, desc: '<b>사용 (2회 충전):</b> 12초에 걸쳐 체력을 100 회복합니다. 상점에 들르면 다시 채워집니다.' },
  '2010': { kind: 'biscuit', stack: 3, desc: '<b>사용:</b> 20 + 최대 체력의 2%를 회복하며, 잃은 체력에 비례해 최대 2배까지 늘어납니다. 먹으면 최대 체력이 영구히 30 증가합니다.' },
  '2055': { kind: 'controlWard', stack: 2, desc: '<b>사용:</b> 커서 위치(최대 600)에 시야를 밝히는 제어 와드를 설치합니다 (1개까지 유지).' },
  '2138': { kind: 'elixir', buff: 'elixirIron', dur: 180, desc: '<b>사용:</b> 3분 동안 체력 300, 강인함 25%를 얻습니다.' },
  '2139': { kind: 'elixir', buff: 'elixirSorcery', dur: 180, desc: '<b>사용:</b> 3분 동안 주문력 50, 기본 마나 재생 15%를 얻습니다.' },
  '2140': { kind: 'elixir', buff: 'elixirWrath', dur: 180, desc: '<b>사용:</b> 3분 동안 공격력 30을 얻습니다.' },
  '2150': { kind: 'elixir', buff: 'elixirAvarice', dur: 180, desc: '<b>사용:</b> 3분 동안 미니언·몬스터 처치 골드가 늘어납니다.' + EST },
  '2151': { kind: 'elixir', buff: 'elixirForce', dur: 180, desc: '<b>사용:</b> 3분 동안 적응형 능력치 10을 얻습니다.' + EST },
  '2152': { kind: 'elixir', buff: 'elixirSkill', dur: 180, desc: '<b>사용:</b> 3분 동안 스킬 가속 10을 얻습니다.' + EST },
  '2141': { kind: 'juice', stack: 5, desc: '<b>사용:</b> 마십니다. 아무 효과도 없습니다.' },
  '3340': { kind: 'wardTrinket', desc: '<b>사용 (최대 2회 충전):</b> 커서 위치에 투명 와드를 설치합니다 (90~120초 유지, 충전 240~120초).' },
  '3363': { kind: 'farsight', desc: '<b>사용:</b> 멀리(최대 4000) 떨어진 곳에 망원형 와드를 설치해 시야를 밝힙니다 (재사용 198~99초). 9레벨부터 교체 가능.' },
  '3364': { kind: 'lens', desc: '<b>사용:</b> 주변의 보이지 않는 적과 와드를 찾아냅니다 (재사용 160~100초). 9레벨부터 교체 가능. <i class="est">※적 와드가 없어 현재는 효과 없음</i>' },
};
for (const id of ['3866']) ITEM_USE[id] = { kind: 'supportWard', charges: 3, desc: '<b>사용 (3회 충전):</b> 투명 와드를 설치합니다. 상점에 들르면 충전됩니다.' };
for (const id of ['3867'].concat(SUPPORT_UPGRADES)) ITEM_USE[id] = { kind: 'supportWard', charges: 4, desc: '<b>사용 (4회 충전):</b> 투명 와드를 설치합니다. 상점에 들르면 충전됩니다.' };

const ITEM_GROUPS = {
  boots: Object.keys(ITEM_DB).filter(id => ITEM_DB[id].tags.includes('Boots')),
  jungle: ['1101', '1102', '1103'],
  support: ['3865', '3866', '3867'].concat(SUPPORT_UPGRADES),
  lifeline: ['3053', '6673', '3155', '3156', '3040', '2525'],
  hydra: ['3077', '3074', '6631', '6698', '3748'],
  manaflow: ['3070', '3003', '3004', '3119', '2526', '3040', '3042', '3121', '2530'],
  quicksilver: ['3140', '3139'],
  stasis: ['2420', '2421', '3157'],
  spellshield: ['4632', '3102', '3814'],
  glory: ['1082', '3041'],
  immolate: ['6660', '3068', '6664'],
};
const GROUP_NAME = { boots: '신발', jungle: '정글 동료', support: '서포터 아이템', lifeline: '생명선', hydra: '히드라', manaflow: '마나순환', quicksilver: '수은', stasis: '경직', spellshield: '주문 방어막', glory: '영광', immolate: '불사르기' };

const itemIcon = id => DD_CDN + DD_VER + '/img/item/' + ((ITEM_DB[id] && ITEM_DB[id].icon) || id) + '.png';
const isBoots = it => it.tags.includes('Boots');
const isConsumable = it => it.tags.includes('Consumable') || !!(ITEM_USE[it.id] && ['potion', 'refill', 'biscuit', 'controlWard', 'elixir', 'juice'].includes(ITEM_USE[it.id].kind));
const isLegendary = it => !it.into.length && it.cost >= 2000 && !isBoots(it) && !ITEM_GROUPS.support.includes(it.id);
const STARTERS = new Set(['1054', '1055', '1056', '1083', '1086', '1120', '1082', '3865', '2003', '2031']);

function itemCategory(it) {
  if (TRINKETS.has(it.id)) return '장신구';
  if (isConsumable(it)) return '소모품';
  if (ITEM_GROUPS.jungle.includes(it.id)) return '정글';
  if (ITEM_GROUPS.support.includes(it.id)) return '서포터';
  if (isBoots(it)) return '신발';
  if (STARTERS.has(it.id)) return '시작';
  if (['2051', '3112', '3177', '3184'].includes(it.id)) return '기타';
  if (isLegendary(it)) return '전설급';
  if (it.from.length || it.into.length && it.depth > 1) return '서사급';
  return '기본';
}
const SHOP_CATEGORIES = ['시작', '기본', '서사급', '전설급', '신발', '소모품', '장신구', '정글', '서포터', '기타'];

const STAT_LABEL = {
  ad: ['공격력', v => v], ap: ['주문력', v => v], hp: ['체력', v => v], mana: ['마나', v => v],
  armor: ['방어력', v => v], mr: ['마법 저항력', v => v], asPct: ['공격 속도', v => pc(v)],
  crit: ['치명타 확률', v => pc(v)], critDmg: ['치명타 피해량', v => pc(v)], lifesteal: ['생명력 흡수', v => pc(v)],
  omnivamp: ['모든 피해 흡혈', v => pc(v)], ah: ['스킬 가속', v => v], lethality: ['물리 관통력', v => v],
  armorPenPct: ['방어구 관통력', v => pc(v)], mpen: ['마법 관통력', v => v], mpenPct: ['마법 관통력', v => pc(v)],
  ms: ['이동 속도', v => v], msPct: ['이동 속도', v => pc(v)], baseHpRegenPct: ['기본 체력 재생', v => pc(v)],
  baseManaRegenPct: ['기본 마나 재생', v => pc(v)], tenacity: ['강인함', v => pc(v)], hsp: ['체력 회복 및 보호막', v => pc(v)],
  goldPer10: ['10초당 골드', v => v],
};
function itemStatLines(it) {
  return Object.entries(it.stats || {}).map(([k, v]) => STAT_LABEL[k] ? STAT_LABEL[k][0] + ' +' + STAT_LABEL[k][1](v) : k);
}
function itemEffectHtml(id) {
  const out = [];
  if (ITEM_USE[id]) out.push(ITEM_USE[id].desc);
  for (const [tplName, p = {}] of ITEM_EFFECTS[id] || []) {
    const tpl = FX[tplName];
    if (tpl && tpl.desc) out.push(tpl.desc(p));
  }
  return out;
}

// ---------------- 상점 ----------------
const Shop = {
  slotRefs(h) {
    const refs = h.items.map((s, i) => s ? { s, ref: i } : null).filter(Boolean);
    if (h.questSlot) refs.push({ s: h.questSlot, ref: 'quest' });
    return refs;
  },

  // 가진 하위 아이템을 반영한 실제 가격과 소모할 칸
  plan(h, id) {
    const avail = this.slotRefs(h).map(x => ({ id: ITEM_DB[x.s.id].alias || x.s.id, ref: x.ref }));
    const used = [];
    const walk = cid => {
      const it = ITEM_DB[cid];
      if (!it) return 0;
      let cost = it.from.length ? it.base : it.cost;
      for (const c of it.from) {
        const found = avail.find(a => a.id === c && !used.includes(a.ref));
        if (found) used.push(found.ref);
        else cost += walk(c);
      }
      return cost;
    };
    return { cost: walk(id), used };
  },

  canBuy(game, h, id) {
    const it = ITEM_DB[id];
    if (!it) return { ok: false, reason: '없는 아이템입니다' };
    if (!game.canShop(h)) return { ok: false, reason: '우물(기지 안)에서만 구매할 수 있습니다' };
    if (TIER3_BOOTS.includes(id)) return { ok: false, reason: '미드 퀘스트 보상으로만 얻을 수 있습니다' };
    if (SUPPORT_UPGRADES.includes(id)) return { ok: false, reason: '서포터 퀘스트를 완료한 뒤 무료로 업그레이드합니다' };
    if (id === '2421' && !h.brokeStopwatch) return { ok: false, reason: '팔목 보호대를 사용한 뒤에만 살 수 있습니다' };
    if (id === '2420' && h.brokeStopwatch) return { ok: false, reason: '이제 부서진 팔목 보호대만 살 수 있습니다' };
    if (!it.shop && id !== '2421') return { ok: false, reason: '상점에서 살 수 없는 아이템입니다' };
    if (isBoots(it) && h.bootsLockedUntil && game.time < h.bootsLockedUntil) return { ok: false, reason: '마법의 신발 룬: ' + formatTime(h.bootsLockedUntil - game.time) + ' 후에 신발을 얻습니다' };
    if (ITEM_GROUPS.jungle.includes(id) && !h.spells.some(s => s.key === 'SummonerSmite')) return { ok: false, reason: '정글 동료는 강타를 들어야 살 수 있습니다' };
    const plan = this.plan(h, id);
    if (TRINKETS.has(id)) {
      if (id !== '3340' && h.level < 9) return { ok: false, reason: '9레벨부터 교체할 수 있습니다' };
      if (h.trinket && h.trinket.id === id) return { ok: false, reason: '이미 장착한 장신구입니다' };
      return { ok: true, cost: 0, used: [] };
    }
    const use = ITEM_USE[id];
    const cost = id === '2055' && h.questRewards && h.questRewards.support ? 40 : plan.cost;
    if (h.gold < cost) return { ok: false, reason: '골드가 부족합니다', cost };
    const owned = this.slotRefs(h).filter(x => !plan.used.includes(x.ref)).map(x => x.s);
    if (use && use.stack) {
      const same = owned.find(s => s.id === id);
      if (same && same.count >= use.stack) return { ok: false, reason: '더 가질 수 없습니다 (최대 ' + use.stack + '개)', cost };
      if (same) return { ok: true, cost, used: [] };
    }
    for (const g in ITEM_GROUPS) {
      if (!ITEM_GROUPS[g].includes(id)) continue;
      if (owned.some(s => ITEM_GROUPS[g].includes(s.id))) return { ok: false, reason: GROUP_NAME[g] + ' 계열은 하나만 가질 수 있습니다', cost };
    }
    if (isLegendary(it) && owned.some(s => s.id === id)) return { ok: false, reason: '같은 전설급 아이템은 하나만 가질 수 있습니다', cost };
    const freeAfter = h.items.filter(s => !s).length + plan.used.filter(r => r !== 'quest').length;
    if (freeAfter <= 0) return { ok: false, reason: '인벤토리가 가득 찼습니다', cost };
    return { ok: true, cost, used: plan.used };
  },

  buy(game, h, id) {
    const chk = this.canBuy(game, h, id);
    if (!chk.ok) return chk;
    const it = ITEM_DB[id];
    h.gold -= chk.cost;
    if (TRINKETS.has(id)) {
      h.trinket = { id, count: 1, st: {} };
      h.recalcStats();
      return chk;
    }
    const use = ITEM_USE[id];
    if (use && use.stack) {
      const same = h.items.find(s => s && s.id === id) || (h.questSlot && h.questSlot.id === id ? h.questSlot : null);
      if (same) { same.count++; h.recalcStats(); return chk; }
      if (id === '2055' && h.questRewards && h.questRewards.support && !h.questSlot) {
        h.questSlot = { id, count: 1, st: {} };
        h.recalcStats();
        return chk;
      }
    }
    // 하위 아이템의 상태(마나순환·영광 중첩 등)를 이어받음
    const st = {};
    for (const ref of chk.used) {
      const s = ref === 'quest' ? h.questSlot : h.items[ref];
      if (s && s.st) Object.assign(st, s.st);
      if (ref === 'quest') h.questSlot = null; else h.items[ref] = null;
    }
    const slot = { id, count: 1, st };
    if (use && use.charges) slot.count = use.charges;
    if (isBoots(it) && h.questRewards && h.questRewards.bot) h.questSlot = slot;
    else h.items[h.items.findIndex(s => !s)] = slot;
    if (h.questRewards && h.questRewards.mid) Items.upgradeBoots(h);
    h.fxEvent('itemBought', id, chk.cost);
    h.recalcStats();
    return chk;
  },

  sell(game, h, ref) {
    const s = ref === 'quest' ? h.questSlot : h.items[ref];
    if (!s || !game.canShop(h)) return false;
    const it = ITEM_DB[s.id];
    h.gold += it.sell;
    const use = ITEM_USE[s.id];
    if (use && use.stack && s.count > 1) s.count--;
    else if (ref === 'quest') h.questSlot = null;
    else h.items[ref] = null;
    h.recalcStats();
    return true;
  },
};

// ---------------- 사용 / 변신 / 충전 ----------------
const Items = {
  slotOf(h, ref) { return ref === 'trinket' ? h.trinket : ref === 'quest' ? h.questSlot : h.items[ref]; },

  transform(h, ref, into) {
    const s = this.slotOf(h, ref);
    if (!s) return;
    s.id = into;
    s.count = ITEM_USE[into] && ITEM_USE[into].charges ? ITEM_USE[into].charges : 1;
    h.recalcStats();
    if (h === h.game.player && UI.shopOpen) UI.refreshShop();
  },

  upgradeBoots(h) {
    for (const ref of ['quest', 0, 1, 2, 3, 4, 5]) {
      const s = this.slotOf(h, ref);
      if (!s || !isBoots(ITEM_DB[s.id])) continue;
      const t3 = TIER3_BOOTS.find(id => ITEM_DB[id].from.includes(s.id));
      if (t3) this.transform(h, ref, t3);
    }
  },

  upgradeSupport(h, into) {
    for (const ref of [0, 1, 2, 3, 4, 5]) {
      const s = h.items[ref];
      if (s && s.id === '3867' && SUPPORT_UPGRADES.includes(into)) { this.transform(h, ref, into); return true; }
    }
    return false;
  },

  onShopVisit(h) {
    for (const { s } of h.slotsWithItems()) {
      const use = ITEM_USE[s.id];
      if (use && (use.kind === 'refill' || use.kind === 'supportWard')) s.count = use.charges;
    }
  },

  tick(h, dt) {
    const t = h.trinket;
    if (t && t.id === '3340') {
      if (t.charges == null) { t.charges = 2; t.next = 0; }
      if (t.charges < 2) {
        t.next -= dt;
        if (t.next <= 0) { t.charges++; t.next = t.charges < 2 ? lerp(240, 120, (h.level - 1) / 17) : 0; }
      }
    }
  },

  consume(h, ref) {
    const s = this.slotOf(h, ref);
    if (!s) return;
    s.count--;
    if (s.count <= 0) { if (ref === 'quest') h.questSlot = null; else if (ref !== 'trinket') h.items[ref] = null; }
    h.recalcStats();
  },

  use(h, ref, wx, wy, hover) {
    const s = this.slotOf(h, ref);
    if (!s) return false;
    const use = ITEM_USE[s.id];
    const g = h.game;
    if (use) {
      const cdKey = 'use:' + s.id;
      if (h.itemCds[cdKey] > 0) return false;
      const clampTo = r => { const d = dist(h.x, h.y, wx, wy); return d <= r ? P(wx, wy) : P(h.x + (wx - h.x) / d * r, h.y + (wy - h.y) / d * r); };
      switch (use.kind) {
        case 'potion':
          if (h.hots.some(x => x.src === 'potion') || h.hp >= h.maxHp) return false;
          h.hots.push({ src: 'potion', perSec: use.heal / use.dur, t: use.dur });
          h.fxEvent('potion', use.heal);
          this.consume(h, ref);
          return true;
        case 'refill':
          if (s.count <= 0 || h.hots.some(x => x.src === 'potion') || h.hp >= h.maxHp) return false;
          h.hots.push({ src: 'potion', perSec: use.heal / use.dur, t: use.dur });
          h.fxEvent('potion', use.heal);
          s.count--;
          return true;
        case 'biscuit': {
          const base = 20 + h.maxHp * 0.02;
          h.heal(base * (1 + (1 - h.hp / h.maxHp)), 'item');
          h.perm.hp = (h.perm.hp || 0) + 30;
          this.consume(h, ref);
          return true;
        }
        case 'elixir':
          for (const k of ['elixirIron', 'elixirSorcery', 'elixirWrath', 'elixirAvarice', 'elixirForce', 'elixirSkill']) delete h.buffs[k];
          h.buffs[use.buff] = { t: use.dur, stacks: 1 };
          this.consume(h, ref);
          return true;
        case 'juice':
          g.floatText(h.x, h.y - 60, '꿀꺽', '#ffd98a', 18);
          this.consume(h, ref);
          return true;
        case 'controlWard': {
          const p = clampTo(600);
          g.addWard(h, p.x, p.y, 'control', Infinity);
          this.consume(h, ref);
          return true;
        }
        case 'wardTrinket': {
          if (!(s.charges > 0)) return false;
          const p = clampTo(600);
          g.addWard(h, p.x, p.y, 'stealth', lerp(90, 120, (h.level - 1) / 17) + (h.effectMap.has('r:8141') && MapData.zoneAt(p.x, p.y) !== 'lane' ? 45 : 0));
          s.charges--;
          if (s.next <= 0) s.next = lerp(240, 120, (h.level - 1) / 17);
          return true;
        }
        case 'supportWard': {
          if (s.count <= 0) return false;
          const p = clampTo(600);
          g.addWard(h, p.x, p.y, 'stealth', 150);
          s.count--;
          return true;
        }
        case 'farsight': {
          const p = clampTo(4000);
          g.addWard(h, p.x, p.y, 'farsight', Infinity);
          h.itemCds[cdKey] = lerp(198, 99, (h.level - 1) / 17);
          return true;
        }
        case 'lens':
          g.addEffect({ type: 'pulse', x: h.x, y: h.y, r: 600, color: '#ff8a8a', dur: 0.6 });
          h.itemCds[cdKey] = lerp(160, 100, (h.level - 1) / 17);
          return true;
      }
      return false;
    }
    const e = h.effects.find(x => x.tpl.use && x.src.type === 'item' && x.src.id === s.id);
    if (!e) return false;
    if (h.itemCds[e.key] > 0) return false;
    const r = e.tpl.use(h, e, wx, wy, hover);
    if (!r) return false;
    const cd = e.tpl.cd ? e.tpl.cd(e.p, h) : 0;
    if (cd) h.itemCds[e.key] = cd * 100 / (100 + h.itemHaste);
    if (typeof r === 'string' && r.startsWith('transform:')) {
      if (s.id === '2420') h.brokeStopwatch = true;
      this.transform(h, ref, r.slice(10));
    }
    return true;
  },

  cooldownOf(h, ref) {
    const s = this.slotOf(h, ref);
    if (!s) return 0;
    if (ITEM_USE[s.id]) return h.itemCds['use:' + s.id] || 0;
    const e = h.effects.find(x => x.tpl.use && x.src.type === 'item' && x.src.id === s.id);
    return e ? (h.itemCds[e.key] || 0) : 0;
  },
};
