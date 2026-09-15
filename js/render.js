// ===== 렌더링 (캔버스) =====
const TAU = Math.PI * 2;

const Renderer = {
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.mm = document.getElementById('minimap');
    this.mmCtx = this.mm.getContext('2d');
    this.fog = document.createElement('canvas');
    this.fogCtx = this.fog.getContext('2d');
    this.mmFog = document.createElement('canvas');
    this.mmFogCtx = this.mmFog.getContext('2d');
    this.treeBuf = [];
    this.drawList = [];
    this.buildTerrainPaths();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  attach(game) { this.game = game; },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.fog.width = Math.ceil(this.W / 4); this.fog.height = Math.ceil(this.H / 4);
    const mmCss = this.mm.clientWidth || 240;
    this.mm.width = this.mm.height = Math.round(mmCss * this.dpr);
    this.mmFog.width = this.mmFog.height = 160;
    this.buildMinimapBase();
  },

  // ---------- 지형 ----------
  buildTerrainPaths() {
    this.caps = []; this.circles = [];
    for (const s of MapData.shapes) {
      if (s.kind === 'circle') { this.circles.push({ mat: s.mat, x: s.x, y: s.y, r: s.r, bb: [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r] }); continue; }
      const p = new Path2D();
      s.pts.forEach((pt, i) => i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y));
      const xs = s.pts.map(q => q.x), ys = s.pts.map(q => q.y);
      this.caps.push({ mat: s.mat, r: s.r, path: p, bb: [Math.min(...xs) - s.r, Math.min(...ys) - s.r, Math.max(...xs) + s.r, Math.max(...ys) + s.r] });
    }
  },

  fillShapes(ctx, test, delta, color, view) {
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pad = delta + 40;
    const vis = g => !view || !(g.bb[2] + pad < view[0] || g.bb[0] - pad > view[2] || g.bb[3] + pad < view[1] || g.bb[1] - pad > view[3]);
    for (const g of this.caps) {
      if (!test(g.mat) || !vis(g)) continue;
      const w = 2 * (g.r + delta);
      if (w <= 0) continue;
      ctx.lineWidth = w;
      ctx.stroke(g.path);
    }
    ctx.beginPath();
    for (const c of this.circles) {
      if (!test(c.mat) || !vis(c)) continue;
      const r = c.r + delta;
      if (r <= 0) continue;
      ctx.moveTo(c.x + r, c.y);
      ctx.arc(c.x, c.y, r, 0, TAU);
    }
    ctx.fill();
  },

  drawTerrainLayers(ctx, view, detail) {
    const all = () => true, is = m => k => k === m;
    const notBase = k => k !== 'base0' && k !== 'base1';
    if (detail) this.fillShapes(ctx, notBase, 26, '#111b0e', view);
    this.fillShapes(ctx, notBase, 10, '#2c4222', view);
    this.fillShapes(ctx, notBase, 0, '#43613a', view);
    this.fillShapes(ctx, is('river'), 0, '#2a5c78', view);
    if (detail) this.fillShapes(ctx, is('river'), -130, '#377592', view);
    this.fillShapes(ctx, is('pit'), 0, '#3a4d33', view);
    if (detail) this.fillShapes(ctx, is('pit'), -70, '#475e3f', view);
    this.fillShapes(ctx, is('lane'), -45, '#77664a', view);
    if (detail) this.fillShapes(ctx, is('lane'), -120, '#86734f', view);
    if (detail) { this.fillShapes(ctx, is('base0'), 18, '#101828', view); this.fillShapes(ctx, is('base1'), 18, '#281010', view); }
    this.fillShapes(ctx, is('base0'), 0, '#34425a', view);
    this.fillShapes(ctx, is('base1'), 0, '#5a3a3a', view);
    if (detail) {
      this.fillShapes(ctx, is('base0'), -90, '#3c4c66', view);
      this.fillShapes(ctx, is('base1'), -90, '#664343', view);
    }
    for (const team of [0, 1]) {
      const f = LAYOUT[team].fountain;
      ctx.fillStyle = team === 0 ? 'rgba(80,150,255,0.18)' : 'rgba(255,90,90,0.18)';
      ctx.beginPath(); ctx.arc(f.x, f.y, CFG.FOUNTAIN_RADIUS, 0, TAU); ctx.fill();
    }
  },

  drawTrees(ctx, view) {
    const trees = MapData.treesInRect(view[0] - 100, view[1] - 100, view[2] + 100, view[3] + 100, this.treeBuf);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    for (const t of trees) { ctx.moveTo(t.x + 12 + t.r, t.y + 18); ctx.arc(t.x + 12, t.y + 18, t.r, 0, TAU); }
    ctx.fill();
    const tones = ['#1f3a1c', '#244421', '#2a4d25'];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = tones[k];
      ctx.beginPath();
      for (const t of trees) { if (Math.floor(t.shade * 3) !== k) continue; ctx.moveTo(t.x + t.r, t.y); ctx.arc(t.x, t.y, t.r, 0, TAU); }
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(120,170,90,0.13)';
    ctx.beginPath();
    for (const t of trees) { const r = t.r * 0.55; ctx.moveTo(t.x - t.r * 0.25 + r, t.y - t.r * 0.25); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, r, 0, TAU); }
    ctx.fill();
  },

  // ---------- 메인 그리기 ----------
  draw(game, dt) {
    const ctx = this.ctx, W = this.W, H = this.H, c = game.cam, z = c.zoom;
    const pl = game.player;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#18261a';
    ctx.fillRect(0, 0, W, H);

    const hw = W / 2 / z, hh = H / 2 / z;
    const view = [c.x - hw, c.y - hh, c.x + hw, c.y + hh];

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-c.x, -c.y);

    this.drawTerrainLayers(ctx, view, true);
    this.drawTrees(ctx, view);
    this.drawCampTimers(ctx, game, view);
    this.drawZones(ctx, game);
    this.drawGroundFx(ctx, game);
    for (const h of game.heroes) if (h.drawGround && (h.team === pl.team || game.isVisible(pl.team, h))) h.drawGround(ctx, this, game);
    if (UI.hoverAbility && pl.alive && pl.drawAbilityRange) pl.drawAbilityRange(ctx, UI.hoverAbility, game);

    // 그릴 유닛 목록
    const list = this.drawList; list.length = 0;
    for (const u of game.units) {
      if (!u.alive && !u.isStructure) continue;
      if (u.kind === 'hero' && !u.alive) continue;
      if (u.x < view[0] - 300 || u.x > view[2] + 300 || u.y < view[1] - 300 || u.y > view[3] + 300) continue;
      if (!game.isVisible(pl.team, u)) continue;
      list.push(u);
    }
    list.sort((a, b) => a.y - b.y);

    this.drawTurretRanges(ctx, game);
    for (const u of list) this.drawUnit(ctx, u, game);
    for (const h of game.heroes) if (h.drawOver && (h.team === pl.team || game.isVisible(pl.team, h))) h.drawOver(ctx, this, game);
    this.drawWards(ctx, game);
    this.drawProjectiles(ctx, game);
    this.drawSkillShots(ctx, game);
    this.drawTeleportTargets(ctx, game);
    this.drawFx(ctx, game);
    ctx.restore();

    this.drawFog(game, view);
    this.drawBars(game, list);
    this.drawFloaters(game);
    this.drawMinimap(game, view);
  },

  toScreen(x, y) {
    const c = this.game.cam;
    return [(x - c.x) * c.zoom + this.W / 2, (y - c.y) * c.zoom + this.H / 2];
  },

  drawCampTimers(ctx, game, view) {
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const camp of game.camps) {
      const p = camp.pos;
      if (p.x < view[0] - 200 || p.x > view[2] + 200 || p.y < view[1] - 200 || p.y > view[3] + 200) continue;
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, camp.type === 'baron' || camp.type === 'dragon' ? 170 : 110, 0, TAU); ctx.stroke();
      if (!camp.up) {
        ctx.fillStyle = 'rgba(255,230,160,0.55)';
        ctx.fillText(formatTime(camp.timer), p.x, p.y);
      }
    }
  },

  drawTurretRanges(ctx, game) {
    const pl = game.player;
    if (!pl.alive) return;
    for (const s of game.structures) {
      if (s.kind !== 'turret' || !s.alive || s.team === pl.team) continue;
      const d = dist(s.x, s.y, pl.x, pl.y);
      if (d > s.range + 450) continue;
      const aimed = s.target === pl;
      ctx.strokeStyle = aimed ? 'rgba(255,60,60,0.8)' : 'rgba(255,90,90,' + clamp(0.5 - (d - s.range) / 900, 0.1, 0.45) + ')';
      ctx.lineWidth = aimed ? 6 : 4;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.range, 0, TAU); ctx.stroke();
      if (aimed) {
        ctx.beginPath(); ctx.moveTo(s.x, s.y - s.radius * 2.4); ctx.lineTo(pl.x, pl.y);
        ctx.lineWidth = 3; ctx.stroke();
      }
    }
    if (Input.amoveArmed) {
      ctx.strokeStyle = 'rgba(120,220,255,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.range + pl.radius, 0, TAU); ctx.stroke();
    }
  },

  circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  },

  shadow(ctx, u, k = 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(u.x + 4, u.y + u.radius * 0.45, u.radius * 1.05 * k, u.radius * 0.5 * k, 0, 0, TAU); ctx.fill();
  },

  drawUnit(ctx, u, game) {
    const hover = Input.hover === u;
    const sel = game.selected === u;
    if ((hover || sel) && u.alive) {
      ctx.strokeStyle = u.team === game.player.team ? 'rgba(120,255,140,0.9)' : (u.team === TEAM.NEUTRAL ? 'rgba(255,220,90,0.9)' : 'rgba(255,70,70,0.95)');
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(u.x, u.y + (u.isStructure ? 0 : u.radius * 0.3), u.radius * 1.25, u.radius * 0.75, 0, 0, TAU); ctx.stroke();
    }
    const air = u.displace ? u.airHeight() : 0;
    if (air) { ctx.save(); ctx.translate(0, -air); }
    switch (u.kind) {
      case 'hero': this.drawHero(ctx, u, game); break;
      case 'minion': this.drawMinion(ctx, u); break;
      case 'monster': this.drawMonster(ctx, u); break;
      case 'turret': this.drawTurret(ctx, u, game); break;
      case 'inhibitor': this.drawInhibitor(ctx, u, game); break;
      case 'nexus': this.drawNexus(ctx, u, game); break;
      case 'fountain': this.drawFountain(ctx, u, game); break;
    }
    if (u.hitFlash > 0 && u.alive && !u.isStructure) {
      this.circle(ctx, u.x, u.y, u.radius, 'rgba(255,255,255,' + (u.hitFlash * 4).toFixed(2) + ')');
    }
    if (u.shields && u.alive && u.shieldTotal() > 0) {
      const pulse = 0.5 + 0.15 * Math.sin(game.time * 5);
      this.circle(ctx, u.x, u.y, u.radius + 14, 'rgba(255,240,200,0.14)', 'rgba(255,235,170,' + pulse.toFixed(2) + ')', 3);
    }
    if (air) ctx.restore();
  },

  drawHero(ctx, u, game) {
    const t = game.time;
    if (u === game.player) {
      ctx.strokeStyle = 'rgba(90,255,120,0.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(u.x, u.y + u.radius * 0.35, u.radius * 1.45, u.radius * 0.8, 0, 0, TAU); ctx.stroke();
    }
    if (u.recall) {
      const k = u.recall.t / u.recall.dur;
      ctx.fillStyle = 'rgba(120,190,255,' + (0.15 + 0.15 * Math.sin(t * 10)) + ')';
      ctx.beginPath(); ctx.ellipse(u.x, u.y, 80, 44, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(150,210,255,0.25)';
      ctx.fillRect(u.x - 30, u.y - 160 * k - 20, 60, 160 * k + 20);
    }
    if (u.drawBody) { u.drawBody(ctx, this, game); return; }
    this.shadow(ctx, u);
    const col = TEAM_COLOR[u.team];
    this.circle(ctx, u.x, u.y, u.radius, col, '#e8c060', 4);
    this.circle(ctx, u.x - u.radius * 0.3, u.y - u.radius * 0.3, u.radius * 0.45, 'rgba(255,255,255,0.25)');
    // 활 모양 무기
    const a = u.facing, recoil = u.attackAnim > 0 ? -6 : 0;
    const bx = u.x + Math.cos(a) * (u.radius + 8 + recoil), by = u.y + Math.sin(a) * (u.radius + 8 + recoil);
    ctx.strokeStyle = '#f3e2b0'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(bx - Math.cos(a) * 14, by - Math.sin(a) * 14, 22, a - 1.1, a + 1.1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx - Math.cos(a) * 14 + Math.cos(a - 1.1) * 22, by - Math.sin(a) * 14 + Math.sin(a - 1.1) * 22);
    ctx.lineTo(bx - Math.cos(a) * 14 + Math.cos(a + 1.1) * 22, by - Math.sin(a) * 14 + Math.sin(a + 1.1) * 22);
    ctx.stroke();
  },

  drawMinion(ctx, u) {
    const blue = u.team === TEAM.BLUE;
    const col = blue ? '#3f7fe0' : '#d94848', dark = blue ? '#15305e' : '#5e1515', light = blue ? '#9cc4ff' : '#ffb0b0';
    const a = u.facing, r = u.radius;
    this.shadow(ctx, u);
    if (u.mtype === 'siege') {
      ctx.save(); ctx.translate(u.x, u.y); ctx.rotate(a);
      ctx.fillStyle = dark; ctx.fillRect(-r, -r * 0.8, r * 2, r * 1.6);
      ctx.fillStyle = col; ctx.fillRect(-r + 4, -r * 0.8 + 4, r * 2 - 8, r * 1.6 - 8);
      ctx.fillStyle = '#333'; ctx.fillRect(r * 0.2, -6, r * 1.2 + (u.attackAnim > 0 ? -8 : 0), 12);
      ctx.restore();
      return;
    }
    if (u.mtype === 'super') {
      ctx.fillStyle = dark;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = a + i / 10 * TAU, rr = i % 2 ? r * 0.95 : r * 1.25;
        i ? ctx.lineTo(u.x + Math.cos(ang) * rr, u.y + Math.sin(ang) * rr) : ctx.moveTo(u.x + Math.cos(ang) * rr, u.y + Math.sin(ang) * rr);
      }
      ctx.fill();
      this.circle(ctx, u.x, u.y, r * 0.85, col);
      this.circle(ctx, u.x, u.y, r * 0.35, light);
      return;
    }
    this.circle(ctx, u.x, u.y, r, col, dark, 3);
    if (u.mtype === 'melee') {
      const k = u.attackAnim > 0 ? 10 : 0;
      ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(u.x + Math.cos(a + 0.6) * r * 0.6, u.y + Math.sin(a + 0.6) * r * 0.6);
      ctx.lineTo(u.x + Math.cos(a + 0.2) * (r + 14 + k), u.y + Math.sin(a + 0.2) * (r + 14 + k));
      ctx.stroke();
      this.circle(ctx, u.x, u.y, r * 0.4, light);
    } else {
      this.circle(ctx, u.x + Math.cos(a) * (r + 6), u.y + Math.sin(a) * (r + 6), 6, light, dark, 2);
      this.circle(ctx, u.x, u.y, r * 0.35, dark);
    }
  },

  drawMonster(ctx, u) {
    const s = u.stats, r = u.radius, a = u.facing;
    ctx.globalAlpha = u.resetting ? 0.6 : 1;
    this.shadow(ctx, u);
    if (u.mtype === 'dragon') {
      ctx.fillStyle = '#8a3a10';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(u.x + Math.cos(a + side * 1.7) * r * 2, u.y + Math.sin(a + side * 1.7) * r * 2);
        ctx.lineTo(u.x + Math.cos(a + side * 2.6) * r * 1.4, u.y + Math.sin(a + side * 2.6) * r * 1.4);
        ctx.fill();
      }
    }
    if (u.mtype === 'baron') {
      ctx.fillStyle = '#3a1f66';
      for (let i = 0; i < 8; i++) {
        const ang = i / 8 * TAU + Math.sin(u.game.time + i) * 0.1;
        ctx.beginPath();
        ctx.moveTo(u.x + Math.cos(ang - 0.2) * r, u.y + Math.sin(ang - 0.2) * r);
        ctx.lineTo(u.x + Math.cos(ang) * r * 1.45, u.y + Math.sin(ang) * r * 1.45);
        ctx.lineTo(u.x + Math.cos(ang + 0.2) * r, u.y + Math.sin(ang + 0.2) * r);
        ctx.fill();
      }
    }
    this.circle(ctx, u.x, u.y, r, s.color, 'rgba(0,0,0,0.6)', 4);
    this.circle(ctx, u.x - r * 0.25, u.y - r * 0.3, r * 0.45, 'rgba(255,255,255,0.18)');
    for (const side of [-0.45, 0.45]) {
      const ex = u.x + Math.cos(a + side) * r * 0.6, ey = u.y + Math.sin(a + side) * r * 0.6;
      this.circle(ctx, ex, ey, Math.max(3, r * 0.13), u.aggro ? '#ff3030' : '#fff8d0');
    }
    ctx.globalAlpha = 1;
  },

  drawTurret(ctx, u, game) {
    const x = u.x, y = u.y, r = u.radius;
    if (!u.alive) {
      ctx.fillStyle = '#3a3a3a';
      for (let i = 0; i < 6; i++) this.circle(ctx, x + Math.cos(i * 1.3) * r * 0.5, y + Math.sin(i * 1.3) * r * 0.4, r * 0.35, i % 2 ? '#454545' : '#2e2e2e');
      return;
    }
    const tc = TEAM_COLOR[u.team];
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x + 10, y + r * 0.4, r * 1.2, r * 0.6, 0, 0, TAU); ctx.fill();
    this.circle(ctx, x, y, r, '#50545c', '#2c2f34', 5);
    ctx.fillStyle = '#6c7079';
    ctx.fillRect(x - r * 0.42, y - r * 2.1, r * 0.84, r * 2.1);
    ctx.fillStyle = '#585c64';
    ctx.fillRect(x + r * 0.1, y - r * 2.1, r * 0.32, r * 2.1);
    ctx.fillStyle = '#8a8e96';
    ctx.beginPath(); ctx.ellipse(x, y - r * 2.1, r * 0.72, r * 0.3, 0, 0, TAU); ctx.fill();
    const cy = y - r * 2.55 + Math.sin(game.time * 2 + x) * 4;
    const pulse = u.target ? 0.55 : 0.3;
    this.circle(ctx, x, cy, r * 0.75, tc === TEAM_COLOR[0] ? 'rgba(80,160,255,' + pulse + ')' : 'rgba(255,90,90,' + pulse + ')');
    ctx.fillStyle = tc;
    ctx.beginPath();
    ctx.moveTo(x, cy - r * 0.55); ctx.lineTo(x + r * 0.32, cy); ctx.lineTo(x, cy + r * 0.45); ctx.lineTo(x - r * 0.32, cy);
    ctx.fill();
    if (!game.isVulnerable(u)) {
      ctx.strokeStyle = 'rgba(255,230,140,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y - r, r * 1.5, 0, TAU); ctx.stroke();
    }
  },

  drawInhibitor(ctx, u, game) {
    const x = u.x, y = u.y, r = u.radius;
    this.circle(ctx, x, y, r, '#2b2f36', '#1a1c20', 6);
    if (!u.alive) {
      this.circle(ctx, x, y, r * 0.5, '#3a3a3a');
      ctx.fillStyle = '#ddd'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(formatTime(u.respawnTimer), x, y - r - 20);
      return;
    }
    const tc = TEAM_COLOR[u.team];
    ctx.strokeStyle = tc; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.stroke();
    const g = 0.35 + 0.15 * Math.sin(game.time * 3 + x);
    this.circle(ctx, x, y - 20, r * 0.55, u.team === 0 ? 'rgba(90,170,255,' + g + ')' : 'rgba(255,100,100,' + g + ')');
    ctx.fillStyle = tc;
    ctx.beginPath(); ctx.ellipse(x, y - 24, r * 0.28, r * 0.5, 0, 0, TAU); ctx.fill();
  },

  drawNexus(ctx, u, game) {
    const x = u.x, y = u.y, r = u.radius;
    if (!u.alive) { this.circle(ctx, x, y, r, '#2a2a2a', '#111', 6); return; }
    const tc = TEAM_COLOR[u.team];
    ctx.fillStyle = '#2a2e36';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); }
    ctx.fill();
    ctx.strokeStyle = tc; ctx.lineWidth = 6; ctx.stroke();
    const g = 0.3 + 0.12 * Math.sin(game.time * 2);
    this.circle(ctx, x, y - r * 0.9, r * 0.9, u.team === 0 ? 'rgba(90,170,255,' + g + ')' : 'rgba(255,100,100,' + g + ')');
    const cy = y - r * 0.9 + Math.sin(game.time * 1.5) * 6;
    ctx.fillStyle = tc;
    ctx.beginPath();
    ctx.moveTo(x, cy - r * 0.9); ctx.lineTo(x + r * 0.45, cy); ctx.lineTo(x, cy + r * 0.7); ctx.lineTo(x - r * 0.45, cy);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(x, cy - r * 0.9); ctx.lineTo(x - r * 0.45, cy); ctx.lineTo(x, cy + r * 0.1); ctx.fill();
  },

  drawFountain(ctx, u, game) {
    const tc = TEAM_COLOR[u.team];
    this.circle(ctx, u.x, u.y, u.radius, '#20242c', tc, 6);
    this.circle(ctx, u.x, u.y, u.radius * 0.5, u.team === 0 ? 'rgba(120,200,255,0.6)' : 'rgba(255,140,120,0.6)');
    ctx.strokeStyle = tc; ctx.lineWidth = 4;
    for (const t of u.laserTargets) {
      if (!game.isVisible(game.player.team, t)) continue;
      ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    }
  },

  drawProjectiles(ctx, game) {
    const pt = game.player.team;
    for (const p of game.projectiles) {
      if (!game.isVisible(pt, p.target) && p.target.team === pt) { /* 아군 대상은 항상 보임 */ }
      const s = p.style;
      for (let i = 0; i < p.trail.length; i++) {
        const q = p.trail[i];
        this.circle(ctx, q.x, q.y, s.size * (0.4 + i * 0.1), this.alphaColor(s.color, 0.12 + i * 0.05));
      }
      if (s.glow) this.circle(ctx, p.x, p.y, s.size * 2, this.alphaColor(s.color, 0.3));
      this.circle(ctx, p.x, p.y, s.size, s.color);
    }
  },

  alphaColor(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a.toFixed(2) + ')';
  },

  drawGroundFx(ctx, game) {
    for (const e of game.effects) {
      const k = e.t / e.dur;
      if (e.type === 'click') {
        ctx.strokeStyle = this.alphaColor(e.color, 1 - k); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(e.x, e.y, 30 * (1 - k * 0.6), 18 * (1 - k * 0.6), 0, 0, TAU); ctx.stroke();
      }
    }
  },

  drawFx(ctx, game) {
    for (const e of game.effects) {
      const k = e.t / e.dur;
      const x = e.follow ? e.follow.x : e.x, y = e.follow ? e.follow.y : e.y;
      switch (e.type) {
        case 'targetMark':
          if (!e.target.alive) break;
          ctx.strokeStyle = 'rgba(255,60,60,' + (1 - k) + ')'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(e.target.x, e.target.y, e.target.radius + 20 - k * 10, 0, TAU); ctx.stroke();
          break;
        case 'flash':
          this.circle(ctx, x, y, 20 + k * 60, 'rgba(255,240,140,' + (0.6 * (1 - k)) + ')');
          break;
        case 'heal':
          ctx.strokeStyle = 'rgba(100,255,140,' + (1 - k) + ')'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.ellipse(x, y - k * 40, 50, 25, 0, 0, TAU); ctx.stroke();
          break;
        case 'levelup':
          ctx.strokeStyle = 'rgba(210,160,255,' + (1 - k) + ')'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(x, y, 40 + k * 60, 0, TAU); ctx.stroke();
          break;
        case 'pulse': {
          const rr = e.r * (0.6 + 0.4 * k);
          ctx.fillStyle = this.alphaColor(e.color, 0.25 * (1 - k));
          ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
          ctx.strokeStyle = this.alphaColor(e.color, 1 - k); ctx.lineWidth = 5;
          ctx.stroke();
          break;
        }
        case 'shockwave':
          this.circle(ctx, x, y, e.r, 'rgba(90,160,255,' + (0.28 * (1 - k)).toFixed(3) + ')');
          for (let i = 0; i < 3; i++) {
            const kk = clamp(k * 1.4 - i * 0.2, 0, 1);
            if (kk <= 0 || kk >= 1) continue;
            ctx.strokeStyle = 'rgba(160,220,255,' + (1 - kk).toFixed(3) + ')'; ctx.lineWidth = 12 - i * 3;
            ctx.beginPath(); ctx.arc(x, y, e.r * kk, 0, TAU); ctx.stroke();
          }
          break;
        case 'bolt': {
          ctx.strokeStyle = e.color || 'rgba(190,230,255,' + (1 - k).toFixed(2) + ')';
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(e.x, e.y);
          const segs = 6;
          for (let i = 1; i < segs; i++) {
            const tt = i / segs;
            ctx.lineTo(lerp(e.x, e.x2, tt) + rand(-14, 14), lerp(e.y, e.y2, tt) + rand(-14, 14));
          }
          ctx.lineTo(e.x2, e.y2); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'smite': {
          const col = ['255,225,120', '255,160,90', '255,110,70'][e.tier || 0];
          this.circle(ctx, x, y, e.r + 30 * (1 - k), 'rgba(' + col + ',' + (0.5 * (1 - k)).toFixed(2) + ')');
          ctx.strokeStyle = 'rgba(' + col + ',' + (1 - k).toFixed(2) + ')'; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.moveTo(x, y - 260 * (1 - k * 0.5)); ctx.lineTo(x, y); ctx.stroke();
          break;
        }
        case 'kick':
          for (let i = 0; i < 5; i++) {
            const a = e.a + (i - 2) * 0.3;
            ctx.strokeStyle = 'rgba(255,190,80,' + (1 - k).toFixed(2) + ')'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30); ctx.lineTo(x + Math.cos(a) * (60 + k * 120), y + Math.sin(a) * (60 + k * 120)); ctx.stroke();
          }
          this.circle(ctx, x, y, 40 + k * 40, 'rgba(255,220,140,' + (0.5 * (1 - k)).toFixed(2) + ')');
          break;
        case 'stasis':
        case 'revive': {
          const col = e.type === 'stasis' ? '255,215,110' : '140,230,255';
          this.circle(ctx, x, y, 48, 'rgba(' + col + ',0.28)', 'rgba(' + col + ',0.9)', 4);
          ctx.strokeStyle = 'rgba(' + col + ',0.6)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, 58, game.time * 3, game.time * 3 + TAU * (1 - k)); ctx.stroke();
          break;
        }
        case 'comet': {
          const hy = (1 - k) * 420;
          this.circle(ctx, x, y, 140, 'rgba(180,120,255,' + (0.1 + 0.2 * k).toFixed(2) + ')', 'rgba(200,150,255,0.6)', 2);
          this.circle(ctx, x - hy * 0.4, y - hy, 18, '#d9b8ff');
          this.circle(ctx, x - hy * 0.4 - 16, y - hy - 30, 10, 'rgba(217,184,255,0.5)');
          break;
        }
        case 'death':
          if (e.big) {
            for (let i = 0; i < 10; i++) {
              const a = i / 10 * TAU;
              this.circle(ctx, x + Math.cos(a) * k * 180, y + Math.sin(a) * k * 120, 30 * (1 - k), 'rgba(255,170,80,' + (1 - k) + ')');
            }
            this.circle(ctx, x, y, e.r * (1 + k * 2), 'rgba(255,220,150,' + (0.5 * (1 - k)) + ')');
          } else {
            this.circle(ctx, x, y, e.r * (1 + k), 'rgba(40,40,40,' + (0.5 * (1 - k)) + ')');
          }
          break;
      }
    }
  },

  // ---------- 장판 / 와드 / 스킬샷 ----------
  drawZones(ctx, game) {
    for (const z of game.zones) {
      const k = z.t / z.dur, a = k < 0.85 ? 1 : (1 - k) / 0.15;
      const col = z.color || '#9fdcff';
      ctx.fillStyle = this.alphaColor(col, 0.16 * a);
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = this.alphaColor(col, 0.6 * a); ctx.lineWidth = 3;
      ctx.stroke();
    }
  },

  drawWards(ctx, game) {
    const pt = game.player.team;
    for (const w of game.wards) {
      if (w.team !== pt) continue;
      const col = w.type === 'control' ? '#ff5a5a' : w.type === 'farsight' ? '#6ab8ff' : '#ffd84a';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(w.x, w.y + 8, 16, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a2d36';
      ctx.fillRect(w.x - 3, w.y - 30, 6, 34);
      this.circle(ctx, w.x, w.y - 34, 11, col, '#111', 2);
      this.circle(ctx, w.x, w.y - 34, 4 + Math.sin(game.time * 4 + w.id) * 1.5, 'rgba(255,255,255,0.85)');
      if (isFinite(w.maxT)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(w.x, w.y - 34, 15, -Math.PI / 2, -Math.PI / 2 + TAU * w.t / w.maxT); ctx.stroke();
      }
    }
  },

  drawSkillShots(ctx, game) {
    for (const s of game.skillshots) {
      for (let i = 0; i < s.trail.length; i++) {
        const q = s.trail[i];
        this.circle(ctx, q.x, q.y, 10 + i * 2, this.alphaColor(s.color, 0.08 + i * 0.05));
      }
      ctx.strokeStyle = s.color; ctx.lineWidth = 5;
      const a = Math.atan2(s.dy, s.dx);
      ctx.beginPath(); ctx.arc(s.x, s.y, s.width * 0.6, a - 1.1, a + 1.1); ctx.stroke();
      ctx.beginPath(); ctx.arc(s.x - s.dx * 14, s.y - s.dy * 14, s.width * 0.45, a - 1.1, a + 1.1); ctx.stroke();
    }
  },

  drawTeleportTargets(ctx, game) {
    if (!Input.targeting) return;
    const pl = game.player;
    ctx.strokeStyle = 'rgba(190,120,255,0.8)'; ctx.lineWidth = 4;
    for (const u of game.units.concat(game.wards)) {
      if (!SPELL_DEFS.SummonerTeleport.validTarget(pl, u)) continue;
      ctx.beginPath(); ctx.arc(u.x, u.y, (u.radius || 20) + 18 + Math.sin(game.time * 6) * 4, 0, TAU); ctx.stroke();
    }
  },

  // ---------- 전장의 안개 ----------
  drawFog(game, view) {
    const f = this.fog, fc = this.fogCtx, c = game.cam, z = c.zoom;
    const s = f.width / this.W;
    fc.globalCompositeOperation = 'source-over';
    fc.clearRect(0, 0, f.width, f.height);
    fc.fillStyle = 'rgba(5,8,20,0.55)';
    fc.fillRect(0, 0, f.width, f.height);
    fc.globalCompositeOperation = 'destination-out';
    const team = game.player.team;
    for (const u of game.units.concat(game.wards)) {
      if (!u.alive || u.team !== team || !u.sight) continue;
      const R = u.sight;
      if (u.x + R < view[0] || u.x - R > view[2] || u.y + R < view[1] || u.y - R > view[3]) continue;
      const sx = ((u.x - c.x) * z + this.W / 2) * s, sy = ((u.y - c.y) * z + this.H / 2) * s, sr = R * z * s;
      const g = fc.createRadialGradient(sx, sy, sr * 0.75, sx, sy, sr);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = g;
      fc.beginPath(); fc.arc(sx, sy, sr, 0, TAU); fc.fill();
    }
    fc.globalCompositeOperation = 'source-over';
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(f, 0, 0, this.W, this.H);
  },

  // ---------- 체력바 ----------
  drawBars(game, list) {
    const ctx = this.ctx, z = game.cam.zoom, pt = game.player.team;
    for (const u of list) {
      if (!u.alive || u.kind === 'fountain') continue;
      const [sx, sy] = this.toScreen(u.x, u.y);
      let bw, bh, by, col;
      const ally = u.team === pt;
      switch (u.kind) {
        case 'hero': bw = 96; bh = 10; by = sy - u.radius * z - 30; col = u === game.player ? '#4fd65a' : (ally ? '#4a90ff' : '#e84a4a'); break;
        case 'minion': bw = u.mtype === 'super' || u.mtype === 'siege' ? 52 : 42; bh = 5; by = sy - u.radius * z - 12; col = ally ? '#4a90ff' : '#e04848'; break;
        case 'monster': bw = u.radius > 60 ? 120 : (u.radius > 35 ? 70 : 42); bh = u.radius > 35 ? 7 : 5; by = sy - u.radius * z - 16; col = '#e0a830'; break;
        case 'turret': bw = 110; bh = 8; by = sy - u.radius * 3.2 * z - 12; col = ally ? '#4a90ff' : '#e84a4a'; break;
        case 'inhibitor': bw = 100; bh = 8; by = sy - u.radius * z - 26; col = ally ? '#4a90ff' : '#e84a4a'; break;
        case 'nexus': bw = 150; bh = 10; by = sy - u.radius * 2 * z - 20; col = ally ? '#4a90ff' : '#e84a4a'; break;
        default: continue;
      }
      if (u.kind === 'minion' && u.hp >= u.maxHp && u !== Input.hover) continue;
      const x = sx - bw / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(x - 2, by - 2, bw + 4, bh + 4);
      const sh = u.shields ? u.shieldTotal() : 0;
      const total = Math.max(u.maxHp, u.hp + sh);
      const k = clamp(u.hp / total, 0, 1);
      ctx.fillStyle = col;
      ctx.fillRect(x, by, bw * k, bh);
      if (sh > 0) { ctx.fillStyle = '#eeeeee'; ctx.fillRect(x + bw * k, by, bw * sh / total, bh); }
      if (u.kind === 'hero' && u.maxMana > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - 2, by + bh + 2, bw + 4, 6);
        ctx.fillStyle = '#4f8fff'; ctx.fillRect(x, by + bh + 3, bw * clamp(u.mana / u.maxMana, 0, 1), 4);
      }
      if (u.kind === 'hero') {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        for (let h = 100; h < u.maxHp; h += 100) {
          const tx = x + bw * h / u.maxHp;
          ctx.fillRect(tx, by, h % 1000 === 0 ? 2 : 1, h % 1000 === 0 ? bh : bh * 0.5);
        }
        ctx.fillStyle = '#111'; ctx.fillRect(x - 24, by - 3, 20, bh + 6);
        ctx.fillStyle = '#e8d8a8'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(u.level, x - 14, by + bh / 2 + 1);
      }
      if (u.isStructure && !game.isVulnerable(u)) {
        ctx.fillStyle = 'rgba(160,160,160,0.55)';
        ctx.fillRect(x, by, bw * k, bh);
        ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ffe9a0'; ctx.fillText('🛡 보호됨', sx, by - 3);
      }
    }
  },

  drawFloaters(game) {
    const ctx = this.ctx;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of game.floaters) {
      const [sx, sy] = this.toScreen(f.x, f.y);
      const k = f.t / f.dur;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.font = 'bold ' + Math.round(f.size * (k < 0.1 ? 1 + (0.1 - k) * 4 : 1)) + 'px sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(f.text, sx, sy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  },

  // ---------- 미니맵 ----------
  buildMinimapBase() {
    const size = this.mm.width;
    const base = this.mmBase = document.createElement('canvas');
    base.width = base.height = size;
    const c = base.getContext('2d');
    c.fillStyle = '#17241a';
    c.fillRect(0, 0, size, size);
    c.scale(size / M, size / M);
    this.drawTerrainLayers(c, null, false);
  },

  drawMinimap(game, view) {
    const ctx = this.mmCtx, size = this.mm.width, k = size / M, d = this.dpr;
    const pt = game.player.team;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.mmBase, 0, 0);

    // 안개
    const fc = this.mmFogCtx, fs = this.mmFog.width, fk = fs / M;
    fc.globalCompositeOperation = 'source-over';
    fc.clearRect(0, 0, fs, fs);
    fc.fillStyle = 'rgba(0,0,0,0.5)';
    fc.fillRect(0, 0, fs, fs);
    fc.globalCompositeOperation = 'destination-out';
    fc.fillStyle = '#000';
    fc.beginPath();
    for (const u of game.units.concat(game.wards)) {
      if (!u.alive || u.team !== pt || !u.sight) continue;
      fc.moveTo(u.x * fk + u.sight * fk, u.y * fk);
      fc.arc(u.x * fk, u.y * fk, u.sight * fk, 0, TAU);
    }
    fc.fill();
    ctx.drawImage(this.mmFog, 0, 0, size, size);

    for (const s of game.structures) {
      if (s.kind === 'fountain') continue;
      const sz = (s.kind === 'nexus' ? 11 : s.kind === 'inhibitor' ? 8 : 7) * d;
      ctx.fillStyle = '#000';
      ctx.fillRect(s.x * k - sz / 2 - d, s.y * k - sz / 2 - d, sz + 2 * d, sz + 2 * d);
      ctx.fillStyle = s.alive ? TEAM_COLOR[s.team] : '#555';
      ctx.fillRect(s.x * k - sz / 2, s.y * k - sz / 2, sz, sz);
    }
    for (const u of game.units) {
      if (!u.alive || u.isStructure || u.kind === 'hero') continue;
      if (!game.isVisible(pt, u)) continue;
      const r = (u.kind === 'monster' ? (u.radius > 60 ? 5 : 3) : 2.2) * d;
      ctx.fillStyle = u.kind === 'monster' ? '#e8b840' : (u.team === TEAM.BLUE ? '#6aa8ff' : '#ff6060');
      ctx.beginPath(); ctx.arc(u.x * k, u.y * k, r, 0, TAU); ctx.fill();
    }
    for (const w of game.wards) {
      if (w.team !== pt) continue;
      ctx.fillStyle = w.type === 'control' ? '#ff5a5a' : '#ffd84a';
      ctx.beginPath(); ctx.arc(w.x * k, w.y * k, 3 * d, 0, TAU); ctx.fill();
    }
    for (const h of game.heroes) {
      if (!h.alive || !game.isVisible(pt, h)) continue;
      ctx.beginPath(); ctx.arc(h.x * k, h.y * k, 6 * d, 0, TAU);
      ctx.fillStyle = TEAM_COLOR[h.team]; ctx.fill();
      ctx.strokeStyle = h === game.player ? '#ffe070' : '#fff'; ctx.lineWidth = 2 * d; ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5 * d;
    ctx.strokeRect(view[0] * k, view[1] * k, (view[2] - view[0]) * k, (view[3] - view[1]) * k);
  },
};
