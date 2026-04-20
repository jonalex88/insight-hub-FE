import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MobileTopBar, Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { Solution, Area } from "@/data/solutions";
import {
  Rule, EntityRules,
  TRANSACTION_TYPES, OPERATORS,
  fetchAllRules, getCachedRules, getEntityRules,
  apiAddRule, apiUpdateRule, apiDeleteRule,
} from "@/data/rules";
import { getShortName, saveShortName, patchEntity } from "@/data/shortNames";
import { createEntity } from "@/data/entityStore";
import { useAreaSolutions } from "@/hooks/useAreaSolutions";
import { Projection, upsertProjection, deleteProjection } from "@/data/apiClient";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronRight, TrendingUp } from "lucide-react";

// ─── Area tabs ────────────────────────────────────────────────────────────────

const TABS: { area: Area; label: string; singular: string }[] = [
  { area: "Payment Methods", label: "Payment Methods", singular: "Payment Method" },
  { area: "Solutions",       label: "Solutions",       singular: "Solution"        },
  { area: "Channels",        label: "Channels",        singular: "Channel"         },
  { area: "Platforms",       label: "Platforms",       singular: "Platform"        },
  { area: "Countries",       label: "Countries",       singular: "Country"         },
  { area: "Banks",           label: "Banks",           singular: "Bank"            },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

const Config = () => {
  const [activeTab, setActiveTab] = useState<Area>("Payment Methods");
  const [allRules, setAllRules]   = useState<EntityRules[]>(getCachedRules);
  const [showAdd, setShowAdd]     = useState(false);
  const queryClient = useQueryClient();

  const { data: allProjections = [], refetch: refetchProjections } = useQuery({
    queryKey: ["projections"],
    queryFn:  () => import("@/data/apiClient").then((m) => m.getAllProjections()),
    staleTime: 60_000,
  });

  const { solutions: entities, isLoading: entitiesLoading } = useAreaSolutions(activeTab);

  // Load rules from API on mount; cache is shown immediately while fetching
  useEffect(() => {
    fetchAllRules().then(setAllRules);
  }, []);

  const singular = TABS.find((t) => t.area === activeTab)?.singular ?? activeTab;

  const handleCreated = (_entity: Solution) => {
    queryClient.invalidateQueries({ queryKey: ["stats30d", activeTab] });
    queryClient.invalidateQueries({ queryKey: ["statsMonthly", activeTab] });
    setShowAdd(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar />
        <div className="flex-1 px-5 sm:px-8 lg:px-12 py-8 lg:py-10 space-y-6 max-w-[1400px] w-full mx-auto">
          <PageHeader
            title="Rules Config"
            crumbs={[{ label: "Insights Hub" }, { label: "Config" }]}
            right={
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-cyan text-cyan-foreground text-xs font-semibold hover:bg-cyan/90 transition-colors shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Add {singular}
              </button>
            }
          />

          <p className="text-sm text-muted-foreground max-w-2xl">
            Define how the stream processor tags incoming transactions. For payment method, country,
            platform, and channel — rules are evaluated in order and the first match wins (a transaction
            belongs to exactly one of each). For solutions, all matching rules apply — a single
            transaction can match multiple solutions simultaneously (e.g. a DCC transaction may also be
            tokenised and tagged as car rental).
          </p>

          {/* Tabs */}
          <div className="overflow-x-auto border-b border-border -mx-5 px-5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
            <div className="flex gap-1 min-w-max">
              {TABS.map((tab) => (
                <button
                  key={tab.area}
                  onClick={() => setActiveTab(tab.area)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap",
                    activeTab === tab.area
                      ? "border-cyan text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Entity list */}
          <div className="space-y-3">
            {entitiesLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-secondary animate-pulse" />
              ))
            ) : (
              entities.map((entity) => (
                <EntityRow
                  key={entity.id}
                  entity={entity}
                  rules={getEntityRules(allRules, entity.id)}
                  projection={allProjections.find((p) => p.entity_id === entity.id) ?? null}
                  onProjectionChange={() => refetchProjections()}
                  onAdd={async (rule) => { const next = await apiAddRule(allRules, entity.id, rule); setAllRules(next); }}
                  onUpdate={async (rule) => { const next = await apiUpdateRule(allRules, entity.id, rule); setAllRules(next); }}
                  onDelete={async (ruleId) => { const next = await apiDeleteRule(allRules, entity.id, ruleId); setAllRules(next); }}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {/* Add entity modal */}
      {showAdd && (
        <AddEntityModal
          area={activeTab}
          singular={singular}
          onCreated={handleCreated}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
};

// ─── Add entity modal ─────────────────────────────────────────────────────────

interface AddEntityModalProps {
  area: Area;
  singular: string;
  onCreated: (entity: Solution) => void;
  onClose: () => void;
}

const AddEntityModal = ({ area, singular, onCreated, onClose }: AddEntityModalProps) => {
  const [name,        setName]        = useState("");
  const [shortName,   setShortName]   = useState("");
  const [tag,         setTag]         = useState("");
  const [logo,        setLogo]        = useState("");
  const [description, setDescription] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const showTag = area !== "Countries";

  const valid = name.trim().length > 0;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      const entity = await createEntity({ name, shortName, tag, logo, description, area });
      onCreated(entity);
    } catch (e) {
      setError("Failed to create. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">Add {singular}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{singular} Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. My ${singular}`}
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-cyan/40"
            />
          </div>

          {/* Short Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Short Name</label>
            <input
              type="text"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Abbreviation for mobile views"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-cyan/40"
            />
          </div>

          {/* Tag (hidden for Countries) */}
          {showTag && (
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Tag / Category</label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. Card, QR, Loyalty"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-cyan/40"
              />
            </div>
          )}

          {/* Logo URL */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Logo URL</label>
            <input
              type="text"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://example.com/logo.svg"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-cyan/40"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description for the card tooltip"
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-cyan/40 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            disabled={!valid || saving}
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan text-cyan-foreground text-sm font-semibold disabled:opacity-40 hover:bg-cyan/90 transition-colors"
          >
            <Check className="h-4 w-4" />
            {saving ? "Creating…" : `Create ${singular}`}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Entity row ───────────────────────────────────────────────────────────────

interface EntityRowProps {
  entity: Solution;
  rules: Rule[];
  projection: Projection | null;
  onProjectionChange: () => void;
  onAdd: (rule: Omit<Rule, "id">) => Promise<void>;
  onUpdate: (rule: Rule) => Promise<void>;
  onDelete: (ruleId: string) => Promise<void>;
}

const EntityRow = ({ entity, rules, projection, onProjectionChange, onAdd, onUpdate, onDelete }: EntityRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Projection state
  const [projEnabled,   setProjEnabled]   = useState(!!projection);
  const [projStartDate, setProjStartDate] = useState(projection?.start_date?.slice(0, 10) ?? todayStr);
  const [projDate,      setProjDate]      = useState(projection?.target_date?.slice(0, 10) ?? "");
  const [projLanes,     setProjLanes]     = useState(projection?.lane_count?.toString() ?? "");
  const [projTxnCount,  setProjTxnCount]  = useState(projection?.txn_count?.toString() ?? "");
  const [projValue,     setProjValue]     = useState(projection?.monthly_value?.toString() ?? "");
  const [projSaving,    setProjSaving]    = useState(false);
  const [projSaved,     setProjSaved]     = useState(false);

  // Sync if projection prop changes (e.g. after refetch)
  useEffect(() => {
    setProjEnabled(!!projection);
    setProjStartDate(projection?.start_date?.slice(0, 10) ?? todayStr);
    setProjDate(projection?.target_date?.slice(0, 10) ?? "");
    setProjLanes(projection?.lane_count?.toString() ?? "");
    setProjTxnCount(projection?.txn_count?.toString() ?? "");
    setProjValue(projection?.monthly_value?.toString() ?? "");
  }, [projection]);

  const handleToggleProjection = async (enabled: boolean) => {
    setProjEnabled(enabled);
    if (!enabled && projection) {
      await deleteProjection(entity.id);
      onProjectionChange();
    }
  };

  const handleSaveProjection = async () => {
    if (!projDate) return;
    setProjSaving(true);
    try {
      await upsertProjection(entity.id, {
        start_date:    projStartDate || null,
        target_date:   projDate,
        lane_count:    projLanes    ? Number(projLanes)    : null,
        txn_count:     projTxnCount ? Number(projTxnCount) : null,
        monthly_value: projValue    ? Number(projValue)    : null,
      });
      onProjectionChange();
      setProjSaved(true);
      setTimeout(() => setProjSaved(false), 2000);
    } finally {
      setProjSaving(false);
    }
  };

  const initShortName   = getShortName(entity.id, entity.shortName);
  const initDescription = entity.description ?? "";
  const initLogo        = entity.logo ?? "";

  const [shortName,   setShortName]   = useState(initShortName);
  const [description, setDescription] = useState(initDescription);
  const [logo,        setLogo]        = useState(initLogo);

  const isDirty =
    shortName.trim()   !== initShortName.trim()   ||
    description.trim() !== initDescription.trim() ||
    logo.trim()        !== initLogo.trim();

  const handleApply = async () => {
    if (!isDirty) return;
    saveShortName(entity.id, shortName.trim());
    await patchEntity(entity.area, entity.id, {
      short_name:  shortName.trim(),
      description: description.trim() || undefined,
      logo:        logo.trim() || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Logo / accent tile */}
        <EntityLogo entity={entity} />

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground text-sm">{entity.name}</div>
          {entity.tag && (
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mt-0.5">{entity.tag}</div>
          )}
        </div>

        {/* Rule count badge */}
        <div className={cn(
          "shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full",
          rules.length > 0
            ? "bg-cyan/10 text-cyan"
            : "bg-secondary text-muted-foreground"
        )}>
          {rules.length === 0 ? "No rules" : `${rules.length} rule${rules.length !== 1 ? "s" : ""}`}
        </div>

        {/* Projection badge */}
        {projection && (
          <div className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-500">
            <TrendingUp className="h-3 w-3" />
            1 Projection
          </div>
        )}

        {expanded
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded rules panel */}
      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-4 bg-background/50">
          {/* Entity fields */}
          <div className="space-y-3 pb-3 border-b border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Short Name</label>
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder={entity.shortName}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-cyan/40"
              />
              <p className="text-[11px] text-muted-foreground/50">Used in mobile views when space is limited.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description…"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-cyan/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Logo URL</label>
              <input
                type="text"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-cyan/40"
              />
            </div>
            <button
              onClick={handleApply}
              disabled={!isDirty}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap",
                saved
                  ? "bg-emerald-500/10 text-emerald-600"
                  : isDirty
                    ? "bg-cyan text-cyan-foreground hover:bg-cyan/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Check className="h-3.5 w-3.5" />
              {saved ? "Saved" : "Apply changes"}
            </button>
          </div>

          {/* Projection panel */}
          <div className="space-y-3 pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Create Projection</span>
              </div>
              {/* Toggle */}
              <button
                onClick={() => handleToggleProjection(!projEnabled)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  projEnabled ? "bg-violet-500" : "bg-muted"
                )}
              >
                <span className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform",
                  projEnabled ? "translate-x-4" : "translate-x-0"
                )} />
              </button>
            </div>

            {projEnabled && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Start Date</label>
                    <input
                      type="date"
                      value={projStartDate}
                      onChange={(e) => setProjStartDate(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Target Date *</label>
                    <input
                      type="date"
                      value={projDate}
                      onChange={(e) => setProjDate(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Target Lane Count</label>
                    <input
                      type="number"
                      value={projLanes}
                      onChange={(e) => setProjLanes(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Target Txn Count / Month</label>
                    <input
                      type="number"
                      value={projTxnCount}
                      onChange={(e) => setProjTxnCount(e.target.value)}
                      placeholder="e.g. 200000"
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Target Monthly Value (ZAR)</label>
                    <input
                      type="number"
                      value={projValue}
                      onChange={(e) => setProjValue(e.target.value)}
                      placeholder="e.g. 5000000"
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveProjection}
                  disabled={!projDate || projSaving}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap",
                    projSaved
                      ? "bg-emerald-500/10 text-emerald-600"
                      : !projDate
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-violet-500 text-white hover:bg-violet-600"
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  {projSaved ? "Saved" : projSaving ? "Saving…" : "Save projection"}
                </button>
              </div>
            )}
          </div>

          {/* Existing rules */}
          {rules.map((rule) => (
            <RuleRowItem
              key={rule.id}
              rule={rule}
              onUpdate={onUpdate}
              onDelete={() => onDelete(rule.id)}
            />
          ))}

          {rules.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground/50 py-1">No rules yet. Add one below.</p>
          )}

          {/* Add rule form */}
          {adding ? (
            <RuleForm
              onSave={async (rule) => { await onAdd(rule); setAdding(false); }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="mt-2 flex items-center gap-2 text-xs font-semibold text-cyan hover:text-cyan/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add rule
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Entity logo ──────────────────────────────────────────────────────────────

const ACCENT_CLASS: Record<Solution["accent"], string> = {
  cyan:    "bg-cyan/10 text-cyan",
  sky:     "bg-sky-500/10 text-sky-500",
  emerald: "bg-emerald-500/10 text-emerald-500",
  violet:  "bg-violet-500/10 text-violet-500",
  amber:   "bg-amber-500/10 text-amber-500",
  rose:    "bg-rose-500/10 text-rose-500",
};

const EntityLogo = ({ entity }: { entity: Solution }) => {
  const [failed, setFailed] = useState(false);
  if (entity.logo && !failed) {
    return (
      <div className="h-9 w-9 shrink-0 rounded-lg overflow-hidden bg-white border border-border/40 flex items-center justify-center p-1">
        <img src={entity.logo} alt={entity.name} className="h-full w-full object-contain" onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className={cn("h-9 w-9 shrink-0 rounded-lg grid place-items-center text-xs font-bold", ACCENT_CLASS[entity.accent])}>
      {entity.shortName.slice(0, 2).toUpperCase()}
    </div>
  );
};

// ─── Existing rule row ────────────────────────────────────────────────────────

const RuleRowItem = ({ rule, onUpdate, onDelete }: { rule: Rule; onUpdate: (r: Rule) => Promise<void>; onDelete: () => Promise<void> }) => {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await onDelete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete rule");
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <RuleForm
        initial={rule}
        onSave={async (updated) => { await onUpdate({ ...updated, id: rule.id }); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-1">
      <div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 bg-card border border-border hover:border-cyan/30 transition-colors">
        <RuleText rule={rule} />
        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <IconBtn onClick={() => setEditing(true)} title="Edit"><Pencil className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={handleDelete} title="Delete" danger disabled={deleting}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
        </div>
      </div>
      {error && <p className="text-xs text-rose-500 px-3">{error}</p>}
    </div>
  );
};

// ─── Rule text display ────────────────────────────────────────────────────────

const RuleText = ({ rule }: { rule: Omit<Rule, "id"> }) => {
  const operatorLabel = OPERATORS.find((o) => o.value === rule.operator)?.label ?? rule.operator ?? "equals";
  const noValue = rule.operator === "present" || rule.operator === "absent";
  return (
    <div className="flex-1 text-sm flex items-center gap-1.5 flex-wrap">
      <span className="text-muted-foreground">in</span>
      {rule.transactionTypes.length === 0
        ? <Pill>any</Pill>
        : rule.transactionTypes.map((t, i) => (
            <span key={t} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground/50 text-[11px] font-semibold">OR</span>}
              <Pill>{t}</Pill>
            </span>
          ))
      }
      <span className="text-muted-foreground">where</span>
      <Pill variant="field">{rule.fieldType || "…"}</Pill>
      <span className="text-muted-foreground">{operatorLabel}</span>
      {!noValue && <Pill variant="value">{rule.value || "…"}</Pill>}
    </div>
  );
};

const Pill = ({
  children,
  variant = "type",
}: {
  children: string;
  variant?: "type" | "field" | "value";
}) => (
  <span className={cn(
    "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold",
    variant === "type"  && "bg-cyan/10 text-cyan",
    variant === "field" && "bg-violet-500/10 text-violet-500",
    variant === "value" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  )}>
    {children}
  </span>
);

// ─── Rule form (add / edit) ───────────────────────────────────────────────────

interface RuleFormProps {
  initial?: Omit<Rule, "id">;
  onSave: (rule: Omit<Rule, "id">) => Promise<void>;
  onCancel: () => void;
}

const RuleForm = ({ initial, onSave, onCancel }: RuleFormProps) => {
  const [txTypes,   setTxTypes]   = useState<string[]>(initial?.transactionTypes ?? []);
  const [fieldType, setFieldType] = useState(initial?.fieldType ?? "");
  const [operator,  setOperator]  = useState(initial?.operator ?? "eq");
  const [value,     setValue]     = useState(initial?.value ?? "");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const noValue = operator === "present" || operator === "absent";
  const valid   = fieldType.trim().length > 0 && (noValue || value.trim().length > 0);

  const toggleTx = (t: string) =>
    setTxTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave({
        transactionTypes: txTypes,
        fieldType: fieldType.trim(),
        operator,
        value: noValue ? "" : value.trim(),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save rule");
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-3 space-y-3">
      {/* Rule preview */}
      <div className="text-xs text-muted-foreground/70">Preview</div>
      <RuleText rule={{ transactionTypes: txTypes, fieldType: fieldType || "…", operator, value }} />

      {/* Transaction type multi-toggle */}
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Transaction type (select all that apply)</label>
        <div className="flex gap-1.5 flex-wrap">
          {TRANSACTION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTx(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                txTypes.includes(t)
                  ? "bg-cyan text-cyan-foreground border-cyan shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-cyan/40 hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Field · Operator · Value */}
      <div className={cn("grid gap-2", noValue ? "grid-cols-2" : "grid-cols-3")}>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Field</label>
          <input
            type="text"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
            placeholder="e.g. de48_se22"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-cyan/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Operator</label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan/40"
          >
            {OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {!noValue && (
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Value</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. visa"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-cyan/40"
              onKeyDown={(e) => { if (e.key === "Enter" && valid) handleSave(); if (e.key === "Escape") onCancel(); }}
              autoFocus
            />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          disabled={!valid || saving}
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan text-cyan-foreground text-xs font-semibold disabled:opacity-40 hover:bg-cyan/90 transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? "Saving…" : initial ? "Save changes" : "Add rule"}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Icon button ──────────────────────────────────────────────────────────────

const IconBtn = ({ onClick, title, danger, disabled, children }: { onClick: () => void; title: string; danger?: boolean; disabled?: boolean; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={cn(
      "p-1.5 rounded-md transition-colors disabled:opacity-40",
      danger ? "hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground" : "hover:bg-secondary text-muted-foreground hover:text-foreground"
    )}
  >
    {children}
  </button>
);

export default Config;
