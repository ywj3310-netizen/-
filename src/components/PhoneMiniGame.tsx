import React, { useEffect, useRef } from 'react';
import { ChevronDown, Gamepad2, Zap } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { MiniGameType } from '../types/game';

interface PhoneMiniGameProps {
  gameType: MiniGameType;
  isVisible: boolean;
  isActive: boolean; // true during PLAYING phase
  score: number;
  combo: number;
  targetScore: number;
  onScoreGain: (delta: number, newCombo: number, soundKind: 'pop' | 'coin' | 'stack' | 'miss') => void;
  onHidePhone: () => void;
}

interface PopTarget {
  id: number;
  x: number;
  y: number;
  r: number;
  kind: 'normal' | 'gold' | 'bomb';
  life: number;
  maxLife: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface RunnerItem {
  lane: number;
  y: number;
  kind: 'coin' | 'gem' | 'barrier';
}

interface StackLayer {
  x: number;
  w: number;
  color: string;
}

const STACK_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185'];

export const PhoneMiniGame: React.FC<PhoneMiniGameProps> = ({
  gameType,
  isVisible,
  isActive,
  score,
  combo,
  targetScore,
  onScoreGain,
  onHidePhone,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scoreGainRef = useRef(onScoreGain);
  scoreGainRef.current = onScoreGain;

  const comboRef = useRef(combo);
  comboRef.current = combo;

  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const gameTypeRef = useRef(gameType);
  gameTypeRef.current = gameType;

  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // Mutable mini-game simulation state
  const simRef = useRef({
    // Common FX
    particles: [] as Particle[],
    texts: [] as FloatingText[],
    shake: 0,
    // Bubble Pop
    targets: [] as PopTarget[],
    spawnTimer: 0.2,
    nextId: 1,
    // Lane Dodge
    playerLane: 1,
    playerVisualX: 0.5,
    runnerItems: [] as RunnerItem[],
    runnerSpawnTimer: 0.35,
    roadOffset: 0,
    // Tower Stack
    stack: [{ x: 0.25, w: 0.5, color: STACK_COLORS[0] }] as StackLayer[],
    movingBlock: { x: 0.1, w: 0.5, dir: 1, speed: 0.85, colorIdx: 1 },
    fallingPieces: [] as Array<{ x: number; y: number; w: number; vy: number; color: string }>,
    // Snake Dash (16x10 grid)
    snake: [
      { x: 8, y: 5 },
      { x: 7, y: 5 },
      { x: 6, y: 5 },
    ] as Array<{ x: number; y: number }>,
    snakeDir: { dx: 1, dy: 0 },
    snakeStepTimer: 0,
    snakeFood: { x: 12, y: 5, gold: false },
    // Brick Breaker
    paddleX: 0.5,
    ball: { x: 0.5, y: 0.72, vx: 0.44, vy: -0.62 },
    bricks: [] as Array<{ row: number; col: number; alive: boolean; color: string; hp: number }>,
    // Rhythm Tap
    rhythmNotes: [] as Array<{ lane: number; y: number; color: string }>,
    rhythmSpawnTimer: 0.25,
    laneFlash: [0, 0, 0],
  });

  // Reset internal simulation when gameType changes or round restarts
  useEffect(() => {
    const s = simRef.current;
    s.particles = [];
    s.texts = [];
    s.shake = 0;
    s.targets = [];
    s.spawnTimer = 0.15;
    s.playerLane = 1;
    s.playerVisualX = 0.5;
    s.runnerItems = [];
    s.runnerSpawnTimer = 0.25;
    s.stack = [{ x: 0.25, w: 0.5, color: STACK_COLORS[0] }];
    s.movingBlock = { x: 0.05, w: 0.5, dir: 1, speed: 0.85, colorIdx: 1 };
    s.fallingPieces = [];
    s.snake = [
      { x: 8, y: 5 },
      { x: 7, y: 5 },
      { x: 6, y: 5 },
    ];
    s.snakeDir = { dx: 1, dy: 0 };
    s.snakeStepTimer = 0;
    s.snakeFood = { x: 12, y: 5, gold: false };
    s.paddleX = 0.5;
    s.ball = { x: 0.5, y: 0.72, vx: 0.44, vy: -0.62 };
    s.bricks = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 7; c++) {
        s.bricks.push({
          row: r,
          col: c,
          alive: true,
          color: STACK_COLORS[(r + c) % STACK_COLORS.length],
          hp: r === 0 ? 2 : 1,
        });
      }
    }
    s.rhythmNotes = [];
    s.rhythmSpawnTimer = 0.25;
    s.laneFlash = [0, 0, 0];
  }, [gameType, isActive]);

