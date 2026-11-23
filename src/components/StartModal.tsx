import React from 'react';
import { Eye, Gamepad2, Play, ShieldAlert, Smartphone, Trophy } from 'lucide-react';
import { MINI_GAMES, MiniGameType, STAGES, StageConfig } from '../types/game';

interface StartModalProps {
  selectedStage: StageConfig;
  selectedMiniGame: MiniGameType;
  bestScores: Record<number, number>;
  onSelectStage: (stage: StageConfig) => void;
  onSelectMiniGame: (game: MiniGameType) => void;
  onStart: () => void;
}

export const StartModal: React.FC<StartModalProps> = ({
  selectedStage,
  selectedMiniGame,
  bestScores,
  onSelectStage,
  onSelectMiniGame,
  onStart,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-stone-950/80 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-stone-900 border border-stone-700/80 shadow-2xl overflow-hidden my-auto">
        {/* Header Banner */}
        <div className="px-5 pt-5 pb-4 sm:px-7 sm:pt-6 border-b border-stone-800">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium mb-1">
            <span>1인칭 3D 강의실 스텔스</span>
            <span aria-hidden="true">·</span>
            <span>모바일 눈치게임</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            교수님 몰래 게임하기
          </h1>
          <p className="text-sm text-stone-300 mt-1.5 leading-relaxed">
            칠판에 판서할 때 폰을 꺼내 목표 점수를 달성하세요. 교수님이 뒤돌아보면 즉시 숨겨야 합니다!
          </p>
        </div>

        <div className="p-5 sm:p-7 space-y-5">
          {/* Quick 3-Rule Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-stone-950/70 border border-stone-800 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-1">
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>판서 중 몰폰</span>
              </div>
              <p className="text-xs text-stone-300 leading-snug">
                교수님이 칠판을 보고 있을 때 미니게임으로 콤보를 쌓으세요.
              </p>
            </div>

            <div className="rounded-xl bg-stone-950/70 border border-stone-800 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1">
                <Eye className="w-4 h-4 shrink-0" />
                <span>뒤돌아볼 때 숨기기</span>
              </div>
              <p className="text-xs text-stone-300 leading-snug">
                경고음과 함께 고개가 돌아가면 하단 버튼·상단 배경 탭·아래 스와이프로 숨기세요.
              </p>
            </div>

            <div className="rounded-xl bg-stone-950/70 border border-stone-800 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 mb-1">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>눈치 & A+ 도전</span>
              </div>
              <p className="text-xs text-stone-300 leading-snug">
                감시 중 들키면 의심도가 오릅니다. 다른 동기들이 걸릴 땐 시선이 분산돼요!
              </p>
            </div>
          </div>

          {/* Stage Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-stone-400">강의 선택</h2>
              <span className="text-xs text-stone-400 font-mono-num">
                최고 기록: {(bestScores[selectedStage.id] ?? 0).toLocaleString()}점
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STAGES.map((stage) => {
                const active = stage.id === selectedStage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => onSelectStage(stage)}
                    className={`text-left p-3 rounded-xl border transition-colors cursor-pointer min-h-[68px] ${
                      active
                        ? 'bg-sky-500/15 border-sky-400 text-white'
                        : 'bg-stone-950/60 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="text-sm font-bold truncate">{stage.title}</div>
                    <div className="text-[11px] text-stone-400 mt-0.5 truncate">{stage.subtitle}</div>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono-num text-amber-300">
                      <span>목표 {stage.targetScore}점</span>
                      <span aria-hidden="true">·</span>
                      <span>{stage.durationSec}초</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mini-Game Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-sky-400" />
                <h2 className="text-xs font-bold text-stone-400">폰 안에 깔린 게임 선택 (6종)</h2>
              </div>
              <span className="text-[11px] text-stone-400">최고 학점 A+</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MINI_GAMES.map((game) => {
                const active = game.id === selectedMiniGame;
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => onSelectMiniGame(game.id)}
                    className={`text-left p-2.5 sm:p-3 rounded-xl border transition-colors cursor-pointer min-h-[60px] ${
                      active
                        ? 'bg-emerald-500/15 border-emerald-400 text-white'
                        : 'bg-stone-950/60 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-bold truncate">{game.name}</div>
                    <div className="text-[11px] text-stone-400 mt-0.5 leading-snug line-clamp-2">{game.tagline}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start CTA */}
          <button
            type="button"
            onClick={onStart}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 active:scale-[0.99] text-stone-950 font-extrabold text-base shadow-lg flex items-center justify-center gap-2 transition-transform cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>수업 시작하기 ({selectedStage.professorName})</span>
          </button>

          {Object.values(bestScores).some((v) => v > 0) && (
            <div className="flex items-center justify-center gap-2 text-xs text-stone-400">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono-num">
                1교시 {bestScores[1] ?? 0}점 · 2교시 {bestScores[2] ?? 0}점 · 3교시 {bestScores[3] ?? 0}점
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
