import React from 'react';
import { Award, Home, RotateCcw, ShieldAlert } from 'lucide-react';
import { RunResult, STAGES } from '../types/game';

interface ResultModalProps {
  result: RunResult;
  bestScore: number;
  onRetry: () => void;
  onBackToMenu: () => void;
  onNextStage?: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  result,
  bestScore,
  onRetry,
  onBackToMenu,
  onNextStage,
}) => {
  const stage = STAGES.find((s) => s.id === result.stageId) ?? STAGES[0];
  const isSuccess = result.cleared && result.grade !== 'F';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-stone-950/85">
      <div className="w-full max-w-md rounded-3xl bg-stone-900 border border-stone-700 shadow-2xl overflow-hidden">
        <div
          className={`px-6 py-5 border-b border-stone-800 ${
            isSuccess ? 'bg-emerald-950/50' : 'bg-rose-950/60'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold mb-1">
            {isSuccess ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <Award className="w-4 h-4" />
                수업 종료 · 몰폰 성공!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-rose-300">
                <ShieldAlert className="w-4 h-4" />
                {result.reason || '교수님께 적발되었습니다'}
              </span>
            )}
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            {isSuccess ? `최종 학점 ${result.grade}` : '스마트폰 압수 (F학점)'}
          </h2>
          <p className="text-xs text-stone-300 mt-1">
            {stage.title} · {stage.professorName}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-stone-950 border border-stone-800 p-2.5">
              <div className="text-[11px] text-stone-400">달성 점수</div>
              <div className="font-mono-num text-base font-extrabold text-amber-300 mt-0.5">
                {result.score.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl bg-stone-950 border border-stone-800 p-2.5">
              <div className="text-[11px] text-stone-400">최대 콤보</div>
              <div className="font-mono-num text-base font-extrabold text-sky-300 mt-0.5">
                {result.maxCombo}x
              </div>
            </div>
            <div className="rounded-xl bg-stone-950 border border-stone-800 p-2.5">
              <div className="text-[11px] text-stone-400">아슬아슬 회피</div>
              <div className="font-mono-num text-base font-extrabold text-emerald-300 mt-0.5">
                {result.closeCalls}회
              </div>
            </div>
            <div className="rounded-xl bg-stone-950 border border-stone-800 p-2.5">
              <div className="text-[11px] text-stone-400">적발된 동기</div>
              <div className="font-mono-num text-base font-extrabold text-rose-300 mt-0.5">
                {result.othersCaught}명
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-300 px-1">
            <span>목표 점수: {stage.targetScore.toLocaleString()}점</span>
            <span className="font-mono-num text-amber-300">
              이 강의 최고 기록: {bestScore.toLocaleString()}점
            </span>
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            {isSuccess && onNextStage && (
              <button
                type="button"
                onClick={onNextStage}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-sm cursor-pointer transition-colors"
              >
                다음 교시 도전하기
              </button>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onRetry}
                className="min-h-[48px] px-4 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>다시 도전</span>
              </button>
              <button
                type="button"
                onClick={onBackToMenu}
                className="min-h-[48px] px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>강의 선택</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