  // Helper to spawn particles
  const emitParticles = (x: number, y: number, color: string, count = 8) => {
    const s = simRef.current;
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 45 + Math.random() * 90;
      s.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.45,
        color,
        size: 2.5 + Math.random() * 2.5,
      });
    }
  };

  const addFloatText = (x: number, y: number, text: string, color: string) => {
    simRef.current.texts.push({ x, y, text, color, life: 0.65 });
  };

  const handleCanvasTap = (clientX: number, clientY: number) => {
    if (!isVisibleRef.current || !isActiveRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const s = simRef.current;

    if (gameTypeRef.current === MiniGameType.BUBBLE_POP) {
      let hitIdx = -1;
      for (let i = s.targets.length - 1; i >= 0; i--) {
        const t = s.targets[i];
        const dist = Math.hypot(x - t.x * w, y - t.y * h);
        if (dist <= t.r + 14) {
          hitIdx = i;
          break;
        }
      }
      if (hitIdx >= 0) {
        const t = s.targets[hitIdx];
        s.targets.splice(hitIdx, 1);
        const px = t.x * w;
        const py = t.y * h;
        if (t.kind === 'bomb') {
          s.shake = 0.25;
          emitParticles(px, py, '#ef4444', 12);
          addFloatText(px, py, '-20', '#f87171');
          scoreGainRef.current(-20, 0, 'miss');
        } else {
          const nextCombo = comboRef.current + 1;
          const mult = 1 + Math.min(4, Math.floor(nextCombo / 3)) * 0.5;
          const base = t.kind === 'gold' ? 35 : 16;
          const pts = Math.round(base * mult);
          emitParticles(px, py, t.kind === 'gold' ? '#fbbf24' : '#34d399', 10);
          addFloatText(px, py, `+${pts}`, t.kind === 'gold' ? '#fde047' : '#6ee7b7');
          scoreGainRef.current(pts, nextCombo, 'pop');
        }
      } else {
        // Missed tap breaks combo softly
        emitParticles(x, y, '#64748b', 4);
        if (comboRef.current > 0) {
          scoreGainRef.current(0, 0, 'miss');
        }
      }
    } else if (gameTypeRef.current === MiniGameType.LANE_DODGE) {
      if (x < w * 0.5) {
        s.playerLane = Math.max(0, s.playerLane - 1);
      } else {
        s.playerLane = Math.min(2, s.playerLane + 1);
      }
      soundEngine.playTone(340 + s.playerLane * 70, 0.04, 'sine', 0.04);
    } else if (gameTypeRef.current === MiniGameType.TOWER_STACK) {
      const top = s.stack[s.stack.length - 1];
      const cur = s.movingBlock;
      const overlapStart = Math.max(top.x, cur.x);
      const overlapEnd = Math.min(top.x + top.w, cur.x + cur.w);
      const overlapW = overlapEnd - overlapStart;

      const blockH = 22;
      const visibleCount = Math.min(s.stack.length, 6);
      const topScreenY = h - 34 - visibleCount * blockH;

      if (overlapW <= 0.02) {
        // Complete miss: drop piece and reset width
        s.fallingPieces.push({
          x: cur.x,
          y: topScreenY,
          w: cur.w,
          vy: 20,
          color: STACK_COLORS[cur.colorIdx % STACK_COLORS.length],
        });
        s.shake = 0.22;
        addFloatText(w * 0.5, topScreenY - 12, 'MISS!', '#f87171');
        scoreGainRef.current(0, 0, 'miss');
        s.movingBlock = {
          x: 0.05,
          w: Math.max(0.28, top.w),
          dir: 1,
          speed: 0.85,
          colorIdx: cur.colorIdx + 1,
        };
      } else {
        const diff = Math.abs(cur.x - top.x);
        const isPerfect = diff < 0.032;
        const placedX = isPerfect ? top.x : overlapStart;
        const placedW = isPerfect ? top.w : overlapW;
        const color = STACK_COLORS[cur.colorIdx % STACK_COLORS.length];

        if (!isPerfect) {
          const cutLeft = cur.x < top.x;
          const cutX = cutLeft ? cur.x : top.x + top.w;
          const cutW = cur.w - placedW;
          if (cutW > 0.005) {
            s.fallingPieces.push({
              x: cutX,
              y: topScreenY,
              w: cutW,
              vy: 15,
              color,
            });
          }
        }

        s.stack.push({ x: placedX, w: placedW, color });
        if (s.stack.length > 18) {
          s.stack.shift();
        }

        const nextCombo = isPerfect ? comboRef.current + 1 : 1;
        const pts = isPerfect ? 30 + nextCombo * 8 : 14;
        const centerPx = (placedX + placedW * 0.5) * w;
        emitParticles(centerPx, topScreenY, isPerfect ? '#fde047' : color, isPerfect ? 12 : 6);
        addFloatText(centerPx, topScreenY - 14, isPerfect ? `PERFECT +${pts}` : `+${pts}`, isPerfect ? '#fde047' : '#f8fafc');
        scoreGainRef.current(pts, nextCombo, 'stack');

        const nextW = placedW < 0.14 ? 0.32 : placedW;
        const nextSpeed = Math.min(1.65, 0.88 + s.stack.length * 0.035);
        s.movingBlock = {
          x: cur.dir > 0 ? 0.02 : 0.98 - nextW,
          w: nextW,
          dir: cur.dir > 0 ? -1 : 1,
          speed: nextSpeed,
          colorIdx: cur.colorIdx + 1,
        };
      }
    } else if (gameTypeRef.current === MiniGameType.SNAKE_DASH) {
      // Turn 90 deg counter-clockwise on left tap, clockwise on right tap
      const { dx, dy } = s.snakeDir;
      if (x < w * 0.5) {
        s.snakeDir = { dx: dy, dy: -dx };
      } else {
        s.snakeDir = { dx: -dy, dy: dx };
      }
      soundEngine.playTone(420, 0.035, 'sine', 0.04);
    } else if (gameTypeRef.current === MiniGameType.BRICK_BREAKER) {
      s.paddleX = Math.max(0.14, Math.min(0.86, x / w));
    } else if (gameTypeRef.current === MiniGameType.RHYTHM_TAP) {
      const lane = x < w / 3 ? 0 : x < (w * 2) / 3 ? 1 : 2;
      s.laneFlash[lane] = 0.18;
      const hitLineY = h - 38;
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < s.rhythmNotes.length; i++) {
        const n = s.rhythmNotes[i];
        if (n.lane === lane) {
          const dist = Math.abs(n.y - hitLineY);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        }
      }
      const laneX = ((lane + 0.5) / 3) * w;
      if (bestIdx >= 0 && bestDist <= 34) {
        s.rhythmNotes.splice(bestIdx, 1);
        const isPerfect = bestDist <= 16;
        const nextCombo = comboRef.current + 1;
        const pts = (isPerfect ? 32 : 18) + Math.min(24, nextCombo * 2);
        emitParticles(laneX, hitLineY, isPerfect ? '#fde047' : '#38bdf8', isPerfect ? 10 : 6);
        addFloatText(laneX, hitLineY - 14, isPerfect ? `PERFECT +${pts}` : `GOOD +${pts}`, isPerfect ? '#fde047' : '#7dd3fc');
        scoreGainRef.current(pts, nextCombo, 'pop');
      } else {
        addFloatText(laneX, hitLineY - 10, 'MISS', '#f87171');
        if (comboRef.current > 0) {
          scoreGainRef.current(0, 0, 'miss');
        }
      }
    }
  };

  const handleCanvasMove = (clientX: number) => {
    if (!isVisibleRef.current || !isActiveRef.current) return;
    if (gameTypeRef.current !== MiniGameType.BRICK_BREAKER) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width);
    simRef.current.paddleX = Math.max(0.14, Math.min(0.86, nx));
  };

  // Keyboard support for desktop mini-game testing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isVisibleRef.current || !isActiveRef.current) return;
      const s = simRef.current;
      const key = e.key.toLowerCase();

      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
      }

      if (gameTypeRef.current === MiniGameType.LANE_DODGE) {
        if (e.key === 'ArrowLeft' || key === 'a') {
          s.playerLane = Math.max(0, s.playerLane - 1);
        } else if (e.key === 'ArrowRight' || key === 'd') {
          s.playerLane = Math.min(2, s.playerLane + 1);
        }
      } else if (gameTypeRef.current === MiniGameType.TOWER_STACK) {
        if (e.key === 'Enter' || key === 'j' || key === 'k') {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            handleCanvasTap(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5);
          }
        }
      } else if (gameTypeRef.current === MiniGameType.SNAKE_DASH) {
        if ((e.key === 'ArrowLeft' || key === 'a') && s.snakeDir.dx !== 1) s.snakeDir = { dx: -1, dy: 0 };
        else if ((e.key === 'ArrowRight' || key === 'd') && s.snakeDir.dx !== -1) s.snakeDir = { dx: 1, dy: 0 };
        else if ((e.key === 'ArrowUp' || key === 'w') && s.snakeDir.dy !== 1) s.snakeDir = { dx: 0, dy: -1 };
        else if ((e.key === 'ArrowDown' || key === 's') && s.snakeDir.dy !== -1) s.snakeDir = { dx: 0, dy: 1 };
      } else if (gameTypeRef.current === MiniGameType.BRICK_BREAKER) {
        if (e.key === 'ArrowLeft' || key === 'a') s.paddleX = Math.max(0.14, s.paddleX - 0.1);
        else if (e.key === 'ArrowRight' || key === 'd') s.paddleX = Math.min(0.86, s.paddleX + 0.1);
      } else if (gameTypeRef.current === MiniGameType.RHYTHM_TAP) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (e.key === '1' || key === 'a' || e.key === 'ArrowLeft') {
          handleCanvasTap(rect.left + rect.width * 0.16, rect.top + rect.height * 0.8);
        } else if (e.key === '2' || key === 'w' || key === 'ArrowUp') {
          handleCanvasTap(rect.left + rect.width * 0.5, rect.top + rect.height * 0.8);
        } else if (e.key === '3' || key === 'd' || e.key === 'ArrowRight') {
          handleCanvasTap(rect.left + rect.width * 0.84, rect.top + rect.height * 0.8);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Main 60fps Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();

    const renderLoop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth || 320;
      const ch = canvas.clientHeight || 220;
      if (canvas.width !== Math.floor(cw * dpr) || canvas.height !== Math.floor(ch * dpr)) {
        canvas.width = Math.floor(cw * dpr);
        canvas.height = Math.floor(ch * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const s = simRef.current;
      const running = isVisibleRef.current && isActiveRef.current;

      if (s.shake > 0) {
        s.shake = Math.max(0, s.shake - dt);
        const mag = s.shake * 18;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      // Background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, cw, ch);

      // Subtle arcade grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < cw; gx += 32) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, ch);
        ctx.stroke();
      }
      for (let gy = 0; gy < ch; gy += 32) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(cw, gy);
        ctx.stroke();
      }

      const mode = gameTypeRef.current;

      if (mode === MiniGameType.BUBBLE_POP) {
        if (running) {
          s.spawnTimer -= dt;
          if (s.spawnTimer <= 0 && s.targets.length < 5) {
            const rRoll = Math.random();
            const kind: PopTarget['kind'] =
              rRoll < 0.2 ? 'bomb' : rRoll < 0.42 ? 'gold' : 'normal';
            s.targets.push({
              id: s.nextId++,
              x: 0.14 + Math.random() * 0.72,
              y: 0.18 + Math.random() * 0.64,
              r: kind === 'gold' ? 20 : 25,
              kind,
              life: kind === 'gold' ? 1.45 : 1.95,
              maxLife: kind === 'gold' ? 1.45 : 1.95,
            });
            s.spawnTimer = 0.44 + Math.random() * 0.26;
          }
          for (let i = s.targets.length - 1; i >= 0; i--) {
            s.targets[i].life -= dt;
            if (s.targets[i].life <= 0) {
              s.targets.splice(i, 1);
            }
          }
        }

        for (const t of s.targets) {
          const px = t.x * cw;
          const py = t.y * ch;
          const ratio = Math.max(0, t.life / t.maxLife);
          const scale = 0.75 + Math.sin((1 - ratio) * Math.PI) * 0.28;
          const rad = t.r * scale;

          ctx.beginPath();
          ctx.arc(px, py, rad + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
          ctx.strokeStyle =
            t.kind === 'bomb' ? '#ef4444' : t.kind === 'gold' ? '#fbbf24' : '#34d399';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(px, py, rad, 0, Math.PI * 2);
          ctx.fillStyle =
            t.kind === 'bomb'
              ? 'rgba(220, 38, 38, 0.92)'
              : t.kind === 'gold'
                ? 'rgba(245, 158, 11, 0.92)'
                : 'rgba(16, 185, 129, 0.9)';
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px "Outfit", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(t.kind === 'bomb' ? 'X' : t.kind === 'gold' ? '★' : 'TAP', px, py + 1);
        }
      } else if (mode === MiniGameType.LANE_DODGE) {
        const laneCenters = [0.2, 0.5, 0.8];
        if (running) {
          s.roadOffset = (s.roadOffset + dt * 240) % 40;
          s.playerVisualX += (laneCenters[s.playerLane] - s.playerVisualX) * Math.min(1, dt * 16);

          s.runnerSpawnTimer -= dt;
          if (s.runnerSpawnTimer <= 0) {
            const lane = Math.floor(Math.random() * 3);
            const roll = Math.random();
            const kind: RunnerItem['kind'] =
              roll < 0.36 ? 'barrier' : roll < 0.56 ? 'gem' : 'coin';
            s.runnerItems.push({ lane, y: -20, kind });
            s.runnerSpawnTimer = 0.36 + Math.random() * 0.22;
          }

          const playerY = ch - 42;
          for (let i = s.runnerItems.length - 1; i >= 0; i--) {
            const item = s.runnerItems[i];
            item.y += dt * 195;
            const ix = laneCenters[item.lane] * cw;
            const px = s.playerVisualX * cw;
            if (Math.abs(item.y - playerY) < 22 && Math.abs(ix - px) < 28) {
              s.runnerItems.splice(i, 1);
              if (item.kind === 'barrier') {
                s.shake = 0.24;
                emitParticles(px, playerY, '#ef4444', 10);
                addFloatText(px, playerY - 14, '-15', '#f87171');
                scoreGainRef.current(-15, 0, 'miss');
              } else {
                const nextCombo = comboRef.current + 1;
                const pts = (item.kind === 'gem' ? 35 : 18) + Math.min(25, nextCombo * 3);
                emitParticles(px, playerY, item.kind === 'gem' ? '#38bdf8' : '#fbbf24', 8);
                addFloatText(px, playerY - 14, `+${pts}`, item.kind === 'gem' ? '#7dd3fc' : '#fde047');
                scoreGainRef.current(pts, nextCombo, 'coin');
              }
              continue;
            }
            if (item.y > ch + 28) {
              s.runnerItems.splice(i, 1);
            }
          }
        }

        // Dashed lane dividers
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 2;
        ctx.setLineDash([16, 24]);
        ctx.lineDashOffset = -s.roadOffset;
        for (const divX of [cw * 0.35, cw * 0.65]) {
          ctx.beginPath();
          ctx.moveTo(divX, 0);
          ctx.lineTo(divX, ch);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // Items
        for (const item of s.runnerItems) {
          const ix = laneCenters[item.lane] * cw;
          if (item.kind === 'barrier') {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.roundRect(ix - 22, item.y - 10, 44, 20, 5);
            ctx.fill();
            ctx.fillStyle = '#fecaca';
            ctx.font = 'bold 11px "Outfit", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('STOP', ix, item.y + 1);
          } else {
            ctx.beginPath();
            ctx.arc(ix, item.y, item.kind === 'gem' ? 12 : 10, 0, Math.PI * 2);
            ctx.fillStyle = item.kind === 'gem' ? '#38bdf8' : '#fbbf24';
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 11px "Outfit", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.kind === 'gem' ? '◆' : '$', ix, item.y + 1);
          }
        }

        // Player craft
        const px = s.playerVisualX * cw;
        const py = ch - 42;
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(px, py - 16);
        ctx.lineTo(px + 16, py + 14);
        ctx.lineTo(px, py + 8);
        ctx.lineTo(px - 16, py + 14);
        ctx.closePath();
        ctx.fill();
      } else if (mode === MiniGameType.TOWER_STACK) {
        const blockH = 22;
        const baseY = ch - 34;

        if (running) {
          const mb = s.movingBlock;
          mb.x += mb.dir * mb.speed * dt;
          if (mb.x + mb.w >= 0.98) {
            mb.x = 0.98 - mb.w;
            mb.dir = -1;
          } else if (mb.x <= 0.02) {
            mb.x = 0.02;
            mb.dir = 1;
          }
          for (let i = s.fallingPieces.length - 1; i >= 0; i--) {
            s.fallingPieces[i].vy += 420 * dt;
            s.fallingPieces[i].y += s.fallingPieces[i].vy * dt;
            if (s.fallingPieces[i].y > ch + 40) {
              s.fallingPieces.splice(i, 1);
            }
          }
        }

        const visibleLayers = s.stack.slice(-6);
        visibleLayers.forEach((layer, idx) => {
          const ly = baseY - idx * blockH;
          ctx.fillStyle = layer.color;
          ctx.beginPath();
          ctx.roundRect(layer.x * cw, ly, layer.w * cw, blockH - 2, 4);
          ctx.fill();
        });

        const mb = s.movingBlock;
        const activeY = baseY - visibleLayers.length * blockH;
        ctx.fillStyle = STACK_COLORS[mb.colorIdx % STACK_COLORS.length];
        ctx.beginPath();
        ctx.roundRect(mb.x * cw, activeY, mb.w * cw, blockH - 2, 4);
        ctx.fill();

        for (const fp of s.fallingPieces) {
          ctx.fillStyle = fp.color;
          ctx.fillRect(fp.x * cw, fp.y, fp.w * cw, blockH - 2);
        }
      } else if (mode === MiniGameType.SNAKE_DASH) {
        const cols = 16;
        const rows = 10;
        const cellW = cw / cols;
        const cellH = ch / rows;

        if (running) {
          s.snakeStepTimer += dt;
          if (s.snakeStepTimer >= 0.15) {
            s.snakeStepTimer = 0;
            const head = s.snake[0];
            const nx = (head.x + s.snakeDir.dx + cols) % cols;
            const ny = (head.y + s.snakeDir.dy + rows) % rows;

            const hitSelf = s.snake.some((seg, idx) => idx > 0 && seg.x === nx && seg.y === ny);
            if (hitSelf) {
              s.shake = 0.2;
              s.snake = [
                { x: nx, y: ny },
                { x: (nx - s.snakeDir.dx + cols) % cols, y: (ny - s.snakeDir.dy + rows) % rows },
                { x: (nx - s.snakeDir.dx * 2 + cols) % cols, y: (ny - s.snakeDir.dy * 2 + rows) % rows },
              ];
              addFloatText((nx + 0.5) * cellW, (ny + 0.5) * cellH, '-10', '#f87171');
              scoreGainRef.current(-10, 0, 'miss');
            } else {
              s.snake.unshift({ x: nx, y: ny });
              if (nx === s.snakeFood.x && ny === s.snakeFood.y) {
                const nextCombo = comboRef.current + 1;
                const pts = (s.snakeFood.gold ? 45 : 24) + Math.min(24, nextCombo * 3);
                const fx = (nx + 0.5) * cellW;
                const fy = (ny + 0.5) * cellH;
                emitParticles(fx, fy, s.snakeFood.gold ? '#fbbf24' : '#34d399', 10);
                addFloatText(fx, fy - 10, `+${pts}`, s.snakeFood.gold ? '#fde047' : '#6ee7b7');
                scoreGainRef.current(pts, nextCombo, 'coin');
                s.snakeFood = {
                  x: Math.floor(Math.random() * cols),
                  y: Math.floor(Math.random() * rows),
                  gold: Math.random() < 0.28,
                };
              } else {
                s.snake.pop();
              }
            }
          }
        }

        // Draw Food
        const foodX = (s.snakeFood.x + 0.5) * cellW;
        const foodY = (s.snakeFood.y + 0.5) * cellH;
        ctx.beginPath();
        ctx.arc(foodX, foodY, Math.min(cellW, cellH) * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = s.snakeFood.gold ? '#fbbf24' : '#34d399';
        ctx.fill();

        // Draw Snake
        s.snake.forEach((seg, idx) => {
          ctx.fillStyle = idx === 0 ? '#38bdf8' : '#0ea5e9';
          ctx.beginPath();
          ctx.roundRect(seg.x * cellW + 2, seg.y * cellH + 2, cellW - 4, cellH - 4, 5);
          ctx.fill();
        });
      } else if (mode === MiniGameType.BRICK_BREAKER) {
        const cols = 7;
        const brickPad = 4;
        const brickW = (cw - brickPad * (cols + 1)) / cols;
        const brickH = 15;
        const paddleW = cw * 0.25;
        const paddleH = 11;
        const paddleY = ch - 24;

        if (running) {
          const b = s.ball;
          b.x += b.vx * dt;
          b.y += b.vy * dt;

          if (b.x <= 0.025) {
            b.x = 0.025;
            b.vx = Math.abs(b.vx);
          } else if (b.x >= 0.975) {
            b.x = 0.975;
            b.vx = -Math.abs(b.vx);
          }
          if (b.y <= 0.035) {
            b.y = 0.035;
            b.vy = Math.abs(b.vy);
          }

          // Paddle collision
          const pxCenter = s.paddleX * cw;
          const bx = b.x * cw;
          const by = b.y * ch;
          if (b.vy > 0 && by >= paddleY - 6 && by <= paddleY + 10 && Math.abs(bx - pxCenter) <= paddleW * 0.55) {
            b.vy = -Math.abs(b.vy);
            const hitOffset = (bx - pxCenter) / (paddleW * 0.5);
            b.vx = hitOffset * 0.68;
            soundEngine.playTone(380, 0.04, 'triangle', 0.04);
          }

          // Brick collision
          for (const br of s.bricks) {
            if (!br.alive) continue;
            const rx = brickPad + br.col * (brickW + brickPad);
            const ry = 14 + br.row * (brickH + brickPad);
            if (bx >= rx - 5 && bx <= rx + brickW + 5 && by >= ry - 5 && by <= ry + brickH + 5) {
              br.hp -= 1;
              b.vy = -b.vy;
              if (br.hp <= 0) {
                br.alive = false;
                const nextCombo = comboRef.current + 1;
                const pts = 18 + Math.min(25, nextCombo * 2);
                emitParticles(rx + brickW * 0.5, ry + brickH * 0.5, br.color, 7);
                addFloatText(rx + brickW * 0.5, ry, `+${pts}`, '#fde047');
                scoreGainRef.current(pts, nextCombo, 'pop');
              } else {
                soundEngine.playTone(520, 0.04, 'sine', 0.04);
              }
              break;
            }
          }

          // Wave clear check
          if (s.bricks.every((br) => !br.alive)) {
            addFloatText(cw * 0.5, ch * 0.5, 'CLEAR +60!', '#6ee7b7');
            scoreGainRef.current(60, comboRef.current + 2, 'coin');
            for (const br of s.bricks) {
              br.alive = true;
              br.hp = br.row === 0 ? 2 : 1;
            }
          }

          // Ball fell below paddle
          if (b.y > 1.04) {
            s.shake = 0.2;
            b.x = s.paddleX;
            b.y = 0.72;
            b.vx = (Math.random() > 0.5 ? 1 : -1) * 0.42;
            b.vy = -0.62;
            addFloatText(cw * 0.5, paddleY - 18, '-10', '#f87171');
            scoreGainRef.current(-10, 0, 'miss');
          }
        }

        // Render Bricks
        for (const br of s.bricks) {
          if (!br.alive) continue;
          const rx = brickPad + br.col * (brickW + brickPad);
          const ry = 14 + br.row * (brickH + brickPad);
          ctx.fillStyle = br.color;
          ctx.globalAlpha = br.hp > 1 ? 1 : 0.85;
          ctx.beginPath();
          ctx.roundRect(rx, ry, brickW, brickH, 4);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Render Paddle
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(s.paddleX * cw - paddleW * 0.5, paddleY, paddleW, paddleH, 5);
        ctx.fill();

        // Render Ball
        ctx.beginPath();
        ctx.arc(s.ball.x * cw, s.ball.y * ch, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fef08a';
        ctx.fill();
      } else if (mode === MiniGameType.RHYTHM_TAP) {
        const hitLineY = ch - 38;
        const laneColors = ['#38bdf8', '#34d399', '#f472b6'];

        if (running) {
          s.rhythmSpawnTimer -= dt;
          if (s.rhythmSpawnTimer <= 0) {
            const lane = Math.floor(Math.random() * 3);
            s.rhythmNotes.push({ lane, y: -14, color: laneColors[lane] });
            s.rhythmSpawnTimer = 0.34 + Math.random() * 0.22;
          }

          for (let i = 0; i < 3; i++) {
            s.laneFlash[i] = Math.max(0, s.laneFlash[i] - dt);
          }

          for (let i = s.rhythmNotes.length - 1; i >= 0; i--) {
            const n = s.rhythmNotes[i];
            n.y += dt * 165;
            if (n.y > ch + 18) {
              s.rhythmNotes.splice(i, 1);
              if (comboRef.current > 0) {
                scoreGainRef.current(0, 0, 'miss');
              }
            }
          }
        }

        // Lane dividers & receptor flash
        for (let i = 0; i < 3; i++) {
          const lx = (i / 3) * cw;
          const lw = cw / 3;
          if (s.laneFlash[i] > 0) {
            ctx.fillStyle = laneColors[i];
            ctx.globalAlpha = (s.laneFlash[i] / 0.18) * 0.22;
            ctx.fillRect(lx, 0, lw, ch);
            ctx.globalAlpha = 1;
          }
          if (i > 0) {
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
            ctx.beginPath();
            ctx.moveTo(lx, 0);
            ctx.lineTo(lx, ch);
            ctx.stroke();
          }
          ctx.strokeStyle = laneColors[i];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(lx + 10, hitLineY - 12, lw - 20, 24, 6);
          ctx.stroke();
        }

        // Notes
        for (const n of s.rhythmNotes) {
          const lx = (n.lane / 3) * cw + 12;
          const nw = cw / 3 - 24;
          ctx.fillStyle = n.color;
          ctx.beginPath();
          ctx.roundRect(lx, n.y - 9, nw, 18, 5);
          ctx.fill();
        }
      }

      // Particles & Floating Texts
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        if (running) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        if (p.life <= 0) {
          s.particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, p.life / 0.45);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (let i = s.texts.length - 1; i >= 0; i--) {
        const ft = s.texts[i];
        if (running) {
          ft.life -= dt;
          ft.y -= 34 * dt;
        }
        if (ft.life <= 0) {
          s.texts.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, ft.life / 0.65);
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 14px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;

      ctx.restore();
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const progressPct = Math.min(100, Math.round((score / Math.max(1, targetScore)) * 100));

  return (
    <div
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-[420px] px-3 pb-2 pointer-events-none"
      style={{
        transform: isVisible
          ? 'translate(-50%, 0)'
          : 'translate(-50%, 108%)',
        transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        className="pointer-events-auto rounded-t-3xl rounded-b-2xl bg-stone-950 border-2 border-stone-700 shadow-2xl overflow-hidden"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStartYRef.current = t.clientY;
          touchStartXRef.current = t.clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartYRef.current !== null && e.changedTouches[0]) {
            const dy = e.changedTouches[0].clientY - touchStartYRef.current;
            const dx = e.changedTouches[0].clientX - (touchStartXRef.current ?? 0);
            if (dy > 52 && Math.abs(dy) > Math.abs(dx) * 1.3) {
              onHidePhone();
            }
          }
          touchStartYRef.current = null;
          touchStartXRef.current = null;
        }}
      >
        {/* Top Phone Bezel + Quick Hide Handle */}
        <div className="flex items-center justify-between px-4 py-2 bg-stone-900 border-b border-stone-800">
          <div className="flex items-center gap-2 min-w-0">
            <Gamepad2 className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-xs font-semibold text-stone-100 whitespace-nowrap truncate">
              {gameType === MiniGameType.BUBBLE_POP && '터치 팝!'}
              {gameType === MiniGameType.LANE_DODGE && '네온 러너'}
              {gameType === MiniGameType.TOWER_STACK && '타워 스택'}
              {gameType === MiniGameType.SNAKE_DASH && '스네이크 대시'}
              {gameType === MiniGameType.BRICK_BREAKER && '브릭 브레이커'}
              {gameType === MiniGameType.RHYTHM_TAP && '비트 탭'}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono-num text-xs font-bold text-amber-300">
              {score.toLocaleString()} / {targetScore.toLocaleString()}
            </span>
            {combo > 1 && (
              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-400 font-mono-num">
                <Zap className="w-3 h-3" />
                {combo}x
              </span>
            )}
          </div>
        </div>

        {/* Target Score Micro Progress */}
        <div className="h-1 w-full bg-stone-800">
          <div
            className="h-full bg-sky-400"
            style={{
              width: `${progressPct}%`,
              transition: 'width 140ms ease-out',
            }}
          />
        </div>

        {/* Interactive Mini-Game Canvas */}
        <div className="relative w-full h-[196px] sm:h-[220px] bg-stone-950">
          <canvas
            ref={canvasRef}
            className="w-full h-full block cursor-pointer touch-none"
            onPointerDown={(e) => {
              e.stopPropagation();
              handleCanvasTap(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0 || e.pointerType === 'touch') {
                handleCanvasMove(e.clientX);
              }
            }}
          />
        </div>

        {/* Bottom Thumb-Zone Panic Hide Bar */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onHidePhone();
          }}
          className="w-full min-h-[46px] px-4 py-2.5 bg-stone-900 hover:bg-stone-800 active:bg-stone-700 border-t border-stone-800 flex items-center justify-center gap-2 text-sm font-bold text-stone-100 transition-colors cursor-pointer"
        >
          <ChevronDown className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="whitespace-nowrap">폰 숨기고 책 보는 척하기</span>
          <span className="hidden sm:inline text-xs font-normal text-stone-400 whitespace-nowrap">
            (Space)
          </span>
        </button>
      </div>
    </div>
  );
};
