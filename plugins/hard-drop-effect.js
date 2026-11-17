/*
 * 하드 드롭 착지 효과
 *   Space로 떨어뜨리면 약 250ms 동안
 *   - 떨어진 거리만큼 블록 색의 세로 잔상이 남았다가 사라짐
 *   - 착지한 칸들이 하얗게 번쩍임
 *   - 보드가 아래로 살짝 흔들림 (떨어진 거리가 길수록 조금 더, 동작 줄이기 설정이면 생략)
 *   그리기만 하므로 게임 진행(입력·낙하·판정)에는 영향 없음
 */
(() => {
  'use strict';

  const game = window.NullBlock;
  const canvas = document.getElementById('board');

  const DURATION = 250; // ms, 잔상·번쩍임
  const SHAKE_DURATION = 200; // ms
  const SHAKE_MAX = 5; // px (화면 기준)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let effects = []; // { start, color, cells: [{x, y}], trails: [{x, top, bottom}] }
  let shake = null; // { start, amp }

  game.on('drop', ({ distance, piece }) => {
    const start = performance.now();
    const color = game.COLORS[piece.type];

    // 열마다 가장 위 칸에서 위로 distance 칸만큼 잔상
    const trails = [];
    if (distance > 0) {
      const tops = new Map();
      for (const { x, y } of piece.cells) {
        if (!tops.has(x) || y < tops.get(x)) tops.set(x, y);
      }
      for (const [x, top] of tops) trails.push({ x, top: top - distance, bottom: top });
    }

    effects.push({ start, color, cells: piece.cells.slice(), trails });

    if (distance > 0 && !reduceMotion.matches) {
      shake = { start, amp: Math.min(SHAKE_MAX, 1.5 + distance * 0.25) };
    }
  });

  // 착지와 동시에 줄이 지워지면 번쩍일 칸과 잔상도 같이 내려 줌
  game.on('clear', ({ rows }) => {
    for (const effect of effects) {
      effect.cells = effect.cells
        .filter(({ y }) => !rows.includes(y))
        .map(({ x, y }) => ({ x, y: y + rows.filter((r) => r > y).length }));
      // 잔상은 그 열에 남은 칸 중 가장 위 칸에 붙임 (열의 칸이 다 지워졌으면 잔상도 없앰)
      effect.trails = effect.trails.flatMap(({ x, top, bottom }) => {
        const ys = effect.cells.filter((c) => c.x === x).map((c) => c.y);
        if (ys.length === 0) return [];
        const newBottom = Math.min(...ys);
        return [{ x, top: top + (newBottom - bottom), bottom: newBottom }];
      });
    }
  });

  game.on('start', () => {
    effects = [];
    shake = null;
    canvas.style.transform = '';
  });

  game.on('draw', ({ ctx, cellSize }) => {
    const now = performance.now();
    effects = effects.filter((e) => now - e.start < DURATION);

    for (const effect of effects) {
      const t = (now - effect.start) / DURATION; // 0 → 1
      const fade = 1 - t;

      ctx.save();

      // 세로 잔상: 아래(착지 지점)로 갈수록 진하게
      for (const { x, top, bottom } of effect.trails) {
        const px = x * cellSize + cellSize * 0.2;
        const w = cellSize * 0.6;
        const y0 = top * cellSize;
        const y1 = bottom * cellSize;
        const grad = ctx.createLinearGradient(0, y0, 0, y1);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, effect.color);
        ctx.globalAlpha = 0.6 * fade;
        ctx.fillStyle = grad;
        ctx.fillRect(px, y0, w, y1 - y0);
      }

      // 착지 칸 번쩍임: 처음엔 강하게, 빠르게 사라짐
      ctx.globalAlpha = 0.9 * fade ** 1.5;
      ctx.fillStyle = '#ffffff';
      for (const { x, y } of effect.cells) {
        if (y < 0) continue;
        ctx.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
      }

      ctx.restore();
    }

    // 흔들림: 아래로 쿵 내려갔다가 작게 튕기며 제자리로
    if (shake) {
      const t = (now - shake.start) / SHAKE_DURATION;
      if (t >= 1) {
        shake = null;
        canvas.style.transform = '';
      } else {
        const offset = shake.amp * (1 - t) * Math.cos(t * Math.PI * 3);
        canvas.style.transform = `translateY(${offset.toFixed(2)}px)`;
      }
    }
  });
})();
