// ===== 1대1 온라인: PeerJS(P2P) 연결 + 락스텝 동기화 =====
// 두 컴퓨터가 같은 시드로 게임을 만들고, 50ms(3틱)마다 양쪽 입력을 모아 똑같은 순서로 실행합니다.
// 내 입력은 150ms 뒤 차례에 실행되도록 예약해서, 상대에게 도착할 시간을 줍니다.

// ---------------- 명령 ----------------
// 모든 조작은 명령으로 보냅니다. 혼자 하기에서는 바로 실행, 1대1에서는 예약된 차례에 양쪽이 동시에 실행.
const Cmd = {
  send(c) {
    if (!game) return;
    if (Net.active) Net.queue(c);
    else Cmd.run(game, game.player, c);
  },

  unit(g, id) {
    if (id == null) return null;
    return g.units.find(u => u.id === id) || g.wards.find(w => w.id === id) || null;
  },

  num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; },

  run(g, h, c) {
    if (!c || typeof c.k !== 'string' || !h) return;
    const x = this.num(c.x), y = this.num(c.y);
    const hover = this.unit(g, c.hid);
    switch (c.k) {
      case 'move': h.orderMove(x, y); break;
      case 'attack': {
        const t = this.unit(g, c.id);
        if (t && t.alive) {
          h.orderAttack(t);
          if (c.clicks && h.cmd && h.cmd.type === 'attack') h.cmd.clicks = c.clicks;
        }
        break;
      }
      case 'amove': h.orderAttackMove(x, y); break;
      case 'stop': h.orderStop(); break;
      case 'recall': h.startRecall(); break;
      case 'cast': if (h.abilityDefs && 'QWER'.includes(c.key)) h.castAbility(c.key, x, y, hover); break;
      case 'level': if ('QWER'.includes(c.key)) h.levelAbility(c.key); break;
      case 'spell': h.castSpell(c.i | 0, x, y, hover); break;
      case 'tp': { const t = this.unit(g, c.id); if (t) Spells.teleport(h, c.i | 0, t); break; }
      case 'item': h.useItem(c.ref === 'trinket' || c.ref === 'quest' ? c.ref : c.ref | 0, x, y, hover); break;
      case 'buy': if (ITEM_DB[c.id]) { const r = Shop.buy(g, h, c.id); if (!r.ok) h.hint(r.reason); } break;
      case 'sell': Shop.sell(g, h, c.ref === 'quest' ? 'quest' : c.ref | 0); break;
      case 'upgradeSupport': Items.upgradeSupport(h, c.id); break;
      case 'spellbook': Spells.swapBook(h, c.i | 0, c.key); break;
      case 'wasd': h.moveInput = { x, y }; h.attackHeld = !!c.held; break;
    }
    if (h === g.player && ['buy', 'sell', 'upgradeSupport', 'spellbook'].includes(c.k)) {
      try { UI.afterInventoryChange(); } catch (e) { console.warn(e); }
    }
  },
};

