// ===== 시작 / 메인 루프 =====
let game = null;
const SETUP_KEY = 'lolproto.setup.v2';

function loadSetups() {
  try { return JSON.parse(localStorage.getItem(SETUP_KEY)) || {}; } catch (e) { return {}; }
}

function saveSetup(setup) {
  try {
    const all = loadSetups();
    all.last = setup.champ;
    all[setup.champ] = setup;
    localStorage.setItem(SETUP_KEY, JSON.stringify(all));
  } catch (e) { /* 저장소를 쓸 수 없는 환경이면 무시 */ }
}

// setup: 혼자 하기 = { champ, role, spells, runes, practice } / 1대1 = { mode: 'pvp', seed, blue, red, localTeam }
function startGame(setup) {
  setup = setup || UI.currentSetup();
  if (setup.mode !== 'pvp') saveSetup(setup);
  else saveSetup(UI.currentSetup());
  game = new Game(setup);
  window.game = game;
  game.cam.zoom = clamp(window.innerHeight / 1150, 0.6, 1.2);
  Input.attach(game);
  UI.attach(game);
  Renderer.attach(game);
}

function showChampSelect() {
  game = null;
  window.game = null;
  Input.game = null;
  UI.toggleShop(false);
  UI.toggleSpellbook(false);
  UI.hideTip();
  UI.game = null;
  UI.pauseOpen = false;
  document.querySelectorAll('.hud').forEach(e => e.classList.add('hidden'));
  for (const id of ['endScreen', 'pauseScreen', 'deathOverlay', 'channelBar']) document.getElementById(id).classList.add('hidden');
  UI.renderSetup();
  document.getElementById('startScreen').classList.remove('hidden');
}

function boot() {
  MapData.build();
  Nav.build();
  Renderer.init();
  UI.init();

  let last = performance.now(), acc = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.1);
    if (game) {
      if (Net.active) {
        Net.pumpNow();
        Input.update(dt);
      } else if (!game.paused) {
        acc += dt;
        let steps = 0;
        while (acc >= CFG.TICK && steps < 8) { game.update(CFG.TICK); acc -= CFG.TICK; steps++; }
        if (steps >= 8) acc = 0;
        Input.update(dt);
      }
      Renderer.draw(game, dt);
      UI.update(game, dt);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('load', boot);
// 게임 중 실수로 탭을 닫지 않도록 (예: Ctrl+W)
window.addEventListener('beforeunload', e => {
  if (game && !game.over) { e.preventDefault(); e.returnValue = ''; }
});
window.addEventListener('pagehide', () => { if (Net.connected()) Net.send({ t: 'leave' }); });
