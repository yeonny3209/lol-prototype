// ===== 시작 / 메인 루프 =====
let game = null;

function startGame(champId) {
  game = new Game(champId);
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
  UI.hideTip();
  UI.game = null;
  document.querySelectorAll('.hud').forEach(e => e.classList.add('hidden'));
  for (const id of ['endScreen', 'pauseScreen', 'deathOverlay', 'channelBar']) document.getElementById(id).classList.add('hidden');
  UI.buildChampSelect();
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
      if (!game.paused) {
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
