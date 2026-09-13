// ===== 맵 정의 / 충돌 격자 / 길찾기 =====
const M = CFG.MAP;
const P = (x, y) => ({ x, y });
const reflectP = p => P(M - p.x, M - p.y);       // 블루 <-> 레드 (점대칭)
const swapP = p => P(p.y, p.x);                  // 대각선(강) 기준 대칭
const antiSwapP = p => P(M - p.y, M - p.x);      // 반대 대각선(미드) 기준 대칭
const mapObj = (o, f) => { const r = {}; for (const k in o) r[k] = Array.isArray(o[k]) ? o[k].map(f) : f(o[k]); return r; };

// ---------- 구조물 배치 (블루 기준, 레드는 점대칭) ----------
const BLUE_LAYOUT = {
  fountain: P(380, 7620),
  nexus: P(1150, 6850),
  nexusTurrets: [P(980, 6560), P(1440, 7020)],
  lanes: {
    top: { outer: P(800, 2500), inner: P(800, 4200), inhibTurret: P(800, 5650), inhib: P(800, 6150) },
    mid: { outer: P(3250, 4750), inner: P(2650, 5350), inhibTurret: P(2050, 5950), inhib: P(1650, 6350) },
    bot: { outer: P(5500, 7200), inner: P(3800, 7200), inhibTurret: P(2350, 7200), inhib: P(1850, 7200) },
  },
  spawn: { top: P(800, 5950), mid: P(1830, 6170), bot: P(2080, 7200) },
  path: {
    top: [P(800, 5900), P(800, 800), P(6400, 800), P(6850, 1150)],
    mid: [P(1850, 6150), P(6600, 1400), P(6850, 1150)],
    bot: [P(2100, 7200), P(7200, 7200), P(7200, 1600), P(6850, 1150)],
  },
};

function buildRedLayout(b) {
  return {
    fountain: reflectP(b.fountain),
    nexus: reflectP(b.nexus),
    nexusTurrets: b.nexusTurrets.map(reflectP),
    lanes: { top: mapObj(b.lanes.bot, reflectP), mid: mapObj(b.lanes.mid, reflectP), bot: mapObj(b.lanes.top, reflectP) },
    spawn: { top: reflectP(b.spawn.bot), mid: reflectP(b.spawn.mid), bot: reflectP(b.spawn.top) },
    path: { top: b.path.bot.map(reflectP), mid: b.path.mid.map(reflectP), bot: b.path.top.map(reflectP) },
  };
}
const LAYOUT = [BLUE_LAYOUT, buildRedLayout(BLUE_LAYOUT)];
const LANE_NAMES = { top: '탑', mid: '미드', bot: '봇' };

// ---------- 정글 (서쪽 사분면을 정의하고 나머지는 대칭) ----------
const WEST_CAMPS = [
  { slot: 'A', pos: P(1900, 4000) },
  { slot: 'B', pos: P(1450, 3000) },
  { slot: 'C', pos: P(2600, 4700) },
];
const WEST_PATHS = [
  [P(800, 3000), P(1450, 3000), P(1900, 4000), P(2600, 4700), P(3200, 4800)],
  [P(1900, 4000), P(2750, 3100)],
  [P(2600, 4700), P(1750, 5550), P(800, 5550)],
  [P(1450, 3000), P(1700, 2050)],
];
const CAMP_TYPES = {
  blue:    { units: ['blueBuff'], respawn: 240, label: '푸른 파수꾼' },
  gromp:   { units: ['gromp'], respawn: 120, label: '거대 두꺼비' },
  wolves:  { units: ['bigWolf', 'wolf', 'wolf'], respawn: 120, label: '늑대' },
  red:     { units: ['redBuff'], respawn: 240, label: '붉은 덩굴정령' },
  krugs:   { units: ['bigKrug', 'krug'], respawn: 120, label: '돌거북' },
  raptors: { units: ['bigRaptor', 'raptor', 'raptor', 'raptor'], respawn: 120, label: '칼날부리' },
  dragon:  { units: ['dragon'], respawn: 300, label: '용', first: CFG.DRAGON_FIRST },
  baron:   { units: ['baron'], respawn: 360, label: '공허의 군주', first: CFG.BARON_FIRST },
};
const QUADRANTS = [
  { f: p => p, types: { A: 'blue', B: 'gromp', C: 'wolves' } },         // 서 (블루 탑 정글)
  { f: antiSwapP, types: { A: 'red', B: 'krugs', C: 'raptors' } },      // 남 (블루 봇 정글)
  { f: swapP, types: { A: 'blue', B: 'gromp', C: 'wolves' } },          // 북 (레드 탑 정글)
  { f: reflectP, types: { A: 'red', B: 'krugs', C: 'raptors' } },       // 동 (레드 봇 정글)
];
const BARON_PIT = P(2500, 2100);
const DRAGON_PIT = reflectP(BARON_PIT);

const CAMP_DEFS = [];
for (const q of QUADRANTS) for (const c of WEST_CAMPS) CAMP_DEFS.push({ type: q.types[c.slot], pos: q.f(c.pos) });
CAMP_DEFS.push({ type: 'baron', pos: BARON_PIT });
CAMP_DEFS.push({ type: 'dragon', pos: DRAGON_PIT });

