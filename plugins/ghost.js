/*
 * 고스트 (착지 위치 미리보기)
 *   지금 블록이 하드 드롭으로 떨어질 자리를 블록 색으로 흐리게 표시
 *   playing 상태에서만 그리며, 실제 블록과 겹치는 칸은 그리지 않음
 *   그리기만 하므로 게임 진행에는 영향 없음
 */
(() => {
  'use strict';

  const game = window.NullBlock;
  const ALPHA = 0.25;

  game.on('draw', () => {
    if (game.status !== 'playing') return;
    const piece = game.getPiece();
    if (!piece) return;

    // 하드 드롭과 같은 방식으로 더 내려갈 수 없을 때까지 내림
    let drop = 0;
    while (!game.collides(piece.matrix, piece.x, piece.y + drop + 1)) drop++;
    if (drop === 0) return; // 이미 바닥이면 블록과 완전히 겹침

    const occupied = new Set(piece.cells.map(({ x, y }) => `${x},${y}`));
    const color = game.COLORS[piece.type];
    for (const { x, y } of piece.cells) {
      const gy = y + drop;
      if (occupied.has(`${x},${gy}`)) continue;
      game.drawCell(x, gy, color, ALPHA);
    }
  });
})();
