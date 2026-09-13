// ===== 아이템 / 상점 =====
// stats: ad, asPct, hp, armor, mr, ms, msPct, crit, critDmg, lifesteal, regen, thorns,
//        ap, apPct, mana, manaRegen, ah, mpen, mpenPct
const ITEMS = [
  { id: 'potion', name: '체력 물약', icon: '🧪', cost: 50, cat: '시작', consumable: true, stack: 5, desc: '사용 시 15초 동안 체력을 150 회복합니다. (숫자키로 사용)' },
  { id: 'ring', name: '초보자의 반지', icon: '💍', cost: 400, cat: '시작', stats: { ap: 18, hp: 90, manaRegen: 0.5 } },
  { id: 'blade', name: '초보자의 검', icon: '🗡', cost: 450, cat: '시작', stats: { ad: 8, hp: 80, lifesteal: 0.03 } },

  { id: 'longsword', name: '철검', icon: '🗡️', cost: 350, cat: '기본', stats: { ad: 10 } },
  { id: 'dagger', name: '단검', icon: '🔪', cost: 300, cat: '기본', stats: { asPct: 0.12 } },
  { id: 'tome', name: '증폭의 고서', icon: '📘', cost: 435, cat: '기본', stats: { ap: 20 } },
  { id: 'sapphire', name: '푸른 수정', icon: '💎', cost: 350, cat: '기본', stats: { mana: 250 } },
  { id: 'ruby', name: '붉은 수정', icon: '❤️', cost: 400, cat: '기본', stats: { hp: 150 } },
  { id: 'cloth', name: '천 갑옷', icon: '🥋', cost: 300, cat: '기본', stats: { armor: 15 } },
  { id: 'cloak', name: '마법 저항 망토', icon: '🧣', cost: 450, cat: '기본', stats: { mr: 25 } },
  { id: 'agility', name: '민첩의 망토', icon: '🍀', cost: 600, cat: '기본', stats: { crit: 0.15 } },

  { id: 'boots', name: '장화', icon: '👢', cost: 300, cat: '신발', stats: { ms: 25 }, group: 'boots' },
  { id: 'swiftBoots', name: '신속의 장화', icon: '👟', cost: 1000, cat: '신발', stats: { ms: 60 }, group: 'boots' },
  { id: 'berserker', name: '광전사의 군화', icon: '🥾', cost: 1100, cat: '신발', stats: { ms: 45, asPct: 0.35 }, group: 'boots' },
  { id: 'sorcBoots', name: '마법사의 신발', icon: '🩰', cost: 1100, cat: '신발', stats: { ms: 45, mpen: 12 }, group: 'boots' },
  { id: 'plated', name: '판금 장화', icon: '🦿', cost: 1100, cat: '신발', stats: { ms: 45, armor: 25 }, group: 'boots' },

  { id: 'bfsword', name: '대검', icon: '⚔️', cost: 1300, cat: '중급', stats: { ad: 40 } },
  { id: 'recurve', name: '곡궁', icon: '🏹', cost: 1000, cat: '중급', stats: { asPct: 0.25 } },
  { id: 'scythe', name: '흡혈의 낫', icon: '🩸', cost: 900, cat: '중급', stats: { ad: 15, lifesteal: 0.10 } },
  { id: 'wand', name: '폭발 지팡이', icon: '🪄', cost: 850, cat: '중급', stats: { ap: 45 } },
  { id: 'rod', name: '거대한 마법봉', icon: '🔱', cost: 1250, cat: '중급', stats: { ap: 65 } },
  { id: 'chapter', name: '잊힌 서책', icon: '📖', cost: 1200, cat: '중급', stats: { ap: 40, mana: 300, ah: 10 } },
  { id: 'belt', name: '거인의 허리띠', icon: '🎗️', cost: 900, cat: '중급', stats: { hp: 350 } },
  { id: 'chain', name: '쇠사슬 조끼', icon: '🦺', cost: 800, cat: '중급', stats: { armor: 40 } },

  { id: 'destroyer', name: '파괴의 대검', icon: '💥', cost: 3400, cat: '공격형 완성', stats: { ad: 70, crit: 0.2, critDmg: 0.35 }, desc: '치명타 피해량 +35%' },
  { id: 'rapidfire', name: '폭풍 연사궁', icon: '🎯', cost: 2600, cat: '공격형 완성', stats: { asPct: 0.35, crit: 0.2, msPct: 0.07 } },
  { id: 'bloodthirst', name: '피의 갈증', icon: '🍷', cost: 3400, cat: '공격형 완성', stats: { ad: 55, lifesteal: 0.18 } },

  { id: 'echoStaff', name: '메아리 지팡이', icon: '🌀', cost: 2800, cat: '마법형 완성', stats: { ap: 90, mana: 600, ah: 20 } },
  { id: 'rabadon', name: '대마법사의 모자', icon: '🎩', cost: 3500, cat: '마법형 완성', stats: { ap: 120, apPct: 0.3 }, desc: '총 주문력이 30% 증가합니다' },
  { id: 'voidStaff', name: '공허의 홀', icon: '🌑', cost: 3000, cat: '마법형 완성', stats: { ap: 95, mpenPct: 0.4 }, desc: '대상 마법 저항력의 40%를 무시합니다' },
  { id: 'hourglass', name: '시간의 모래시계', icon: '⌛', cost: 2900, cat: '마법형 완성', stats: { ap: 100, armor: 45 } },

  { id: 'giantHeart', name: '거인의 심장', icon: '💗', cost: 3000, cat: '방어형 완성', stats: { hp: 800, regen: 8 } },
  { id: 'thornmail', name: '가시 갑옷', icon: '🌵', cost: 2700, cat: '방어형 완성', stats: { armor: 70, hp: 350, thorns: 1 }, desc: '기본 공격을 받으면 공격자에게 (15 + 방어력의 15%) 고정 피해' },
  { id: 'spirit', name: '정령의 형상', icon: '🔮', cost: 2800, cat: '방어형 완성', stats: { mr: 60, hp: 450, regen: 5 } },
];
const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

