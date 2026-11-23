export enum ProfessorState {
  WRITING = 'WRITING',               // Chalkboard writing - safe to play
  WARNING = 'WARNING',               // Paused chalk, clearing throat / turning head - hide quickly!
  SCANNING = 'SCANNING',             // Facing class / walking aisle - danger!
  FAKEOUT = 'FAKEOUT',               // Half-turn fake-out - tense!
  SCOLDING_OTHER = 'SCOLDING_OTHER', // Professor caught another classmate - distraction window!
}

export enum MiniGameType {
  BUBBLE_POP = 'BUBBLE_POP',
  LANE_DODGE = 'LANE_DODGE',
  TOWER_STACK = 'TOWER_STACK',
  SNAKE_DASH = 'SNAKE_DASH',
  BRICK_BREAKER = 'BRICK_BREAKER',
  RHYTHM_TAP = 'RHYTHM_TAP',
}

export enum GamePhase {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  CAUGHT = 'CAUGHT',
  CLEARED = 'CLEARED',
}

export interface ClassmateEvent {
  studentIndex: number; // 0..7 matching 3D classroom students
  studentLabel: string;
  message: string;
  id: number;
}

export interface StageConfig {
  id: number;
  title: string;
  subtitle: string;
  professorName: string;
  chalkboardTitle: string;
  chalkboardLines: string[];
  durationSec: number;
  targetScore: number;
  aPlusScore: number;
  warningLeadSec: number;
  scanMinSec: number;
  scanMaxSec: number;
  writeMinSec: number;
  writeMaxSec: number;
  suspicionGainRate: number;
  aisleWalkChance: number;
  fakeoutChance: number;
  otherCatchChance: number;
}

export interface MiniGameMeta {
  id: MiniGameType;
  name: string;
  tagline: string;
  controlsHint: string;
}

export const STAGES: StageConfig[] = [
  {
    id: 1,
    title: '1교시: 교양 인문학',
    subtitle: '널널한 오프닝 강의 · 기본 난이도',
    professorName: '김철수 교수님',
    chalkboardTitle: '제4장. 현대 사회와 디지털 집중력',
    chalkboardLines: [
      '1. 주의력 분산의 경제학 (Attention Economy)',
      '2. 도파민 루프와 스마트폰 의존성',
      '3. 강의실 내 비언어적 시선 교환',
      '   -> f(x) = Σ(집중도) - α(스마트폰)',
      '※ 다음 주 중간고사 출제 범위 포함!',
    ],
    durationSec: 65,
    targetScore: 450,
    aPlusScore: 950,
    warningLeadSec: 1.15,
    scanMinSec: 2.2,
    scanMaxSec: 3.4,
    writeMinSec: 3.8,
    writeMaxSec: 6.2,
    suspicionGainRate: 46,
    aisleWalkChance: 0.15,
    fakeoutChance: 0.15,
    otherCatchChance: 0.34,
  },
  {
    id: 2,
    title: '2교시: 전공 알고리즘',
    subtitle: '예리한 눈썰미 · 복도 순찰 시작',
    professorName: '박지훈 교수님',
    chalkboardTitle: 'Dynamic Programming & Graph Search',
    chalkboardLines: [
      'DP[i][j] = min(DP[i-1][j], DP[i][j-1]) + cost',
      '시간복잡도: O(V log V + E)',
      '반례 체크: Greedy 접근 시 최적해 보장 불가',
      'Backtracking -> 불필요한 탐색 가지치기',
      '※ 뒷줄 조는 학생 없죠? 다 보입니다.',
    ],
    durationSec: 75,
    targetScore: 700,
    aPlusScore: 1400,
    warningLeadSec: 0.9,
    scanMinSec: 2.5,
    scanMaxSec: 4.0,
    writeMinSec: 3.0,
    writeMaxSec: 5.0,
    suspicionGainRate: 62,
    aisleWalkChance: 0.4,
    fakeoutChance: 0.3,
    otherCatchChance: 0.28,
  },
  {
    id: 3,
    title: '3교시: 시험 전날 보강',
    subtitle: '극한의 눈치게임 · 낚시 패턴 주의',
    professorName: '최엄격 교수님',
    chalkboardTitle: '기말고사 최종 총정리 (절대평가)',
    chalkboardLines: [
      '★ 시험 출제 1순위: 상태 머신과 임계 구역',
      '★ 부정행위 및 수업 태도 불량 즉시 F학점',
      'lim (t -> 0) P(들킴) = 1.00',
      '예외 처리 없이 전원 집중할 것!',
      '※ 핸드폰 진동 소리도 다 들립니다.',
    ],
    durationSec: 85,
    targetScore: 950,
    aPlusScore: 1850,
    warningLeadSec: 0.72,
    scanMinSec: 2.8,
    scanMaxSec: 4.4,
    writeMinSec: 2.4,
    writeMaxSec: 4.2,
    suspicionGainRate: 80,
    aisleWalkChance: 0.65,
    fakeoutChance: 0.45,
    otherCatchChance: 0.22,
  },
];

export const MINI_GAMES: MiniGameMeta[] = [
  {
    id: MiniGameType.BUBBLE_POP,
    name: '터치 팝!',
    tagline: '뜨는 타겟 터치 · 폭탄 피하기',
    controlsHint: '초록/황금 타겟 터치 · 빨간 폭탄 주의',
  },
  {
    id: MiniGameType.LANE_DODGE,
    name: '네온 러너',
    tagline: '3차선 고속 회피 · 코인 수집',
    controlsHint: '화면 좌/우 터치로 차선 변경',
  },
  {
    id: MiniGameType.TOWER_STACK,
    name: '타워 스택',
    tagline: '타이밍에 맞춰 블록 쌓기',
    controlsHint: '화면 아무 곳이나 터치해 드롭',
  },
  {
    id: MiniGameType.SNAKE_DASH,
    name: '스네이크 대시',
    tagline: '방향 전환으로 에너지 코어 먹기',
    controlsHint: '화면 좌/우 터치로 90도 회전',
  },
  {
    id: MiniGameType.BRICK_BREAKER,
    name: '브릭 브레이커',
    tagline: '패들 조작으로 네온 벽돌 격파',
    controlsHint: '화면 좌/우 드래그 또는 터치로 이동',
  },
  {
    id: MiniGameType.RHYTHM_TAP,
    name: '비트 탭',
    tagline: '3라인 리듬 노트 퍼펙트 판정',
    controlsHint: '노트가 판정선에 올 때 해당 레인 터치',
  },
];

export type GradeRank = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'F';

export interface RunResult {
  cleared: boolean;
  score: number;
  maxCombo: number;
  closeCalls: number;
  othersCaught: number;
  grade: GradeRank;
  stageId: number;
  miniGame: MiniGameType;
  reason?: string;
}
