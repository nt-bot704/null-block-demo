/*
 * NULL BLOCK — 코어
 *
 * 기능을 붙이는 방법: index.html에서 game.js 아래에 <script src="..."> 를 추가하고
 * 그 파일에서 NullBlock.on('이벤트', (detail, game) => { ... }) 로 구독합니다.
 *
 * 이벤트 (detail 내용)
 *   start     {}                                  새 게임 시작
 *   spawn     { piece }                           새 블록 등장
 *   move      { dx, dy, source, piece }           블록 이동 (source: 'player' | 'gravity')
 *   rotate    { kick, piece }                     블록 회전
 *   drop      { distance, piece }                 Space로 바로 떨어뜨림 (lock 직전)
 *   lock      { piece, cells }                    블록이 바닥/다른 블록 위에 놓임
 *   clear     { rows, count }                     줄이 지워짐 (rows: 지워진 줄 번호, 위가 0)
 *   pause     {} / resume {}                      일시정지 / 재개
 *   gameover  {}                                  게임 오버
 *   draw      { ctx, cellSize, cols, rows }       매 프레임 보드를 그린 직후 (덧그리기용)
 *
 * piece = { type, x, y, matrix, cells: [{x, y}, ...] }  (복사본이라 고쳐도 게임엔 영향 없음)
 */
