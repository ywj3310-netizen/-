import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { GameHUD } from './components/GameHUD';
import { PhoneMiniGame } from './components/PhoneMiniGame';
import { ResultModal } from './components/ResultModal';
import { StartModal } from './components/StartModal';
import { ClassroomSceneController } from './three/ClassroomScene';
import {
  ClassmateEvent,
  GamePhase,
  GradeRank,
  MiniGameType,
  ProfessorState,
  RunResult,
  STAGES,
  StageConfig,
} from './types/game';

const STUDENT_SEAT_LABELS = [
  '앞줄 왼쪽 창가 학생',
  '앞줄 왼쪽 복도 학생',
  '앞줄 오른쪽 복도 학생',
  '앞줄 오른쪽 끝 학생',
  '둘째 줄 왼쪽 창가 학생',
  '둘째 줄 왼쪽 복도 학생',
  '둘째 줄 바로 앞 학생',
  '둘째 줄 오른쪽 학생',
];

const SCOLD_MESSAGES = [
  '지금 수업 중에 게임하는 소리 다 들렸어!',
  '책상 밑에서 뭐 보는 거야? 이리 내!',
  '고개 숙이고 딴짓하는 거 다 보입니다!',
  '강의 시간에 몰폰하다 적발되었습니다!',
];

const STORAGE_KEY = 'lecture_stealth_best_v1';

function loadBestScores(): Record<number, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<number, number>;
  } catch {
    return {};
  }
}

