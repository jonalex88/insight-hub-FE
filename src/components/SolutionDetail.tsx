import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Solution, MonthPoint } from "@/data/solutions";
import { formatDate, formatNumber, formatZAR } from "@/lib/format";
import { getDailyStats, getTrendStats, getProjection, AREA_PATH, DailyRow, TrendRow } from "@/data/apiClient";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart,
  Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Period = "30d" | "12m" | "3y";

interface DataPoint {
  label: string;
  merchants: number;
  txnCount: number;
  txnValue: number;
}

interface ProjPoint {
  label: string;
  ym: string;
  actual:    number | null;
  predicted: number | null;
  projLine:  number | null;
}

// ─── Series conversion ────────────────────────────────────────────────────────

function toDataPoints(series: MonthPoint[]): DataPoint[] {
  return series.map((p) => ({ label: p.month, merchants: p.merchants, txnCount: p.txnCount, txnValue: p.txnValue }));
}

function fromDailyRows(rows: DailyRow[]): DataPoint[] {
  return rows.map((r) => {
    const d = new Date(r.date);
    const label = d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
    return {
      label,
      merchants: r.active_merchants,
      txnCount:  Number(r.approved_count),
      txnValue:  Number(r.approved_value),
    };
  });
}

function fromTrendRows(rows: TrendRow[]): DataPoint[] {
  const byYear = new Map<string, TrendRow[]>();
  for (const r of rows) {
    const y = r.year_month.slice(0, 4);
    (byYear.get(y) ?? byYear.set(y, []).get(y)!).push(r);
  }
  return Array.from(byYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, rs]) => ({
      label:     year,
      merchants: Math.round(rs.reduce((s, r) => s + r.active_merchants, 0) / rs.length),
      txnCount:  rs.reduce((s, r) => s + Number(r.approved_count), 0),
      txnValue:  rs.reduce((s, r) => s + Number(r.approved_value), 0),
    }));
}

function getSubtitles(period: Period) {
  return {
    merchants:  period === "30d" ? "Active lanes — daily view" : period === "12m" ? "Active lanes per month" : "Active lanes — annual average",
    txnCount:   period === "30d" ? "Approved transactions per day" : period === "12m" ? "Successful transactions per month" : "Total approved transactions per year",
    txnValue:   period === "30d" ? "Approved ZAR per day" : period === "12m" ? "Total approved ZAR per month" : "Total approved ZAR per year",
  };
}

// ─── Projection chart helpers ─────────────────────────────────────────────────

function nowYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtYM(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });
}

