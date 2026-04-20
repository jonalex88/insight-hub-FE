import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileTopBar, Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { SolutionCard } from "@/components/SolutionCard";
import { useAreaSolutions } from "@/hooks/useAreaSolutions";
import { formatNumber, formatZAR } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "South Africa" | "Africa";
const TABS: Tab[] = ["South Africa", "Africa"];

const BanksPage = () => {
  const [tab, setTab] = useState<Tab>("South Africa");
  const navigate = useNavigate();

  const { solutions: allBanks, isLoading } = useAreaSolutions("Banks");

  const filtered = useMemo(
    () => allBanks
      .filter((b) => b.region === tab)
      .sort((a, b) => b.enabledMerchants - a.enabledMerchants),
    [allBanks, tab]
  );

  const totalMerchants = filtered.reduce((a, b) => a + b.enabledMerchants, 0);
  const totalValue     = filtered.reduce((a, b) => a + b.approvedValue30d, 0);
  const avgGrowth      = filtered.length
    ? filtered.reduce((a, b) => a + b.merchantGrowthPct, 0) / filtered.length
    : 0;

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar />

        <div className="flex-1 px-5 sm:px-8 lg:px-12 py-8 lg:py-10 space-y-8 max-w-[1600px] w-full mx-auto">
          <PageHeader
            title="Banks"
            crumbs={[{ label: "Insights Hub" }, { label: "Banks" }]}
            right={
              <div className="text-xs text-muted-foreground bg-card border border-border rounded-full px-4 py-2 shadow-card">
                Snapshot · Last 30 days
              </div>
            }
          />

          {/* Tab bar */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1 border border-border w-fit">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-5 py-2 text-sm font-semibold rounded-md transition-all",
                  tab === t
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Summary tiles */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Total active lanes"
              value={formatNumber(totalMerchants, false)}
              sub={`${filtered.length} bank${filtered.length === 1 ? "" : "s"}`}
            />
            <StatTile
              label="30 day approved value"
              value={formatZAR(totalValue)}
              sub="Across filtered banks"
            />
            <StatTile
              label="Avg lane growth"
              value={`${avgGrowth >= 0 ? "+" : ""}${avgGrowth.toFixed(1)}%`}
              sub="Compared with prior 30 days"
              highlight
            />
          </section>

          {/* Cards */}
          <section className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{tab} bank performance</h2>
              <p className="text-sm text-muted-foreground">Sorted by active lanes. Click any card to view details.</p>
            </div>

            {isLoading ? (
              <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground animate-pulse">
                Loading banks…
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                No banks found for this region.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filtered.map((b) => (
                  <SolutionCard key={b.id} solution={b} onClick={() => navigate(`/banks/${b.id}`)} />
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

export default BanksPage;
