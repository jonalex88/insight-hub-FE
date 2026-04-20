const STORAGE_KEY = "tj-short-names";

export type ShortNameMap = Record<string, string>;

export function loadShortNames(): ShortNameMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveShortName(entityId: string, shortName: string): void {
  const map = loadShortNames();
  map[entityId] = shortName;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getShortName(entityId: string, fallback: string): string {
  return loadShortNames()[entityId] ?? fallback;
}

import { API_BASE } from "./apiBase";

const AREA_ENDPOINT: Record<string, string> = {
  "Payment Methods": `${API_BASE}/payment-methods`,
  "Solutions":       `${API_BASE}/solution-tags`,
  "Platforms":       `${API_BASE}/platforms`,
  "Countries":       `${API_BASE}/countries`,
  "Channels":        `${API_BASE}/channels`,
  "Banks":           `${API_BASE}/banks`,
  "POS Providers":   `${API_BASE}/pos-providers`,
};

export type EntityPatch = {
  short_name?: string;
  description?: string;
  logo?: string;
  primary_industry?: string;
  rev_share_enabled?: boolean;
  rev_share_pct?: number | null;
};

export async function patchEntity(area: string, entityId: string, fields: EntityPatch): Promise<void> {
  const base = AREA_ENDPOINT[area];
  if (!base) return;
  try {
    await fetch(`${base}/${entityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
  } catch {
    // API unavailable — local save is the fallback
  }
}

export async function patchShortName(area: string, entityId: string, shortName: string): Promise<void> {
  return patchEntity(area, entityId, { short_name: shortName });
}
