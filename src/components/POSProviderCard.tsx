import { useState } from "react";
import { Store, Layers } from "lucide-react";
import { Solution } from "@/data/solutions";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const accentMap: Record<Solution["accent"], string> = {
  cyan:    "from-cyan/20 to-cyan/5 text-cyan",
  sky:     "from-sky-500/20 to-sky-500/5 text-sky-500",
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
  violet:  "from-violet-500/20 to-violet-500/5 text-violet-500",
  amber:   "from-amber-500/20 to-amber-500/5 text-amber-500",
  rose:    "from-rose-500/20 to-rose-500/5 text-rose-500",
};

const accentBg: Record<Solution["accent"], string> = {
  cyan:    "bg-cyan/10 text-cyan",
  sky:     "bg-sky-500/10 text-sky-500",
  emerald: "bg-emerald-500/10 text-emerald-500",
  violet:  "bg-violet-500/10 text-violet-500",
  amber:   "bg-amber-500/10 text-amber-500",
  rose:    "bg-rose-500/10 text-rose-500",
};

interface Props {
  provider: Solution;
}

export const POSProviderCard = ({ provider }: Props) => {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="group relative bg-card rounded-2xl border border-border shadow-card hover:shadow-card-hover hover:border-cyan/40 hover:-translate-y-0.5 transition-all duration-300 ease-out overflow-hidden">
      <div className={cn("absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500", accentMap[provider.accent])} />

      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
        {/* Logo / initials */}
        <div className="flex items-start gap-4 sm:w-[320px] sm:shrink-0">
          {provider.logo && !logoFailed ? (
            <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-white border border-border/40 flex items-center justify-center p-1.5">
              <img
                src={provider.logo}
                alt={provider.name}
                className="h-full w-full object-contain"
                onError={() => setLogoFailed(true)}
              />
            </div>
          ) : (
            <div className={cn("h-12 w-12 shrink-0 rounded-xl grid place-items-center text-sm font-bold", accentBg[provider.accent])}>
              {provider.shortName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-foreground leading-tight">{provider.name}</h3>
            {provider.primaryIndustry && (
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 mt-0.5">{provider.primaryIndustry}</p>
            )}
            {provider.tag && !provider.primaryIndustry && (
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 mt-0.5">{provider.tag}</p>
            )}
            {provider.description && (
              <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{provider.description}</p>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 sm:shrink-0 pt-4 sm:pt-0 border-t sm:border-t-0 sm:border-l border-border sm:pl-6">
          <Metric
            icon={<Store className="h-3.5 w-3.5" />}
            label="Stores"
            value={formatNumber(provider.storeCount ?? 0, false)}
          />
          <Metric
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Lanes"
            value={formatNumber(provider.laneCount ?? 0, false)}
          />
        </div>

        {/* Rev share badge */}
        {provider.revShareEnabled && (
          <div className="sm:ml-auto shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600">
              Rev Share {provider.revSharePct != null ? `${provider.revSharePct}%` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const Metric = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span className="text-[11px] uppercase tracking-wider font-semibold">{label}</span>
    </div>
    <div className="text-lg font-bold text-foreground tabular-nums">{value}</div>
  </div>
);
