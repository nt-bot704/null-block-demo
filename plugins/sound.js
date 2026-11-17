/*
 * 효과음 (오디오 파일 없이 Web Audio API로 합성)
 *   lock  : 블록이 놓일 때 짧고 낮은 "툭"
 *   clear : 지운 줄 수(1~3)만큼 음이 올라가는 아르페지오, 4줄은 화려한 팡파르
 *   줄이 지워질 때는 lock 직후 clear가 같은 틱에 이어서 발생하므로,
 *   lock 소리를 한 틱 미뤘다가 clear가 오면 취소해서 겹치지 않게 함
 *   M 키로 음소거 토글 (상태는 localStorage에 저장), 안내는 game.hud에 표시
 *   AudioContext는 첫 키 입력/클릭 때 만들고 resume (자동재생 정책)
 */
(() => {
  'use strict';

  const game = window.NullBlock;
  const STORAGE_KEY = 'nullblock.muted';
  const MASTER_GAIN = 0.15; // 0.2 이하로 작게

  let ctx = null;
  let master = null;
  let muted = false;
  let pendingLock = null;

  try {
    muted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (e) {
    /* 저장소를 못 쓰면 기본값(소리 켜짐) */
  }

  // ───────────── 안내 표시 ─────────────
  const hint = document.createElement('div');
  hint.style.cssText = 'margin-top:8px;font-size:12px;opacity:0.7;';
  game.hud.appendChild(hint);
  function renderHint() {
    hint.textContent = `M 효과음 ${muted ? '꺼짐' : '켜짐'}`;
  }
  renderHint();

  // ───────────── 오디오 ─────────────
  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // 단음: 주파수 f0→f1 로 변하는 짧은 톤, 어택 후 지수 감쇠
  function tone({ freq, freqEnd = freq, type = 'sine', start = 0, dur = 0.1, vol = 0.6 }) {
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function play(fn) {
    if (muted || !ensureAudio() || ctx.state !== 'running') return;
    fn();
  }

  function playLock() {
    play(() => tone({ freq: 160, freqEnd: 70, type: 'triangle', dur: 0.08, vol: 0.7 }));
  }

  // C 장조 음계 기반: 줄 수가 많을수록 음이 많고 높고 길어짐
  const NOTES = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0];
  function playClear(count) {
    play(() => {
      if (count >= 4) {
        // 특별: 낮은 쿵 + 빠른 상행 아르페지오 + 마지막 화음
        tone({ freq: 120, freqEnd: 50, type: 'sawtooth', dur: 0.18, vol: 0.5 });
        NOTES.forEach((f, i) => tone({ freq: f, type: 'square', start: 0.04 + i * 0.055, dur: 0.12, vol: 0.28 }));
        const end = 0.04 + NOTES.length * 0.055;
        [1046.5, 1318.5, 1568.0, 2093.0].forEach((f) =>
          tone({ freq: f, type: 'triangle', start: end, dur: 0.45, vol: 0.3 }),
        );
      } else {
        const n = Math.max(1, Math.min(count, 3)) + 1; // 2~4음
        for (let i = 0; i < n; i++) {
          tone({ freq: NOTES[i], type: 'square', start: i * 0.06, dur: 0.1 + count * 0.02, vol: 0.3 });
        }
      }
    });
  }

  // ───────────── 이벤트 ─────────────
  game.on('lock', () => {
    clearTimeout(pendingLock);
    // 같은 틱에 clear가 오면 취소됨
    pendingLock = setTimeout(() => {
      pendingLock = null;
      playLock();
    }, 0);
  });

  game.on('clear', ({ count }) => {
    if (pendingLock !== null) {
      clearTimeout(pendingLock);
      pendingLock = null;
    }
    playClear(count);
  });

  // ───────────── 입력 ─────────────
  // 사용자 동작 후에 AudioContext 생성/resume
  const unlock = () => ensureAudio();
  document.addEventListener('keydown', unlock);
  document.addEventListener('pointerdown', unlock);

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyM' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    muted = !muted;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch (err) {
      /* 저장 실패는 무시 */
    }
    renderHint();
  });
})();
