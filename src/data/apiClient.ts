const BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:4000") + "/api/v1";

export interface Stats30dRow {
  id: string;
  name: string;
  short_name: string;
  area?: string;
  tag: string | null;
  logo: string | null;
  description: string | null;
  region?: string | null;
  total_count: string;
  approved_count: string;
  approved_value: string;
  active_merchants: number;
  approval_rate: string | null;
  merchant_growth_pct: string | null;
}

export interface MonthlyRow {
  id: string;
  year_month: string;
  approved_count: string;
  approved_value: string;
  active_merchants: number;
  growth_pct: string | null;
}

export interface TrendRow {
  year_month: string;
  total_count: string;
  approved_count: string;
  approved_value: string;
  active_merchants: number;
  approval_rate: string | null;
  growth_pct: string | null;
}

export interface DailyRow {
  date: string;
  total_count: string;
  approved_count: string;
  approved_value: string;
  active_merchants: number;
  approval_rate: string | null;
}

export const AREA_PATH: Record<string, string> = {
  "Payment Methods": "payment-methods",
  "Solutions":       "solution-tags",
  "Channels":        "channels",
  "Platforms":       "platforms",
  "Countries":       "countries",
  "Banks":           "banks",
  "POS Providers":   "pos-providers",
};

export interface PosProviderStatsRow {
  id: string;
  name: string;
  short_name: string;
  logo: string | null;
  description: string | null;
  primary_industry: string | null;
  rev_share_enabled: boolean;
  rev_share_pct: number | null;
  store_count: number;
  lane_count: number;
}

export function getPosProviderStats(): Promise<PosProviderStatsRow[]> {
  return apiFetch(`${BASE}/pos-providers/stats/latest`);
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${url} → ${res.status}`);
  return res.json();
}

export function getStats30d(path: string): Promise<Stats30dRow[]> {
  return apiFetch(`${BASE}/${path}/stats/30d`);
}

export function getStatsMonthly(path: string, months = 12): Promise<MonthlyRow[]> {
  return apiFetch(`${BASE}/${path}/stats/monthly?months=${months}`);
}

export function getTrendStats(path: string, id: string, months = 36): Promise<TrendRow[]> {
  return apiFetch(`${BASE}/${path}/${id}/trend?months=${months}`);
}

export function getDailyStats(path: string, id: string, days = 30): Promise<DailyRow[]> {
  return apiFetch(`${BASE}/${path}/${id}/daily?days=${days}`);
}

export interface AllDailyRow extends DailyRow {
  id: string;
}

export function getAllDailyStats(path: string, days = 30): Promise<AllDailyRow[]> {
  return apiFetch(`${BASE}/${path}/stats/daily?days=${days}`);
}

export interface Projection {
  entity_id:     string;
  start_date:    string | null;  // ISO date string
  target_date:   string;         // ISO date string
  lane_count:    number | null;
  txn_count:     number | null;
  monthly_value: number | null;
}

export function getAllProjections(): Promise<Projection[]> {
  return apiFetch(`${BASE}/projections`);
}

export function getProjection(entityId: string): Promise<Projection> {
  return apiFetch(`${BASE}/projections/${entityId}`);
}

export function upsertProjection(entityId: string, data: Omit<Projection, "entity_id" | "start_date"> & { start_date?: string | null }): Promise<Projection> {
  const res = fetch(`${BASE}/projections/${entityId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); });
}

export function deleteProjection(entityId: string): Promise<void> {
  return fetch(`${BASE}/projections/${entityId}`, { method: "DELETE" }).then(() => undefined);
}
