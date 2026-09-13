// ===== 시작 / 메인 루프 =====
let game = null;

function startGame() {
  game = new Game();
  window.game = game;
  game.cam.zoom = clamp(window.innerHeight / 1150, 0.6, 1.2);
  Input.attach(game);
  UI.attach(game);
  Renderer.attach(game);
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
