type Point = { date: string; score: number };

const W = 600;
const H = 200;
const PAD_X = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 12;

/** Smooth line of daily completion %, one point per day. */
export function StatsChart({ points }: { points: Point[] }) {
  if (points.length < 2) {
    return <div className="chart-empty">Your chart fills in as the days go by. Come back tomorrow.</div>;
  }

  const n = points.length;
  const x = (i: number) => PAD_X + (i / (n - 1)) * (W - PAD_X * 2);
  const y = (v: number) => H - PAD_BOTTOM - v * (H - PAD_TOP - PAD_BOTTOM);
  const pts = points.map((p, i) => [x(i), y(p.score)] as const);

  // Catmull-Rom → cubic Bézier for a smooth curve
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clampY(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clampY(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  const area = `${d} L${pts[n - 1][0]},${H - PAD_BOTTOM} L${pts[0][0]},${H - PAD_BOTTOM} Z`;

  const showDots = n <= 31;
  const labelEvery = n <= 7 ? 1 : n <= 31 ? 5 : 15;
  const fmt = (iso: string) =>
    new Date(iso + "T00:00").toLocaleDateString(undefined, n <= 7 ? { weekday: "short" } : { month: "short", day: "numeric" });

  return (
    <div className="stats-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="sc-line" x1="0" x2="1">
            <stop offset="0" stopColor="#8b3fe0" />
            <stop offset="1" stopColor="#be96f0" />
          </linearGradient>
          <linearGradient id="sc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#8b3fe0" stopOpacity="0.28" />
            <stop offset="1" stopColor="#8b3fe0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={PAD_X} x2={W - PAD_X} y1={y(f)} y2={y(f)} className="sc-grid" />
        ))}
        {n <= 7 && pts.map(([px], i) => <line key={i} x1={px} x2={px} y1={PAD_TOP} y2={H - PAD_BOTTOM} className="sc-vgrid" />)}
        <path d={area} fill="url(#sc-fill)" />
        <path d={d} fill="none" stroke="url(#sc-line)" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </svg>

      {/* dots + labels in HTML so they stay round and readable at any width */}
      <div className="sc-overlay">
        {points.map((p, i) => {
          const left = `${(x(i) / W) * 100}%`;
          const top = `${(y(p.score) / H) * 100}%`;
          const isLast = i === n - 1;
          return (
            <span key={p.date}>
              {(showDots || isLast) && (
                <i className={`sc-dot ${isLast ? "last" : ""}`} style={{ left, top }} title={`${fmt(p.date)}: ${Math.round(p.score * 100)}%`} />
              )}
              {((i % labelEvery === 0 && n - 1 - i >= labelEvery / 2) || isLast) && (
                <em className="sc-label" style={{ left }}>
                  {fmt(p.date)}
                </em>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function clampY(v: number) {
  return Math.min(H - PAD_BOTTOM, Math.max(PAD_TOP, v));
}