(() => {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;

  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  };

  const COLORS = {
    I: '#4fd1c5',
    O: '#f6e05e',
    T: '#b794f4',
    S: '#68d391',
    Z: '#fc8181',
    J: '#63b3ed',
    L: '#f6ad55',
  };

  // 플러그인이 바꿔도 되는 값 (예: 레벨 기능이 dropInterval을 줄임)
  const config = {
    dropInterval: 800, // ms, 블록이 한 칸 떨어지는 간격
  };

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const hud = document.getElementById('hud');
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;

  // ───────────────────────── 이벤트 ─────────────────────────
  const listeners = new Map();

  function on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(fn);
    return () => off(name, fn); // 구독 해제 함수
  }

  function off(name, fn) {
    const list = listeners.get(name);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  function emit(name, detail = {}) {
    const list = listeners.get(name);
    if (!list) return;
    for (const fn of list.slice()) {
      // 기능 파일 하나가 터져도 게임은 계속 돌아가게
      try {
        fn(detail, api);
      } catch (err) {
        console.error(`[NullBlock] '${name}' 리스너 오류:`, err);
      }
    }
  }

  // ───────────────────────── 상태 ─────────────────────────
  let board = emptyBoard();
  let piece = null;
  let bag = [];
  let status = 'ready'; // 'ready' | 'playing' | 'paused' | 'over'
  let dropAcc = 0;
  let lastTime = 0;

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  // 7종을 한 번씩 섞어서 꺼냄 (같은 블록만 계속 나오는 것 방지)
  function nextType() {
    if (bag.length === 0) {
      bag = Object.keys(SHAPES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function cellsOf(matrix, px, py) {
    const cells = [];
    matrix.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v) cells.push({ x: px + c, y: py + r });
      })
    );
    return cells;
  }

  // 보드 위쪽(y < 0)은 빈 공간으로 취급
  function collides(matrix, px, py) {
    return cellsOf(matrix, px, py).some(
      ({ x, y }) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== null)
    );
  }

  function rotateCW(m) {
    const n = m.length;
    return m.map((row, r) => row.map((_, c) => m[n - 1 - c][r]));
  }

  function pieceInfo() {
    return {
      type: piece.type,
      x: piece.x,
      y: piece.y,
      matrix: piece.matrix.map((r) => r.slice()),
      cells: cellsOf(piece.matrix, piece.x, piece.y),
    };
  }

  // ───────────────────────── 동작 ─────────────────────────
  function spawn() {
    const type = nextType();
    const matrix = SHAPES[type].map((r) => r.slice());
    const topRow = matrix.findIndex((row) => row.some(Boolean));
    piece = {
      type,
      matrix,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: -topRow, // 블록의 첫 칸이 맨 윗줄에 오도록
    };
    dropAcc = 0;
    if (collides(piece.matrix, piece.x, piece.y)) {
      gameOver(); // 나올 자리가 막힘 = 꼭대기에 닿음
      return;
    }
    emit('spawn', { piece: pieceInfo() });
  }

  function move(dx, dy, source) {
    if (collides(piece.matrix, piece.x + dx, piece.y + dy)) return false;
    piece.x += dx;
    piece.y += dy;
    emit('move', { dx, dy, source, piece: pieceInfo() });
    return true;
  }

  function rotate() {
    const rotated = rotateCW(piece.matrix);
    // 벽이나 블록에 걸리면 좌우로 살짝 밀어서 다시 시도
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(rotated, piece.x + kick, piece.y)) {
        piece.matrix = rotated;
        piece.x += kick;
        emit('rotate', { kick, piece: pieceInfo() });
        return true;
      }
    }
    return false;
  }

  function softDrop() {
    dropAcc = 0;
    if (!move(0, 1, 'player')) lock();
  }

  function hardDrop() {
    let distance = 0;
    while (!collides(piece.matrix, piece.x, piece.y + distance + 1)) distance++;
    piece.y += distance;
    emit('drop', { distance, piece: pieceInfo() });
    lock();
  }

  function lock() {
    const cells = cellsOf(piece.matrix, piece.x, piece.y);
    for (const { x, y } of cells) {
      if (y >= 0) board[y][x] = piece.type;
    }
    emit('lock', { piece: pieceInfo(), cells });

    // 보드 밖(꼭대기 위)에 걸친 채 놓이면 게임 오버
    if (cells.some(({ y }) => y < 0)) {
      gameOver();
      return;
    }

    clearLines();
    spawn();
  }

  function clearLines() {
    const rows = [];
    for (let y = 0; y < ROWS; y++) {
      if (board[y].every((cell) => cell !== null)) rows.push(y);
    }
    if (rows.length === 0) return;

    board = board.filter((_, y) => !rows.includes(y));
    while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
    emit('clear', { rows, count: rows.length });
  }

  // ───────────────────────── 진행 ─────────────────────────
  function start() {
    board = emptyBoard();
    bag = [];
    piece = null;
    status = 'playing';
    hideOverlay();
    emit('start');
    spawn();
  }

  function gameOver() {
    status = 'over';
    showOverlay('GAME OVER', 'Enter 키로 다시 시작');
    emit('gameover');
  }

  function togglePause() {
    if (status === 'playing') {
      status = 'paused';
      showOverlay('PAUSED', 'P 키로 계속');
      emit('pause');
    } else if (status === 'paused') {
      status = 'playing';
      hideOverlay();
      emit('resume');
    }
  }

  function showOverlay(title, sub = '') {
    overlay.querySelector('.overlay-title').textContent = title;
    overlay.querySelector('.overlay-sub').textContent = sub;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  // ───────────────────────── 그리기 ─────────────────────────
  function drawCell(x, y, color, alpha = 1) {
    if (y < 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 4);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#151a20';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, canvas.height);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(canvas.width, y * CELL + 0.5);
    }
    ctx.stroke();

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) drawCell(x, y, COLORS[board[y][x]]);
      }
    }

    if (piece && status !== 'over') {
      for (const { x, y } of cellsOf(piece.matrix, piece.x, piece.y)) {
        drawCell(x, y, COLORS[piece.type]);
      }
    }

    emit('draw', { ctx, cellSize: CELL, cols: COLS, rows: ROWS });
  }

  function frame(time) {
    const dt = time - lastTime;
    lastTime = time;

    if (status === 'playing') {
      dropAcc += dt;
      if (dropAcc >= config.dropInterval) {
        dropAcc = 0;
        if (!move(0, 1, 'gravity')) lock();
      }
    }

    draw();
    requestAnimationFrame(frame);
  }

  // ───────────────────────── 입력 ─────────────────────────
  // e.code 기준이라 한글 입력 상태에서도 동작
  const ACTIONS = {
    ArrowLeft: () => move(-1, 0, 'player'),
    ArrowRight: () => move(1, 0, 'player'),
    ArrowDown: softDrop,
    ArrowUp: rotate,
    Space: hardDrop,
  };

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      if (status === 'ready' || status === 'over') start();
      return;
    }
    if (e.code === 'KeyP') {
      togglePause();
      return;
    }
    const action = ACTIONS[e.code];
    if (!action) return;
    e.preventDefault(); // 방향키·Space로 페이지가 스크롤되지 않게
    if (status === 'playing' && piece) action();
  });

  // ───────────────────────── 공개 API ─────────────────────────
  const api = Object.freeze({
    COLS,
    ROWS,
    COLORS,
    config,
    on,
    off,
    get status() {
      return status;
    },
    getBoard: () => board.map((row) => row.slice()),
    getPiece: () => (piece ? pieceInfo() : null),
    collides: (matrix, x, y) => collides(matrix, x, y),
    drawCell,
    hud, // 기능 파일이 점수판 같은 UI를 붙일 곳
    showOverlay,
    hideOverlay,
    start,
    togglePause,
  });

  window.NullBlock = api;
  requestAnimationFrame(frame);
})();
