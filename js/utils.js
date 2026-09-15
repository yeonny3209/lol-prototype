// ===== 수학 / 공용 도구 =====
function dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
// 화면 효과용 난수 (게임 결과에 영향 없음)
function rand(a, b) { return a + Math.random() * (b - a); }

// 게임 로직용 난수: 1대1에서 두 컴퓨터가 똑같은 결과를 내도록 시드를 고정한 Mulberry32
const Rng = {
  s: 1,
  seed(n) { this.s = (n >>> 0) || 1; },
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },
};
const rng = () => Rng.next();
function srand(a, b) { return a + rng() * (b - a); }

// 선분 AB 와 점 P 사이 거리
function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
  t = clamp(t, 0, 1);
  return dist(px, py, ax + abx * t, ay + aby * t);
}

function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// 방어력 적용 피해
function mitigate(amount, armor) {
  return armor >= 0 ? amount * 100 / (100 + armor) : amount * (2 - 100 / (100 - armor));
}

// A* 용 최소 힙
class MinHeap {
  constructor() { this.items = []; this.prio = []; }
  get size() { return this.items.length; }
  push(item, p) {
    const it = this.items, pr = this.prio;
    let i = it.length; it.push(item); pr.push(p);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= p) break;
      it[i] = it[parent]; pr[i] = pr[parent];
      i = parent;
    }
    it[i] = item; pr[i] = p;
  }
  pop() {
    const it = this.items, pr = this.prio;
    const top = it[0];
    const lastI = it.pop(), lastP = pr.pop();
    const n = it.length;
    if (n > 0) {
      let i = 0;
      while (true) {
        let l = 2 * i + 1, r = l + 1, m = i;
        let mp = lastP;
        if (l < n && pr[l] < mp) { m = l; mp = pr[l]; }
        if (r < n && pr[r] < mp) { m = r; mp = pr[r]; }
        if (m === i) break;
        it[i] = it[m]; pr[i] = pr[m];
        i = m;
      }
      it[i] = lastI; pr[i] = lastP;
    }
    return top;
  }
}
