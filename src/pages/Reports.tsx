import { useState, useRef, useMemo, useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import { MobileTopBar, Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { Solution } from "@/data/solutions";
import { useAreaSolutions } from "@/hooks/useAreaSolutions";
import { formatNumber, formatZAR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { loadShortNames, ShortNameMap } from "@/data/shortNames";
import { getAllDailyStats, AllDailyRow, AREA_PATH } from "@/data/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "years" | "months" | "days" | "all";
type Metric   = "merchants" | "txnCount" | "txnValue";

// ─── Column definitions ───────────────────────────────────────────────────────

const YEAR_COLS  = ["Y3", "Y2", "YTD"] as const;
const MONTH_COLS = ["May 25","Jun 25","Jul 25","Aug 25","Sep 25","Oct 25","Nov 25","Dec 25","Jan 26","Feb 26","Mar 26","Apr 26"] as const;

function buildDayCols(): string[] {
  const cols: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i - 1);
    cols.push(d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }));
  }
  return cols;
}
const DAY_COLS = buildDayCols();

// ─── Data derivation ──────────────────────────────────────────────────────────

function deriveYears(s: Solution, metric: Metric): Record<string, number> {
  const sum = (idxs: number[]) => idxs.reduce((acc, i) => acc + (s.series[i]?.[metric] ?? 0), 0);
  const avg = (idxs: number[]) => Math.round(sum(idxs) / idxs.length);
  return {
    Y3:  metric === "merchants" ? avg([0,1,2,3])  : sum([0,1,2,3]),
    Y2:  metric === "merchants" ? avg([4,5,6,7])  : sum([4,5,6,7]),
    YTD: metric === "merchants" ? avg([8,9,10,11]) : sum([8,9,10,11]),
  };
}

function deriveMonths(s: Solution, metric: Metric): Record<string, number> {
  return Object.fromEntries(MONTH_COLS.map((label, i) => [label, s.series[i]?.[metric] ?? 0]));
}

function fmtCell(value: number, metric: Metric): string {
  if (metric === "txnValue") return formatZAR(value);
  return formatNumber(value, false);
}

function visibleCols(mode: ViewMode, hasDailyData: boolean): string[] {
  const cols: string[] = [];
  if (mode === "years"  || mode === "all") cols.push(...YEAR_COLS);
  if (mode === "months" || mode === "all") cols.push(...MONTH_COLS);
  if (mode === "days"   || mode === "all") cols.push(...(hasDailyData ? DAY_COLS : []));
  return cols;
}

interface RowData { solution: Solution; values: Record<string, number>; }

function buildRows(solutions: Solution[], metric: Metric, dailyByEntity: Map<string, Map<string, AllDailyRow>>): RowData[] {
  return solutions.map((s) => {
    const dayMap = dailyByEntity.get(s.id);
    const dayValues: Record<string, number> = {};
    for (const col of DAY_COLS) {
      const row = dayMap?.get(col);
      if (row) {
        dayValues[col] = metric === "merchants" ? row.active_merchants
          : metric === "txnCount" ? Number(row.approved_count)
          : Number(row.approved_value);
      } else {
        dayValues[col] = 0;
      }
    }
    return {
      solution: s,
      values: { ...deriveYears(s, metric), ...deriveMonths(s, metric), ...dayValues },
    };
  });
}