const STAT_LABEL = {
  ad: ['공격력', v => '+' + v],
  asPct: ['공격 속도', v => '+' + Math.round(v * 100) + '%'],
  ap: ['주문력', v => '+' + v],
  apPct: ['주문력 증폭', v => '+' + Math.round(v * 100) + '%'],
  mana: ['마나', v => '+' + v],
  manaRegen: ['마나 재생', v => '+' + v + '/초'],
  ah: ['스킬 가속', v => '+' + v],
  mpen: ['마법 관통력', v => '+' + v],
  mpenPct: ['마법 관통력', v => '+' + Math.round(v * 100) + '%'],
  hp: ['체력', v => '+' + v],
  armor: ['방어력', v => '+' + v],
  mr: ['마법 저항력', v => '+' + v],
  ms: ['이동 속도', v => '+' + v],
  msPct: ['이동 속도', v => '+' + Math.round(v * 100) + '%'],
  crit: ['치명타 확률', v => '+' + Math.round(v * 100) + '%'],
  critDmg: ['치명타 피해', v => '+' + Math.round(v * 100) + '%'],
  lifesteal: ['생명력 흡수', v => '+' + Math.round(v * 100) + '%'],
  regen: ['체력 재생', v => '+' + v + '/초'],
  thorns: ['피해 반사', () => '있음'],
};

function itemStatLines(item) {
  if (!item.stats) return [];
  return Object.entries(item.stats).map(([k, v]) => STAT_LABEL[k][0] + ' ' + STAT_LABEL[k][1](v));
}

const Shop = {
  canBuy(game, hero, item) {
    if (!game.canShop(hero)) return { ok: false, reason: '우물(기지 안)에서만 구매할 수 있습니다' };
    if (hero.gold < item.cost) return { ok: false, reason: '골드가 부족합니다' };
    if (item.consumable) {
      const slot = hero.items.find(s => s && s.id === item.id && s.count < item.stack);
      if (slot) return { ok: true };
    }
    if (item.group && hero.items.some(s => s && ITEM_BY_ID[s.id].group === item.group)) return { ok: false, reason: '같은 종류(신발)는 하나만 가질 수 있습니다' };
    if (!hero.items.some(s => !s)) return { ok: false, reason: '인벤토리가 가득 찼습니다' };
    return { ok: true };
  },

  buy(game, hero, item) {
    const chk = this.canBuy(game, hero, item);
    if (!chk.ok) return chk;
    hero.gold -= item.cost;
    if (item.consumable) {
      const slot = hero.items.find(s => s && s.id === item.id && s.count < item.stack);
      if (slot) { slot.count++; hero.recalcStats(); return chk; }
    }
    const idx = hero.items.findIndex(s => !s);
    hero.items[idx] = { id: item.id, count: 1 };
    hero.recalcStats();
    return chk;
  },

  sell(game, hero, idx) {
    const s = hero.items[idx];
    if (!s || !game.canShop(hero)) return false;
    const item = ITEM_BY_ID[s.id];
    hero.gold += Math.floor(item.cost * 0.7);
    if (s.count > 1) s.count--; else hero.items[idx] = null;
    hero.recalcStats();
    return true;
  },
};
