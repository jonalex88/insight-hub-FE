import { useState } from "react";
import { ArrowUpRight, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { Solution } from "@/data/solutions";
import { formatNumber, formatZAR } from "@/lib/format";
import { cn } from "@/lib/utils";

const accentMap: Record<Solution["accent"], string> = {
  cyan: "from-cyan/20 to-cyan/5 text-cyan",
  sky: "from-sky-500/20 to-sky-500/5 text-sky-500",
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
  violet: "from-violet-500/20 to-violet-500/5 text-violet-500",
  amber: "from-amber-500/20 to-amber-500/5 text-amber-500",
  rose: "from-rose-500/20 to-rose-500/5 text-rose-500",
};

interface Props {
  solution: Solution;
  onClick: () => void;
}

export const SolutionCard = ({ solution, onClick }: Props) => {
  const positive = solution.merchantGrowthPct >= 0;
  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left bg-card rounded-2xl border border-border shadow-card hover:shadow-card-hover hover:border-cyan/40 hover:-translate-y-0.5 transition-all duration-300 ease-out overflow-hidden"
    >
      <div className={cn("absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500", accentMap[solution.accent])} />

      <div className="relative p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
        {/* Left: identity + description */}
        <div className="flex items-start gap-4 lg:w-[360px] lg:shrink-0">
          <LogoTile solution={solution} />
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-foreground leading-tight truncate">{solution.name}</h3>
            {solution.tag && <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 mt-0.5">{solution.tag}</p>}
            {solution.description && (
              <p
                className="mt-1.5 text-xs text-muted-foreground line-clamp-2 cursor-default"
                title={solution.description}
              >
                {solution.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: metrics */}
        <div className="grid grid-cols-3 gap-4 sm:gap-6 lg:gap-8 lg:shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-border lg:pl-8">
          <Metric
            icon={<Users className="h-3.5 w-3.5" />}
            label="Active Lanes"
            value={formatNumber(solution.enabledMerchants, false)}
          />
          <Metric
            icon={<Wallet className="h-3.5 w-3.5" />}
            label="30d value"
            value={formatZAR(solution.approvedValue30d)}
          />
          <Metric
            icon={positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            label="MoM lane growth"
            value={`${positive ? "+" : ""}${solution.merchantGrowthPct.toFixed(1)}%`}
            valueClass={positive ? "text-success" : "text-destructive"}
          />
        </div>
      </div>
    </button>
  );
};

const LogoTile = ({ solution }: { solution: Solution }) => {
  const [failed, setFailed] = useState(false);

  if (solution.logo && !failed) {
    return (
      <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-white border border-border/40 flex items-center justify-center p-1.5">
        <img
          src={solution.logo}
          alt={solution.name}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={cn("h-12 w-12 shrink-0 rounded-xl grid place-items-center bg-gradient-to-br", accentMap[solution.accent])}>
      <ArrowUpRight className="h-5 w-5" />
    </div>
  );
};

const Metric = ({
  icon, label, value, valueClass,
}: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-1 text-muted-foreground text-[11px] uppercase tracking-wider font-medium">
      {icon}
      <span>{label}</span>
    </div>
    <div className={cn("font-display font-bold text-foreground text-[15px] leading-tight truncate pl-[18px] lg:pl-0", valueClass)}>{value}</div>
  </div>
);