function exportToExcel(rows: RowData[], cols: string[], metric: Metric) {
  const label = metric === "merchants" ? "Active Lanes" : metric === "txnCount" ? "Txn Count" : "Txn Value (ZAR)";
  const ws = XLSX.utils.aoa_to_sheet([
    ["Area", "Name", "Tag", ...cols],
    ...rows.map((r) => [r.solution.area, r.solution.name, r.solution.tag, ...cols.map((c) => r.values[c] ?? 0)]),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, label);
  XLSX.writeFile(wb, `transpector-report-${metric}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const AREA_ORDER = ["Payment Methods", "Solutions", "Channels", "Platforms", "Countries", "Banks"] as const;

const AREA_ORDER_PATHS = ["Payment Methods", "Solutions", "Channels", "Platforms", "Countries", "Banks"] as const;

const Reports = () => {
  const [mode, setMode]     = useState<ViewMode>("all");
  const [metric, setMetric] = useState<Metric>("merchants");
  const [shortNames, setShortNames] = useState<ShortNameMap>({});
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setShortNames(loadShortNames()); }, []);

  const pm       = useAreaSolutions("Payment Methods");
  const sols     = useAreaSolutions("Solutions");
  const channels = useAreaSolutions("Channels");
  const platforms = useAreaSolutions("Platforms");
  const countries = useAreaSolutions("Countries");
  const banks    = useAreaSolutions("Banks");

  const isLoading = [pm, sols, channels, platforms, countries, banks].some((q) => q.isLoading);

  // Fetch daily data for all areas when in days/all mode
  const dailyQueries = useQueries({
    queries: AREA_ORDER_PATHS.map((area) => ({
      queryKey: ["allDaily", area],
      queryFn:  () => getAllDailyStats(AREA_PATH[area]),
      enabled:  mode === "days" || mode === "all",
      staleTime: 5 * 60 * 1000,
    })),
  });
  const isDailyLoading = dailyQueries.some((q) => q.isLoading);

  // Build entity → (dateLabel → row) map
  const dailyByEntity = useMemo(() => {
    const map = new Map<string, Map<string, AllDailyRow>>();
    for (const q of dailyQueries) {
      for (const row of (q.data ?? [])) {
        const d = new Date(row.date);
        const label = d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
        if (!map.has(row.id)) map.set(row.id, new Map());
        map.get(row.id)!.set(label, row);
      }
    }
    return map;
  }, [dailyQueries]);

  const allSolutions = useMemo(() => [
    ...pm.solutions, ...sols.solutions, ...channels.solutions,
    ...platforms.solutions, ...countries.solutions, ...banks.solutions,
  ], [pm.solutions, sols.solutions, channels.solutions, platforms.solutions, countries.solutions, banks.solutions]);

  const hasDailyData = !isDailyLoading && dailyByEntity.size > 0;
  const rows = useMemo(() => buildRows(allSolutions, metric, dailyByEntity), [allSolutions, metric, dailyByEntity]);
  const cols = useMemo(() => visibleCols(mode, hasDailyData), [mode, hasDailyData]);

  const grouped = useMemo(() =>
    AREA_ORDER
      .map((area) => ({ area, rows: rows.filter((r) => r.solution.area === area) }))
      .filter((g) => g.rows.length > 0),
    [rows]
  );

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <MobileTopBar />
        <div className="flex-1 flex flex-col px-5 sm:px-8 lg:px-12 py-8 lg:py-10 gap-6 min-h-0">
          <PageHeader
            title="Reports"
            crumbs={[{ label: "Insights Hub" }, { label: "Reports" }]}
            right={
              <button
                onClick={() => exportToExcel(rows, cols, metric)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan text-cyan-foreground text-xs font-semibold hover:bg-cyan/90 transition-colors shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                Export to Excel
              </button>
            }
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1 border border-border">
              {(["years", "months", "days", "all"] as ViewMode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={cn("px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize",
                    mode === m ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                  )}>
                  {m === "years" ? "Years" : m === "months" ? "Months" : m === "days" ? "30 Days" : "All"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1 border border-border">
              {([["merchants", "Lanes"], ["txnCount", "Txn Count"], ["txnValue", "Txn Value"]] as [Metric, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setMetric(key)}
                  className={cn("px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                    metric === key ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                  )}>
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-1">
              {isLoading ? "Loading…" : `${cols.length} columns · ${rows.length} rows`}
            </span>
          </div>

          <div ref={tableRef} className="flex-1 min-h-0 overflow-auto rounded-2xl border border-border shadow-card bg-card">
            {isLoading ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground animate-pulse">Loading report data…</div>
            ) : (
            <table className="text-sm border-collapse" style={{ minWidth: `${Math.max(600, 130 + cols.length * 110)}px` }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-card border-b border-border">
                  <th className="sticky left-0 z-30 bg-card px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap border-r border-border min-w-[110px] sm:min-w-[130px]" />
                  {(mode === "years" || mode === "all") && (
                    <th colSpan={3} className="px-4 py-3 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider border-r border-border bg-secondary/40">Years</th>
                  )}
                  {(mode === "months" || mode === "all") && (
                    <th colSpan={12} className="px-4 py-3 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider border-r border-border bg-secondary/20">Months</th>
                  )}
                  {(mode === "days" || mode === "all") && (
                    <th colSpan={DAY_COLS.length} className="px-4 py-3 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider bg-cyan/5">
                      {isDailyLoading ? "Loading daily…" : "Daily (last 30 days)"}
                    </th>
                  )}
                </tr>
                <tr className="bg-card border-b-2 border-border">
                  <th className="sticky left-0 z-30 bg-card px-4 py-2 text-left text-xs text-muted-foreground font-medium border-r border-border">Name · Area · Tag</th>
                  {cols.map((col) => (
                    <th key={col} className={cn("px-3 py-2 text-right text-xs font-semibold whitespace-nowrap",
                      DAY_COLS.includes(col) ? "text-cyan bg-cyan/5" : "text-muted-foreground",
                      (col === "YTD" || col === "Apr 26") && "border-r border-border",
                      col === DAY_COLS[0] && "border-l border-border"
                    )}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ area, rows: areaRows }) => (
                  <>
                    <tr key={`area-${area}`} className="bg-secondary/30 border-y border-border">
                      <td className="sticky left-0 z-10 bg-secondary/30 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground border-r border-border" colSpan={1}>{area}</td>
                      {cols.map((col) => <td key={col} className="px-3 py-2" />)}
                    </tr>
                    {areaRows.map((row) => (
                      <DataRow key={row.solution.id} row={row} cols={cols} metric={metric} shortNames={shortNames} />
                    ))}
                  </>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// ─── Data row ─────────────────────────────────────────────────────────────────

const DataRow = ({ row, cols, metric, shortNames }: { row: RowData; cols: string[]; metric: Metric; shortNames: ShortNameMap }) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const displayName = shortNames[row.solution.id] ?? row.solution.shortName;
  const values  = cols.map((c) => row.values[c] ?? 0);
  const max     = Math.max(...values);
  const min     = Math.min(...values);
  const range   = max - min || 1;

  return (
    <tr className="border-b border-border/50 hover:bg-secondary/40 transition-colors group">
      <td className="sticky left-0 z-10 bg-card group-hover:bg-secondary transition-colors px-4 py-3 border-r border-border">
        <div className="flex items-center gap-2">
          {row.solution.logo && !logoFailed ? (
            <div className="hidden sm:flex h-7 w-7 shrink-0 rounded-md overflow-hidden bg-white border border-border/40 items-center justify-center p-0.5">
              <img src={row.solution.logo} alt={row.solution.name} className="h-full w-full object-contain" onError={() => setLogoFailed(true)} />
            </div>
          ) : (
            <div className="hidden sm:grid h-7 w-7 shrink-0 rounded-md bg-secondary place-items-center text-[10px] font-bold text-muted-foreground">
              {row.solution.shortName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="sm:hidden font-medium text-foreground truncate text-xs">{displayName}</div>
            <div className="hidden sm:block font-medium text-foreground truncate max-w-[90px]">{row.solution.name}</div>
            {row.solution.tag && (
              <div className="hidden sm:block text-[10px] uppercase tracking-wider text-muted-foreground/60 truncate">{row.solution.tag}</div>
            )}
          </div>
        </div>
      </td>
      {cols.map((col, ci) => {
        const val       = row.values[col] ?? 0;
        const intensity = (val - min) / range;
        const isDay     = DAY_COLS.includes(col);
        const isFirstDay = col === DAY_COLS[0];
        return (
          <td key={col}
            className={cn("px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap",
              isFirstDay && "border-l border-border",
              (col === "YTD" || col === "Apr 26") && "border-r border-border"
            )}
            style={{ background: isDay ? `hsla(var(--cyan) / ${intensity * 0.18})` : `hsla(var(--navy) / ${intensity * 0.12})` }}
          >
            <span className={cn("font-medium", isDay ? "text-cyan" : "text-foreground")}>
              {fmtCell(val, metric)}
            </span>
          </td>
        );
      })}
    </tr>
  );
};

export default Reports;
