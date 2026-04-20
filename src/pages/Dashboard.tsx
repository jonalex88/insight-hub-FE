import { useState, useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import { MobileTopBar, Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { Area, Solution } from "@/data/solutions";
import { getStats30d, AREA_PATH } from "@/data/apiClient";
import { loadShortNames, ShortNameMap } from "@/data/shortNames";
import { cn } from "@/lib/utils";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionData {
  area: Area;
  label: string;
  top: Solution[];
  bottom: Solution[];
}

// ─── Performers logic ─────────────────────────────────────────────────────────

const SECTIONS: { area: Area; label: string }[] = [
  { area: "Payment Methods", label: "Payment Methods" },
  { area: "Countries",       label: "Countries"       },
  { area: "Platforms",       label: "Platforms"       },
  { area: "Solutions",       label: "Solutions"       },
];

const ACCENTS: Solution["accent"][] = ["cyan", "violet", "emerald", "amber", "rose", "sky"];
function accentFor(id: string): Solution["accent"] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffff;
  return ACCENTS[h % ACCENTS.length];
}

function buildSections(allRows: Solution[][]): SectionData[] {
  return SECTIONS.map(({ area, label }, i) => {
    const items = (allRows[i] ?? []).sort((a, b) => b.merchantGrowthPct - a.merchantGrowthPct);
    const top       = items.slice(0, Math.min(3, items.length));
    const remaining = items.slice(top.length);
    const bottom    = remaining.slice(Math.max(0, remaining.length - 3));
    return { area, label, top, bottom };
  });
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

const Dashboard = () => {
  const [shortNames, setShortNames] = useState<ShortNameMap>({});
  useEffect(() => { setShortNames(loadShortNames()); }, []);

  const results = useQueries({
    queries: SECTIONS.map(({ area }) => ({
      queryKey: ["stats30d", area],
      queryFn:  () => getStats30d(AREA_PATH[area]),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);

  const allRows: Solution[][] = results.map((r) =>
    (r.data ?? []).map((row) => ({
      id:               row.id,
      name:             row.name,
      shortName:        row.short_name,
      description:      row.description ?? "",
      area:             (row.area ?? "") as Area,
      tag:              row.tag ?? "",
      launchDate:       "2020-01-01",
      enabledMerchants: row.active_merchants,
      approvedValue30d: Number(row.approved_value),
      merchantGrowthPct: Number(row.merchant_growth_pct ?? 0),
      series:           [],
      accent:           accentFor(row.id),
      logo:             row.logo ?? undefined,
    }))
  );

  const sections = buildSections(allRows);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar />
        <div className="flex-1 px-5 sm:px-8 lg:px-12 py-8 lg:py-10 space-y-8 max-w-[1600px] w-full mx-auto">
          <PageHeader
            title="Dashboard"
            crumbs={[{ label: "Insights Hub" }, { label: "Dashboard" }]}
            right={
              <div className="text-xs text-muted-foreground bg-card border border-border rounded-full px-4 py-2 shadow-card">
                Snapshot · Last 30 days
              </div>
            }
          />

          <section className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">High &amp; Low Performers</h2>
              <p className="text-sm text-muted-foreground">Month-on-month lane growth, top 3 and bottom 3 per section.</p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {SECTIONS.map((s) => (
                  <div key={s.area} className="bg-card rounded-2xl border border-border shadow-card h-48 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {sections.map((section) => (
                  <SectionPanel key={section.area} section={section} shortNames={shortNames} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

// ─── Section panel ────────────────────────────────────────────────────────────

const SectionPanel = ({ section, shortNames }: { section: SectionData; shortNames: ShortNameMap }) => (
  <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
    <div className="px-5 py-4 border-b border-border">
      <h3 className="font-display font-bold text-foreground">{section.label}</h3>
    </div>
    <div className="grid grid-cols-2 divide-x divide-border">
      <PerformerColumn heading="Top performers"  items={section.top}    positive emptyLabel="No data yet"                                       shortNames={shortNames} />
      <PerformerColumn heading="Low performers"  items={section.bottom} positive={false} emptyLabel={section.top.length > 0 ? "—" : "No data yet"} shortNames={shortNames} />
    </div>
  </div>
);

// ─── Performer column ─────────────────────────────────────────────────────────

const PerformerColumn = ({ heading, items, positive, emptyLabel, shortNames }: {
  heading: string; items: Solution[]; positive: boolean; emptyLabel: string; shortNames: ShortNameMap;
}) => (
  <div className="p-4 space-y-1">
    <div className={cn("flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] font-semibold mb-3", positive ? "text-emerald-500" : "text-rose-500")}>
      {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {heading}
    </div>
    {items.length === 0 ? (
      <p className="text-sm text-muted-foreground/50 py-2">{emptyLabel}</p>
    ) : (
      items.map((item) => <PerformerRow key={item.id} item={item} positive={positive} shortNames={shortNames} />)
    )}
  </div>
);

// ─── Performer row ────────────────────────────────────────────────────────────

const accentMap: Record<Solution["accent"], string> = {
  cyan:    "from-cyan/20 to-cyan/5 text-cyan",
  sky:     "from-sky-500/20 to-sky-500/5 text-sky-500",
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
  violet:  "from-violet-500/20 to-violet-500/5 text-violet-500",
  amber:   "from-amber-500/20 to-amber-500/5 text-amber-500",
  rose:    "from-rose-500/20 to-rose-500/5 text-rose-500",
};

const PerformerRow = ({ item, positive, shortNames }: { item: Solution; positive: boolean; shortNames: ShortNameMap }) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const pct  = item.merchantGrowthPct;
  const sign = pct >= 0 ? "+" : "";

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-secondary/50 transition-colors">
      {item.logo && !logoFailed ? (
        <div className="h-8 w-8 shrink-0 rounded-lg overflow-hidden bg-white border border-border/40 flex items-center justify-center p-1">
          <img src={item.logo} alt={item.name} className="h-full w-full object-contain" onError={() => setLogoFailed(true)} />
        </div>
      ) : (
        <div className={cn("h-8 w-8 shrink-0 rounded-lg grid place-items-center bg-gradient-to-br", accentMap[item.accent])}>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      )}
      <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
        {shortNames[item.id] ?? item.shortName}
      </span>
      <span className={cn("shrink-0 text-xs font-bold tabular-nums px-2 py-0.5 rounded-full",
        positive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
      )}>
        {sign}{pct.toFixed(1)}%
      </span>
    </div>
  );
};

export default Dashboard;
