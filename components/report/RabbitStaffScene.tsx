import type { RoomMilestone } from "@/lib/progress-narrative";

/** "회의를 준비하는 상황실" 일러스트 - 참고 이미지 수준의 손그림 캐릭터 아트는 SVG 코드로
 * 직접 그려낼 수 있는 범위를 벗어나서, 여기서는 플랫/기하학적 실루엣으로 같은 구도(화이트보드
 * 앞 토끼, 자료 옮기는 토끼, 프로젝터 켜는 토끼, 테이블 정리하는 토끼)와 스토리(진행률에 따라
 * 방이 완성됨)만 최대한 그대로 재현한다. 진짜 일러스트 에셋이 있으면 이 컴포넌트를 그걸로
 * 교체하면 된다 - 레이아웃/애니메이션 타이밍은 그대로 재사용 가능하도록 짜여 있다. */
export function RabbitStaffScene({ milestones }: { milestones: Set<RoomMilestone> }) {
  const hasWhiteboard = milestones.has("whiteboard");
  const hasMaterials = milestones.has("materials");
  const hasProjector = milestones.has("projector");
  const hasTable = milestones.has("table");
  const lightsOn = milestones.has("lightsOn");

  return (
    <svg viewBox="0 0 800 520" className="h-full w-full" role="img" aria-label="회의를 준비하는 상황실">
      <defs>
        <radialGradient id="lampGlow" cx="50%" cy="0%" r="70%">
          <stop offset="0%" stopColor="#3a2a2c" stopOpacity={lightsOn ? 0.9 : 0.5} />
          <stop offset="100%" stopColor="#3a2a2c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="projectorBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E3262E" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#E3262E" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 배경 램프 글로우 */}
      <rect x="0" y="0" width="800" height="520" fill="url(#lampGlow)" />
      <line x1="620" y1="0" x2="620" y2="90" stroke="#3a3b40" strokeWidth="3" />
      <g className={lightsOn ? "rs-lamp-on" : "rs-lamp-idle"}>
        <path d="M580 90 L660 90 L640 140 L600 140 Z" fill="#232428" stroke="#3a3b40" strokeWidth="2" />
      </g>

      {/* 창문 */}
      <rect x="40" y="40" width="120" height="150" rx="4" fill="#131417" stroke="#2c2d31" strokeWidth="2" />
      <line x1="100" y1="40" x2="100" y2="190" stroke="#2c2d31" strokeWidth="2" />
      <line x1="40" y1="115" x2="160" y2="115" stroke="#2c2d31" strokeWidth="2" />

      {/* 화이트보드 */}
      <g className={`rs-fade ${hasWhiteboard ? "rs-in" : "rs-out"}`}>
        <rect x="230" y="70" width="220" height="140" rx="4" fill="#1c1d21" stroke="#3a3b40" strokeWidth="2" />
        <line x1="250" y1="110" x2="380" y2="105" stroke="#55565c" strokeWidth="2" />
        <line x1="250" y1="130" x2="360" y2="128" stroke="#55565c" strokeWidth="2" />
        <line x1="250" y1="150" x2="400" y2="150" stroke="#55565c" strokeWidth="2" />
        <rect x="270" y="90" width="14" height="14" fill="#E3262E" className="rs-blink" />
        <rect x="330" y="160" width="14" height="14" fill="#E3262E" className="rs-blink" style={{ animationDelay: "0.6s" }} />
        <rect x="390" y="115" width="14" height="14" fill="#E3262E" className="rs-blink" style={{ animationDelay: "1.1s" }} />
      </g>

      {/* 자료 더미 */}
      <g className={`rs-fade ${hasMaterials ? "rs-in" : "rs-out"}`}>
        <rect x="640" y="360" width="70" height="18" rx="2" fill="#2a2b2f" stroke="#3a3b40" />
        <rect x="645" y="342" width="60" height="18" rx="2" fill="#232428" stroke="#3a3b40" />
        <rect x="650" y="324" width="50" height="18" rx="2" fill="#2a2b2f" stroke="#3a3b40" />
        <rect x="655" y="306" width="40" height="18" rx="2" fill="#E3262E" opacity="0.85" />
      </g>

      {/* 프로젝터 스크린 + 빔 */}
      <g className={`rs-fade ${hasProjector ? "rs-in" : "rs-out"}`}>
        <rect x="480" y="60" width="150" height="95" rx="4" fill="#141518" stroke="#3a3b40" strokeWidth="2" />
        <rect x="495" y="72" width="120" height="70" fill="#1e1f23" />
        <circle cx="530" cy="105" r="18" fill="none" stroke="#E3262E" strokeWidth="2" opacity="0.8" />
        <path d="M530 95 L530 115 M520 105 L540 105" stroke="#E3262E" strokeWidth="2" opacity="0.8" />
        <path d="M420 260 L480 90 L560 90 L520 260 Z" fill="url(#projectorBeam)" />
      </g>

      {/* 테이블 + 의자 */}
      <g className={`rs-fade ${hasTable ? "rs-in" : "rs-out"}`}>
        <ellipse cx="400" cy="400" rx="230" ry="46" fill="#1c1d21" stroke="#3a3b40" strokeWidth="2" />
        <rect x="330" y="378" width="140" height="10" rx="3" fill="#2a2b2f" />
        {[300, 360, 420, 480].map((x, i) => (
          <rect key={x} x={x} y="370" width="16" height="16" rx="2" fill="#E3262E" opacity={0.7} className="rs-blink" style={{ animationDelay: `${i * 0.3}s` }} />
        ))}
      </g>

      {/* Rabbit staff #1 - 화이트보드 앞, 팔 흔들며 패턴 붙이는 중 */}
      <RabbitFigure x={330} y={230} scale={0.95} action="point" delay="0s" wander="M0,0 L26,-8 L14,16 L-12,10 Z" wanderDur="9s" />
      {/* Rabbit staff #2 - 자료 옮기는 중 */}
      <RabbitFigure x={600} y={300} scale={0.9} action="carry" delay="0.4s" wander="M0,0 L-22,6 L-6,-16 L20,-4 Z" wanderDur="11s" />
      {/* Rabbit staff #3 - 테이블에서 정리하는 중 */}
      <RabbitFigure x={230} y={330} scale={0.85} action="sort" delay="0.2s" wander="M0,0 L16,13 L-16,19 L-10,-9 Z" wanderDur="10s" />
      {/* Rabbit staff #4 - 프로젝터 켜는 중 */}
      <RabbitFigure x={470} y={210} scale={0.8} action="reach" delay="0.6s" wander="M0,0 L-19,-11 L11,-19 L19,9 Z" wanderDur="8s" />
      {/* Rabbit staff #5 - 커피 놓는 중 */}
      <RabbitFigure x={140} y={370} scale={0.85} action="carry" delay="0.1s" wander="M0,0 L13,-16 L-16,-6 L6,16 Z" wanderDur="12s" />

      <style>{`
        .rs-fade { transition: opacity 0.6s ease; }
        .rs-in { opacity: 1; }
        .rs-out { opacity: 0; }
        .rs-blink { animation: rsBlink 2.4s ease-in-out infinite; }
        @keyframes rsBlink { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.9; } }
        .rs-lamp-idle path { fill: #232428; }
        .rs-lamp-on path { fill: #E3262E; filter: drop-shadow(0 0 12px rgba(227,38,46,0.6)); transition: fill 0.8s ease; }
      `}</style>
    </svg>
  );
}