// ---------- 지형 도형 ----------
const MapData = {
  shapes: [],
  trees: [],
  treeBuckets: null,
  BUCKET: 800,

  build() {
    const S = this.shapes = [];
    const cap = (pts, r, mat) => S.push({ kind: 'cap', pts, r, mat });
    const circ = (p, r, mat) => S.push({ kind: 'circle', x: p.x, y: p.y, r, mat });

    // 정글 길 / 캠프 공터
    for (const q of QUADRANTS) {
      for (const path of WEST_PATHS) cap(path.map(q.f), 150, 'grass');
      for (const c of WEST_CAMPS) circ(q.f(c.pos), 280, 'grass');
    }
    // 강
    cap([P(950, 950), P(7050, 7050)], 330, 'river');
    circ(BARON_PIT, 400, 'pit');
    circ(DRAGON_PIT, 400, 'pit');
    // 라인
    for (const lane of ['top', 'mid', 'bot']) cap(BLUE_LAYOUT.path[lane].slice(0, -1), 300, 'lane');
    cap([P(800, 6400), P(800, 5800)], 300, 'lane');
    cap([P(1500, 6500), P(1900, 6100)], 300, 'lane');
    cap([P(1600, 7200), P(2200, 7200)], 300, 'lane');
    cap([P(7200, 1600), P(7200, 2200)], 300, 'lane');
    cap([P(6500, 1500), P(6100, 1900)], 300, 'lane');
    cap([P(6400, 800), P(5800, 800)], 300, 'lane');
    // 기지
    circ(P(700, 7300), 1250, 'base0');
    circ(P(7300, 700), 1250, 'base1');

    this.buildTrees();
  },

  insideShape(s, x, y, margin) {
    if (s.kind === 'circle') return dist2(x, y, s.x, s.y) <= (s.r - margin) * (s.r - margin);
    const r = s.r - margin;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const a = s.pts[i], b = s.pts[i + 1];
      if (distToSegment(x, y, a.x, a.y, b.x, b.y) <= r) return true;
    }
    return false;
  },

  insideAny(x, y, margin) {
    for (const s of this.shapes) if (this.insideShape(s, x, y, margin)) return true;
    return false;
  },

  buildTrees() {
    let seed = 1337;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const B = this.BUCKET, nb = Math.ceil(M / B);
    this.treeBuckets = Array.from({ length: nb * nb }, () => []);
    const step = 115;
    for (let y = -60; y < M + 60; y += step) {
      for (let x = -60; x < M + 60; x += step) {
        const tx = x + (rnd() - 0.5) * 80, ty = y + (rnd() - 0.5) * 80;
        if (this.insideAny(tx, ty, -55)) continue;
        const t = { x: tx, y: ty, r: 55 + rnd() * 30, shade: rnd() };
        this.trees.push(t);
        const bx = clamp(Math.floor(tx / B), 0, nb - 1), by = clamp(Math.floor(ty / B), 0, nb - 1);
        this.treeBuckets[by * nb + bx].push(t);
      }
    }
  },

  treesInRect(x0, y0, x1, y1, out) {
    const B = this.BUCKET, nb = Math.ceil(M / B);
    const bx0 = clamp(Math.floor(x0 / B), 0, nb - 1), bx1 = clamp(Math.floor(x1 / B), 0, nb - 1);
    const by0 = clamp(Math.floor(y0 / B), 0, nb - 1), by1 = clamp(Math.floor(y1 / B), 0, nb - 1);
    out.length = 0;
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
      for (const t of this.treeBuckets[by * nb + bx]) out.push(t);
    }
    return out;
  },
};