// ---------------- 네트워크 ----------------
const Net = {
  VERSION: 1,
  PREFIX: 'lolproto-v1-',
  TPT: 3,           // 차례당 틱 수 (3틱 = 50ms)
  DELAY: 3,         // 입력 지연 차례 수 (150ms)
  HASH_EVERY: 20,   // 1초마다 게임 상태 비교

  peer: null, conn: null, role: null, code: '', status: 'idle', error: '',
  remote: null, remoteReady: false, localReady: false, localSetupJson: '',
  active: false, localTeam: TEAM.BLUE, turn: 0, acc: 0, lastPump: 0,
  inputs: null, pending: [], hashes: null, desync: false, waitingSince: 0,
  ping: 0, pingTimer: null, joinTimer: null, ticker: null, tickerInterval: null, closing: false,

  available() { return typeof Peer === 'function'; },
  connected() { return !!(this.conn && this.conn.open); },
  notify() { if (typeof UI !== 'undefined' && UI.renderLobby) UI.renderLobby(); },

  makeCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 헷갈리는 0/O, 1/I 제외
    let s = '';
    for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  },

  errorText(e) {
    const t = e && e.type;
    if (t === 'peer-unavailable') return '방을 찾을 수 없습니다. 방 코드를 확인해 주세요.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return '연결 서버에 접속하지 못했습니다. 인터넷 연결을 확인해 주세요.';
    if (t === 'browser-incompatible') return '이 브라우저는 P2P 연결을 지원하지 않습니다. 크롬이나 엣지를 써 주세요.';
    if (t === 'webrtc') return 'P2P 연결에 실패했습니다. 네트워크(회사·학교 등)가 막고 있을 수 있어요.';
    return '연결 오류가 발생했습니다 (' + (t || '알 수 없음') + ')';
  },

  // ---------- 방 만들기 / 참가 ----------
  host() {
    if (!this.available()) return this.fail('연결 라이브러리를 불러오지 못했습니다. 새로고침해 주세요.');
    this.close();
    this.role = 'host';
    this.code = this.makeCode();
    this.status = 'creating';
    this.error = '';
    this.notify();
    const peer = this.peer = new Peer(this.PREFIX + this.code, { debug: 1 });
    peer.on('open', () => { if (this.peer !== peer) return; this.status = 'waiting'; this.notify(); });
    peer.on('connection', c => {
      if (this.connected()) {
        c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 500); });
        return;
      }
      this.bind(c);
    });
    peer.on('error', e => {
      if (this.peer !== peer) return;
      if (e.type === 'unavailable-id') { this.host(); return; }
      if (this.connected() && (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error')) return;   // 이미 연결된 뒤 신호 서버 문제는 무시
      this.fail(this.errorText(e));
    });
    peer.on('disconnected', () => { if (this.peer === peer && !peer.destroyed && !this.connected()) peer.reconnect(); });
  },

  join(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) return this.fail('방 코드 5자리를 입력해 주세요.');
    if (!this.available()) return this.fail('연결 라이브러리를 불러오지 못했습니다. 새로고침해 주세요.');
    this.close();
    this.role = 'guest';
    this.code = code;
    this.status = 'connecting';
    this.error = '';
    this.notify();
    const peer = this.peer = new Peer({ debug: 1 });
    peer.on('open', () => {
      if (this.peer !== peer) return;
      this.bind(peer.connect(this.PREFIX + code, { reliable: true, serialization: 'json' }));
      clearTimeout(this.joinTimer);
      this.joinTimer = setTimeout(() => { if (this.peer === peer && !this.connected()) this.fail('방에 연결하지 못했습니다. 코드와 네트워크를 확인해 주세요.'); }, 15000);
    });
    peer.on('error', e => {
      if (this.peer !== peer) return;
      if (this.connected() && e.type !== 'peer-unavailable') return;
      this.fail(this.errorText(e));
    });
  },

  bind(c) {
    this.conn = c;
    c.on('open', () => {
      if (this.conn !== c) return;
      clearTimeout(this.joinTimer);
      this.status = 'lobby';
      this.error = '';
      this.remote = null;
      this.remoteReady = false;
      this.localReady = false;
      this.localSetupJson = '';
      this.send({ t: 'hello', v: this.VERSION });
      this.pushSetup(true);
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ t: 'ping', at: performance.now() }), 2000);
      this.notify();
    });
    c.on('data', m => { try { this.onData(m); } catch (err) { console.error(err); } });
    c.on('close', () => { if (this.conn === c) this.onClose(); });
    c.on('error', e => console.warn('연결 오류', e));
    c.on('iceStateChanged', s => { if (this.conn === c && (s === 'failed' || s === 'closed')) this.onClose(); });
  },

  send(m) {
    if (!this.connected()) return;
    try { this.conn.send(m); } catch (e) { console.warn('전송 실패', e); }
  },

  onData(m) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'hello':
        if (m.v !== this.VERSION) this.fail('상대와 게임 버전이 다릅니다. 둘 다 새로고침한 뒤 다시 연결해 주세요.');
        break;
      case 'full': this.fail('이미 다른 사람이 들어간 방입니다.'); break;
      case 'setup':
        this.remote = m.setup && typeof m.setup === 'object' ? m.setup : null;
        this.remoteReady = !!m.ready;
        this.notify();
        break;
      case 'lobby': this.remoteReady = false; this.notify(); break;
      case 'start': if (this.role === 'guest' && m.blue && m.red) this.beginGame(m.seed | 0, m.blue, m.red, TEAM.RED); break;
      case 'in': if (this.active && this.inputs) this.inputs[1 - this.localTeam].set(m.turn | 0, Array.isArray(m.cmds) ? m.cmds : []); break;
      case 'hash': if (this.active) this.checkHash(m.turn | 0, m.h, 'theirs'); break;
      case 'ping': this.send({ t: 'pong', at: m.at }); break;
      case 'pong': this.ping = Math.max(0, Math.round(performance.now() - m.at)); if (!this.active) this.notify(); break;
      case 'leave': this.remoteLeft = true; this.onClose(); break;
    }
  },

  onClose() {
    if (this.closing) return;
    const wasActive = this.active;
    clearInterval(this.pingTimer);
    this.conn = null;
    this.remote = null;
    this.remoteReady = false;
    this.localReady = false;
    this.active = false;
    this.stopTicker();
    if (wasActive && game && !game.over) game.endByDisconnect(this.localTeam);
    if (this.role === 'host' && this.peer && !this.peer.destroyed) {
      this.status = 'waiting';
      this.error = this.remoteLeft ? '상대가 방을 나갔습니다. 다시 기다리는 중이에요.' : '상대와 연결이 끊어졌습니다. 다시 기다리는 중이에요.';
    } else {
      const msg = this.remoteLeft ? '방장이 방을 닫았습니다.' : '방장과 연결이 끊어졌습니다.';
      this.close();
      this.error = msg;
    }
    this.remoteLeft = false;
    this.notify();
  },

  fail(msg) {
    this.close();
    this.error = msg;
    this.notify();
  },

  // 연결을 모두 끊고 초기 상태로
  close() {
    this.closing = true;
    clearTimeout(this.joinTimer);
    clearInterval(this.pingTimer);
    this.stopTicker();
    try { if (this.conn) this.conn.close(); } catch (e) { /* 무시 */ }
    try { if (this.peer && !this.peer.destroyed) this.peer.destroy(); } catch (e) { /* 무시 */ }
    this.peer = null; this.conn = null; this.role = null; this.code = ''; this.status = 'idle'; this.error = '';
    this.remote = null; this.remoteReady = false; this.localReady = false; this.localSetupJson = '';
    this.active = false; this.inputs = null; this.pending = []; this.ping = 0;
    this.closing = false;
  },

  leave() {
    this.send({ t: 'leave' });
    const c = this.conn;
    setTimeout(() => { try { if (c) c.close(); } catch (e) { /* 무시 */ } }, 300);
    this.conn = null;
    this.close();
    this.notify();
  },

  // ---------- 로비 ----------
  pushSetup(force) {
    if (!this.connected() || this.active) return;
    const s = UI.currentSetup();
    const json = JSON.stringify({ champ: s.champ, role: s.role, spells: s.spells, runes: s.runes });
    if (json !== this.localSetupJson) {
      if (this.localSetupJson) this.localReady = false;   // 준비한 뒤 구성을 바꾸면 준비 해제
      this.localSetupJson = json;
    } else if (!force) return;
    this.send({ t: 'setup', setup: JSON.parse(json), ready: this.localReady });
    this.notify();
  },

  setReady(v) {
    this.localReady = !!v;
    this.pushSetup(true);
  },

  hostStart() {
    if (this.role !== 'host' || !this.connected() || !this.remote || !this.remoteReady) return;
    const seed = (Math.random() * 2147483647) | 0;
    const blue = Object.assign(JSON.parse(this.localSetupJson || JSON.stringify(UI.currentSetup())), { practice: false });
    const red = Object.assign({}, this.remote, { practice: false });
    this.send({ t: 'start', seed, blue, red });
    this.beginGame(seed, blue, red, TEAM.BLUE);
  },

  // 게임이 끝난 뒤 로비로 (연결은 유지)
  backToLobby() {
    this.active = false;
    this.stopTicker();
    this.inputs = null;
    this.pending = [];
    if (this.connected()) {
      this.status = 'lobby';
      this.localReady = false;
      this.remoteReady = false;
      this.send({ t: 'lobby' });
      this.pushSetup(true);
    }
    this.notify();
  },

  // ---------- 락스텝 ----------
  beginGame(seed, blue, red, localTeam) {
    this.active = true;
    this.status = 'ingame';
    this.localTeam = localTeam;
    this.turn = 0;
    this.acc = 0;
    this.lastPump = performance.now();
    this.pending = [];
    this.desync = false;
    this.waitingSince = 0;
    this.inputs = [new Map(), new Map()];
    for (let t = 0; t < this.DELAY; t++) { this.inputs[0].set(t, []); this.inputs[1].set(t, []); }
    this.hashes = new Map();
    startGame({ mode: 'pvp', seed, blue, red, localTeam });
    this.startTicker();
  },

  queue(c) { this.pending.push(c); },

  pumpNow() {
    if (!this.active || !game || !this.inputs) return;
    const now = performance.now();
    this.acc += Math.min(0.25, (now - this.lastPump) / 1000);
    this.lastPump = now;
    const turnDur = this.TPT * CFG.TICK;
    let steps = 0;
    while (this.acc >= turnDur && steps < 8) {
      const a = this.inputs[0].get(this.turn), b = this.inputs[1].get(this.turn);
      if (!a || !b) {
        if (!this.waitingSince) this.waitingSince = now;
        this.acc = Math.min(this.acc, turnDur * 8);
        return;
      }
      this.waitingSince = 0;
      this.inputs[0].delete(this.turn);
      this.inputs[1].delete(this.turn);
      for (const c of a) this.safeRun(game.heroes[0], c);
      for (const c of b) this.safeRun(game.heroes[1], c);
      for (let i = 0; i < this.TPT; i++) game.update(CFG.TICK);
      const target = this.turn + this.DELAY;
      const cmds = this.pending;
      this.pending = [];
      this.inputs[this.localTeam].set(target, cmds);
      this.send({ t: 'in', turn: target, cmds });
      if (this.turn % this.HASH_EVERY === 0) {
        const h = this.hash(game);
        this.checkHash(this.turn, h, 'mine');
        this.send({ t: 'hash', turn: this.turn, h });
      }
      this.turn++;
      this.acc -= turnDur;
      steps++;
    }
  },

  safeRun(h, c) {
    try { Cmd.run(game, h, c); } catch (e) { console.error('명령 실행 오류', c, e); }
  },

  hash(g) {
    let h = 2166136261 | 0;
    const mix = v => { h = Math.imul(h ^ (v | 0), 16777619); };
    mix(Math.round(g.time * 60));
    for (const u of g.units) {
      mix(u.id); mix(u.alive ? 1 : 0);
      mix(Math.round(u.x * 4)); mix(Math.round(u.y * 4)); mix(Math.round(u.hp * 4));
    }
    for (const hero of g.heroes) { mix(Math.round(hero.gold)); mix(hero.level); mix(Math.round(hero.mana)); }
    return h >>> 0;
  },

  checkHash(turn, h, side) {
    const rec = this.hashes.get(turn) || {};
    rec[side] = h;
    this.hashes.set(turn, rec);
    if (rec.mine != null && rec.theirs != null) {
      this.hashes.delete(turn);
      if (rec.mine !== rec.theirs && !this.desync) {
        this.desync = true;
        console.warn('동기화 오류: 차례', turn, rec);
        UI.announce('⚠ 두 화면의 게임 상태가 달라졌습니다 (동기화 오류)', 'bad');
      }
    }
    if (this.hashes.size > 50) for (const k of [...this.hashes.keys()].slice(0, 25)) this.hashes.delete(k);
  },

  // 창이 가려지거나 탭이 뒤로 가서 화면 갱신(requestAnimationFrame)이 멈춰도 게임이 진행되도록 워커 타이머로도 진행.
  // pumpNow는 실제 경과 시간으로 계산하므로 화면 갱신과 워커가 같이 불러도 두 번 진행되지 않음
  startTicker() {
    this.stopTicker();
    try {
      const url = URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},20)'], { type: 'text/javascript' }));
      this.ticker = new Worker(url);
      this.ticker.onmessage = () => this.pumpNow();
    } catch (e) {
      this.tickerInterval = setInterval(() => this.pumpNow(), 25);
    }
  },

  stopTicker() {
    if (this.ticker) { this.ticker.terminate(); this.ticker = null; }
    clearInterval(this.tickerInterval);
    this.tickerInterval = null;
  },
};
