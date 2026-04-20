export function formatZAR(value: number, compact = true): string {
  if (compact) {
    if (value >= 1_000_000_000) return `R ${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `R ${(value / 1_000).toFixed(1)}K`;
    return `R ${value.toFixed(0)}`;
  }
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number, compact = true): string {
  if (compact) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return `${value}`;
  }
  return new Intl.NumberFormat("en-ZA").format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}