// ---------- 충돌 / 길찾기 격자 ----------
const Nav = {
  cw: 0, ch: 0, coll: null,
  nw: 0, nh: 0, nav: null, block: null,

  build() {
    const C = CFG.COLL_CELL, N = CFG.NAV_CELL;
    this.cw = this.ch = Math.ceil(M / C);
    this.coll = new Uint8Array(this.cw * this.ch);
    for (let cy = 0; cy < this.ch; cy++) for (let cx = 0; cx < this.cw; cx++) {
      this.coll[cy * this.cw + cx] = MapData.insideAny((cx + 0.5) * C, (cy + 0.5) * C, 18) ? 1 : 0;
    }
    this.nw = this.nh = Math.ceil(M / N);
    this.nav = new Uint8Array(this.nw * this.nh);
    this.block = new Uint16Array(this.nw * this.nh);
    const k = N / C;
    for (let ny = 0; ny < this.nh; ny++) for (let nx = 0; nx < this.nw; nx++) {
      let ok = 1;
      for (let sy = 0; sy < k && ok; sy++) for (let sx = 0; sx < k; sx++) {
        const cx = nx * k + sx, cy = ny * k + sy;
        if (cx >= this.cw || cy >= this.ch || !this.coll[cy * this.cw + cx]) { ok = 0; break; }
      }
      this.nav[ny * this.nw + nx] = ok;
    }
  },

  isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= M || y >= M) return false;
    const C = CFG.COLL_CELL;
    return this.coll[((y / C) | 0) * this.cw + ((x / C) | 0)] === 1;
  },

  navOk(nx, ny) {
    if (nx < 0 || ny < 0 || nx >= this.nw || ny >= this.nh) return false;
    const i = ny * this.nw + nx;
    return this.nav[i] === 1 && this.block[i] === 0;
  },

  // 구조물이 길찾기 격자를 막도록 등록 / 해제
  setBlocker(x, y, r, on) {
    const N = CFG.NAV_CELL, rr = r + 25;
    const x0 = Math.floor((x - rr) / N), x1 = Math.floor((x + rr) / N);
    const y0 = Math.floor((y - rr) / N), y1 = Math.floor((y + rr) / N);
    for (let ny = y0; ny <= y1; ny++) for (let nx = x0; nx <= x1; nx++) {
      if (nx < 0 || ny < 0 || nx >= this.nw || ny >= this.nh) continue;
      if (dist((nx + 0.5) * N, (ny + 0.5) * N, x, y) > rr) continue;
      const i = ny * this.nw + nx;
      this.block[i] = on ? this.block[i] + 1 : Math.max(0, this.block[i] - 1);
    }
  },

  nearestNav(x, y) {
    const N = CFG.NAV_CELL;
    const sx = clamp(Math.floor(x / N), 0, this.nw - 1), sy = clamp(Math.floor(y / N), 0, this.nh - 1);
    if (this.navOk(sx, sy)) return { nx: sx, ny: sy };
    for (let r = 1; r < 40; r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = sx + dx, ny = sy + dy;
        if (!this.navOk(nx, ny)) continue;
        const d = dist2((nx + 0.5) * N, (ny + 0.5) * N, x, y);
        if (d < bd) { bd = d; best = { nx, ny }; }
      }
      if (best) return best;
    }
    return { nx: sx, ny: sy };
  },

  nearestWalkablePoint(x, y) {
    if (this.isWalkable(x, y)) return P(x, y);
    const C = CFG.COLL_CELL;
    for (let r = 1; r < 40; r++) {
      let best = null, bd = Infinity;
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos(a / 16 * Math.PI * 2) * r * C, py = y + Math.sin(a / 16 * Math.PI * 2) * r * C;
        if (!this.isWalkable(px, py)) continue;
        const d = dist2(px, py, x, y);
        if (d < bd) { bd = d; best = P(px, py); }
      }
      if (best) return best;
    }
    return P(x, y);
  },

  // 직선 이동 가능 여부 (길찾기 격자 기준)
  los(ax, ay, bx, by) {
    const N = CFG.NAV_CELL;
    const d = dist(ax, ay, bx, by);
    const steps = Math.ceil(d / 20);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (!this.navOk(Math.floor(x / N), Math.floor(y / N))) return false;
    }
    return true;
  },

  findPath(sx, sy, tx, ty) {
    const N = CFG.NAV_CELL, W = this.nw, H = this.nh;
    const start = this.nearestNav(sx, sy), goal = this.nearestNav(tx, ty);
    const goalWalkable = this.navOk(Math.floor(tx / N), Math.floor(ty / N));
    const gx = goal.nx, gy = goal.ny;
    const endPoint = goalWalkable ? P(tx, ty) : P((gx + 0.5) * N, (gy + 0.5) * N);
    if (this.los(sx, sy, endPoint.x, endPoint.y)) return [endPoint];

    const si = start.ny * W + start.nx, gi = gy * W + gx;
    const g = new Float32Array(W * H).fill(Infinity);
    const from = new Int32Array(W * H).fill(-1);
    const closed = new Uint8Array(W * H);
    const heap = new MinHeap();
    const h = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
    g[si] = 0; heap.push(si, h(start.nx, start.ny));
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    let found = false, iter = 0;
    while (heap.size && iter++ < 40000) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      if (cur === gi) { found = true; break; }
      closed[cur] = 1;
      const cx = cur % W, cy = (cur / W) | 0;
      for (const [dx, dy, cost] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.navOk(nx, ny)) continue;
        if (dx && dy && (!this.navOk(cx + dx, cy) || !this.navOk(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + cost;
        if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; heap.push(ni, ng + h(nx, ny)); }
      }
    }
    if (!found) return [endPoint];

    const cells = [];
    for (let c = gi; c !== -1 && c !== si; c = from[c]) cells.push(c);
    cells.reverse();
    const raw = cells.map(c => P((c % W + 0.5) * N, (((c / W) | 0) + 0.5) * N));
    raw[raw.length - 1] = endPoint;

    // 경로 다듬기 (시야가 통하는 점은 건너뛰기)
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < raw.length) {
      let j = raw.length - 1;
      while (j > i && !this.los(ax, ay, raw[j].x, raw[j].y)) j--;
      out.push(raw[j]);
      ax = raw[j].x; ay = raw[j].y;
      i = j + 1;
    }
    return out;
  },
};
