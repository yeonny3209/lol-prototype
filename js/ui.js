// ===== HUD / 상점 / 화면 전환 =====
const $ = id => document.getElementById(id);

const UI = {
  game: null,
  shopOpen: false,
  selItem: null,       // 상점에서 선택한 아이템 id
  selSlot: null,       // 상점에서 선택한 인벤토리 칸
  slowAcc: 0,
  fps: 60,
  lastLockedMsg: -99,
  cache: {},

  init() {
    $('startBtn').onclick = () => { $('startScreen').classList.add('hidden'); startGame(); };
    $('resumeBtn').onclick = () => this.setPaused(false);
    $('restartBtn').onclick = () => startGame();
    $('restartBtn2').onclick = () => startGame();
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
    this.buildShop();
  },

  attach(game) {
    this.game = game;
    this.cache = {};
    this.selItem = null; this.selSlot = null;
    document.querySelectorAll('.hud').forEach(e => e.classList.remove('hidden'));
    $('endScreen').classList.add('hidden');
    $('pauseScreen').classList.add('hidden');
    $('announce').innerHTML = '';
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

  flashLocked(key) {
    if (!this.game) return;
    if (performance.now() - this.lastLockedMsg > 2000) {
      this.lastLockedMsg = performance.now();
      this.announce('챔피언이 없어 ' + key + ' 스킬이 비어 있습니다', 'info');
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

  // ---------- 상점 ----------
  buildShop() {
    const list = $('shopList');
    const cats = [...new Set(ITEMS.map(i => i.cat))];
    list.innerHTML = '';
    for (const cat of cats) {
      const h = document.createElement('h3'); h.textContent = cat; list.appendChild(h);
      const grid = document.createElement('div'); grid.className = 'grid';
      for (const it of ITEMS.filter(i => i.cat === cat)) {
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

    // 체력바 (매 프레임)
    const hpK = clamp(p.hp / p.maxHp, 0, 1);
    $('hpBar').querySelector('.fill').style.width = (hpK * 100).toFixed(1) + '%';
    this.set('hpTxt', $('hpBar').querySelector('.txt'), 'text', Math.ceil(p.hp) + ' / ' + p.maxHp);
    if (this.cache.ticksFor !== p.maxHp) {
      this.cache.ticksFor = p.maxHp;
      let html = '';
      for (let h = 100; h < p.maxHp; h += 100) html += '<i style="left:' + (h / p.maxHp * 100).toFixed(2) + '%"></i>';
      $('hpBar').querySelector('.ticks').innerHTML = html;
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
      ['⚔', Math.round(p.ad), '공격력'], ['⚡', p.as.toFixed(2), '공격 속도'],
      ['🛡', Math.round(p.armor), '방어력'], ['✨', Math.round(p.mr), '마법 저항력'],
      ['👟', Math.round(p.ms), '이동 속도'], ['🎯', p.range, '사거리'],
      ['💥', Math.round(p.crit * 100) + '%', '치명타 확률'], ['🩸', Math.round(p.lifesteal * 100) + '%', '생명력 흡수'],
    ];
    this.set('stats', $('statsPanel'), 'html', stats.map(s => '<div class="st" title="' + s[2] + '"><i>' + s[0] + '</i>' + s[1] + '</div>').join(''));

    for (const [key, id] of [['heal', 'spellD'], ['flash', 'spellF']]) {
      const cd = p.spellCd[key];
      this.set('cd' + key, $(id).querySelector('.cd'), 'text', cd > 0 ? Math.ceil(cd) : '');
    }

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
    const rows = [];
    if (u.ad) rows.push('⚔ ' + Math.round(u.kind === 'turret' ? TURRET_COMMON.ad + TURRET_COMMON.adPerMin * game.time / 60 : u.ad));
    rows.push('🛡 ' + Math.round(u.armor));
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
