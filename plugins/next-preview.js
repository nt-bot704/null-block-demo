/*
 * 다음 블록 미리보기 (NEXT)
 *   spawn 이벤트의 next(다음 블록 종류 배열)를 사이드바의 작은 canvas에 그림.
 *   바로 다음 블록은 진하게, 그 뒤는 흐리게.
 */
(() => {
  'use strict';

  const game = window.NullBlock;
  const CELL = 16; // 미리보기 칸 크기 (보드는 30)
  const SLOT_W = 4 * CELL; // 가장 넓은 블록(I) 기준
  const SLOT_H = 2 * CELL; // 가장 높은 블록 기준 (빈 줄을 잘라낸 뒤)
  const GAP = 12;
  const PAD = 10;
  const COUNT = game.NEXT_COUNT;

  const width = SLOT_W + PAD * 2;
  const height = COUNT * SLOT_H + (COUNT - 1) * GAP + PAD * 2;

  // HUD: 기존 사이드바의 h2 스타일을 그대로 씀
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = 'NEXT';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', '다음 블록');
  canvas.style.display = 'block';
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.background = 'var(--panel)';
  canvas.style.border = '1px solid var(--line)';
  section.append(h2, canvas);
  game.hud.append(section);

  // 고해상도 화면에서도 선명하게
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // 블록이 차지하는 칸만 남기고 빈 줄/칸을 잘라냄
  function trim(matrix) {
    const rows = matrix.filter((row) => row.some(Boolean));
    const cols = rows[0].map((_, c) => c).filter((c) => rows.some((row) => row[c]));
    return rows.map((row) => cols.map((c) => row[c]));
  }

  // game.js의 drawCell과 같은 모양 (칸 + 위쪽 하이라이트)
  function drawCell(px, py, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(px + 1, py + 1, CELL - 2, 2);
    ctx.restore();
  }

  function render(next) {
    ctx.clearRect(0, 0, width, height);
    next.slice(0, COUNT).forEach((type, i) => {
      const shape = trim(game.SHAPES[type]);
      const w = shape[0].length * CELL;
      const h = shape.length * CELL;
      const ox = PAD + (SLOT_W - w) / 2;
      const oy = PAD + i * (SLOT_H + GAP) + (SLOT_H - h) / 2;
      const alpha = i === 0 ? 1 : 0.45;
      shape.forEach((row, r) =>
        row.forEach((v, c) => {
          if (v) drawCell(ox + c * CELL, oy + r * CELL, game.COLORS[type], alpha);
        })
      );
    });
  }

  game.on('start', () => render([]));
  game.on('spawn', ({ next }) => render(next));

  render(game.getNext());
})();
