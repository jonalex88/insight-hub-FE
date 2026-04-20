import { useMemo, useState } from "react";
import { MobileTopBar, Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { POSProviderCard } from "@/components/POSProviderCard";
import { getAllSolutions } from "@/data/entityStore";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Store, Layers, BarChart3 } from "lucide-react";

const INDUSTRIES = ["All", "Retail", "Hospitality", "Pharmacy", "Petroleum", "Fashion & Apparel", "Wholesale", "Enterprise", "Other"];

const POSProvidersPage = () => {
  const [industry, setIndustry] = useState("All");
  const allProviders = useMemo(() => getAllSolutions("POS Providers"), []);
  const isLoading = false;

  const filtered = useMemo(() => {
    if (industry === "All") return allProviders;
    const isOther = industry === "Other";
    return allProviders.filter((p) => {
      const ind = p.primaryIndustry ?? "";
      if (isOther) return !INDUSTRIES.slice(1, -1).includes(ind);
      return ind === industry;
    });
  }, [allProviders, industry]);

  const totalStores = filtered.reduce((a, p) => a + (p.storeCount ?? 0), 0);
  const totalLanes  = filtered.reduce((a, p) => a + (p.laneCount  ?? 0), 0);
  const revShareCount = filtered.filter((p) => p.revShareEnabled).length;

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar />
        <div className="flex-1 px-5 sm:px-8 lg:px-12 py-8 lg:py-10 space-y-8 max-w-[1600px] w-full mx-auto">
          <PageHeader
            title="POS Providers"
            crumbs={[{ label: "Insights Hub" }, { label: "POS Providers" }]}
            right={
              <div className="text-xs text-muted-foreground bg-card border border-border rounded-full px-4 py-2 shadow-card">
                {filtered.length} provider{filtered.length !== 1 ? "s" : ""}
              </div>
            }
          />

          {/* Summary tiles */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              icon={<Store className="h-5 w-5 text-cyan" />}
              label="Total stores"
              value={formatNumber(totalStores, false)}
              sub={`${filtered.length} provider${filtered.length !== 1 ? "s" : ""}`}
            />
            <StatTile
              icon={<Layers className="h-5 w-5 text-violet-500" />}
              label="Total lanes"
              value={formatNumber(totalLanes, false)}
              sub="Across filtered providers"
            />
            <StatTile
              icon={<BarChart3 className="h-5 w-5 text-emerald-500" />}
              label="Rev share enabled"
              value={String(revShareCount)}
              sub={`of ${filtered.length} providers`}
            />
          </section>

          {/* Industry filter */}
          <div className="overflow-x-auto -mx-5 px-5 sm:-mx-8 sm:px-8">
            <div className="flex gap-2 min-w-max pb-1">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  onClick={() => setIndustry(ind)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border whitespace-nowrap",
                    industry === ind
                      ? "bg-cyan text-cyan-foreground border-cyan shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-cyan/30"
                  )}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>

          {/* Provider list */}
          <section className="space-y-3">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-secondary animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No providers in this category.</p>
            ) : (
              filtered.map((provider) => (
                <POSProviderCard key={provider.id} provider={provider} />
              ))
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

const StatTile = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) => (
  <div className="bg-card rounded-2xl border border-border shadow-card p-5 flex items-center gap-4">
    <div className="shrink-0">{icon}</div>
    <div>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-foreground tabular-nums mt-0.5">{value}</div>
      <div className="text-xs text-muted-foreground/60 mt-0.5">{sub}</div>
    </div>
  </div>
);

export default POSProvidersPage;
