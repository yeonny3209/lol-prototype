// ===== HUD / 시작 화면(챔피언·포지션·주문·룬) / 상점 / 툴팁 =====
const $ = id => document.getElementById(id);
const ABILITY_KEYS = ['Q', 'W', 'E', 'R'];
const ROLE_ORDER = ['top', 'jungle', 'mid', 'bot', 'support'];
const PORTRAITS = { orianna: 'Orianna', leesin: 'LeeSin' };
const ITEM_SLOT_ORDER = [0, 1, 2, 'trinket', 3, 4, 5, 'quest'];
const ITEM_SLOT_KEYS = ['1', '2', '3', '7', '4', '5', '6', '8'];

const champIcon = id => PORTRAITS[id] && LOL_DATA.champions[PORTRAITS[id]] ? DD_CDN + DD_VER + '/img/champion/' + LOL_DATA.champions[PORTRAITS[id]].icon : null;
function iconHtml(src, fallback, cls = '') {
  if (!src) return '<span class="icoFb ' + cls + '">' + fallback + '</span>';
  return '<img class="' + cls + '" src="' + src + '" alt="" onerror="this.outerHTML=\'<span class=&quot;icoFb ' + cls + '&quot;>' + fallback + '</span>\'">';
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = {
  game: null,
  shopOpen: false,
  spellbookOpen: false,
  selItem: null,
  selSlot: null,
  shopCat: '추천',
  shopQuery: '',
  slowAcc: 0,
  fps: 60,
  lastLockedMsg: -99,
  cache: {},
  hoverAbility: null,
  tipFn: null,
  tipEl: null,
  abilityEls: {},
  lastHint: '',
  lastHintT: 0,
  setup: null,
  spellSlotSel: 0,

  init() {
    $('startBtn').onclick = () => startGame(this.currentSetup());
    $('resumeBtn').onclick = () => this.setPaused(false);
    const restart = () => startGame(this.game ? this.game.setup : this.currentSetup());
    $('restartBtn').onclick = restart;
    $('restartBtn2').onclick = restart;
    $('menuBtn').onclick = () => showChampSelect();
    $('menuBtn2').onclick = () => showChampSelect();
    $('shopBtn').onclick = () => this.toggleShop();
    $('recallBtn').onclick = () => this.game && this.game.player.startRecall();
    document.querySelectorAll('[data-close="shop"]').forEach(b => b.onclick = () => this.toggleShop(false));
    document.querySelectorAll('[data-close="spellbook"]').forEach(b => b.onclick = () => this.toggleSpellbook(false));
    $('controlsBtn').onclick = () => $('controlsBox').classList.toggle('hidden');
    $('runeRecBtn').onclick = () => { this.setup.runes = Runes.clone(RECOMMENDED_RUNES[this.setup.champ] || RECOMMENDED_RUNES.basic); this.renderRunes(); };
    $('spellRecBtn').onclick = () => { this.setup.spells = (CHAMPIONS[this.setup.champ].base.recSpells || ['SummonerFlash', 'SummonerHeal']).slice(); this.renderSpellPick(); this.renderRoles(); };
    $('practiceChk').onchange = e => { this.setup.practice = e.target.checked; };
    document.querySelectorAll('#ctrlPick [data-scheme]').forEach(b => b.onclick = () => { Controls.scheme = b.dataset.scheme; Controls.save(); this.renderControls(); this.renderSpellPick(); });
    $('angleChk').onchange = e => { Controls.angle45 = e.target.checked; Controls.save(); };
    $('ctrlToggleBtn').onclick = () => {
      Controls.scheme = Controls.wasd() ? 'classic' : 'wasd';
      Controls.save();
      this.renderControls();
      if (this.game) {
        Input.amoveArmed = false; Input.rightHeld = false; Input.leftHeld = false;
        this.buildAbilities(this.game.player);
        this.buildSpells(this.game.player);
      }
    };
    $('shopSearch').oninput = e => { this.shopQuery = e.target.value.trim(); this.renderShopList(); };
    $('patchVer').textContent = DD_VER;
    const saved = loadSetups();
    this.loadSetupFor(CHAMPIONS[saved.last] ? saved.last : 'orianna');
    this.renderSetup();
  },

  // ================= 시작 화면 =================
  defaultSetup(champ) {
    const base = CHAMPIONS[champ].base;
    return {
      champ, role: base.defaultRole || 'mid',
      spells: (base.recSpells || ['SummonerFlash', 'SummonerHeal']).slice(),
      runes: Runes.clone(RECOMMENDED_RUNES[champ] || RECOMMENDED_RUNES.basic),
      practice: true,
    };
  },

  loadSetupFor(champ) {
    const saved = loadSetups()[champ];
    this.setup = Object.assign(this.defaultSetup(champ), saved || {});
    this.setup.runes = Runes.validate(this.setup.runes);
    if (!Array.isArray(this.setup.spells) || this.setup.spells.length !== 2) this.setup.spells = this.defaultSetup(champ).spells;
  },

  currentSetup() {
    const s = JSON.parse(JSON.stringify(this.setup));
    s.practice = $('practiceChk').checked;
    return s;
  },

  // 조작 방식 버튼·설명 갱신 (시작 화면과 일시정지 화면)
  renderControls() {
    const wasd = Controls.wasd();
    document.querySelectorAll('#ctrlPick [data-scheme]').forEach(b => b.classList.toggle('sel', b.dataset.scheme === Controls.scheme));
    $('angleChk').checked = Controls.angle45;
    $('angleWrap').classList.toggle('hidden', !wasd);
    $('controlsClassic').classList.toggle('hidden', wasd);
    $('controlsWasd').classList.toggle('hidden', !wasd);
    $('ctrlToggleBtn').textContent = '조작 방식: ' + (wasd ? 'WASD → 클래식으로' : '클래식 → WASD로');
  },

  renderSetup() {
    this.renderControls();
    $('practiceChk').checked = this.setup.practice !== false;
    this.renderChampSelect();
    this.renderRoles();
    this.renderSpellPick();
    this.renderRunes();
  },

  renderChampSelect() {
    const box = $('champSelect');
    box.innerHTML = '';
    const list = Object.entries(CHAMPIONS).sort((a, b) => (a[1].base.order || 99) - (b[1].base.order || 99));
    for (const [id, c] of list) {
      const el = document.createElement('div');
      el.className = 'champCard' + (id === this.setup.champ ? ' sel' : '');
      el.innerHTML = '<div class="cIcon">' + iconHtml(champIcon(id), c.base.icon) + '</div><div class="cName">' + c.base.name + '</div>' +
        '<div class="cTitle">' + (c.base.title || '') + '</div><div class="cRole">' + c.base.role + '</div>';
      el.onclick = () => { if (id !== this.setup.champ) { this.loadSetupFor(id); this.renderSetup(); } };
      el.ondblclick = () => startGame(this.currentSetup());
      box.appendChild(el);
    }
  },

  renderRoles() {
    const box = $('roleSelect');
    box.innerHTML = '';
    for (const r of ROLE_ORDER) {
      const b = document.createElement('button');
      b.className = 'roleBtn' + (this.setup.role === r ? ' sel' : '');
      b.textContent = ROLES[r].name;
      b.onclick = () => { this.setup.role = r; this.renderRoles(); };
      box.appendChild(b);
    }
    const q = QUEST_INFO[this.setup.role];
    let warn = '';
    if (this.setup.role === 'jungle' && !this.setup.spells.includes('SummonerSmite')) warn = '<div class="warn">정글 동료 아이템을 사려면 강타가 필요합니다.</div>';
    $('roleInfo').innerHTML = '<div><b>진행:</b> ' + q.goal + '</div><div><b>보상:</b> ' + q.reward + '</div>' + warn;
  },

  renderSpellPick() {
    const slots = $('spellSlots');
    slots.innerHTML = '';
    [Controls.spellLabel(0), Controls.spellLabel(1)].forEach((k, i) => {
      const key = this.setup.spells[i];
      const el = document.createElement('div');
      el.className = 'spellPick' + (this.spellSlotSel === i ? ' sel' : '');
      el.innerHTML = iconHtml(spellIcon(key), '✦') + '<span class="key">' + k + '</span><span class="nm">' + SPELL_INFO[key].name + '</span>';
      el.onclick = () => { this.spellSlotSel = i; this.renderSpellPick(); };
      this.bindTip(el, () => this.spellTip(key, null));
      slots.appendChild(el);
    });
    const grid = $('spellGrid');
    grid.innerHTML = '';
    for (const key of SPELL_ORDER) {
      const el = document.createElement('div');
      el.className = 'spellOpt' + (this.setup.spells.includes(key) ? ' used' : '');
      el.innerHTML = iconHtml(spellIcon(key), '✦') + '<span>' + SPELL_INFO[key].name + '</span>';
      el.onclick = () => {
        const s = this.setup.spells, i = this.spellSlotSel, other = 1 - i;
        if (s[other] === key) s[other] = s[i];
        s[i] = key;
        this.spellSlotSel = other;
        this.renderSpellPick();
        this.renderRoles();
      };
      this.bindTip(el, () => this.spellTip(key, null));
      grid.appendChild(el);
    }
  },

  renderRunes() {
    const page = this.setup.runes = Runes.validate(this.setup.runes);
    const box = $('runeEditor');
    box.innerHTML = '';
    const runeBtn = (r, selected, onClick, big) => {
      const el = document.createElement('div');
      el.className = 'runeOpt' + (selected ? ' sel' : '') + (big ? ' big' : '');
      el.innerHTML = iconHtml(runeIcon(r.icon), r.name.slice(0, 2));
      el.onclick = onClick;
      this.bindTip(el, () => '<div class="tipHead"><span class="tipName">' + r.name + '</span></div><div class="tipBody">' + Runes.desc(r.id) + '</div>');
      return el;
    };
    const treeTabs = (current, exclude, onPick) => {
      const tabs = document.createElement('div');
      tabs.className = 'treeTabs';
      for (const t of RUNE_TREES) {
        if (t.id === exclude) continue;
        const el = document.createElement('div');
        el.className = 'treeTab' + (t.id === current ? ' sel' : '');
        el.innerHTML = iconHtml(runeIcon(t.icon), t.name.slice(0, 1)) + '<span>' + t.name + '</span>';
        el.onclick = () => onPick(t.id);
        tabs.appendChild(el);
      }
      return tabs;
    };

    const prim = document.createElement('div');
    prim.className = 'runeCol';
    prim.innerHTML = '<h4>주 룬</h4>';
    prim.appendChild(treeTabs(page.primary, null, id => {
      if (id === page.primary) return;
      page.primary = id; page.keys = [];
      if (page.secondary === id) page.secondary = null;
      this.renderRunes();
    }));
    const pt = Runes.tree(page.primary);
    pt.slots.forEach((slot, si) => {
      const row = document.createElement('div');
      row.className = 'runeRow' + (si === 0 ? ' keystones' : '');
      for (const r of slot) row.appendChild(runeBtn(r, page.keys[si] === r.id, () => { page.keys[si] = r.id; this.renderRunes(); }, si === 0));
      prim.appendChild(row);
    });

    const sec = document.createElement('div');
    sec.className = 'runeCol';
    sec.innerHTML = '<h4>보조 룬 <small>서로 다른 줄에서 2개</small></h4>';
    sec.appendChild(treeTabs(page.secondary, page.primary, id => { page.secondary = id; page.sec = []; this.renderRunes(); }));
    const st = Runes.tree(page.secondary);
    st.slots.forEach((slot, si) => {
      if (si === 0) return;
      const row = document.createElement('div');
      row.className = 'runeRow';
      for (const r of slot) row.appendChild(runeBtn(r, page.sec.includes(r.id), () => { Runes.pickSecondary(page, r.id); this.renderRunes(); }));
      sec.appendChild(row);
    });
    const shards = document.createElement('div');
    shards.className = 'shardBox';
    shards.innerHTML = '<h4>능력치 파편</h4>';
    SHARD_ROWS.forEach((rowIds, ri) => {
      const row = document.createElement('div');
      row.className = 'runeRow shards';
      row.innerHTML = '<span class="shardLbl">' + SHARD_ROW_NAMES[ri] + '</span>';
      for (const id of rowIds) {
        const sh = SHARDS[id];
        const el = document.createElement('div');
        el.className = 'runeOpt shard' + (page.shards[ri] === id ? ' sel' : '');
        el.innerHTML = iconHtml(runeIcon(sh.icon), sh.name.slice(0, 1));
        el.onclick = () => { page.shards[ri] = id; this.renderRunes(); };
        this.bindTip(el, () => '<div class="tipHead"><span class="tipName">' + sh.name + '</span></div><div class="tipBody">' + sh.text + '</div>');
        row.appendChild(el);
      }
      shards.appendChild(row);
    });
    sec.appendChild(shards);
    box.appendChild(prim);
    box.appendChild(sec);
  },

  // ================= 게임 연결 =================
  attach(game) {
    this.game = game;
    this.cache = {};
    this.selItem = null; this.selSlot = null; this.shopCat = '추천';
    this.hideTip();
    document.querySelectorAll('.hud').forEach(e => e.classList.remove('hidden'));
    $('startScreen').classList.add('hidden');
    $('endScreen').classList.add('hidden');
    $('pauseScreen').classList.add('hidden');
    $('announce').innerHTML = '';
    const p = game.player;
    $('portraitInner').innerHTML = iconHtml(champIcon(p.champId), p.base.icon || '⚔');
    const ks = p.runePage && RUNE_BY_ID[p.runePage.keys[0]];
    $('keystone').innerHTML = ks ? iconHtml(runeIcon(ks.icon), '★') : '';
    if (ks) this.bindTip($('keystone'), () => '<div class="tipHead"><span class="tipName">' + ks.name + '</span><span class="tipKey">핵심 룬</span></div><div class="tipBody">' + Runes.desc(ks.id, p) + '</div>');
    this.buildAbilities(p);
    this.buildSpells(p);
    this.buildItems(p);
    this.buildShopTabs();
    this.toggleShop(false);
    this.toggleSpellbook(false);
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

  showEnd(game) {
    const win = game.winner === game.player.team;
    const t = $('endTitle');
    t.textContent = win ? '승리' : '패배';
    t.className = win ? 'win' : 'lose';
    const p = game.player;
    $('endStats').innerHTML = [
      ['챔피언', p.base.name + ' (' + ROLES[p.role].name + ')'],
      ['게임 시간', formatTime(game.time)],
      ['레벨', p.level],
      ['미니언 / 몬스터 처치', p.cs],
      ['획득 골드', Math.round(p.goldEarned)],
      ['파괴한 포탑', game.towersKilled[p.team]],
      ['역할군 퀘스트', p.quest && p.quest.done ? '완료' : '미완료'],
      ['사망', p.deaths],
    ].map(([k, v]) => '<span>' + k + '</span><b>' + v + '</b>').join('');
    $('endScreen').classList.remove('hidden');
    this.toggleShop(false);
  },

  // ================= HUD: 스킬 / 주문 / 아이템 =================
  buildAbilities(p) {
    const box = $('abilitySlots');
    box.innerHTML = '';
    this.abilityEls = {};
    const defs = p.abilityDefs;
    if (defs && defs.P) {
      const el = document.createElement('div');
      el.className = 'slot passive';
      el.innerHTML = '<span class="icon">' + defs.P.icon + '</span>';
      this.bindTip(el, () => '<div class="tipHead"><span class="tipName">' + defs.P.name + '</span><span class="tipKey">패시브</span></div><div class="tipBody">' + defs.P.desc(p) + '</div>');
      box.appendChild(el);
    }
    for (const key of ABILITY_KEYS) {
      const def = defs && defs[key];
      const wrap = document.createElement('div');
      wrap.className = 'abilityWrap';
      wrap.innerHTML = '<button class="lvlUp" title="스킬 레벨 올리기 (' + Controls.levelKey(key) + ')">+</button>' +
        '<div class="slot ability' + (def ? '' : ' locked') + (key === 'R' ? ' big' : '') + '">' +
        (def ? '<span class="icon">' + def.icon + '</span><span class="cost"></span><div class="cd"></div>' : '') +
        '<span class="key">' + Controls.abilityLabel(key) + '</span></div><div class="pips"></div>';
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

  buildSpells(p) {
    const box = $('spellRow');
    box.innerHTML = '';
    this.spellEls = [];
    p.spells.slice(0, 2).forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'slot spell';
      el.innerHTML = iconHtml(spellIcon(s.key), '✦', 'spIcon') + '<span class="key">' + Controls.spellLabel(i) + '</span><span class="cnt"></span><div class="cd"></div>';
      el.onclick = () => p.castSpell(i, p.x, p.y, null);
      this.bindTip(el, () => this.spellTip(p.spells[i].key, p));
      box.appendChild(el);
      this.spellEls.push({ el, key: s.key });
    });
    if (p.effectMap.has('r:8360')) {
      const b = document.createElement('button');
      b.className = 'spellbookBtn';
      b.textContent = '📖';
      b.title = '봉인 풀린 주문서';
      b.onclick = () => this.toggleSpellbook();
      box.appendChild(b);
    }
  },

  buildItems(p) {
    const box = $('items');
    box.innerHTML = '';
    this.itemEls = [];
    ITEM_SLOT_ORDER.forEach((ref, i) => {
      const el = document.createElement('div');
      el.className = 'item' + (ref === 'trinket' ? ' trinket' : ref === 'quest' ? ' questSlot' : '');
      el.innerHTML = '<span class="key">' + ITEM_SLOT_KEYS[i] + '</span><span class="ic"></span><span class="cnt"></span><div class="cd"></div>';
      el.onclick = () => {
        if (!this.game) return;
        const pl = this.game.player;
        if (this.shopOpen && ref !== 'trinket') { this.selSlot = ref; this.selItem = null; this.renderShopDetail(); }
        else if (ref === 'quest' && !pl.questSlot && pl.spells[2]) pl.castSpell(2, pl.x, pl.y, null);
        else pl.useItem(ref);
      };
      this.bindTip(el, () => {
        const pl = this.game.player, s = Items.slotOf(pl, ref);
        if (s) return this.itemTip(s.id, s);
        if (ref === 'quest') return '<div class="tipHead"><span class="tipName">퀘스트 칸</span></div><div class="tipBody">' + (pl.spells[2] ? this.spellTip(pl.spells[2].key, pl) : '역할군 퀘스트 보상(원딜: 신발, 서포터: 제어 와드, 탑: 순간이동)이 들어갑니다.') + '</div>';
        return '';
      });
      box.appendChild(el);
      this.itemEls.push({ el, ref });
    });
  },

  bindTip(el, fn, abilityKey) {
    el.addEventListener('mouseenter', () => { this.tipFn = fn; this.tipEl = el; this.hoverAbility = abilityKey || null; this.showTip(); });
    el.addEventListener('mouseleave', () => this.hideTip());
  },

  showTip() {
    if (!this.tipFn || !this.tipEl || !this.tipEl.isConnected) { this.hideTip(); return; }
    const html = this.tipFn();
    const tip = $('tooltip');
    if (!html) { tip.classList.add('hidden'); return; }
    tip.innerHTML = html;
    tip.classList.remove('hidden');
    const r = this.tipEl.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8) + 'px';
    const above = r.top - th - 12;
    tip.style.top = (above >= 8 ? above : Math.min(window.innerHeight - th - 8, r.bottom + 12)) + 'px';
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
    const cost = def.cost[lvl - 1];
    return '<div class="tipHead"><span class="tipName">' + def.name + '</span><span class="tipKey">' + Controls.abilityLabel(key) + '</span></div>' +
      '<div class="tipMeta">' + (a.lvl ? '레벨 ' + a.lvl + ' / ' + def.maxLvl : '<span class="warn">배우지 않음 · ' + Controls.levelKey(key) + '</span>') +
      (cost ? ' · ' + p.resourceName() + ' ' + cost : '') + ' · 재사용 ' + (+cd.toFixed(1)) + '초</div>' +
      '<div class="tipBody">' + def.desc(p, lvl) + '</div>';
  },

  spellTip(key, p) {
    const def = SPELL_DEFS[key];
    const h = p || { level: 1, game: { time: 0 }, spellHaste: 0, questRewards: {} };
    return '<div class="tipHead"><span class="tipName">' + SPELL_INFO[key].name + '</span><span class="tipKey">소환사 주문</span></div>' +
      '<div class="tipMeta">재사용 대기시간 ' + Math.round(def.cd(h)) + '초</div><div class="tipBody">' + def.desc(h) + '</div>';
  },

  itemTip(id, slot) {
    const it = ITEM_DB[id];
    const stats = itemStatLines(it);
    const fx = itemEffectHtml(id);
    let extra = '';
    if (slot && slot.st) {
      if (slot.st.mana) extra += '<div class="tipMeta">마나순환: +' + Math.round(slot.st.mana) + ' / 360</div>';
      if (slot.st.glory) extra += '<div class="tipMeta">영광 중첩: ' + slot.st.glory + '</div>';
      if (slot.st.earned) extra += '<div class="tipMeta">퀘스트 골드: ' + Math.floor(slot.st.earned) + '</div>';
      if (slot.st.cull) extra += '<div class="tipMeta">수확: ' + slot.st.cull + ' / 100</div>';
    }
    return '<div class="tipHead"><span class="tipName">' + it.name + '</span><span class="tipKey gold">' + it.cost + 'G</span></div>' + extra +
      (stats.length ? '<div class="tipStats">' + stats.join('<br>') + '</div>' : '') +
      (fx.length ? '<div class="tipBody">' + fx.join('<br><br>') + '</div>' : '');
  },

  // ================= 봉인 풀린 주문서 =================
  toggleSpellbook(force) {
    this.spellbookOpen = force === undefined ? !this.spellbookOpen : force;
    $('spellbook').classList.toggle('hidden', !this.spellbookOpen);
    if (this.spellbookOpen) this.renderSpellbook();
  },

  renderSpellbook() {
    const g = this.game, box = $('spellbookBody');
    if (!g) return;
    const p = g.player;
    const sb = p.spellbook || (p.spellbook = { cd: 0, used: new Set() });
    const blocked = g.time < 360 ? '6분부터 사용할 수 있습니다' : p.inCombat() ? '전투 중에는 바꿀 수 없습니다' : g.time < sb.cd ? '재사용 대기 중 (' + Math.ceil(sb.cd - g.time) + '초)' : '';
    box.innerHTML = '<p class="sbNote">' + (blocked || '바꿀 주문을 고른 뒤, 교체할 슬롯(D/F)을 누르세요.') + '</p>';
    const grid = document.createElement('div');
    grid.className = 'spellGrid';
    for (const key of SPELL_ORDER) {
      if (p.spells.some(s => s.key === key)) continue;
      const el = document.createElement('div');
      el.className = 'spellOpt' + (this.sbPick === key ? ' sel' : '');
      el.innerHTML = iconHtml(spellIcon(key), '✦') + '<span>' + SPELL_INFO[key].name + '</span>';
      el.onclick = () => { this.sbPick = key; this.renderSpellbook(); };
      grid.appendChild(el);
    }
    box.appendChild(grid);
    const row = document.createElement('div');
    row.className = 'sbSlots';
    ['D', 'F'].forEach((k, i) => {
      const b = document.createElement('button');
      b.className = 'smallBtn';
      b.textContent = k + ' 슬롯과 교체';
      b.disabled = !!blocked || !this.sbPick;
      b.onclick = () => {
        const key = this.sbPick;
        if (!sb.used.has(key)) sb.used.add(key);
        p.spells[i] = { key, cd: 0, charges: key === 'SummonerSmite' ? 1 : null, recharge: key === 'SummonerSmite' ? 90 : 0 };
        sb.cd = g.time + Math.max(60, 300 - 25 * sb.used.size);
        this.sbPick = null;
        this.buildSpells(p);
        this.renderSpellbook();
      };
      row.appendChild(b);
    });
    box.appendChild(row);
  },

  // ================= 상점 =================
  toggleShop(force) {
    this.shopOpen = force === undefined ? !this.shopOpen : force;
    $('shop').classList.toggle('hidden', !this.shopOpen);
    if (this.shopOpen) { this.renderShopList(); this.renderShopDetail(); }
  },

  buildShopTabs() {
    const tabs = $('shopTabs');
    tabs.innerHTML = '';
    for (const cat of ['추천'].concat(SHOP_CATEGORIES, ['전체'])) {
      const b = document.createElement('button');
      b.className = 'shopTab' + (cat === this.shopCat ? ' sel' : '');
      b.textContent = cat;
      b.onclick = () => { this.shopCat = cat; this.buildShopTabs(); this.renderShopList(); };
      tabs.appendChild(b);
    }
  },

  shopVisible(it) {
    if (['2421', '2422', '2010', '2150', '2151', '2152', '3040', '3042', '3121', '2530', '3866', '3867'].includes(it.id)) return it.id === '2421' && this.game && this.game.player.brokeStopwatch;
    return it.shop || TRINKETS.has(it.id) || TIER3_BOOTS.includes(it.id) || SUPPORT_UPGRADES.includes(it.id);
  },

  renderShopList() {
    const g = this.game;
    if (!g) return;
    const p = g.player, box = $('shopList');
    let list;
    if (this.shopCat === '추천') list = (p.base.recommended || []).map(id => ITEM_DB[id]).filter(Boolean);
    else list = Object.values(ITEM_DB).filter(it => this.shopVisible(it) && (this.shopCat === '전체' || itemCategory(it) === this.shopCat)).sort((a, b) => a.cost - b.cost);
    if (this.shopQuery) list = Object.values(ITEM_DB).filter(it => this.shopVisible(it) && it.name.includes(this.shopQuery)).sort((a, b) => a.cost - b.cost);
    const owns3867 = p.items.some(s => s && s.id === '3867');
    let html = '';
    if (owns3867) html += '<div class="bountyBar">서포터 퀘스트 완료! 무료 업그레이드: ' + SUPPORT_UPGRADES.map(id => '<button class="bountyBtn" data-up="' + id + '">' + iconHtml(itemIcon(id), '◆') + ITEM_DB[id].name + '</button>').join('') + '</div>';
    html += '<div class="grid">' + list.map(it => {
      const plan = Shop.plan(p, it.id);
      const price = it.id === '2055' && p.questRewards && p.questRewards.support ? 40 : TRINKETS.has(it.id) ? 0 : plan.cost;
      return '<div class="shopItem' + (this.selItem === it.id ? ' sel' : '') + (p.gold < price ? ' poor' : '') + '" data-id="' + it.id + '">' +
        iconHtml(itemIcon(it.id), it.name.slice(0, 2), 'ic') + '<div class="price">' + price + '</div></div>';
    }).join('') + '</div>';
    if (!list.length) html += '<p class="empty">아이템이 없습니다.</p>';
    box.innerHTML = html;
    box.querySelectorAll('.shopItem').forEach(el => {
      const id = el.dataset.id;
      el.onclick = () => { this.selItem = id; this.selSlot = null; this.renderShopList(); this.renderShopDetail(); };
      el.oncontextmenu = e => { e.preventDefault(); this.buy(id); };
      this.bindTip(el, () => this.itemTip(id));
    });
    box.querySelectorAll('.bountyBtn').forEach(b => b.onclick = () => { Items.upgradeSupport(p, b.dataset.up); this.renderShopList(); this.renderShopDetail(); });
    $('shopNote').textContent = g.canShop(p) ? '' : '우물 근처에서만 구매·판매할 수 있습니다 (B: 귀환)';
  },

  buy(id) {
    const g = this.game;
    const r = Shop.buy(g, g.player, id);
    if (!r.ok) this.hint(r.reason);
    else if (!r.used || r.used.length) this.buildSpells(g.player);
    this.cache = {};
    this.renderShopList();
    this.renderShopDetail();
  },

  treeHtml(p, id, ownedLeft) {
    const it = ITEM_DB[id];
    const idx = ownedLeft.indexOf(id);
    const owned = idx >= 0;
    if (owned) ownedLeft.splice(idx, 1);
    const kids = owned ? '' : it.from.map(c => this.treeHtml(p, c, ownedLeft)).join('');
    return '<div class="tnode"><div class="tItem' + (owned ? ' owned' : '') + '" data-id="' + id + '">' + iconHtml(itemIcon(id), it.name.slice(0, 2)) + '<span>' + it.cost + '</span></div>' +
      (it.from.length && !owned ? '<div class="tKids">' + kids + '</div>' : '') + '</div>';
  },

  renderShopDetail() {
    const g = this.game, box = $('shopDetail');
    if (!g) return;
    const p = g.player;
    if (this.selSlot != null) {
      const s = Items.slotOf(p, this.selSlot);
      if (!s) { box.innerHTML = '<div class="ddesc">빈 칸입니다.</div>'; return; }
      const it = ITEM_DB[s.id];
      box.innerHTML = '<div class="dHead">' + iconHtml(itemIcon(s.id), '◆') + '<div><div class="dname">' + it.name + '</div><div class="dcost">판매 가격 ' + it.sell + 'G</div></div></div>' +
        '<div class="dstats">' + itemStatLines(it).join('<br>') + '</div><div class="ddesc">' + itemEffectHtml(s.id).join('<br><br>') + '</div>' +
        '<button class="sell">판매 (+' + it.sell + ')</button>';
      const btn = box.querySelector('button');
      btn.disabled = !g.canShop(p);
      btn.onclick = () => { Shop.sell(g, p, this.selSlot); if (!Items.slotOf(p, this.selSlot)) this.selSlot = null; this.cache = {}; this.renderShopList(); this.renderShopDetail(); };
      return;
    }
    if (!this.selItem) {
      box.innerHTML = '<div class="ddesc">아이템을 클릭하면 정보와 조합법이 표시됩니다.<br><br>· 우클릭: 바로 구매<br>· 가진 하위 아이템은 가격에서 빠집니다<br>· 인벤토리 칸 클릭: 판매</div>';
      return;
    }
    const it = ITEM_DB[this.selItem];
    const chk = Shop.canBuy(g, p, it.id);
    const plan = Shop.plan(p, it.id);
    const ownedIds = Shop.slotRefs(p).map(x => ITEM_DB[x.s.id].alias || x.s.id);
    const tree = it.from.length ? '<div class="dsec">조합</div><div class="tree">' + this.treeHtml(p, it.id, ownedIds.slice()) + '</div>' : '';
    const into = it.into.filter(id => ITEM_DB[id]).map(id => '<div class="tItem" data-id="' + id + '">' + iconHtml(itemIcon(id), '◆') + '</div>').join('');
    box.innerHTML = '<div class="dHead">' + iconHtml(itemIcon(it.id), '◆') + '<div><div class="dname">' + it.name + '</div>' +
      '<div class="dcost">가격 <b>' + (chk.cost != null ? chk.cost : plan.cost) + '</b>G' + (it.from.length ? ' <small>(전체 ' + it.cost + ' · 조합비 ' + it.base + ')</small>' : '') + ' · ' + itemCategory(it) + '</div></div></div>' +
      '<div class="dstats">' + itemStatLines(it).join('<br>') + '</div>' +
      '<div class="ddesc">' + itemEffectHtml(it.id).join('<br><br>') + '</div>' + tree +
      (into ? '<div class="dsec">상위 아이템</div><div class="intoRow">' + into + '</div>' : '') +
      '<button class="buyBtn">구매</button>' + (chk.ok ? '' : '<div class="dwarn">' + chk.reason + '</div>');
    const btn = box.querySelector('.buyBtn');
    btn.disabled = !chk.ok;
    btn.onclick = () => this.buy(it.id);
    box.querySelectorAll('.tItem').forEach(el => {
      el.onclick = () => { this.selItem = el.dataset.id; this.renderShopList(); this.renderShopDetail(); };
      this.bindTip(el, () => this.itemTip(el.dataset.id));
    });
  },

  // ================= 매 프레임 =================
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

    // 마나 / 기력
    const res = $('resBar');
    res.classList.toggle('mana', p.resource === 'mana');
    res.classList.toggle('energy', p.resource === 'energy');
    if (p.maxMana > 0) {
      res.querySelector('.fill').style.width = (clamp(p.mana / p.maxMana, 0, 1) * 100).toFixed(1) + '%';
      this.set('mpTxt', res.querySelector('.txt'), 'text', Math.floor(p.mana) + ' / ' + p.maxMana + '   (+' + p.manaRegen.toFixed(1) + '/초)');
    } else {
      res.querySelector('.fill').style.width = '100%';
      this.set('mpTxt', res.querySelector('.txt'), 'text', '자원 없음');
    }

    // 귀환 / 정신 집중
    const ch = $('channelBar');
    const chan = p.recall ? { t: p.recall.t, dur: p.recall.dur, name: p.recall.empowered ? '강화된 귀환' : '귀환 중' } : p.channel;
    ch.classList.toggle('hidden', !chan);
    if (chan) {
      ch.querySelector('.fill').style.width = (chan.t / chan.dur * 100) + '%';
      this.set('chanName', ch.querySelector('span'), 'text', chan.name);
    }

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
    this.set('xp', $('xpFill'), 'height', (p.level >= p.levelCap ? 100 : p.xp / xpToNext(p.level) * 100).toFixed(1) + '%');
    $('portrait').classList.toggle('dead', !p.alive);

    const stats = [
      ['⚔', Math.round(p.ad), '공격력'], ['🔮', Math.round(p.ap), '주문력'],
      ['🛡', Math.round(p.armor), '방어력'], ['✨', Math.round(p.mr), '마법 저항력'],
      ['⚡', p.getAS().toFixed(2), '공격 속도'], ['⏳', Math.round(p.ah), '스킬 가속'],
      ['💥', Math.round(p.crit * 100) + '%', '치명타 확률'], ['👟', Math.round(p.getMS()), '이동 속도'],
      ['🗡', Math.round(p.lethality) + (p.armorPenPct ? '|' + Math.round(p.armorPenPct * 100) + '%' : ''), '물리 관통력 | 방어구 관통력'],
      ['🌀', Math.round(p.mpenFlat) + (p.mpenPct ? '|' + Math.round(p.mpenPct * 100) + '%' : ''), '마법 관통력'],
      ['🩸', Math.round((p.lifesteal + p.omnivamp + p.omnivampDyn) * 100) + '%', '생명력 흡수 + 모든 피해 흡혈'], ['🧱', Math.round(p.tenacity * 100) + '%', '강인함'],
    ];
    this.set('stats', $('statsPanel'), 'html', stats.map(s => '<div class="st" title="' + s[2] + '"><i>' + s[0] + '</i>' + s[1] + '</div>').join(''));

    // 스킬 칸
    if (p.abilityDefs) {
      for (const key of ABILITY_KEYS) {
        const el = this.abilityEls[key];
        if (!el) continue;
        const a = p.abilities[key], def = p.abilityDefs[key];
        const recast = p.abilityRecast ? !!p.abilityRecast(key) : false;
        el.slot.classList.toggle('unlearned', a.lvl === 0);
        el.slot.classList.toggle('recast', recast);
        el.slot.classList.toggle('nomana', a.lvl > 0 && a.cd <= 0 && !recast && p.resource !== 'none' && p.mana < def.cost[a.lvl - 1]);
        const cdTxt = a.cd > 0 && !recast ? (a.cd < 1 ? a.cd.toFixed(1) : String(Math.ceil(a.cd))) : '';
        this.set('acd' + key, el.cd, 'text', cdTxt);
        if (cdTxt) el.cd.style.background = 'conic-gradient(rgba(0,0,0,0.25) ' + ((1 - a.cd / a.maxCd) * 360).toFixed(0) + 'deg, rgba(0,0,0,0.72) 0)';
        this.set('acost' + key, el.cost, 'text', a.lvl > 0 && def.cost[a.lvl - 1] ? String(recast ? p.abilityRecast(key).cost : def.cost[a.lvl - 1]) : '');
        el.pips.forEach((pip, i) => pip.classList.toggle('on', i < a.lvl));
        el.up.classList.toggle('on', p.canLevelAbility(key));
      }
    }

    // 소환사 주문
    if (this.spellEls) this.spellEls.forEach((se, i) => {
      const s = p.spells[i];
      if (!s) return;
      if (se.key !== s.key) { this.buildSpells(p); return; }
      const cdEl = se.el.querySelector('.cd'), cnt = se.el.querySelector('.cnt');
      let rem = s.cd;
      if (s.key === 'SummonerSmite' && s.charges <= 0) rem = Math.max(s.cd, s.recharge);
      if (s.key === 'SummonerFlash' && s.cd > 0 && p.hexflash && p.hexflash.cd <= 0 && p.effectMap.has('r:8306')) rem = 0;
      this.set('scd' + i, cdEl, 'text', rem > 0 ? String(Math.ceil(rem)) : '');
      this.set('scnt' + i, cnt, 'text', s.key === 'SummonerSmite' ? String(s.charges) + (p.smiteTier ? '★'.repeat(p.smiteTier) : '') : '');
    });

    // 아이템
    for (const { el, ref } of this.itemEls) {
      const s = Items.slotOf(p, ref);
      const questSpell = ref === 'quest' && !s && p.spells[2];
      const id = s ? s.id : questSpell ? 'tp' : '';
      const count = s ? (s.id === '3340' ? s.charges : ITEM_USE[s.id] && (ITEM_USE[s.id].stack || ITEM_USE[s.id].charges) ? s.count : '') : '';
      const sig = id + ':' + count;
      if (this.cache['it' + ref] !== sig) {
        this.cache['it' + ref] = sig;
        el.querySelector('.ic').innerHTML = s ? iconHtml(itemIcon(s.id), ITEM_DB[s.id].name.slice(0, 2)) : questSpell ? iconHtml(spellIcon('SummonerTeleport'), 'TP') : '';
        el.querySelector('.cnt').textContent = count === '' || count == null ? '' : count;
      }
      const cd = s ? Items.cooldownOf(p, ref) : questSpell ? p.spells[2].cd : 0;
      this.set('icd' + ref, el.querySelector('.cd'), 'text', cd > 0 ? String(Math.ceil(cd)) : '');
      el.classList.toggle('selSell', this.shopOpen && this.selSlot === ref);
    }

    // 버프
    const buffs = Object.entries(p.buffs).filter(([id]) => BUFF_INFO[id]);
    this.set('buffs', $('buffBar'), 'html', buffs.map(([id, b]) => {
      const info = BUFF_INFO[id];
      const label = id === 'dragon' ? 'x' + b.stacks : Math.ceil(b.t);
      return '<div class="buff" style="border-color:' + info.color + '" title="' + info.name + ': ' + info.desc + '">' + info.icon + '<span>' + label + '</span></div>';
    }).join(''));

    // 퀘스트
    const q = p.quest;
    if (q) {
      const pr = Quests.progress(p);
      this.set('quest', $('questFrame'), 'html',
        '<div class="qTitle">' + ROLES[q.role].name + ' 퀘스트' + (q.done ? ' <span class="qDone">완료</span>' : '') + '</div>' +
        '<div class="qBar"><div style="width:' + (clamp(pr.pct, 0, 1) * 100).toFixed(1) + '%"></div></div><div class="qText">' + pr.text + (q.role === 'jungle' && p.smiteTier ? ' · 강타 ' + ['', '강화', '원시'][p.smiteTier] : '') + '</div>');
      if (!this.questTipBound) { this.questTipBound = true; this.bindTip($('questFrame'), () => this.game ? '<div class="tipHead"><span class="tipName">' + ROLES[this.game.player.quest.role].name + ' 퀘스트</span></div><div class="tipBody"><b>진행:</b> ' + this.game.player.quest.info.goal + '<br><br><b>보상:</b> ' + this.game.player.quest.info.reward + '</div>' : ''); }
    }

    // 사망
    $('deathOverlay').classList.toggle('hidden', p.alive || game.over);
    if (!p.alive) this.set('death', $('deathText'), 'html', '당하셨습니다<br><span style="font-size:18px">부활까지 ' + Math.ceil(p.respawnTimer) + '초</span>');

    this.updateTargetFrame(game);
    if (this.tipFn) this.showTip();
    if (this.shopOpen) {
      $('shopNote').textContent = game.canShop(p) ? '' : '우물 근처에서만 구매·판매할 수 있습니다 (B: 귀환)';
      const btn = $('shopDetail').querySelector('.buyBtn');
      if (btn && this.selItem) btn.disabled = !Shop.canBuy(game, p, this.selItem).ok;
      if (Math.floor(p.gold / 50) !== this.cache.goldBucket) { this.cache.goldBucket = Math.floor(p.gold / 50); this.renderShopList(); }
    }
    if (this.spellbookOpen && Math.floor(game.time) !== this.cache.sbT) { this.cache.sbT = Math.floor(game.time); this.renderSpellbook(); }
  },

  updateTargetFrame(game) {
    const u = (Input.hover && Input.hover.alive && Input.hover.kind !== 'ward') ? Input.hover : game.selected;
    const box = $('targetFrame');
    if (!u || u === game.player || (!u.alive && !u.isStructure)) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const col = u.team === TEAM.NEUTRAL ? '#e0b040' : TEAM_COLOR[u.team];
    const notes = [];
    if (u.isStructure && u.alive && !game.isVulnerable(u)) notes.push('🛡 ' + game.protectionReason(u));
    if (u.kind === 'inhibitor' && !u.alive) notes.push('재생성까지 ' + formatTime(u.respawnTimer));
    if (u.kind === 'monster' && u.resetting) notes.push('초기화 중 (피해 무효)');
    if (u.slowPct && u.slowPct() > 0) notes.push('둔화 ' + Math.round(u.slowPct() * 100) + '%');
    if (u.grievousT > 0) notes.push('치유 감소');
    if (u.armorShred && Object.keys(u.armorShred).length) notes.push('방어력 감소');
    if (u.exhaustT > 0) notes.push('탈진');
    const rows = [];
    if (u.ad) rows.push('⚔ ' + Math.round(u.kind === 'turret' ? TURRET_COMMON.ad + TURRET_COMMON.adPerMin * game.time / 60 : u.ad));
    rows.push('🛡 ' + Math.round(u.armor));
    rows.push('✨ ' + Math.round(u.mr || 0));
    if (u.gold && u.team !== game.player.team) rows.push('● ' + u.gold + 'G');
    const lane = u.lane ? ' (' + LANE_NAMES[u.lane] + ')' : '';
    const html = '<div class="tname" style="color:' + col + '">' + u.name + lane + (u.large ? ' <small>대형</small>' : u.epic ? ' <small>에픽</small>' : '') + '</div>' +
      '<div class="tbar"><div style="width:' + (u.hp / u.maxHp * 100).toFixed(1) + '%;background:' + col + '"></div></div>' +
      '<div class="trow"><span>' + Math.ceil(u.hp) + ' / ' + Math.round(u.maxHp) + '</span>' + rows.map(r => '<span>' + r + '</span>').join('') + '</div>' +
      (notes.length ? '<div class="tnote">' + notes.join(' · ') + '</div>' : '');
    this.set('target', box, 'html', html);
  },
};
