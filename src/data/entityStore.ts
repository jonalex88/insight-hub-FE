import { solutions, Solution, Area } from "./solutions";
import { API_BASE } from "./apiBase";

const STORAGE_KEY = "tj-created-entities";

const MONTH_LABELS = [
  "May 25","Jun 25","Jul 25","Aug 25","Sep 25","Oct 25",
  "Nov 25","Dec 25","Jan 26","Feb 26","Mar 26","Apr 26",
];

const ZERO_SERIES = MONTH_LABELS.map((month) => ({
  month, merchants: 0, txnCount: 0, txnValue: 0,
}));

const ACCENTS: Solution["accent"][] = ["cyan","violet","emerald","amber","rose","sky"];

const AREA_ENDPOINT: Record<string, string> = {
  "Payment Methods": `${API_BASE}/payment-methods`,
  "Solutions":       `${API_BASE}/solution-tags`,
  "Platforms":       `${API_BASE}/platforms`,
  "Countries":       `${API_BASE}/countries`,
  "Banks":           `${API_BASE}/banks`,
};

export function loadCreatedEntities(): Solution[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCreatedEntities(all: Solution[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function saveCreatedEntity(entity: Solution): void {
  const all = loadCreatedEntities();
  const idx = all.findIndex((e) => e.id === entity.id);
  if (idx >= 0) all[idx] = entity;
  else all.push(entity);
  saveCreatedEntities(all);
}

export function getAllSolutions(area?: Area): Solution[] {
  const created = loadCreatedEntities();
  const staticIds = new Set(solutions.map((s) => s.id));
  const extra = created.filter((e) => !staticIds.has(e.id));
  const all = [...solutions, ...extra];
  return area ? all.filter((s) => s.area === area) : all;
}

export interface CreateEntityInput {
  name: string;
  shortName: string;
  tag: string;
  logo: string;
  description: string;
  area: Area;
}

export async function createEntity(input: CreateEntityInput): Promise<Solution> {
  const id = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const accentSeed = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const entity: Solution = {
    id,
    name: input.name.trim(),
    shortName: (input.shortName.trim() || input.name.trim()),
    description: input.description.trim(),
    area: input.area,
    tag: input.tag.trim(),
    launchDate: new Date().toISOString().slice(0, 10),
    enabledMerchants: 0,
    approvedValue30d: 0,
    merchantGrowthPct: 0,
    series: ZERO_SERIES,
    accent: ACCENTS[accentSeed % ACCENTS.length],
    logo: input.logo.trim() || undefined,
  };

  saveCreatedEntity(entity);

  const base = AREA_ENDPOINT[input.area];
  if (base) {
    try {
      await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: entity.name,
          short_name: entity.shortName,
          tag: entity.tag || undefined,
          logo: entity.logo || undefined,
          description: entity.description || undefined,
        }),
      });
    } catch {
      // API unavailable — local save is the fallback
    }
  }

  return entity;
}
