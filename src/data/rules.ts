export interface Rule {
  id: string;
  transactionTypes: string[];
  fieldType: string;
  operator: string;
  value: string;
}

export interface EntityRules {
  entityId: string;
  rules: Rule[];
}

export const TRANSACTION_TYPES = ["0100", "0200", "0220", "0420", "0600"] as const;

export const OPERATORS: { value: string; label: string }[] = [
  { value: "eq",           label: "equals"           },
  { value: "neq",          label: "does not equal"   },
  { value: "begins_with",  label: "begins with"      },
  { value: "ends_with",    label: "ends with"        },
  { value: "contains",     label: "contains"         },
  { value: "not_contains", label: "does not contain" },
  { value: "present",      label: "is present"       },
  { value: "absent",       label: "is absent"        },
];

import { API_BASE } from "./apiBase";
const BASE = `${API_BASE}/rules`;
const STORAGE_KEY = "tj-rules";

// ─── Local cache helpers (optimistic UI) ──────────────────────────────────────

function cacheLoad(): EntityRules[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function cacheSave(all: EntityRules[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

// Convert flat API row → Rule
function rowToRule(row: Record<string, unknown>): Rule {
  return {
    id:               row.id as string,
    transactionTypes: (row.transaction_types as string[]) ?? [],
    fieldType:        row.field_type as string,
    operator:         (row.operator as string) ?? "eq",
    value:            (row.value as string) ?? "",
  };
}

// ─── API + cache: load all rules ──────────────────────────────────────────────

export async function fetchAllRules(): Promise<EntityRules[]> {
  try {
    const res = await fetch(BASE);
    if (!res.ok) throw new Error("non-2xx");
    const rows: Record<string, unknown>[] = await res.json();

    // Group flat rows by entity_id
    const map = new Map<string, Rule[]>();
    for (const row of rows) {
      const eid = row.entity_id as string;
      if (!map.has(eid)) map.set(eid, []);
      map.get(eid)!.push(rowToRule(row));
    }
    const all: EntityRules[] = Array.from(map.entries()).map(([entityId, rules]) => ({ entityId, rules }));
    cacheSave(all);
    return all;
  } catch {
    // API unavailable — fall back to local cache
    return cacheLoad();
  }
}

export function getCachedRules(): EntityRules[] {
  return cacheLoad();
}

// ─── Pure helpers (no side effects) ──────────────────────────────────────────

export function getEntityRules(all: EntityRules[], entityId: string): Rule[] {
  return all.find((e) => e.entityId === entityId)?.rules ?? [];
}

function applyToCache(next: EntityRules[]): void {
  cacheSave(next);
}

// ─── API mutations (returns updated cache for immediate UI update) ─────────────

export async function apiAddRule(
  all: EntityRules[],
  entityId: string,
  rule: Omit<Rule, "id">
): Promise<EntityRules[]> {
  const res = await fetch(`${BASE}/${encodeURIComponent(entityId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction_types: rule.transactionTypes,
      field_type:        rule.fieldType,
      operator:          rule.operator,
      value:             rule.value,
    }),
  });
  if (!res.ok) throw new Error(`Failed to save rule (${res.status})`);
  const newRule = rowToRule(await res.json());
  const next = insertRule(all, entityId, newRule);
  applyToCache(next);
  return next;
}

export async function apiUpdateRule(
  all: EntityRules[],
  entityId: string,
  updated: Rule
): Promise<EntityRules[]> {
  const res = await fetch(`${BASE}/${encodeURIComponent(entityId)}/${updated.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction_types: updated.transactionTypes,
      field_type:        updated.fieldType,
      operator:          updated.operator,
      value:             updated.value,
    }),
  });
  if (!res.ok) throw new Error(`Failed to update rule (${res.status})`);
  const next = replaceRule(all, entityId, updated);
  applyToCache(next);
  return next;
}

export async function apiDeleteRule(
  all: EntityRules[],
  entityId: string,
  ruleId: string
): Promise<EntityRules[]> {
  const res = await fetch(`${BASE}/${encodeURIComponent(entityId)}/${ruleId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete rule (${res.status})`);
  const next = removeRule(all, entityId, ruleId);
  applyToCache(next);
  return next;
}

// ─── Immutable helpers ────────────────────────────────────────────────────────

function insertRule(all: EntityRules[], entityId: string, rule: Rule): EntityRules[] {
  const existing = all.find((e) => e.entityId === entityId);
  if (existing) {
    return all.map((e) => e.entityId === entityId ? { ...e, rules: [...e.rules, rule] } : e);
  }
  return [...all, { entityId, rules: [rule] }];
}

function replaceRule(all: EntityRules[], entityId: string, updated: Rule): EntityRules[] {
  return all.map((e) =>
    e.entityId === entityId
      ? { ...e, rules: e.rules.map((r) => (r.id === updated.id ? updated : r)) }
      : e
  );
}

function removeRule(all: EntityRules[], entityId: string, ruleId: string): EntityRules[] {
  return all.map((e) =>
    e.entityId === entityId
      ? { ...e, rules: e.rules.filter((r) => r.id !== ruleId) }
      : e
  );
}