function saveBestScores(scores: Record<number, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // Ignore storage quota errors
  }
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ClassroomSceneController | null>(null);

  const [selectedStage, setSelectedStage] = useState<StageConfig>(STAGES[0]);
  const [selectedMiniGame, setSelectedMiniGame] = useState<MiniGameType>(MiniGameType.BUBBLE_POP);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.MENU);
  const [bestScores, setBestScores] = useState<Record<number, number>>(() => loadBestScores());

  // Reactive HUD states
  const [professorState, setProfessorState] = useState<ProfessorState>(ProfessorState.WRITING);
  const [suspicion, setSuspicion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(STAGES[0].durationSec);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isPhoneVisible, setIsPhoneVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [closeCallNotice, setCloseCallNotice] = useState<number | null>(null);
  const [classmateEvent, setClassmateEvent] = useState<ClassmateEvent | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  // Mutable loop refs so Three.js & rAF never tear down
  const simRef = useRef({
    phase: GamePhase.MENU,
    stage: STAGES[0],
    profState: ProfessorState.WRITING,
    stateTimer: 4.0,
    suspicion: 0,
    timeRemaining: STAGES[0].durationSec,
    score: 0,
    combo: 0,
    maxCombo: 0,
    closeCalls: 0,
    othersCaught: 0,
    closeCallUsedThisCycle: false,
    isPhoneVisible: true,
    aisleWalkProgress: 0,
    willWalkAisle: false,
    scanDuration: 2.5,
    scanElapsed: 0,
    sneakingStudentIndex: null as number | null,
    caughtStudentIndex: null as number | null,
  });

  // Pointer drag tracking on 3D classroom viewport
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    movedDist: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    movedDist: 0,
  });

  // Mount Three.js scene once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;
    const ctrl = new ClassroomSceneController(mount, selectedStage);
    sceneRef.current = ctrl;
    return () => {
      ctrl.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Update chalkboard when selectedStage changes
  useEffect(() => {
    sceneRef.current?.updateStageChalkboard(selectedStage);
  }, [selectedStage]);

  const finishRun = useCallback(
    (cleared: boolean, reason?: string) => {
      const s = simRef.current;
      if (s.phase !== GamePhase.PLAYING) return;

      const nextPhase = cleared ? GamePhase.CLEARED : GamePhase.CAUGHT;
      s.phase = nextPhase;
      s.isPhoneVisible = false;
      setIsPhoneVisible(false);
      setPhase(nextPhase);

      let grade: GradeRank = 'F';
      if (cleared) {
        if (s.score >= s.stage.aPlusScore) grade = 'A+';
        else if (s.score >= s.stage.targetScore * 1.45) grade = 'A';
        else if (s.score >= s.stage.targetScore * 1.28) grade = 'B+';
        else if (s.score >= s.stage.targetScore * 1.12) grade = 'B';
        else if (s.score >= s.stage.targetScore * 1.04) grade = 'C+';
        else if (s.score >= s.stage.targetScore) grade = 'C';
      }

      if (cleared && grade !== 'F') {
        soundEngine.playBellClear();
        navigator.vibrate?.([60, 40, 80]);
      } else {
        soundEngine.playCaught();
        navigator.vibrate?.([140, 50, 200]);
      }

      if (s.score > (bestScores[s.stage.id] ?? 0)) {
        const updated = { ...bestScores, [s.stage.id]: s.score };
        setBestScores(updated);
        saveBestScores(updated);
      }

      setResult({
        cleared: cleared && grade !== 'F',
        score: s.score,
        maxCombo: s.maxCombo,
        closeCalls: s.closeCalls,
        othersCaught: s.othersCaught,
        grade,
        stageId: s.stage.id,
        miniGame: selectedMiniGame,
        reason,
      });
    },
    [bestScores, selectedMiniGame],
  );

  const startStage = useCallback(
    (stageToStart: StageConfig) => {
      soundEngine.unlock();
      sceneRef.current?.updateStageChalkboard(stageToStart);
      sceneRef.current?.resetCameraLook();

      const s = simRef.current;
      s.phase = GamePhase.PLAYING;
      s.stage = stageToStart;
      s.profState = ProfessorState.WRITING;
      s.stateTimer = randRange(stageToStart.writeMinSec, stageToStart.writeMaxSec);
      s.suspicion = 0;
      s.timeRemaining = stageToStart.durationSec;
      s.score = 0;
      s.combo = 0;
      s.maxCombo = 0;
      s.closeCalls = 0;
      s.othersCaught = 0;
      s.closeCallUsedThisCycle = false;
      s.isPhoneVisible = true;
      s.aisleWalkProgress = 0;
      s.willWalkAisle = false;
      s.scanElapsed = 0;
      s.sneakingStudentIndex = Math.random() < 0.7 ? Math.floor(Math.random() * 8) : null;
      s.caughtStudentIndex = null;

      setProfessorState(ProfessorState.WRITING);
      setSuspicion(0);
      setTimeRemaining(stageToStart.durationSec);
      setScore(0);
      setCombo(0);
      setIsPhoneVisible(true);
      setCloseCallNotice(null);
      setClassmateEvent(null);
      setResult(null);
      setPhase(GamePhase.PLAYING);
    },
    [],
  );

  const hidePhone = useCallback(() => {
    const s = simRef.current;
    if (s.phase !== GamePhase.PLAYING || !s.isPhoneVisible) return;

    s.isPhoneVisible = false;
    setIsPhoneVisible(false);
    soundEngine.playHidePhone();

    // Check Close-Call bonus if hidden right during Warning / Fakeout / very start of Scan
    const isCloseWindow =
      s.profState === ProfessorState.WARNING ||
      s.profState === ProfessorState.FAKEOUT ||
      (s.profState === ProfessorState.SCANNING && s.scanElapsed < 0.35);

    if (isCloseWindow && !s.closeCallUsedThisCycle) {
      s.closeCallUsedThisCycle = true;
      s.closeCalls += 1;
      s.score += 50;
      setScore(s.score);
      setCloseCallNotice(Date.now());
      soundEngine.playCloseCall();
    }
  }, []);

  const showPhone = useCallback(() => {
    const s = simRef.current;
    if (s.phase !== GamePhase.PLAYING || s.isPhoneVisible) return;
    s.isPhoneVisible = true;
    setIsPhoneVisible(true);
    soundEngine.playShowPhone();
  }, []);

  const togglePhone = useCallback(() => {
    if (simRef.current.isPhoneVisible) {
      hidePhone();
    } else {
      showPhone();
    }
  }, [hidePhone, showPhone]);

  // Clear close-call notice after 1.3s
  useEffect(() => {
    if (closeCallNotice === null) return;
    const id = window.setTimeout(() => setCloseCallNotice(null), 1300);
    return () => clearTimeout(id);
  }, [closeCallNotice]);

  // Space keyboard shortcut (only Space toggles phone on/off)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (simRef.current.phase !== GamePhase.PLAYING) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePhone();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePhone]);

  // Main Game Logic Loop (AI + Suspicion + Timer + Scene Sync)
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudSyncAccum = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const s = simRef.current;

      if (s.phase === GamePhase.PLAYING) {
        s.timeRemaining = Math.max(0, s.timeRemaining - dt);
        s.stateTimer -= dt;

        // Ambient footsteps / chalk audio
        if (s.profState === ProfessorState.WRITING) {
          soundEngine.playChalkTick(now);
        } else if (
          (s.profState === ProfessorState.SCANNING && s.willWalkAisle) ||
          s.profState === ProfessorState.SCOLDING_OTHER
        ) {
          soundEngine.playFootstep(now);
        }

        // State machine transitions
        if (s.profState === ProfessorState.WRITING) {
          s.aisleWalkProgress = Math.max(0, s.aisleWalkProgress - dt * 1.8);
          if (s.stateTimer <= 0) {
            s.profState = ProfessorState.WARNING;
            s.stateTimer = s.stage.warningLeadSec;
            s.closeCallUsedThisCycle = false;
            setProfessorState(ProfessorState.WARNING);
            soundEngine.playWarningCue();
            navigator.vibrate?.(35);
          }
        } else if (s.profState === ProfessorState.WARNING) {
          if (s.stateTimer <= 0) {
            // Decide between fakeout, catching another classmate, or full scan
            const canCatchOther =
              s.sneakingStudentIndex !== null && Math.random() < s.stage.otherCatchChance;
            if (canCatchOther && s.sneakingStudentIndex !== null) {
              const targetIdx = s.sneakingStudentIndex;
              s.profState = ProfessorState.SCOLDING_OTHER;
              s.caughtStudentIndex = targetIdx;
              s.sneakingStudentIndex = null;
              s.othersCaught += 1;
              s.stateTimer = 3.2;
              setProfessorState(ProfessorState.SCOLDING_OTHER);
              setClassmateEvent({
                id: Date.now(),
                studentIndex: targetIdx,
                studentLabel: STUDENT_SEAT_LABELS[targetIdx] ?? '앞줄 학생',
                message: SCOLD_MESSAGES[Math.floor(Math.random() * SCOLD_MESSAGES.length)],
              });
              soundEngine.playCloseCall();
            } else if (Math.random() < s.stage.fakeoutChance) {
              s.profState = ProfessorState.FAKEOUT;
              s.stateTimer = 0.75;
              setProfessorState(ProfessorState.FAKEOUT);
            } else {
              // Classmate hides phone when professor scans (unless caught above)
              s.sneakingStudentIndex = null;
              s.profState = ProfessorState.SCANNING;
              s.scanDuration = randRange(s.stage.scanMinSec, s.stage.scanMaxSec);
              s.stateTimer = s.scanDuration;
              s.scanElapsed = 0;
              s.willWalkAisle = Math.random() < s.stage.aisleWalkChance;
              setProfessorState(ProfessorState.SCANNING);
              soundEngine.playScanAlert();
            }
          }
        } else if (s.profState === ProfessorState.SCOLDING_OTHER) {
          if (s.stateTimer <= 0) {
            s.caughtStudentIndex = null;
            setClassmateEvent(null);
            s.profState = ProfessorState.WRITING;
            s.stateTimer = randRange(s.stage.writeMinSec, s.stage.writeMaxSec);
            s.sneakingStudentIndex = Math.random() < 0.75 ? Math.floor(Math.random() * 8) : null;
            setProfessorState(ProfessorState.WRITING);
          }
        } else if (s.profState === ProfessorState.FAKEOUT) {
          if (s.stateTimer <= 0) {
            // Return to writing after fakeout!
            s.profState = ProfessorState.WRITING;
            s.stateTimer = randRange(s.stage.writeMinSec * 0.75, s.stage.writeMaxSec * 0.9);
            if (s.sneakingStudentIndex === null && Math.random() < 0.65) {
              s.sneakingStudentIndex = Math.floor(Math.random() * 8);
            }
            setProfessorState(ProfessorState.WRITING);
          }
        } else if (s.profState === ProfessorState.SCANNING) {
          s.scanElapsed += dt;
          if (s.willWalkAisle) {
            // Walk partway down aisle in first half, return in second half
            const progress = Math.sin((s.scanElapsed / Math.max(0.5, s.scanDuration)) * Math.PI);
            s.aisleWalkProgress = Math.max(0, Math.min(1, progress));
          } else {
            s.aisleWalkProgress = 0;
          }

          if (s.stateTimer <= 0) {
            s.profState = ProfessorState.WRITING;
            s.stateTimer = randRange(s.stage.writeMinSec, s.stage.writeMaxSec);
            s.willWalkAisle = false;
            s.sneakingStudentIndex = Math.random() < 0.75 ? Math.floor(Math.random() * 8) : null;
            setProfessorState(ProfessorState.WRITING);
          }
        }

        // Suspicion Physics
        if (s.profState === ProfessorState.SCANNING && s.isPhoneVisible) {
          // Small grace window (0.16s) at start of scan for human reaction
          if (s.scanElapsed > 0.16) {
            const aisleMultiplier = 1 + s.aisleWalkProgress * 0.65;
            s.suspicion = Math.min(100, s.suspicion + s.stage.suspicionGainRate * aisleMultiplier * dt);
            if (s.suspicion >= 100) {
              finishRun(false, '스마트폰 플레이 중 교수님께 적발되었습니다!');
            }
          }
        } else if (s.profState === ProfessorState.SCOLDING_OTHER) {
          // Distracted scolding another student: suspicion drops rapidly!
          s.suspicion = Math.max(0, s.suspicion - 12 * dt);
        } else if (s.profState === ProfessorState.WRITING && !s.isPhoneVisible) {
          // Cool down faster while pretending to study
          s.suspicion = Math.max(0, s.suspicion - 14 * dt);
        } else if (!s.isPhoneVisible) {
          s.suspicion = Math.max(0, s.suspicion - 6 * dt);
        } else if (s.profState === ProfessorState.WRITING) {
          s.suspicion = Math.max(0, s.suspicion - 3 * dt);
        }

        // Check lecture timer completion
        if (s.timeRemaining <= 0 && s.phase === GamePhase.PLAYING) {
          if (s.score >= s.stage.targetScore) {
            finishRun(true);
          } else {
            finishRun(false, `목표 점수(${s.stage.targetScore}점)에 도달하지 못했습니다`);
          }
        }

        hudSyncAccum += dt;
        if (hudSyncAccum >= 0.08) {
          hudSyncAccum = 0;
          setSuspicion(s.suspicion);
          setTimeRemaining(s.timeRemaining);
        }
      }

      // Always push latest state to Three.js controller
      sceneRef.current?.setVisualState({
        professorState: s.profState,
        isPhoneVisible: s.isPhoneVisible,
        isCaught: s.phase === GamePhase.CAUGHT,
        suspicion: s.suspicion,
        aisleWalkProgress: s.aisleWalkProgress,
        timeRemainingRatio: s.stage.durationSec > 0 ? s.timeRemaining / s.stage.durationSec : 1,
        caughtStudentIndex: s.caughtStudentIndex,
        sneakingStudentIndex: s.sneakingStudentIndex,
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [finishRun]);

  const handleScoreGain = useCallback(
    (delta: number, newCombo: number, soundKind: 'pop' | 'coin' | 'stack' | 'miss') => {
      const s = simRef.current;
      if (s.phase !== GamePhase.PLAYING) return;

      s.score = Math.max(0, s.score + delta);
      s.combo = newCombo;
      if (newCombo > s.maxCombo) s.maxCombo = newCombo;

      setScore(s.score);
      setCombo(s.combo);

      if (soundKind === 'pop') soundEngine.playPop(newCombo);
      else if (soundKind === 'coin') soundEngine.playCoin(newCombo);
      else if (soundKind === 'stack') soundEngine.playStack(newCombo > 1, newCombo);
      else soundEngine.playMiniMiss();
    },
    [],
  );

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  const handleNextStage = () => {
    const idx = STAGES.findIndex((st) => st.id === selectedStage.id);
    const nextStage = STAGES[idx + 1] ?? STAGES[0];
    setSelectedStage(nextStage);
    startStage(nextStage);
  };

  return (
    <main className="relative w-full h-dvh overflow-hidden bg-stone-950 select-none">
      {/* Dedicated Three.js 1st-Person Classroom Canvas Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          dragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            movedDist: 0,
          };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d.active) return;
          const dx = e.clientX - d.lastX;
          const dy = e.clientY - d.lastY;
          d.lastX = e.clientX;
          d.lastY = e.clientY;
          d.movedDist += Math.hypot(dx, dy);
          sceneRef.current?.nudgeCameraLook(-dx * 0.0022, -dy * 0.0015);
        }}
        onPointerUp={() => {
          const d = dragRef.current;
          if (d.active && d.movedDist < 10 && simRef.current.phase === GamePhase.PLAYING) {
            // Quick tap on classroom background while playing immediately hides phone!
            if (simRef.current.isPhoneVisible) {
              hidePhone();
            }
          }
          dragRef.current.active = false;
        }}
        onPointerCancel={() => {
          dragRef.current.active = false;
        }}
      />

      {/* Active HUD + Handheld Smartphone Mini-Game */}
      {phase !== GamePhase.MENU && (
        <>
          <GameHUD
            stage={selectedStage}
            professorState={professorState}
            suspicion={suspicion}
            timeRemaining={timeRemaining}
            score={score}
            isPhoneVisible={isPhoneVisible}
            isMuted={isMuted}
            closeCallNotice={closeCallNotice}
            classmateEvent={classmateEvent}
            onTogglePhone={togglePhone}
            onToggleMute={handleToggleMute}
            onQuitToMenu={() => {
              simRef.current.phase = GamePhase.MENU;
              setClassmateEvent(null);
              setPhase(GamePhase.MENU);
            }}
          />

          <PhoneMiniGame
            gameType={selectedMiniGame}
            isVisible={isPhoneVisible && phase === GamePhase.PLAYING}
            isActive={phase === GamePhase.PLAYING}
            score={score}
            combo={combo}
            targetScore={selectedStage.targetScore}
            onScoreGain={handleScoreGain}
            onHidePhone={hidePhone}
          />
        </>
      )}

      {/* Start / Stage Selection Modal */}
      {phase === GamePhase.MENU && (
        <StartModal
          selectedStage={selectedStage}
          selectedMiniGame={selectedMiniGame}
          bestScores={bestScores}
          onSelectStage={setSelectedStage}
          onSelectMiniGame={setSelectedMiniGame}
          onStart={() => startStage(selectedStage)}
        />
      )}

      {/* End of Lecture Result Modal */}
      {(phase === GamePhase.CAUGHT || phase === GamePhase.CLEARED) && result && (
        <ResultModal
          result={result}
          bestScore={bestScores[result.stageId] ?? result.score}
          onRetry={() => startStage(selectedStage)}
          onBackToMenu={() => {
            simRef.current.phase = GamePhase.MENU;
            setResult(null);
            setPhase(GamePhase.MENU);
          }}
          onNextStage={
            selectedStage.id < STAGES.length ? handleNextStage : undefined
          }
        />
      )}
    </main>
  );
}