const ACTION_ARM: Record<string, string> = {
  point: "M0,-6 L14,-18",
  carry: "M0,-6 L10,-2",
  sort: "M0,-6 L12,-10",
  reach: "M0,-6 L8,-20",
};

/** 단순 실루엣 캐릭터 - 몸통(타원)+귀(타원 2개)+머리(원)+다리(선)+팔(동작별 선 하나)로만
 * 구성해, 손그림 일러스트를 흉내내지 않고 "일하는 자세의 실루엣"만 표현한다. */
/** 위치(x,y)는 바깥 <g>의 SVG transform 속성으로 기준점을 고정하고, 그 기준점 주변을
 * 배회하는 움직임은 안쪽 <g>에 SMIL <animateMotion>으로 준다. animateTransform/CSS
 * transform 애니메이션은 예전에 같은 이름의 @keyframes가 여러 인스턴스에서 충돌하는
 * 문제를 겪었던 자리라, 그거와 무관한 별개 SMIL 애니메이션(모션 경로)만 쓴다 - wander는
 * 기준점(0,0)에서 시작해 다시 (0,0)으로 돌아오는 닫힌 경로라 위치가 어긋나지 않는다. */
function RabbitFigure({
  x,
  y,
  scale = 1,
  action,
  delay = "0s",
  wander,
  wanderDur = "10s",
}: {
  x: number;
  y: number;
  scale?: number;
  action: keyof typeof ACTION_ARM;
  delay?: string;
  wander: string;
  wanderDur?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g>
        <animateMotion path={wander} dur={wanderDur} begin={delay} repeatCount="indefinite" rotate="0" />
        {/* 다리 */}
        <line x1="-6" y1="18" x2="-8" y2="34" stroke="#c9cbd1" strokeWidth="4" strokeLinecap="round" />
        <line x1="6" y1="18" x2="8" y2="34" stroke="#c9cbd1" strokeWidth="4" strokeLinecap="round" />
        {/* 몸통 */}
        <ellipse cx="0" cy="6" rx="14" ry="18" fill="#e7e8ec" stroke="#9a9ca3" strokeWidth="1.5" />
        {/* 조끼 포인트 */}
        <rect x="-8" y="0" width="16" height="12" rx="2" fill="#E3262E" opacity="0.85" />
        {/* 팔 (동작별) */}
        <path d={ACTION_ARM[action]} stroke="#e7e8ec" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* 머리 */}
        <circle cx="0" cy="-16" r="11" fill="#f2f3f6" stroke="#9a9ca3" strokeWidth="1.5" />
        {/* 귀 */}
        <ellipse cx="-6" cy="-30" rx="3.5" ry="12" fill="#f2f3f6" stroke="#9a9ca3" strokeWidth="1.2" transform="rotate(-10 -6 -30)" />
        <ellipse cx="6" cy="-30" rx="3.5" ry="12" fill="#f2f3f6" stroke="#9a9ca3" strokeWidth="1.2" transform="rotate(10 6 -30)" />
        {/* 작업 표시 - "지금 일하는 중"을 나타내는 깜빡이는 점 */}
        <circle cx="16" cy="-24" r="3" fill="#E3262E" className="rs-blink" style={{ animationDelay: delay }} />
      </g>
    </g>
  );
}
