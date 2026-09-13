// ===== 입력 (마우스 / 키보드 / 카메라) =====
const Input = {
  game: null,
  mouse: { sx: 0, sy: 0, wx: 0, wy: 0, inside: false },
  keys: {},
  rightHeld: false,
  rightRepeat: 0,
  amoveArmed: false,
  hover: null,
  minimapDrag: false,
  bound: false,

  attach(game) {
    this.game = game;
    this.amoveArmed = false;
    this.rightHeld = false;
    this.hover = null;
    if (this.bound) return;
    this.bound = true;

    const canvas = document.getElementById('game');
    const mm = document.getElementById('minimap');

    window.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('mousemove', e => { this.mouse.sx = e.clientX; this.mouse.sy = e.clientY; this.mouse.inside = true; });
    document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.rightHeld = false; this.mouse.inside = false; });

    canvas.addEventListener('mousedown', e => this.onCanvasDown(e));
    window.addEventListener('mouseup', e => {
      if (e.button === 2) this.rightHeld = false;
      if (e.button === 0) this.minimapDrag = false;
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
      if (e.button === 0) { this.minimapDrag = true; this.game.cam.locked = false; this.game.cam.x = p.x; this.game.cam.y = p.y; }
      else if (e.button === 2 && this.running()) { this.game.player.orderMove(p.x, p.y); }
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
    const hover = g.unitAt(w.x, w.y, pl.team);
    if (e.button === 2) {
      this.amoveArmed = false;
      this.rightHeld = true;
      this.rightRepeat = 0.12;
      this.issueRight(w, hover, true);
    } else if (e.button === 0) {
      if (this.amoveArmed) {
        this.amoveArmed = false;
        if (hover && hover.team !== pl.team) pl.orderAttack(hover);
        else pl.orderAttackMove(w.x, w.y);
        g.addEffect({ type: 'click', x: w.x, y: w.y, color: '#ff4a4a', dur: 0.4 });
      } else {
        g.selected = hover;
      }
    }
  },

  issueRight(w, hover, showFx) {
    const g = this.game, pl = g.player;
    if (hover && hover.team !== pl.team && g.isVisible(pl.team, hover)) {
      pl.orderAttack(hover);
      if (showFx) g.addEffect({ type: 'targetMark', target: hover, dur: 0.35 });
    } else {
      const dest = Nav.isWalkable(w.x, w.y) ? w : Nav.nearestWalkablePoint(w.x, w.y);
      pl.orderMove(dest.x, dest.y);
      if (showFx) g.addEffect({ type: 'click', x: w.x, y: w.y, color: '#6dff8a', dur: 0.4 });
    }
  },

  onKeyDown(e) {
    const g = this.game;
    if (!g) return;
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    if (e.code === 'Escape') {
      if (UI.shopOpen) UI.toggleShop(false);
      else if (this.amoveArmed) this.amoveArmed = false;
      else if (!g.over) UI.setPaused(!g.paused);
      return;
    }
    if (!this.running()) return;
    if (e.repeat && e.code !== 'Space') return;
    this.keys[e.code] = true;
    const pl = g.player;
    const w = this.screenToWorld(this.mouse.sx, this.mouse.sy);
    switch (e.code) {
      case 'KeyA': this.amoveArmed = true; break;
      case 'KeyS': pl.orderStop(); break;
      case 'KeyB': pl.startRecall(); break;
      case 'KeyP': UI.toggleShop(); break;
      case 'KeyY': g.cam.locked = !g.cam.locked; UI.announce('카메라 고정: ' + (g.cam.locked ? '켜짐' : '꺼짐'), 'info'); break;
      case 'KeyD': pl.castHeal(); break;
      case 'KeyF': pl.castFlash(w.x, w.y); break;
      case 'KeyQ': case 'KeyW': case 'KeyE': case 'KeyR': {
        const key = e.code.slice(3);
        if (!pl.abilityDefs) UI.flashLocked(key);
        else if (e.shiftKey) pl.levelAbility(key);
        else pl.castAbility(key, w.x, w.y, this.hover);
        break;
      }
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': case 'Digit6':
        pl.useItem(Number(e.code.slice(5)) - 1); break;
    }
  },

  update(dt) {
    const g = this.game;
    if (!g) return;
    const c = g.cam, pl = g.player;
    const W = window.innerWidth, H = window.innerHeight;

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

    // 마우스 아래 유닛
    const w = this.screenToWorld(this.mouse.sx, this.mouse.sy);
    this.mouse.wx = w.x; this.mouse.wy = w.y;
    this.hover = this.running() ? g.unitAt(w.x, w.y, pl.team) : null;

    // 우클릭 누르고 있으면 계속 이동
    if (this.rightHeld && this.running()) {
      this.rightRepeat -= dt;
      if (this.rightRepeat <= 0) {
        this.rightRepeat = 0.15;
        const cmd = pl.cmd;
        if (!(cmd && cmd.type === 'attack' && this.hover === cmd.target)) this.issueRight(w, this.hover, false);
      }
    }

    const canvas = document.getElementById('game');
    canvas.classList.toggle('attackCursor', this.amoveArmed);
    canvas.classList.toggle('enemyHover', !this.amoveArmed && !!this.hover && this.hover.team !== pl.team);
  },
};
