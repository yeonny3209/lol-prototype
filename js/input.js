// ===== 입력 (마우스 / 키보드 / 카메라) =====
// 게임에 영향을 주는 조작은 모두 Cmd.send 로 보냅니다 (혼자 하기: 바로 실행, 1대1: 락스텝 차례에 실행)
const Input = {
  game: null,
  mouse: { sx: 0, sy: 0, wx: 0, wy: 0, inside: false },
  keys: {},
  rightHeld: false,
  rightRepeat: 0,
  leftHeld: false,     // WASD: 좌클릭 공격 유지
  leftRepeat: 0,
  amoveArmed: false,
  targeting: null,     // { type: 'teleport', slot }
  hover: null,
  minimapDrag: false,
  bound: false,
  lastWasd: null,

  attach(game) {
    this.game = game;
    this.amoveArmed = false;
    this.targeting = null;
    this.rightHeld = false;
    this.leftHeld = false;
    this.keys = {};
    this.hover = null;
    this.lastWasd = null;
    if (this.bound) return;
    this.bound = true;

    const canvas = document.getElementById('game');
    const mm = document.getElementById('minimap');

    window.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('mousemove', e => { this.mouse.sx = e.clientX; this.mouse.sy = e.clientY; this.mouse.inside = true; });
    document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.rightHeld = false; this.leftHeld = false; this.mouse.inside = false; });

    canvas.addEventListener('mousedown', e => this.onCanvasDown(e));
    window.addEventListener('mouseup', e => {
      if (e.button === 2) this.rightHeld = false;
      if (e.button === 0) { this.minimapDrag = false; this.leftHeld = false; }
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (!this.game) return;
      const c = this.game.cam;
      c.zoom = clamp(c.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.45, 1.6);
    }, { passive: false });

    mm.addEventListener('mousedown', e => {
      e.preventDefault();
      if (!this.game) return;
      const p = this.minimapToWorld(e);
      if (this.targeting && e.button === 0) { this.resolveTargeting(p.x, p.y, 700); return; }
      if (e.button === 0) { this.minimapDrag = true; this.game.cam.locked = false; this.game.cam.x = p.x; this.game.cam.y = p.y; }
      else if (e.button === 2 && this.running()) { this.cancelTargeting(); Cmd.send({ k: 'move', x: p.x, y: p.y }); }
    });
    mm.addEventListener('mousemove', e => {
      if (!this.minimapDrag || !this.game) return;
      const p = this.minimapToWorld(e);
      this.game.cam.x = p.x; this.game.cam.y = p.y;
    });

    window.addEventListener('keydown', e => this.onKeyDown(e));
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
  },

  running() { return this.game && !this.game.paused && !this.game.over; },

  beginTargeting(t) { this.targeting = t; this.amoveArmed = false; },
  cancelTargeting() { this.targeting = null; },

  // 순간이동 대상: 클릭 지점 근처의 아군 포탑·미니언·와드
  resolveTargeting(wx, wy, radius) {
    const g = this.game, pl = g.player, t = this.targeting;
    this.targeting = null;
    if (!t || t.type !== 'teleport') return;
    let best = null, bd = radius;
    for (const u of g.units.concat(g.wards)) {
      if (!SPELL_DEFS.SummonerTeleport.validTarget(pl, u)) continue;
      const d = dist(wx, wy, u.x, u.y) - (u.radius || 0);
      if (d < bd) { bd = d; best = u; }
    }
    if (!best) { UI.hint('근처에 순간이동할 아군 대상이 없습니다'); return; }
    Cmd.send({ k: 'tp', i: t.slot, id: best.id });
  },

  minimapToWorld(e) {
    const r = e.target.getBoundingClientRect();
    return P(clamp((e.clientX - r.left) / r.width, 0, 1) * M, clamp((e.clientY - r.top) / r.height, 0, 1) * M);
  },

  screenToWorld(sx, sy) {
    const c = this.game.cam;
    return P(c.x + (sx - window.innerWidth / 2) / c.zoom, c.y + (sy - window.innerHeight / 2) / c.zoom);
  },

  onCanvasDown(e) {
    if (!this.running()) return;
    const g = this.game, pl = g.player;
    const w = this.screenToWorld(e.clientX, e.clientY);
    const hover = g.unitAt(w.x, w.y, pl.team, { wards: true });
    if (this.targeting) {
      if (e.button === 0) this.resolveTargeting(w.x, w.y, 250);
      else this.cancelTargeting();
      return;
    }
    if (Controls.wasd()) {
      if (e.button === 2) {
        if (pl.abilityDefs) Cmd.send({ k: 'cast', key: 'Q', x: w.x, y: w.y, hid: hover ? hover.id : null });
        else UI.flashLocked('Q');
      } else if (e.button === 0) {
        this.leftHeld = true;
        this.leftRepeat = 0.15;
        this.wasdAttack(w, hover, true);
      }
      return;
    }
    if (e.button === 2) {
      this.amoveArmed = false;
      this.rightHeld = true;
      this.rightRepeat = 0.12;
      this.issueRight(w, hover, true);
    } else if (e.button === 0) {
      if (this.amoveArmed) {
        this.amoveArmed = false;
        if (hover && hover.team !== pl.team && hover.kind !== 'ward') Cmd.send({ k: 'attack', id: hover.id });
        else Cmd.send({ k: 'amove', x: w.x, y: w.y });
        g.addEffect({ type: 'click', x: w.x, y: w.y, color: '#ff4a4a', dur: 0.4 });
      } else {
        g.selected = hover && hover.kind !== 'ward' ? hover : null;
      }
    }
  },

  // WASD 좌클릭: 커서 아래 적 → 없으면 커서 근처(220)의 가장 가까운 적을 공격 대상으로 지정
  wasdTarget(w, hover) {
    const g = this.game, pl = g.player;
    const ok = u => u && u.alive && u.kind !== 'ward' && u.team !== pl.team && pl.isValidTarget(u);
    if (ok(hover)) return hover;
    let best = null, bd = 220;
    for (const u of g.units) {
      if (!ok(u)) continue;
      const d = dist(w.x, w.y, u.x, u.y) - u.radius;
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  },

  wasdAttack(w, hover, showFx) {
    const g = this.game, pl = g.player;
    const t = this.wasdTarget(w, hover);
    if (!t) {
      if (showFx) g.selected = hover && hover.kind !== 'ward' ? hover : null;
      return;
    }
    const same = pl.cmd && pl.cmd.type === 'attack' && pl.cmd.target === t;
    Cmd.send({ k: 'attack', id: t.id, clicks: 1 });
    if (showFx && !same) g.addEffect({ type: 'targetMark', target: t, dur: 0.35 });
  },

  issueRight(w, hover, showFx) {
    const g = this.game, pl = g.player;
    if (hover && hover.kind !== 'ward' && hover.team !== pl.team && g.isVisible(pl.team, hover)) {
      Cmd.send({ k: 'attack', id: hover.id });
      if (showFx) g.addEffect({ type: 'targetMark', target: hover, dur: 0.35 });
    } else {
      const dest = Nav.isWalkable(w.x, w.y) ? w : Nav.nearestWalkablePoint(w.x, w.y);
      Cmd.send({ k: 'move', x: dest.x, y: dest.y });
      if (showFx) g.addEffect({ type: 'click', x: w.x, y: w.y, color: '#6dff8a', dur: 0.4 });
    }
  },

  onKeyDown(e) {
    const g = this.game;
    if (!g) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    if (e.code === 'Escape') {
      if (this.targeting) this.cancelTargeting();
      else if (UI.shopOpen) UI.toggleShop(false);
      else if (UI.spellbookOpen) UI.toggleSpellbook(false);
      else if (this.amoveArmed) this.amoveArmed = false;
      else if (!g.over) UI.setPaused(!UI.pauseOpen);
      return;
    }
    if (!this.running()) return;
    if (e.repeat && e.code !== 'Space') return;
    this.keys[e.code] = true;
    const pl = g.player;
    const w = this.screenToWorld(this.mouse.sx, this.mouse.sy);
    const hover = this.hover;
    const at = { x: w.x, y: w.y, hid: hover ? hover.id : null };
    if (Controls.wasd()) { this.onKeyDownWasd(e, pl, at); return; }
    switch (e.code) {
      case 'KeyA': this.amoveArmed = true; this.targeting = null; break;
      case 'KeyS': Cmd.send({ k: 'stop' }); break;
      case 'KeyB': Cmd.send({ k: 'recall' }); break;
      case 'KeyP': UI.toggleShop(); break;
      case 'KeyY': g.cam.locked = !g.cam.locked; UI.announce('카메라 고정: ' + (g.cam.locked ? '켜짐' : '꺼짐'), 'info'); break;
      case 'KeyD': Cmd.send(Object.assign({ k: 'spell', i: 0 }, at)); break;
      case 'KeyF': Cmd.send(Object.assign({ k: 'spell', i: 1 }, at)); break;
      case 'KeyQ': case 'KeyW': case 'KeyE': case 'KeyR': {
        const key = e.code.slice(3);
        if (!pl.abilityDefs) UI.flashLocked(key);
        else if (e.shiftKey) Cmd.send({ k: 'level', key });
        else Cmd.send(Object.assign({ k: 'cast', key }, at));
        break;
      }
      default: this.commonItemKeys(e, pl, at);
    }
  },

  // WASD 배치: 이동 W/A/S/D · 공격 좌클릭 · 스킬 우클릭/Shift/E/R · 주문 Q/F · 스킬 레벨 Alt+1~4
  onKeyDownWasd(e, pl, at) {
    const g = this.game;
    if (e.altKey && /^Digit[1-4]$/.test(e.code)) {
      e.preventDefault();
      if (pl.abilityDefs) Cmd.send({ k: 'level', key: 'QWER'[Number(e.code.slice(5)) - 1] });
      return;
    }
    switch (e.code) {
      case 'ShiftLeft': case 'ShiftRight':
        if (pl.abilityDefs) Cmd.send(Object.assign({ k: 'cast', key: 'W' }, at)); else UI.flashLocked('W');
        break;
      case 'KeyE': case 'KeyR': {
        const key = e.code.slice(3);
        if (pl.abilityDefs) Cmd.send(Object.assign({ k: 'cast', key }, at)); else UI.flashLocked(key);
        break;
      }
      case 'KeyQ': Cmd.send(Object.assign({ k: 'spell', i: 0 }, at)); break;
      case 'KeyF': Cmd.send(Object.assign({ k: 'spell', i: 1 }, at)); break;
      case 'KeyC': this.cancelTargeting(); break;
      case 'KeyB': Cmd.send({ k: 'recall' }); break;
      case 'KeyP': UI.toggleShop(); break;
      case 'KeyY': g.cam.locked = !g.cam.locked; UI.announce('카메라 고정: ' + (g.cam.locked ? '켜짐' : '꺼짐'), 'info'); break;
      default: this.commonItemKeys(e, pl, at);
    }
  },

  commonItemKeys(e, pl, at) {
    switch (e.code) {
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': case 'Digit6':
        Cmd.send(Object.assign({ k: 'item', ref: Number(e.code.slice(5)) - 1 }, at)); break;
      case 'Digit7': Cmd.send(Object.assign({ k: 'item', ref: 'trinket' }, at)); break;
      case 'Digit8':
        if (pl.questSlot) Cmd.send(Object.assign({ k: 'item', ref: 'quest' }, at));
        else if (pl.spells[2]) Cmd.send(Object.assign({ k: 'spell', i: 2 }, at));
        break;
    }
  },

  // 누르고 있는 WASD 키로 이동 방향 계산 (45도 보정 시 W가 화면 오른쪽 위)
  wasdVector() {
    const k = this.keys;
    let x = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    let y = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
    if (!x && !y) return { x: 0, y: 0 };
    if (Controls.angle45) {
      const c = Math.SQRT1_2;
      [x, y] = [x * c - y * c, x * c + y * c];
    }
    const l = Math.sqrt(x * x + y * y);
    return { x: x / l, y: y / l };
  },

  update(dt) {
    const g = this.game;
    if (!g) return;
    const c = g.cam, pl = g.player;
    const W = window.innerWidth, H = window.innerHeight;

    // WASD 이동 상태는 바뀔 때만 명령으로 보냄
    const v = Controls.wasd() && this.running() ? this.wasdVector() : { x: 0, y: 0 };
    const held = Controls.wasd() && this.running() && this.leftHeld;
    const last = this.lastWasd || { x: 0, y: 0, held: false };
    if (last.x !== v.x || last.y !== v.y || last.held !== held) {
      this.lastWasd = { x: v.x, y: v.y, held };
      Cmd.send({ k: 'wasd', x: v.x, y: v.y, held });
    }

    // 카메라
    if (this.keys.Space || (c.locked && !this.minimapDrag)) { c.x = pl.x; c.y = pl.y; }
    else {
      const edge = 14, speed = 2200 / c.zoom * dt;
      const m = this.mouse;
      if (m.inside && !g.paused && !UI.shopOpen) {
        if (m.sx < edge) c.x -= speed;
        if (m.sx > W - edge) c.x += speed;
        if (m.sy < edge) c.y -= speed;
        if (m.sy > H - edge) c.y += speed;
      }
      if (this.keys.ArrowLeft) c.x -= speed;
      if (this.keys.ArrowRight) c.x += speed;
      if (this.keys.ArrowUp) c.y -= speed;
      if (this.keys.ArrowDown) c.y += speed;
    }
    c.x = clamp(c.x, 0, M); c.y = clamp(c.y, 0, M);

    // 마우스 아래 유닛 (아군 와드 포함 — 리 신 W 등)
    const w = this.screenToWorld(this.mouse.sx, this.mouse.sy);
    this.mouse.wx = w.x; this.mouse.wy = w.y;
    this.hover = this.running() ? g.unitAt(w.x, w.y, pl.team, { wards: true }) : null;

    // WASD: 좌클릭 누르고 있으면 커서 근처 대상으로 계속 공격
    if (Controls.wasd() && this.leftHeld && this.running()) {
      this.leftRepeat -= dt;
      if (this.leftRepeat <= 0) { this.leftRepeat = 0.15; this.wasdAttack(w, this.hover, false); }
    }

    // 우클릭 누르고 있으면 계속 이동
    if (!Controls.wasd() && this.rightHeld && this.running()) {
      this.rightRepeat -= dt;
      if (this.rightRepeat <= 0) {
        this.rightRepeat = 0.15;
        const cmd = pl.cmd;
        if (!(cmd && cmd.type === 'attack' && this.hover === cmd.target)) this.issueRight(w, this.hover, false);
      }
    }

    const canvas = document.getElementById('game');
    canvas.classList.toggle('attackCursor', this.amoveArmed || !!this.targeting);
    canvas.classList.toggle('enemyHover', !this.amoveArmed && !!this.hover && this.hover.team !== pl.team && this.hover.kind !== 'ward');
  },
};