function monthRange(from: string, to: string): string[] {
  const result: string[] = [];
  const cur = new Date(from + "-01");
  const end = new Date(to + "-01");
  while (cur <= end) {
    result.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return result;
}

function linReg(pts: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = pts.length;
  if (n < 2) return { slope: 0, intercept: pts[0]?.y ?? 0 };
  const xm = pts.reduce((s, p) => s + p.x, 0) / n;
  const ym = pts.reduce((s, p) => s + p.y, 0) / n;
  const num = pts.reduce((s, p) => s + (p.x - xm) * (p.y - ym), 0);
  const den = pts.reduce((s, p) => s + (p.x - xm) ** 2, 0);
  const slope = den !== 0 ? num / den : 0;
  return { slope, intercept: ym - slope * xm };
}

function buildProjSeries(
  trendRows: TrendRow[],
  getValue: (r: TrendRow) => number,
  startDate: string,   // "2025-01-15"
  targetDate: string,  // "2025-12-31"
  targetValue: number,
): ProjPoint[] {
  const current = nowYM();

  // Range: 12 months before start_date → target_date month
  const sd = new Date(startDate + "-01");
  sd.setMonth(sd.getMonth() - 12);
  const fromYM = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}`;
  const toYM   = targetDate.slice(0, 7);
  const startYM = startDate.slice(0, 7);

  const months = monthRange(fromYM, toYM);

  // Actual data map
  const actualMap = new Map<string, number>();
  for (const r of trendRows) actualMap.set(r.year_month, getValue(r));

  // Regression on past data points (within our range)
  const regPts = months
    .map((ym, i) => ({ ym, i, val: actualMap.get(ym) }))
    .filter((p) => p.ym <= current && p.val !== undefined)
    .map((p) => ({ x: p.i, y: p.val! }));

  const { slope, intercept } = linReg(regPts);

  // Projection straight line: from actual at startYM → targetValue at toYM
  const startIdx  = months.indexOf(startYM);
  const targetIdx = months.indexOf(toYM);
  const actualAtStart = actualMap.get(startYM) ?? (regPts.length ? Math.round(slope * (startIdx >= 0 ? startIdx : 0) + intercept) : null);

  return months.map((ym, i) => {
    const isFuture = ym > current;
    const actual = !isFuture ? (actualMap.get(ym) ?? null) : null;
    const predicted = Math.max(0, Math.round(slope * i + intercept));

    let projLine: number | null = null;
    if (startIdx >= 0 && targetIdx > startIdx && i >= startIdx && i <= targetIdx && actualAtStart !== null) {
      const t = (i - startIdx) / (targetIdx - startIdx);
      projLine = Math.round(actualAtStart + t * (targetValue - actualAtStart));
    }

    return { label: fmtYM(ym), ym, actual, predicted, projLine };
  });
}

// ─── Chart tooltip style ──────────────────────────────────────────────────────

const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "10px",
    fontSize: "12px",
    boxShadow: "var(--shadow-card)",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))", fontWeight: 600, marginBottom: 4 },
};

// ─── Main content component ───────────────────────────────────────────────────

interface Props {
  solution: Solution;
}

export const SolutionDetail = ({ solution }: Props) => {
  const [period,   setPeriod]   = useState<Period>("12m");
  const [projMode, setProjMode] = useState(false);
  const path = AREA_PATH[solution.area];

  const { data: dailyRows, isLoading: dailyLoading } = useQuery({
    queryKey:  ["daily", solution.area, solution.id],
    queryFn:   () => getDailyStats(path, solution.id),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: trendRows, isLoading: trendLoading } = useQuery({
    queryKey:  ["trend", solution.area, solution.id],
    queryFn:   () => getTrendStats(path, solution.id, 36),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: projection } = useQuery({
    queryKey:  ["projection", solution.id],
    queryFn:   () => getProjection(solution.id).catch(() => null),
    staleTime: 60_000,
  });

  const projLanes    = projection?.lane_count    ?? null;
  const projTxnCount = projection?.txn_count     ?? null;
  const projValue    = projection?.monthly_value ?? null;

  const hasAnyProjection = !!(projLanes || projTxnCount || projValue);
  const canProjMode = hasAnyProjection && !!(projection?.start_date) && !!(projection?.target_date) && !!trendRows;

  // Exit proj mode if projection disappears
  useEffect(() => {
    if (!canProjMode) setProjMode(false);
  }, [canProjMode]);

  const isChartLoading =
    (period === "30d" && dailyLoading) ||
    (period === "3y"  && trendLoading);

  const projTxnDay   = projTxnCount ? Math.round(projTxnCount / 30) : null;
  const projValueDay = projValue    ? Math.round(Number(projValue)  / 30) : null;

  const data =
    period === "30d" ? (dailyRows ? fromDailyRows(dailyRows) : []) :
    period === "3y"  ? (trendRows ? fromTrendRows(trendRows) : toDataPoints(solution.series).slice(-12)) :
    toDataPoints(solution.series);

  const subtitles = getSubtitles(period);

  // Build projection chart series (when in projMode)
  const startDate  = projection?.start_date?.slice(0, 10) ?? "";
  const targetDate = projection?.target_date?.slice(0, 10) ?? "";

  const lanesProjData  = (canProjMode && projMode && projLanes    && trendRows)
    ? buildProjSeries(trendRows, (r) => r.active_merchants, startDate, targetDate, projLanes)
    : null;
  const txnProjData    = (canProjMode && projMode && projTxnCount && trendRows)
    ? buildProjSeries(trendRows, (r) => Number(r.approved_count), startDate, targetDate, projTxnCount)
    : null;
  const valueProjData  = (canProjMode && projMode && projValue    && trendRows)
    ? buildProjSeries(trendRows, (r) => Number(r.approved_value), startDate, targetDate, Number(projValue))
    : null;

  return (
    <div className="flex flex-col">
      <div className="bg-gradient-kpi text-navy-foreground p-6 md:p-8 rounded-2xl">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-navy-foreground/70 max-w-2xl">{solution.description}</p>
            {hasAnyProjection && (
              <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-violet-500/20 text-violet-200 border border-violet-400/30">
                <TrendingUp className="h-3 w-3" />
                Projection available
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-navy-foreground/60">
            <Calendar className="h-3.5 w-3.5" />
            <span>Launched {formatDate(solution.launchDate)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <KpiTile label="Active lanes" value={formatNumber(solution.enabledMerchants, false)} delta={solution.merchantGrowthPct} />
          <DualKpiTile
            label="30D Transactions"
            rows={[
              { sub: "Approved count", value: formatNumber(solution.series[solution.series.length - 1].txnCount) },
              { sub: "Approved value", value: formatZAR(solution.approvedValue30d) },
            ]}
          />
          <GrowthKpiTile label="Lane growth" series={solution.series} />
        </div>
      </div>

      <div className="pt-6 space-y-6">
        {/* Controls row — sticky so it stays visible while scrolling charts */}
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur-sm flex items-center justify-between gap-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            {canProjMode && (
              <button
                onClick={() => setProjMode((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                  projMode
                    ? "bg-violet-500 text-white border-violet-500 shadow-sm"
                    : "bg-card text-violet-500 border-violet-500/40 hover:bg-violet-500/10"
                )}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {projMode ? "Projection view" : "Show projection"}
              </button>
            )}
          </div>
          {!projMode && <PeriodToggle value={period} onChange={setPeriod} />}
        </div>

        {projMode ? (
          /* ── Projection mode charts ── */
          <div className="space-y-6">
            {lanesProjData && (
              <ProjChartCard
                title="Active lanes — projection"
                subtitle={`${fmtYM(startDate.slice(0,7))} → ${fmtYM(targetDate.slice(0,7))} · target ${formatNumber(projLanes!, false)} lanes`}
                data={lanesProjData}
                targetValue={projLanes!}
                formatter={(v) => formatNumber(v, false)}
                yTickFormatter={(v) => formatNumber(v)}
                actualLabel="Lanes"
              />
            )}
            {txnProjData && (
              <ProjChartCard
                title="Approved txn count — projection"
                subtitle={`${fmtYM(startDate.slice(0,7))} → ${fmtYM(targetDate.slice(0,7))} · target ${formatNumber(projTxnCount!, false)} / month`}
                data={txnProjData}
                targetValue={projTxnCount!}
                formatter={(v) => formatNumber(v, false)}
                yTickFormatter={(v) => formatNumber(v)}
                actualLabel="Txns"
              />
            )}
            {valueProjData && (
              <ProjChartCard
                title="Approved txn value — projection"
                subtitle={`${fmtYM(startDate.slice(0,7))} → ${fmtYM(targetDate.slice(0,7))} · target ${formatZAR(Number(projValue!))} / month`}
                data={valueProjData}
                targetValue={Number(projValue!)}
                formatter={(v) => formatZAR(v)}
                yTickFormatter={(v) => formatZAR(v)}
                actualLabel="Value"
              />
            )}
            {!lanesProjData && !txnProjData && !valueProjData && (
              <p className="text-sm text-muted-foreground py-8 text-center">No projection targets set yet.</p>
            )}
          </div>
        ) : isChartLoading ? (
          <>
            <div className="h-[280px] rounded-2xl bg-secondary animate-pulse" />
            <div className="h-[280px] rounded-2xl bg-secondary animate-pulse" />
            <div className="h-[280px] rounded-2xl bg-secondary animate-pulse" />
          </>
        ) : (
          <>
            <ChartCard title="Active lanes" subtitle={subtitles.merchants}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="merchFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--cyan))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--cyan))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval={period === "30d" ? 4 : 0} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatNumber(v)} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => [formatNumber(v, false), "Lanes"]} />
                  <Area type="monotone" dataKey="merchants" stroke="hsl(var(--cyan))" strokeWidth={2.5} fill="url(#merchFill)" />
                  {projLanes && <ReferenceLine y={projLanes} stroke="hsl(var(--violet))" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `Target ${formatNumber(projLanes, false)}`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--violet))" }} />}
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Approved transaction count" subtitle={subtitles.txnCount}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval={period === "30d" ? 4 : 0} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatNumber(v)} />
                  <Tooltip {...chartTooltip} cursor={{ fill: "hsl(var(--muted))" }} formatter={(v: number) => [formatNumber(v, false), "Txns"]} />
                  <Bar dataKey="txnCount" fill="hsl(var(--navy))" radius={[6, 6, 0, 0]} />
                  {(period === "30d" ? projTxnDay : projTxnCount) && <ReferenceLine y={period === "30d" ? projTxnDay! : projTxnCount!} stroke="hsl(var(--violet))" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `Target ${formatNumber(period === "30d" ? projTxnDay! : projTxnCount!, false)}`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--violet))" }} />}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Approved transaction value" subtitle={subtitles.txnValue}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval={period === "30d" ? 4 : 0} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatZAR(v)} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => [formatZAR(v), "Value"]} />
                  <Line type="monotone" dataKey="txnValue" stroke="hsl(var(--cyan))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--navy))", strokeWidth: 2, stroke: "hsl(var(--cyan))" }} activeDot={{ r: 6 }} />
                  {(period === "30d" ? projValueDay : projValue) && <ReferenceLine y={period === "30d" ? projValueDay! : Number(projValue)!} stroke="hsl(var(--violet))" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `Target ${formatZAR(period === "30d" ? projValueDay! : Number(projValue)!)}`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--violet))" }} />}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Projection chart card ────────────────────────────────────────────────────

interface ProjChartCardProps {
  title: string;
  subtitle: string;
  data: ProjPoint[];
  targetValue: number;
  formatter: (v: number) => string;
  yTickFormatter: (v: number) => string;
  actualLabel: string;
}

const ProjChartCard = ({ title, subtitle, data, targetValue, formatter, yTickFormatter, actualLabel }: ProjChartCardProps) => (
  <ChartCard title={title} subtitle={subtitle}>
    <div className="flex items-center gap-4 mb-3 flex-wrap">
      <Legend color="hsl(var(--navy))" label={`Actual ${actualLabel}`} bar />
      <Legend color="hsl(var(--cyan))" label="Trend (regression)" dashed />
      <Legend color="hsl(var(--violet))" label="Projection line" />
    </div>
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval={Math.floor(data.length / 8)} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={yTickFormatter} />
        <Tooltip
          {...chartTooltip}
          formatter={(v: number, name: string) => {
            const labels: Record<string, string> = { actual: actualLabel, predicted: "Trend", projLine: "Projection" };
            return [formatter(v), labels[name] ?? name];
          }}
        />
        <Bar dataKey="actual" fill="hsl(var(--navy))" radius={[4, 4, 0, 0]} opacity={0.85} />
        <Line dataKey="predicted" stroke="hsl(var(--cyan))" strokeWidth={2} strokeDasharray="4 2" dot={false} connectNulls />
        <Line dataKey="projLine" stroke="hsl(var(--violet))" strokeWidth={2} dot={false} connectNulls />
        <ReferenceLine
          y={targetValue}
          stroke="hsl(var(--violet))"
          strokeDasharray="5 3"
          strokeWidth={1}
          strokeOpacity={0.4}
          label={{ value: `Target ${formatter(targetValue)}`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--violet))" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  </ChartCard>
);

const Legend = ({ color, label, dashed, bar }: { color: string; label: string; dashed?: boolean; bar?: boolean }) => (
  <div className="flex items-center gap-1.5">
    {bar ? (
      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
    ) : (
      <div className="w-6 h-0 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />
    )}
    <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
  </div>
);

// ─── Period toggle ────────────────────────────────────────────────────────────

const PERIODS: { value: Period; label: string }[] = [
  { value: "30d", label: "30D" },
  { value: "12m", label: "12M" },
  { value: "3y",  label: "3Y"  },
];

const PeriodToggle = ({ value, onChange }: { value: Period; onChange: (p: Period) => void }) => (
  <div className="inline-flex items-center gap-0.5 bg-secondary rounded-lg p-1 border border-border">
    {PERIODS.map((p) => (
      <button
        key={p.value}
        onClick={() => onChange(p.value)}
        className={cn(
          "px-3 py-1 text-xs font-semibold rounded-md transition-all",
          value === p.value
            ? "bg-card text-foreground shadow-sm border border-border"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {p.label}
      </button>
    ))}
  </div>
);

// ─── KPI tile ─────────────────────────────────────────────────────────────────

const KpiTile = ({ label, value, delta }: { label: string; value: string; delta: number }) => {
  const positive = delta >= 0;
  return (
    <div className="rounded-xl bg-navy-foreground/5 backdrop-blur-sm border border-navy-foreground/10 p-4">
      <div className="text-[11px] uppercase tracking-wider text-navy-foreground/60 font-semibold">{label}</div>
      <div className="mt-2 font-display text-xl md:text-2xl font-extrabold text-navy-foreground">{value}</div>
      <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${positive ? "text-cyan" : "text-rose-300"}`}>
        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {positive ? "+" : ""}{delta.toFixed(1)}% vs prior
      </div>
    </div>
  );
};

