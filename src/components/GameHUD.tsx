import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  Clock,
  Eye,
  HelpCircle,
  Megaphone,
  Pause,
  PenLine,
  Smartphone,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ClassmateEvent, ProfessorState, StageConfig } from '../types/game';

interface GameHUDProps {
  stage: StageConfig;
  professorState: ProfessorState;
  suspicion: number;
  timeRemaining: number;
  score: number;
  isPhoneVisible: boolean;
  isMuted: boolean;
  closeCallNotice: number | null;
  classmateEvent: ClassmateEvent | null;
  onTogglePhone: () => void;
  onToggleMute: () => void;
  onQuitToMenu: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stage,
  professorState,
  suspicion,
  timeRemaining,
  score,
  isPhoneVisible,
  isMuted,
  closeCallNotice,
  classmateEvent,
  onTogglePhone,
  onToggleMute,
  onQuitToMenu,
}) => {
  const isDanger = professorState === ProfessorState.SCANNING;
  const isScoldingOther = professorState === ProfessorState.SCOLDING_OTHER;
  const isWarn =
    professorState === ProfessorState.WARNING || professorState === ProfessorState.FAKEOUT;

  const stateConfig = isDanger
    ? {
        label: '감시 중 · 위험!',
        textColor: 'text-rose-300',
        bgColor: 'bg-rose-950/95 border-rose-500/50',
        Icon: Eye,
      }
    : isScoldingOther
      ? {
          label: '다른 학생 적발 · 찬스!',
          textColor: 'text-sky-300',
          bgColor: 'bg-sky-950/95 border-sky-400/50',
          Icon: Megaphone,
        }
      : isWarn
        ? {
            label: professorState === ProfessorState.FAKEOUT ? '머뭇거림 · 주의' : '뒤돌아보는 중!',
            textColor: 'text-amber-300',
            bgColor: 'bg-amber-950/95 border-amber-500/50',
            Icon: professorState === ProfessorState.FAKEOUT ? HelpCircle : AlertTriangle,
          }
        : {
            label: '판서 중 · 안전',
            textColor: 'text-emerald-300',
            bgColor: 'bg-emerald-950/90 border-emerald-500/40',
            Icon: PenLine,
          };

  const StateIcon = stateConfig.Icon;
  const suspClamped = Math.max(0, Math.min(100, Math.round(suspicion)));
  const secLeft = Math.max(0, Math.ceil(timeRemaining));
  const mins = Math.floor(secLeft / 60);
  const secs = String(secLeft % 60).padStart(2, '0');

  return (
    <>
      {/* Screen-edge danger vignette when professor scans while phone is out */}
      {isDanger && isPhoneVisible && (
        <div
          className="fixed inset-0 z-20 pointer-events-none border-4 border-rose-500/80"
          style={{
            boxShadow: 'inset 0 0 60px rgba(225, 29, 72, 0.55)',
          }}
        />
      )}

      {/* Top Compact HUD Bar (No backdrop-blur over WebGL) */}
      <header className="fixed top-0 left-0 right-0 z-30 pointer-events-none px-3 pt-2.5">
        <div className="mx-auto max-w-4xl pointer-events-auto rounded-2xl bg-stone-950/90 border border-stone-800 shadow-lg overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            {/* Left: Professor State Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold whitespace-nowrap shrink-0 ${stateConfig.bgColor} ${stateConfig.textColor}`}
            >
              <StateIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{stateConfig.label}</span>
            </div>

            {/* Center: Timer & Score */}
            <div className="flex items-center gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-1 font-mono-num font-bold text-stone-100 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>
                  {mins}:{secs}
                </span>
              </div>
              <span className="text-stone-600" aria-hidden="true">
                ·
              </span>
              <div className="font-mono-num font-bold text-amber-300 whitespace-nowrap">
                {score.toLocaleString()}
                <span className="text-stone-400 font-normal"> / {stage.targetScore}</span>
              </div>
            </div>

            {/* Right: Sound & Menu */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={isMuted ? '소리 켜기' : '음소거'}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onQuitToMenu}
                aria-label="일시정지 및 메뉴"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Suspicion Meter */}
          <div className="flex items-center gap-2 px-3 pb-2">
            <span className="text-[11px] font-medium text-stone-400 whitespace-nowrap shrink-0">
              교수님 의심도
            </span>
            <div className="flex-1 h-2 rounded-full bg-stone-800 overflow-hidden">
              <div
                className={`h-full ${
                  suspClamped >= 70
                    ? 'bg-rose-500'
                    : suspClamped >= 35
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                }`}
                style={{
                  width: `${suspClamped}%`,
                  transition: 'width 90ms linear, background-color 150ms ease',
                }}
              />
            </div>
            <span
              className={`font-mono-num text-[11px] font-bold w-9 text-right shrink-0 ${
                suspClamped >= 70 ? 'text-rose-400' : 'text-stone-200'
              }`}
            >
              {suspClamped}%
            </span>
          </div>
        </div>
      </header>

      {/* Classmate Caught Event Banner */}
      {classmateEvent && (
        <div
          key={classmateEvent.id}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none max-w-[92vw] px-4 py-2 rounded-xl bg-amber-950/95 border border-amber-400/60 text-amber-100 text-xs sm:text-sm font-bold shadow-xl text-center"
        >
          <span className="text-amber-300">{classmateEvent.studentLabel}</span>
          <span className="mx-1.5 text-amber-500">·</span>
          <span>{classmateEvent.message}</span>
        </div>
      )}

      {/* Close-Call Bonus Toast */}
      {closeCallNotice !== null && !classmateEvent && (
        <div
          key={closeCallNotice}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 py-2 rounded-xl bg-emerald-950/95 border border-emerald-400/50 text-emerald-200 text-xs sm:text-sm font-bold shadow-lg whitespace-nowrap"
        >
          아슬아슬 세이프! 눈치 보너스 +50점
        </div>
      )}

      {/* Subtle Posture Helper & Peek Trigger when Phone is Hidden */}
      {!isPhoneVisible && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-[380px] px-4">
          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-medium text-stone-200 bg-stone-950/85 border border-stone-800 rounded-lg py-1.5 px-3 w-fit mx-auto">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">열심히 필기하는 척하는 중 (화면 드래그로 시선 이동)</span>
          </div>
          <button
            type="button"
            onClick={onTogglePhone}
            className="w-full min-h-[52px] px-5 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 active:scale-[0.98] text-stone-950 font-bold text-sm sm:text-base shadow-xl flex items-center justify-center gap-2 transition-transform cursor-pointer"
          >
            <Smartphone className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap">스마트폰 꺼내서 몰폰하기</span>
            <span className="hidden sm:inline text-xs font-semibold text-stone-900/75 whitespace-nowrap">
              (Space)
            </span>
          </button>
        </div>
      )}
    </>
  );
};
