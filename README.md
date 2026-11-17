# null-block-demo

블록 퍼즐 게임 **NULL BLOCK**. 빌드 없이 `index.html`을 브라우저로 열면 됩니다.

| 키 | 동작 |
| --- | --- |
| ← → | 이동 |
| ↑ | 회전 |
| ↓ | 한 칸 내리기 |
| Space | 바로 떨어뜨리기 |
| P | 일시정지 |
| Enter | 시작 / 다시 시작 |

## 기능 붙이기

`index.html`에서 `game.js` **아래에** 파일을 하나 추가하고, 그 파일에서 이벤트를 구독합니다.

```html
<script src="game.js"></script>
<script src="plugins/score.js"></script>
```

```js
// plugins/score.js
(() => {
  let score = 0;
  const el = document.createElement('div');
  NullBlock.hud.append(el);
  const render = () => (el.textContent = `SCORE ${score}`);

  NullBlock.on('start', () => { score = 0; render(); });
  NullBlock.on('clear', ({ count }) => { score += [0, 100, 300, 500, 800][count]; render(); });
})();
```

| 이벤트 | detail | 시점 |
| --- | --- | --- |
| `start` | `{}` | 새 게임 시작 |
| `spawn` | `{ piece }` | 새 블록 등장 |
| `move` | `{ dx, dy, source, piece }` | 이동 (`source`: `'player'` / `'gravity'`) |
| `rotate` | `{ kick, piece }` | 회전 |
| `drop` | `{ distance, piece }` | Space로 바로 떨어뜨림 |
| `lock` | `{ piece, cells }` | 블록이 놓임 |
| `clear` | `{ rows, count }` | 줄이 지워짐 |
| `pause` / `resume` | `{}` | 일시정지 / 재개 |
| `gameover` | `{}` | 게임 오버 |
| `draw` | `{ ctx, cellSize, cols, rows }` | 매 프레임 보드를 그린 직후 |

리스너는 `(detail, game)`을 받고, `on()`은 구독 해제 함수를 돌려줍니다. 리스너에서 오류가 나도 게임은 멈추지 않고 콘솔에 기록만 남습니다.

그 밖에 `NullBlock`에서 쓸 수 있는 것: `status`, `getBoard()`, `getPiece()`, `collides(matrix, x, y)`, `drawCell(x, y, color, alpha)`, `config.dropInterval`(낙하 간격 ms, 바꿀 수 있음), `hud`, `showOverlay(title, sub)`, `hideOverlay()`, `start()`, `togglePause()`.
