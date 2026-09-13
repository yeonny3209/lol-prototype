// ===== 게임 전역 설정 =====
const TEAM = { BLUE: 0, RED: 1, NEUTRAL: 2 };
const TEAM_NAME = ['블루', '레드', '중립'];
const TEAM_COLOR = ['#3d8bff', '#ff4a4a', '#e0b040'];
const TEAM_COLOR_DARK = ['#1c3f7a', '#7a1c1c', '#6b5212'];

const CFG = {
  MAP: 8000,
  COLL_CELL: 25,          // 충돌 격자 크기
  NAV_CELL: 50,           // 길찾기 격자 크기
  TICK: 1 / 60,

  START_GOLD: 500,
  PASSIVE_GOLD: 2.0,      // 초당 골드
  PASSIVE_GOLD_START: 30,

  FIRST_WAVE: 30,
  WAVE_INTERVAL: 30,
  SIEGE_EVERY: 3,
  MINION_SPAWN_GAP: 0.7,
  MINION_UPGRADE_EVERY: 90,

  XP_RANGE: 1400,
  RECALL_TIME: 8,
  INHIB_RESPAWN: 240,

  CAMP_FIRST: 60,
  DRAGON_FIRST: 300,
  BARON_FIRST: 900,

  FOUNTAIN_RADIUS: 700,
  CRIT_MULT: 1.75,
};

// 레벨업에 필요한 경험치 (level -> 다음 레벨까지)
function xpToNext(level) { return 280 + (level - 1) * 100; }
const MAX_LEVEL = 18;

// 기본 테스트 유닛 스탯 (나중에 챔피언 데이터로 교체 가능)
const HERO_BASE = {
  name: '기본 유닛',
  hp: 620, hpPerLvl: 96,
  hpRegen: 1.6, hpRegenPerLvl: 0.12,
  ad: 58, adPerLvl: 3.2,
  as: 0.66, asPerLvl: 0.025,   // 레벨당 +2.5% 공속
  armor: 26, armorPerLvl: 4.2,
  mr: 30, mrPerLvl: 1.3,
  ms: 330,
  range: 525,
  projSpeed: 1800,
  radius: 30,
  sight: 1200,
  windup: 0.22,
};

const MINION_STATS = {
  melee:  { name: '전사 미니언', hp: 477, ad: 12, as: 1.25, armor: 0, range: 110, ms: 325, radius: 24, gold: 21, xp: 60, projSpeed: 0, sight: 800, hpUp: 22, adUp: 1, towerPct: 0.45 },
  caster: { name: '마법사 미니언', hp: 296, ad: 23, as: 0.667, armor: 0, range: 550, ms: 325, radius: 20, gold: 14, xp: 30, projSpeed: 650, sight: 800, hpUp: 9, adUp: 1.5, towerPct: 0.70 },
  siege:  { name: '공성 미니언', hp: 912, ad: 40, as: 1.0, armor: 20, range: 300, ms: 325, radius: 32, gold: 60, xp: 93, projSpeed: 1200, sight: 800, hpUp: 50, adUp: 3, towerPct: 0.14 },
  super:  { name: '슈퍼 미니언', hp: 1600, ad: 190, as: 0.85, armor: 30, range: 170, ms: 325, radius: 40, gold: 60, xp: 97, projSpeed: 0, sight: 800, hpUp: 100, adUp: 5, towerPct: 0.07 },
};

const TURRET_STATS = {
  outer: { name: '외곽 포탑', hp: 2800, armor: 30 },
  inner: { name: '내부 포탑', hp: 3000, armor: 35 },
  inhib: { name: '억제기 포탑', hp: 3000, armor: 35 },
  nexus: { name: '넥서스 포탑', hp: 2600, armor: 35 },
};
const TURRET_COMMON = { ad: 160, adPerMin: 5, as: 0.83, range: 775, radius: 70, sight: 1150, projSpeed: 1300, rampPerHit: 0.4, rampMax: 1.2, gold: 250, xp: 150 };

const INHIB_STATS = { name: '억제기', hp: 3000, armor: 20, radius: 80, sight: 700 };
const NEXUS_STATS = { name: '넥서스', hp: 5000, armor: 20, radius: 125, sight: 1200, regen: 5 };

// 정글 몬스터
const MONSTER_STATS = {
  blueBuff:  { name: '푸른 파수꾼', hp: 2100, ad: 60, as: 0.5, armor: 10, range: 180, radius: 55, gold: 90, xp: 200, ms: 300, buff: 'blue', color: '#4aa8ff' },
  redBuff:   { name: '붉은 덩굴정령', hp: 2100, ad: 70, as: 0.5, armor: 10, range: 180, radius: 55, gold: 90, xp: 200, ms: 300, buff: 'red', color: '#ff6a3a' },
  gromp:     { name: '거대 두꺼비', hp: 1700, ad: 70, as: 0.85, armor: 0, range: 250, radius: 50, gold: 80, xp: 135, ms: 300, color: '#6fae5b' },
  bigWolf:   { name: '큰 늑대', hp: 1200, ad: 35, as: 0.625, armor: 10, range: 175, radius: 42, gold: 55, xp: 95, ms: 350, color: '#8a8fa0' },
  wolf:      { name: '늑대', hp: 380, ad: 16, as: 0.625, armor: 0, range: 175, radius: 26, gold: 12, xp: 25, ms: 350, color: '#a4a8b5' },
  bigRaptor: { name: '큰 칼날부리', hp: 1100, ad: 22, as: 0.7, armor: 20, range: 300, radius: 40, gold: 60, xp: 90, ms: 350, color: '#d95c8f' },
  raptor:    { name: '칼날부리', hp: 350, ad: 13, as: 1.0, armor: 0, range: 300, radius: 22, gold: 10, xp: 20, ms: 350, color: '#e889ad' },
  bigKrug:   { name: '고대 돌거북', hp: 1350, ad: 60, as: 0.6, armor: 25, range: 150, radius: 50, gold: 70, xp: 110, ms: 285, color: '#9b7b56' },
  krug:      { name: '돌거북', hp: 550, ad: 25, as: 0.6, armor: 10, range: 150, radius: 30, gold: 20, xp: 30, ms: 285, color: '#b8966b' },
  dragon:    { name: '화염 용', hp: 3800, ad: 110, as: 0.5, armor: 21, range: 500, radius: 80, gold: 150, xp: 400, ms: 330, projSpeed: 900, buff: 'dragon', color: '#ff7b2e' },
  baron:     { name: '공허의 군주', hp: 9000, ad: 160, as: 0.75, armor: 70, range: 600, radius: 110, gold: 300, xp: 800, ms: 0, projSpeed: 1000, buff: 'baron', color: '#9a5cff' },
};

const BUFF_INFO = {
  blue:   { name: '푸른 기운', dur: 120, desc: '체력 재생 +6/초, 이동 속도 +8%', color: '#4aa8ff', icon: '💧' },
  red:    { name: '붉은 기운', dur: 120, desc: '공격력 +15, 기본 공격에 추가 고정 피해', color: '#ff6a3a', icon: '🔥' },
  dragon: { name: '용의 힘', dur: 0, desc: '공격력/방어력 영구 증가 (중첩)', color: '#ff7b2e', icon: '🐉' },
  baron:  { name: '군주의 권능', dur: 180, desc: '공격력 +40, 귀환 4초, 주변 미니언 강화', color: '#9a5cff', icon: '👁' },
};

const SPELLS = {
  heal:  { name: '회복', key: 'D', cd: 240 },
  flash: { name: '점멸', key: 'F', cd: 300, range: 425 },
};
