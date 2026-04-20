import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileTopBar, Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { SolutionFilters } from "@/components/SolutionFilters";
import { SolutionCard } from "@/components/SolutionCard";
import { Area, Solution } from "@/data/solutions";
import { useAreaSolutions } from "@/hooks/useAreaSolutions";
import { formatNumber, formatZAR } from "@/lib/format";
import { cn } from "@/lib/utils";

const AREA_META: Record<Area, { title: string; noun: string; path: string }> = {
  "Payment Methods": { title: "Payment Methods",  noun: "method",   path: "/payment-methods" },
  "Solutions":       { title: "Solutions",         noun: "solution", path: "/solutions"        },
  "Channels":        { title: "Channels",          noun: "channel",  path: "/channels"         },
  "Platforms":       { title: "Platforms",         noun: "platform", path: "/platforms"        },
  "Countries":       { title: "Countries",         noun: "country",  path: "/countries"        },
  "Banks":           { title: "Banks",             noun: "bank",     path: "/banks"            },
};

interface Props { area: Area; }

export const AreaPage = ({ area }: Props) => {
  const [query, setQuery]   = useState("");
  const [tag, setTag]       = useState("all");
  const [launch, setLaunch] = useState("all");
  const navigate = useNavigate();

  const { solutions: areaSolutions, isLoading } = useAreaSolutions(area);

  const tags = useMemo(
    () => [...new Set(areaSolutions.map(s => s.tag).filter(Boolean))].sort(),
    [areaSolutions]
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    const yrs = (iso: string) => (now - new Date(iso).getTime()) / (365 * 24 * 3600 * 1000);
    return areaSolutions.filter((s) => {
      if (query && !`${s.name} ${s.shortName} ${s.tag} ${s.description}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (tag !== "all" && s.tag !== tag) return false;
      if (launch === "lt2y" && yrs(s.launchDate) >= 2) return false;
      if (launch === "2to4" && (yrs(s.launchDate) < 2 || yrs(s.launchDate) > 4)) return false;
      if (launch === "gt4" && yrs(s.launchDate) <= 4) return false;
      return true;
    }).sort((a, b) => b.enabledMerchants - a.enabledMerchants);
  }, [areaSolutions, query, tag, launch]);

  const { title, noun, path } = AREA_META[area];
  const totalMerchants = filtered.reduce((a, s) => a + s.enabledMerchants, 0);
  const totalValue     = filtered.reduce((a, s) => a + s.approvedValue30d, 0);
  const avgGrowth      = filtered.length ? filtered.reduce((a, s) => a + s.merchantGrowthPct, 0) / filtered.length : 0;

  const handleCardClick = (s: Solution) => navigate(`${path}/${s.id}`);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar />

        <div className="flex-1 px-5 sm:px-8 lg:px-12 py-8 lg:py-10 space-y-8 max-w-[1600px] w-full mx-auto">
          <PageHeader
            title={title}
            crumbs={[{ label: "Insights Hub" }, { label: title }]}
            right={
              <div className="text-xs text-muted-foreground bg-card border border-border rounded-full px-4 py-2 shadow-card">
                Snapshot · Last 30 days
              </div>
            }
          />

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Total active lanes"
              value={formatNumber(totalMerchants, false)}
              sub={`${filtered.length} active ${noun}${filtered.length === 1 ? "" : "s"}`}
            />
            <StatTile
              label="30 day approved value"
              value={formatZAR(totalValue)}
              sub={`Across filtered ${noun}s`}
            />
            <StatTile
              label="Avg lane growth"
              value={`${avgGrowth >= 0 ? "+" : ""}${avgGrowth.toFixed(1)}%`}
              sub="Compared with prior 30 days"
              highlight
            />
          </section>

          {tags.length > 0 && (
            <SolutionFilters
              query={query} setQuery={setQuery}
              tag={tag} setTag={setTag} tags={tags}
              launch={launch} setLaunch={setLaunch}
            />
          )}

          <section className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{title} performance</h2>
              <p className="text-sm text-muted-foreground">Click any card to view details.</p>
            </div>

            {isLoading ? (
              <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground animate-pulse">
                Loading {title.toLowerCase()}…
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                No {title.toLowerCase()} match these filters.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filtered.map((s) => (
                  <SolutionCard key={s.id} solution={s} onClick={() => handleCardClick(s)} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

const StatTile = ({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) => (
  <div className={cn("rounded-2xl border p-5 shadow-card", highlight ? "bg-gradient-kpi text-navy-foreground border-transparent" : "bg-card border-border")}>
    <div className={cn("text-[11px] uppercase tracking-[0.16em] font-semibold", highlight ? "text-cyan" : "text-muted-foreground")}>{label}</div>
    <div className={cn("mt-2 font-display text-2xl md:text-3xl font-extrabold", highlight ? "text-navy-foreground" : "text-foreground")}>{value}</div>
    <div className={cn("mt-1 text-xs", highlight ? "text-navy-foreground/60" : "text-muted-foreground")}>{sub}</div>
  </div>
);
