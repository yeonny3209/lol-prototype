// ===== HUD / 챔피언 선택 / 상점 / 화면 전환 =====
const $ = id => document.getElementById(id);
const ABILITY_KEYS = ['Q', 'W', 'E', 'R'];

const UI = {
  game: null,
  shopOpen: false,
  selItem: null,       // 상점에서 선택한 아이템 id
  selSlot: null,       // 상점에서 선택한 인벤토리 칸
  slowAcc: 0,
  fps: 60,
  lastLockedMsg: -99,
  cache: {},
  selectedChamp: 'orianna',
  hoverAbility: null,  // 마우스를 올린 스킬 (범위 표시용)
  tipFn: null,
  tipEl: null,
  abilityEls: {},
  lastHint: '',
  lastHintT: 0,

  init() {
    $('startBtn').onclick = () => startGame(this.selectedChamp);
    $('resumeBtn').onclick = () => this.setPaused(false);
    const restart = () => startGame(this.game ? this.game.champId : this.selectedChamp);
    $('restartBtn').onclick = restart;
    $('restartBtn2').onclick = restart;
    $('menuBtn').onclick = () => showChampSelect();
    $('menuBtn2').onclick = () => showChampSelect();
    $('shopBtn').onclick = () => this.toggleShop();
    $('recallBtn').onclick = () => this.game && this.game.player.startRecall();
    document.querySelectorAll('[data-close="shop"]').forEach(b => b.onclick = () => this.toggleShop(false));

    const items = $('items');
    for (let i = 0; i < 6; i++) {
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = '<span class="key">' + (i + 1) + '</span><span class="ic"></span><span class="cnt"></span>';
      el.onclick = () => {
        if (!this.game) return;
        if (this.shopOpen) { this.selSlot = i; this.selItem = null; this.renderShopDetail(); }
        else this.game.player.useItem(i);
      };
      items.appendChild(el);
    }
    this.buildChampSelect();
  },

  attach(game) {
    this.game = game;
    this.cache = {};
    this.selItem = null; this.selSlot = null;
    this.hideTip();
    document.querySelectorAll('.hud').forEach(e => e.classList.remove('hidden'));
    $('startScreen').classList.add('hidden');
    $('endScreen').classList.add('hidden');
    $('pauseScreen').classList.add('hidden');
    $('announce').innerHTML = '';
    $('portraitInner').textContent = game.player.base.icon || '⚔';
    this.buildAbilities(game.player);
    this.buildShop(game.player);
    this.toggleShop(false);
  },

  set(key, el, prop, val) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    if (prop === 'text') el.textContent = val;
    else if (prop === 'html') el.innerHTML = val;
    else el.style[prop] = val;
  },

  announce(text, cls = 'info') {
    const box = $('announce');
    const el = document.createElement('div');
    el.className = 'msg ' + cls;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), 3700);
  },

  // 같은 안내가 연달아 쌓이지 않게
  hint(text) {
    const now = performance.now();
    if (this.lastHint === text && now - this.lastHintT < 1500) return;
    this.lastHint = text; this.lastHintT = now;
    this.announce(text, 'bad');
  },

  flashLocked(key) {
    if (!this.game) return;
    if (performance.now() - this.lastLockedMsg > 2000) {
      this.lastLockedMsg = performance.now();
      this.announce(this.game.player.base.name + '은(는) ' + key + ' 스킬이 없습니다', 'info');
    }
  },

  setPaused(p) {
    if (!this.game) return;
    this.game.paused = p;
    $('pauseScreen').classList.toggle('hidden', !p);
  },

  toggleShop(force) {
    this.shopOpen = force === undefined ? !this.shopOpen : force;
    $('shop').classList.toggle('hidden', !this.shopOpen);
    if (this.shopOpen) { this.refreshShop(); this.renderShopDetail(); }
  },

  showEnd(game) {
    const win = game.winner === game.player.team;
    const t = $('endTitle');
    t.textContent = win ? '승리' : '패배';
    t.className = win ? 'win' : 'lose';
    const p = game.player;
    $('endStats').innerHTML = [
      ['챔피언', p.base.name],
      ['게임 시간', formatTime(game.time)],
      ['레벨', p.level],
      ['미니언 / 몬스터 처치', p.cs],
      ['획득 골드', Math.round(p.goldEarned)],
      ['파괴한 포탑', game.towersKilled[p.team]],
      ['사망', p.deaths],
    ].map(([k, v]) => '<span>' + k + '</span><b>' + v + '</b>').join('');
    $('endScreen').classList.remove('hidden');
    this.toggleShop(false);
  },

  // ---------- 챔피언 선택 ----------
  buildChampSelect() {
    const box = $('champSelect');
    box.innerHTML = '';
    const list = Object.entries(CHAMPIONS).sort((a, b) => (a[1].base.order || 99) - (b[1].base.order || 99));
    for (const [id, c] of list) {
      const el = document.createElement('div');
      el.className = 'champCard' + (id === this.selectedChamp ? ' sel' : '');
      el.innerHTML = '<div class="cIcon">' + c.base.icon + '</div><div class="cName">' + c.base.name + '</div>' +
        '<div class="cTitle">' + (c.base.title || '') + '</div><div class="cRole">' + c.base.role + '</div>';
      el.onclick = () => { this.selectedChamp = id; this.buildChampSelect(); };
      el.ondblclick = () => { this.selectedChamp = id; startGame(id); };
      box.appendChild(el);
    }
  },

  // ---------- 스킬 칸 ----------
  buildAbilities(p) {
    const box = $('abilitySlots');
    box.innerHTML = '';
    this.abilityEls = {};
    const defs = p.abilityDefs;
    if (defs && defs.P) {
      const el = document.createElement('div');
      el.className = 'slot passive';
      el.innerHTML = '<span class="icon">' + defs.P.icon + '</span>';
      this.bindTip(el, () => this.passiveTip(p));
      box.appendChild(el);
    }
    for (const key of ABILITY_KEYS) {
      const def = defs && defs[key];
      const wrap = document.createElement('div');
      wrap.className = 'abilityWrap';
      wrap.innerHTML = '<button class="lvlUp" title="스킬 레벨 올리기 (Shift+' + key + ')">+</button>' +
        '<div class="slot ability' + (def ? '' : ' locked') + (key === 'R' ? ' big' : '') + '">' +
        (def ? '<span class="icon">' + def.icon + '</span><span class="cost"></span><div class="cd"></div>' : '') +
        '<span class="key">' + key + '</span></div><div class="pips"></div>';
      box.appendChild(wrap);
      if (!def) continue;
      const pips = wrap.querySelector('.pips');
      for (let i = 0; i < def.maxLvl; i++) pips.appendChild(document.createElement('i'));
      const slot = wrap.querySelector('.slot');
      const up = wrap.querySelector('.lvlUp');
      up.onclick = () => { p.levelAbility(key); if (this.tipFn) this.showTip(); };
      this.bindTip(slot, () => this.abilityTip(p, key), key);
      this.abilityEls[key] = { slot, up, pips: [...pips.children], cd: slot.querySelector('.cd'), cost: slot.querySelector('.cost') };
    }
  },

  bindTip(el, fn, abilityKey) {
    el.addEventListener('mouseenter', () => { this.tipFn = fn; this.tipEl = el; this.hoverAbility = abilityKey || null; this.showTip(); });
    el.addEventListener('mouseleave', () => this.hideTip());
  },

  showTip() {
    const tip = $('tooltip');
    tip.innerHTML = this.tipFn();
    tip.classList.remove('hidden');
    const r = this.tipEl.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8) + 'px';
    tip.style.top = Math.max(8, r.top - th - 36) + 'px';
  },

  hideTip() {
    this.tipFn = null;
    this.tipEl = null;
    this.hoverAbility = null;
    $('tooltip').classList.add('hidden');
  },

  abilityTip(p, key) {
    const def = p.abilityDefs[key], a = p.abilities[key], lvl = Math.max(1, a.lvl);
    const cd = p.abilityCd(key, lvl);
    return '<div class="tipHead"><span class="tipName">' + def.name + '</span><span class="tipKey">' + key + '</span></div>' +
      '<div class="tipMeta">' + (a.lvl ? '레벨 ' + a.lvl + ' / ' + def.maxLvl : '<span class="warn">배우지 않음 · Shift+' + key + '</span>') +
      ' · 마나 ' + def.cost[lvl - 1] + ' · 재사용 ' + (+cd.toFixed(1)) + '초</div>' +
      '<div class="tipBody">' + def.desc(p, lvl) + '</div>';
  },

  passiveTip(p) {
    const def = p.abilityDefs.P;
    return '<div class="tipHead"><span class="tipName">' + def.name + '</span><span class="tipKey">패시브</span></div>' +
      '<div class="tipBody">' + def.desc(p) + '</div>';
  },

  // ---------- 상점 ----------
  buildShop(p) {
    const list = $('shopList');
    list.innerHTML = '';
    const sections = [];
    const rec = (p.base.recommended || []).map(id => ITEM_BY_ID[id]).filter(Boolean);
    if (rec.length) sections.push(['추천 아이템 · ' + p.base.name, rec]);
    for (const cat of [...new Set(ITEMS.map(i => i.cat))]) sections.push([cat, ITEMS.filter(i => i.cat === cat)]);
    for (const [title, items] of sections) {
      const h = document.createElement('h3'); h.textContent = title; list.appendChild(h);
      const grid = document.createElement('div'); grid.className = 'grid';
      for (const it of items) {
        const el = document.createElement('div');
        el.className = 'shopItem';
        el.dataset.id = it.id;
        el.title = it.name;
        el.innerHTML = '<div class="ic">' + it.icon + '</div><div class="price">' + it.cost + '</div>';
        el.onclick = () => { this.selItem = it.id; this.selSlot = null; this.refreshShop(); this.renderShopDetail(); };
        el.oncontextmenu = e => { e.preventDefault(); this.buy(it); };
        grid.appendChild(el);
      }
      list.appendChild(grid);
    }
  },

  buy(it) {
    const g = this.game;
    const r = Shop.buy(g, g.player, it);
    if (!r.ok) this.announce(r.reason, 'bad');
    this.refreshShop(); this.renderShopDetail();
  },

  refreshShop() {
    const g = this.game;
    if (!g) return;
    const p = g.player;
    $('shopNote').textContent = g.canShop(p) ? '' : '우물 근처에서만 구매/판매할 수 있습니다 (B: 귀환)';
    document.querySelectorAll('.shopItem').forEach(el => {
      const it = ITEM_BY_ID[el.dataset.id];
      el.classList.toggle('poor', p.gold < it.cost);
      el.classList.toggle('sel', this.selItem === it.id);
    });
  },

  renderShopDetail() {
    const g = this.game, box = $('shopDetail');
    if (!g) return;
    const p = g.player;
    if (this.selSlot != null) {
      const s = p.items[this.selSlot];
      if (!s) { box.innerHTML = '<div class="ddesc">빈 칸입니다.</div>'; return; }
      const it = ITEM_BY_ID[s.id];
      box.innerHTML = '<div class="dname">' + it.icon + ' ' + it.name + '</div>' +
        '<div class="dstats">' + itemStatLines(it).join('<br>') + '</div>' +
        (it.desc ? '<div class="ddesc">' + it.desc + '</div>' : '') +
        '<button class="sell">판매 (+' + Math.floor(it.cost * 0.7) + ')</button>';
      const btn = box.querySelector('button');
      btn.disabled = !g.canShop(p);
      btn.onclick = () => { Shop.sell(g, p, this.selSlot); if (!p.items[this.selSlot]) this.selSlot = null; this.refreshShop(); this.renderShopDetail(); };
      return;
    }
    if (!this.selItem) {
      box.innerHTML = '<div class="ddesc">아이템을 클릭하면 정보가 표시됩니다.<br><br>우클릭: 바로 구매<br>인벤토리 칸 클릭: 판매</div>';
      return;
    }
    const it = ITEM_BY_ID[this.selItem];
    const chk = Shop.canBuy(g, p, it);
    box.innerHTML = '<div class="dname">' + it.icon + ' ' + it.name + '</div>' +
      '<div style="color:#ffd34d">가격 ' + it.cost + ' 골드</div>' +
      '<div class="dstats">' + itemStatLines(it).join('<br>') + '</div>' +
      (it.desc ? '<div class="ddesc">' + it.desc + '</div>' : '') +
      '<button>구매</button>' +
      (chk.ok ? '' : '<div class="ddesc" style="color:#ff8a6a">' + chk.reason + '</div>');
    const btn = box.querySelector('button');
    btn.disabled = !chk.ok;
    btn.onclick = () => this.buy(it);
  },

  // ---------- 매 프레임 ----------
  update(game, dt) {
    if (dt > 0) this.fps = lerp(this.fps, 1 / dt, 0.05);
    const p = game.player;

    // 체력 / 보호막
    const sh = p.shields ? p.shieldTotal() : 0;
    const total = Math.max(p.maxHp, p.hp + sh);
    const hpK = clamp(p.hp / total, 0, 1);
    const hpBar = $('hpBar');
    hpBar.querySelector('.fill').style.width = (hpK * 100).toFixed(1) + '%';
    const shEl = hpBar.querySelector('.shield');
    shEl.style.left = (hpK * 100).toFixed(1) + '%';
    shEl.style.width = (sh / total * 100).toFixed(1) + '%';
    this.set('hpTxt', hpBar.querySelector('.txt'), 'text', Math.ceil(p.hp) + (sh > 0 ? ' (+' + Math.ceil(sh) + ')' : '') + ' / ' + p.maxHp);
    if (this.cache.ticksFor !== p.maxHp) {
      this.cache.ticksFor = p.maxHp;
      let html = '';
      for (let h = 100; h < p.maxHp; h += 100) html += '<i style="left:' + (h / p.maxHp * 100).toFixed(2) + '%"></i>';
      hpBar.querySelector('.ticks').innerHTML = html;
    }

    // 마나
    const res = $('resBar');
    res.classList.toggle('mana', p.maxMana > 0);
    if (p.maxMana > 0) {
      res.querySelector('.fill').style.width = (clamp(p.mana / p.maxMana, 0, 1) * 100).toFixed(1) + '%';
      this.set('mpTxt', res.querySelector('.txt'), 'text', Math.floor(p.mana) + ' / ' + p.maxMana + '   (+' + p.manaRegen.toFixed(1) + '/초)');
    } else {
      res.querySelector('.fill').style.width = '100%';
      this.set('mpTxt', res.querySelector('.txt'), 'text', '자원 없음');
    }

    // 귀환 바
    const ch = $('channelBar');
    ch.classList.toggle('hidden', !p.recall);
    if (p.recall) ch.querySelector('.fill').style.width = (p.recall.t / p.recall.dur * 100) + '%';

    this.slowAcc += dt;
    if (this.slowAcc < 0.1) return;
    this.slowAcc = 0;

    this.set('timer', $('timer'), 'text', formatTime(game.time));
    this.set('bt', $('blueTowers'), 'text', game.towersKilled[TEAM.BLUE]);
    this.set('rt', $('redTowers'), 'text', game.towersKilled[TEAM.RED]);
    this.set('cs', $('csText'), 'text', 'CS ' + p.cs);
    this.set('fps', $('fpsText'), 'text', Math.round(this.fps) + ' FPS');
    this.set('gold', $('goldText'), 'text', Math.floor(p.gold));
    this.set('lvl', $('levelBadge'), 'text', p.level);
    this.set('xp', $('xpFill'), 'height', (p.level >= MAX_LEVEL ? 100 : p.xp / xpToNext(p.level) * 100).toFixed(1) + '%');
    $('portrait').classList.toggle('dead', !p.alive);

    const stats = [
      ['⚔', Math.round(p.ad), '공격력'], ['🔮', Math.round(p.ap), '주문력'],
      ['🛡', Math.round(p.armor), '방어력'], ['✨', Math.round(p.mr), '마법 저항력'],
      ['⚡', p.as.toFixed(2), '공격 속도'], ['⏳', Math.round(p.ah), '스킬 가속'],
      ['👟', Math.round(p.getMS()), '이동 속도'], ['🎯', p.range, '사거리'],
      ['💥', Math.round(p.crit * 100) + '%', '치명타 확률'], ['🌀', Math.round(p.mpenFlat) + (p.mpenPct ? ' | ' + Math.round(p.mpenPct * 100) + '%' : ''), '마법 관통력'],
    ];
    this.set('stats', $('statsPanel'), 'html', stats.map(s => '<div class="st" title="' + s[2] + '"><i>' + s[0] + '</i>' + s[1] + '</div>').join(''));

    for (const [key, id] of [['heal', 'spellD'], ['flash', 'spellF']]) {
      const cd = p.spellCd[key];
      this.set('cd' + key, $(id).querySelector('.cd'), 'text', cd > 0 ? Math.ceil(cd) : '');
    }

    // 스킬 칸
    if (p.abilityDefs) {
      for (const key of ABILITY_KEYS) {
        const el = this.abilityEls[key];
        if (!el) continue;
        const a = p.abilities[key], def = p.abilityDefs[key];
        el.slot.classList.toggle('unlearned', a.lvl === 0);
        el.slot.classList.toggle('nomana', a.lvl > 0 && a.cd <= 0 && p.mana < def.cost[a.lvl - 1]);
        const cdTxt = a.cd > 0 ? (a.cd < 1 ? a.cd.toFixed(1) : String(Math.ceil(a.cd))) : '';
        this.set('acd' + key, el.cd, 'text', cdTxt);
        if (a.cd > 0) el.cd.style.background = 'conic-gradient(rgba(0,0,0,0.25) ' + ((1 - a.cd / a.maxCd) * 360).toFixed(0) + 'deg, rgba(0,0,0,0.72) 0)';
        this.set('acost' + key, el.cost, 'text', a.lvl > 0 ? String(def.cost[a.lvl - 1]) : '');
        el.pips.forEach((pip, i) => pip.classList.toggle('on', i < a.lvl));
        el.up.classList.toggle('on', p.canLevelAbility(key));
      }
    }
    if (this.tipFn) this.showTip();

    const itemEls = $('items').children;
    for (let i = 0; i < 6; i++) {
      const s = p.items[i];
      const it = s && ITEM_BY_ID[s.id];
      const sig = s ? s.id + ':' + s.count + ':' + (this.shopOpen && this.selSlot === i) : 'empty' + (this.shopOpen && this.selSlot === i);
      if (this.cache['item' + i] === sig) continue;
      this.cache['item' + i] = sig;
      itemEls[i].querySelector('.ic').textContent = it ? it.icon : '';
      itemEls[i].querySelector('.cnt').textContent = s && s.count > 1 ? s.count : '';
      itemEls[i].title = it ? it.name + '\n' + itemStatLines(it).join('\n') + (it.desc ? '\n' + it.desc : '') : '';
      itemEls[i].style.borderColor = this.shopOpen && this.selSlot === i ? '#ffd34d' : '';
    }

    // 버프
    const buffs = Object.entries(p.buffs).filter(([id]) => BUFF_INFO[id]);
    this.set('buffs', $('buffBar'), 'html', buffs.map(([id, b]) => {
      const info = BUFF_INFO[id];
      const label = id === 'dragon' ? 'x' + b.stacks : Math.ceil(b.t);
      return '<div class="buff" style="border-color:' + info.color + '" title="' + info.name + ': ' + info.desc + '">' + info.icon + '<span>' + label + '</span></div>';
    }).join(''));

    // 사망
    $('deathOverlay').classList.toggle('hidden', p.alive || game.over);
    if (!p.alive) this.set('death', $('deathText'), 'html', '당하셨습니다<br><span style="font-size:18px">부활까지 ' + Math.ceil(p.respawnTimer) + '초</span>');

    this.updateTargetFrame(game);
    if (this.shopOpen) { this.refreshShop(); if (this.selItem) this.renderShopDetailLight(); }
  },

  renderShopDetailLight() {
    const g = this.game, it = ITEM_BY_ID[this.selItem];
    const btn = $('shopDetail').querySelector('button');
    if (btn) btn.disabled = !Shop.canBuy(g, g.player, it).ok;
  },

  updateTargetFrame(game) {
    const u = (Input.hover && Input.hover.alive) ? Input.hover : game.selected;
    const box = $('targetFrame');
    if (!u || u === game.player || (!u.alive && !u.isStructure)) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const col = u.team === TEAM.NEUTRAL ? '#e0b040' : TEAM_COLOR[u.team];
    let note = '';
    if (u.isStructure && u.alive && !game.isVulnerable(u)) note = '🛡 ' + game.protectionReason(u);
    if (u.kind === 'inhibitor' && !u.alive) note = '재생성까지 ' + formatTime(u.respawnTimer);
    if (u.kind === 'monster' && u.resetting) note = '초기화 중 (피해 무효)';
    if (u.slows && Object.keys(u.slows).length) note += (note ? ' · ' : '') + '둔화됨';
    const rows = [];
    if (u.ad) rows.push('⚔ ' + Math.round(u.kind === 'turret' ? TURRET_COMMON.ad + TURRET_COMMON.adPerMin * game.time / 60 : u.ad));
    rows.push('🛡 ' + Math.round(u.armor));
    rows.push('✨ ' + Math.round(u.mr || 0));
    if (u.range) rows.push('🎯 ' + u.range);
    if (u.gold && u.team !== game.player.team) rows.push('● ' + u.gold + 'G');
    const lane = u.lane ? ' (' + LANE_NAMES[u.lane] + ')' : '';
    const html = '<div class="tname" style="color:' + col + '">' + u.name + lane + '</div>' +
      '<div class="tbar"><div style="width:' + (u.hp / u.maxHp * 100).toFixed(1) + '%;background:' + col + '"></div></div>' +
      '<div class="trow"><span>' + Math.ceil(u.hp) + ' / ' + Math.round(u.maxHp) + '</span>' + rows.map(r => '<span>' + r + '</span>').join('') + '</div>' +
      (note ? '<div class="tnote">' + note + '</div>' : '');
    this.set('target', box, 'html', html);
  },
};
