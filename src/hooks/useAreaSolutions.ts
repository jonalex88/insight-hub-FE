import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getStats30d, getStatsMonthly, AREA_PATH } from "@/data/apiClient";
import { Solution, Area } from "@/data/solutions";
import { getAllSolutions } from "@/data/entityStore";

const STATIC_ONLY_AREAS: Area[] = ["POS Providers"];

const ACCENTS: Solution["accent"][] = ["cyan", "violet", "emerald", "amber", "rose", "sky"];

function accentFor(id: string): Solution["accent"] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffff;
  return ACCENTS[h % ACCENTS.length];
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function ymToLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[m]} ${y.slice(2)}`;
}

export function useAreaSolutions(area: Area) {
  const isStaticOnly = STATIC_ONLY_AREAS.includes(area);
  const path = AREA_PATH[area];

  const { data: stats30d, isLoading: l1, error: e1 } = useQuery({
    queryKey: ["stats30d", area],
    queryFn:  () => getStats30d(path),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: !isStaticOnly,
  });

  const { data: monthly, isLoading: l2 } = useQuery({
    queryKey: ["statsMonthly", area],
    queryFn:  () => getStatsMonthly(path, 12),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: !isStaticOnly,
  });

  const solutions = useMemo((): Solution[] => {
    if (isStaticOnly) return getAllSolutions(area);
    if (!stats30d) return [];

    const byEntity: Record<string, typeof monthly> = {};
    for (const row of monthly ?? []) {
      (byEntity[row.id] ??= []).push(row);
    }

    return stats30d.map((row): Solution => {
      const series = (byEntity[row.id] ?? [])
        .sort((a, b) => a.year_month.localeCompare(b.year_month))
        .map((m) => ({
          month:     ymToLabel(m.year_month),
          merchants: m.active_merchants,
          txnCount:  Number(m.approved_count),
          txnValue:  Number(m.approved_value),
        }));

      return {
        id:                 row.id,
        name:               row.name,
        shortName:          row.short_name,
        description:        row.description ?? "",
        area:               (row.area ?? area) as Area,
        tag:                row.tag ?? "",
        launchDate:         "2020-01-01",
        enabledMerchants:   row.active_merchants,
        approvedValue30d:   Number(row.approved_value),
        merchantGrowthPct:  Number(row.merchant_growth_pct ?? 0),
        series,
        accent:             accentFor(row.id),
        logo:               row.logo ?? undefined,
        region:             row.region ?? undefined,
      };
    });
  }, [stats30d, monthly, area, isStaticOnly]);

  return { solutions, isLoading: isStaticOnly ? false : (l1 || l2), error: isStaticOnly ? null : e1 };
}