// ─── Dual metric tile ─────────────────────────────────────────────────────────

interface DualRow { sub: string; value: string }

const DualKpiTile = ({ label, rows }: { label: string; rows: [DualRow, DualRow] }) => (
  <div className="rounded-xl bg-navy-foreground/5 backdrop-blur-sm border border-navy-foreground/10 p-4 flex flex-col gap-3">
    <div className="text-[11px] uppercase tracking-wider text-navy-foreground/60 font-semibold">{label}</div>
    {rows.map((r) => (
      <div key={r.sub}>
        <div className="text-[10px] text-navy-foreground/50 font-medium mb-0.5">{r.sub}</div>
        <div className="font-display text-lg md:text-xl font-extrabold text-navy-foreground leading-none">{r.value}</div>
      </div>
    ))}
  </div>
);

// ─── Growth tile (MoM + YoY) ──────────────────────────────────────────────────

function calcGrowth(current: number, prior: number) {
  const diff = current - prior;
  const pct = prior > 0 ? (diff / prior) * 100 : 0;
  return { diff, pct };
}

const GrowthKpiTile = ({ label, series }: { label: string; series: MonthPoint[] }) => {
  const cur  = series[series.length - 1].merchants;
  const mom  = calcGrowth(cur, series[series.length - 2].merchants);
  const yoy  = calcGrowth(cur, series[0].merchants);

  const Row = ({ sub, diff, pct }: { sub: string; diff: number; pct: number }) => {
    const pos = diff >= 0;
    return (
      <div>
        <div className="text-[10px] text-navy-foreground/50 font-medium mb-0.5">{sub}</div>
        <div className="flex items-baseline gap-1.5 font-display font-extrabold text-navy-foreground leading-none">
          <span className="text-lg md:text-xl">{pos ? "+" : ""}{formatNumber(diff, false)}</span>
          <span className={`text-sm font-semibold ${pos ? "text-cyan" : "text-rose-300"}`}>
            {pos ? "+" : ""}{pct.toFixed(1)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl bg-navy-foreground/5 backdrop-blur-sm border border-navy-foreground/10 p-4 flex flex-col gap-3">
      <div className="text-[11px] uppercase tracking-wider text-navy-foreground/60 font-semibold">{label}</div>
      <Row sub="MoM lanes (vs last month)" diff={mom.diff} pct={mom.pct} />
      <Row sub="YoY lanes (~12M growth)" diff={yoy.diff} pct={yoy.pct} />
    </div>
  );
};

// ─── Chart card ───────────────────────────────────────────────────────────────

const ChartCard = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
  <div className="bg-card rounded-2xl border border-border shadow-card p-5">
    <div className="mb-4">
      <h4 className="font-display text-base font-bold text-foreground">{title}</h4>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
    {children}
  </div>
);
