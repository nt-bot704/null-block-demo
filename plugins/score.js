/*
 * 점수 · 레벨
 *   줄 지우기: 1줄 100 · 2줄 300 · 3줄 500 · 4줄 800
 *   10줄마다 레벨 +1, 레벨이 오를수록 블록이 빨리 떨어짐
 */
(() => {
  'use strict';

  const game = window.NullBlock;
  const POINTS = [0, 100, 300, 500, 800]; // 지운 줄 수 → 점수
  const LINES_PER_LEVEL = 10;
  const BASE_INTERVAL = game.config.dropInterval; // 레벨 1 속도 (game.js 기본값)
  const MIN_INTERVAL = 80;
  const SPEEDUP = 0.85; // 레벨마다 낙하 간격 15%씩 줄임

  let score = 0;
  let lines = 0;
  let level = 1;

  const intervalFor = (lv) =>
    Math.max(MIN_INTERVAL, Math.round(BASE_INTERVAL * SPEEDUP ** (lv - 1)));

  // HUD: 기존 사이드바의 h2 스타일을 그대로 씀
  const values = {};
  for (const [key, label] of [['score', 'SCORE'], ['level', 'LEVEL'], ['lines', 'LINES']]) {
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = label;
    const value = document.createElement('div');
    value.style.fontSize = key === 'score' ? '22px' : '16px';
    value.style.fontVariantNumeric = 'tabular-nums';
    section.append(h2, value);
    game.hud.append(section);
    values[key] = value;
  }

  function render() {
    values.score.textContent = score.toLocaleString();
    values.level.textContent = level;
    values.lines.textContent = lines;
  }

  game.on('start', () => {
    score = 0;
    lines = 0;
    level = 1;
    game.config.dropInterval = intervalFor(level);
    render();
  });

  game.on('clear', ({ count }) => {
    score += POINTS[Math.min(count, 4)];
    lines += count;
    const nextLevel = Math.floor(lines / LINES_PER_LEVEL) + 1;
    if (nextLevel !== level) {
      level = nextLevel;
      game.config.dropInterval = intervalFor(level);
    }
    render();
  });

  render();
})();
