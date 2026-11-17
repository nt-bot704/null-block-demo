/*
 * 게임 오버 화면 · 최고 점수
 *   gameover 때 이번 점수 / 최고 점수를 오버레이에 보여 주고, 새 기록이면 표시
 *   최고 점수는 localStorage에 저장 (접근 실패 시 이번 실행 동안만 기억)
 *   score.js는 점수를 공개하지 않으므로 clear 이벤트로 같은 표를 써서 직접 계산
 */
(() => {
  'use strict';

  const game = window.NullBlock;
  const POINTS = [0, 100, 300, 500, 800]; // 지운 줄 수 → 점수 (score.js와 동일)
  const STORAGE_KEY = 'nullblock.best';

  function loadBest() {
    try {
      const n = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch (e) {
      // 저장 실패해도 게임은 계속
    }
  }

  let score = 0;
  let best = loadBest();

  // HUD: BEST
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = 'BEST';
  const bestValue = document.createElement('div');
  bestValue.style.fontSize = '16px';
  bestValue.style.fontVariantNumeric = 'tabular-nums';
  section.append(h2, bestValue);
  game.hud.append(section);

  function renderBest() {
    bestValue.textContent = best.toLocaleString();
  }

  game.on('start', () => {
    score = 0;
    renderBest();
  });

  game.on('clear', ({ count }) => {
    score += POINTS[Math.min(count, 4)];
  });

  game.on('gameover', () => {
    const isNewRecord = score > best;
    if (isNewRecord) {
      best = score;
      saveBest(best);
      renderBest();
    }
    const lines = [
      `점수 ${score.toLocaleString()}`,
      isNewRecord ? `★ 새 기록! 최고 ${best.toLocaleString()}` : `최고 ${best.toLocaleString()}`,
      'Enter 키로 다시 시작',
    ];
    game.showOverlay('GAME OVER', lines.join('\n'));
    const sub = document.querySelector('#overlay .overlay-sub');
    if (sub) sub.style.whiteSpace = 'pre-line';
  });

  renderBest();
})();
