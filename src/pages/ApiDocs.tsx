import { useState } from "react";
import { MobileTopBar, Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Param  { name: string; type: string; required?: boolean; description: string }
interface Field  { name: string; type: string; nullable?: boolean; description: string }

interface Endpoint {
  method:        HttpMethod;
  path:          string;
  summary:       string;
  description?:  string;
  pathParams?:   Param[];
  queryParams?:  Param[];
  requestBody?:  Field[];
  responseFields: Field[];
  calledBy?:     string;
}

interface ApiGroup {
  id:          string;
  label:       string;
  basePath:    string;
  description: string;
  endpoints:   Endpoint[];
}

// ─── Shared entity response fields ────────────────────────────────────────────

const ENTITY_FIELDS: Field[] = [
  { name: "id",          type: "string",           description: "Unique slug identifier" },
  { name: "name",        type: "string",           description: "Display name" },
  { name: "short_name",  type: "string",           description: "Abbreviated name for compact views" },
  { name: "area",        type: "string",           description: "Resource category (e.g. Payment Methods)" },
  { name: "tag",         type: "string | null",    description: "Sub-category tag" },
  { name: "logo",        type: "string | null",    description: "Logo image URL" },
  { name: "description", type: "string | null",    description: "Short description" },
  { name: "sort_order",  type: "number",           description: "Display ordering weight" },
];

const STATS_30D_FIELDS: Field[] = [
  ...ENTITY_FIELDS.filter(f => !["sort_order"].includes(f.name)),
  { name: "total_count",           type: "string",        description: "Total transactions in last 30 days" },
  { name: "approved_count",        type: "string",        description: "Approved transactions in last 30 days" },
  { name: "approved_value",        type: "string",        description: "Total approved value (cents)" },
  { name: "active_merchants",      type: "number",        description: "Active merchant count" },
  { name: "approval_rate",         type: "string | null", description: "Approval rate percentage" },
  { name: "merchant_growth_pct",   type: "string | null", description: "Month-on-month merchant growth %" },
];

const MONTHLY_FIELDS: Field[] = [
  { name: "id",               type: "string",        description: "Entity identifier" },
  { name: "name",             type: "string",        description: "Display name" },
  { name: "short_name",       type: "string",        description: "Abbreviated name" },
  { name: "year_month",       type: "string",        description: "Month in YYYY-MM format" },
  { name: "total_count",      type: "string",        description: "Transaction count for month" },
  { name: "approved_count",   type: "string",        description: "Approved count for month" },
  { name: "approved_value",   type: "string",        description: "Approved value for month" },
  { name: "active_merchants", type: "number",        description: "Active merchants that month" },
  { name: "approval_rate",    type: "string | null", description: "Monthly approval rate %" },
  { name: "growth_pct",       type: "string | null", description: "Month-on-month growth %" },
];

function makeAreaEndpoints(area: string, path: string, hasDailyTrend = true): Endpoint[] {
  const endpoints: Endpoint[] = [
    {
      method: "GET",
      path:   "/",
      summary: `List all ${area}`,
      responseFields: ENTITY_FIELDS,
      calledBy: "entityStore.ts — getAllSolutions (seeded data fallback)",
    },
    {
      method: "GET",
      path:   "/stats/30d",
      summary: "30-day aggregated stats with MoM growth",
      description: "Returns the last 30 calendar days of stats per entity, joined with prior 30 days for growth calculation. Ordered by active_merchants descending.",
      responseFields: STATS_30D_FIELDS,
      calledBy: "useAreaSolutions hook, Dashboard.tsx",
    },
    {
      method: "GET",
      path:   "/stats/monthly",
      summary: "Monthly stats for all entries",
      queryParams: [
        { name: "months", type: "number", required: false, description: "Number of months to return. Max 36, default 12." },
      ],
      responseFields: MONTHLY_FIELDS,
      calledBy: "useAreaSolutions hook",
    },
  ];

  if (hasDailyTrend) {
    endpoints.push(
      {
        method: "GET",
        path:   "/:id/trend",
        summary: "Monthly trend for a single entry",
        pathParams: [{ name: "id", type: "string", description: "Entity slug identifier" }],
        queryParams: [
          { name: "months", type: "number", required: false, description: "Number of months. Max 36, default 12." },
        ],
        responseFields: [
          { name: "year_month",       type: "string",        description: "Month in YYYY-MM format" },
          { name: "total_count",      type: "string",        description: "Transaction count" },
          { name: "approved_count",   type: "string",        description: "Approved transactions" },
          { name: "approved_value",   type: "string",        description: "Approved value" },
          { name: "active_merchants", type: "number",        description: "Active merchants" },
          { name: "approval_rate",    type: "string | null", description: "Approval rate %" },
          { name: "growth_pct",       type: "string | null", description: "Month-on-month growth %" },
        ],
        calledBy: "SolutionDetail.tsx — 3Y chart (getTrendStats, 36 months aggregated by year)",
      },
      {
        method: "GET",
        path:   "/:id/daily",
        summary: "Daily breakdown for a single entry",
        pathParams: [{ name: "id", type: "string", description: "Entity slug identifier" }],
        queryParams: [
          { name: "days", type: "number", required: false, description: "Number of days. Max 30, default 30." },
        ],
        responseFields: [
          { name: "date",             type: "string",        description: "Date in YYYY-MM-DD format" },
          { name: "total_count",      type: "string",        description: "Transaction count" },
          { name: "approved_count",   type: "string",        description: "Approved transactions" },
          { name: "approved_value",   type: "string",        description: "Approved value" },
          { name: "active_merchants", type: "number",        description: "Active merchants" },
          { name: "approval_rate",    type: "string | null", description: "Approval rate %" },
        ],
        calledBy: "SolutionDetail.tsx — 30D chart (getDailyStats)",
      }
    );
  }

  endpoints.push(
    {
      method: "POST",
      path:   "/",
      summary: `Create a new ${area.replace(/s$/, "")} entry`,
      requestBody: [
        { name: "name",        type: "string",           description: "Display name (required)" },
        { name: "short_name",  type: "string",           nullable: true, description: "Abbreviated name — defaults to name" },
        { name: "tag",         type: "string",           nullable: true, description: "Sub-category tag" },
        { name: "logo",        type: "string",           nullable: true, description: "Logo image URL" },
        { name: "description", type: "string",           nullable: true, description: "Short description" },
      ],
      responseFields: ENTITY_FIELDS,
      calledBy: "entityStore.ts — createEntity",
    },
    {
      method: "PATCH",
      path:   "/:id",
      summary: "Update short name, description, and/or logo",
      description: "Partial update — only include the fields you want to change. At least one field is required.",
      pathParams: [{ name: "id", type: "string", description: "Entity slug identifier" }],
      requestBody: [
        { name: "short_name",  type: "string", nullable: true, description: "New abbreviated name" },
        { name: "description", type: "string", nullable: true, description: "New description (null to clear)" },
        { name: "logo",        type: "string", nullable: true, description: "New logo URL (null to clear)" },
      ],
      responseFields: [
        { name: "id",          type: "string",        description: "Entity identifier" },
        { name: "name",        type: "string",        description: "Display name" },
        { name: "short_name",  type: "string",        description: "Updated short name" },
        { name: "description", type: "string | null", description: "Updated description" },
        { name: "logo",        type: "string | null", description: "Updated logo URL" },
      ],
      calledBy: "shortNames.ts — patchEntity (Config page)",
    }
  );

  return endpoints;
}

// ─── API groups data ──────────────────────────────────────────────────────────

const API_GROUPS: ApiGroup[] = [
  {
    id: "health",
    label: "System",
    basePath: "",
    description: "System health and connectivity checks.",
    endpoints: [
      {
        method: "GET",
        path:   "/health",
        summary: "Health check",
        description: "Returns API and database connection status. Used by Railway monitoring and the GitHub Actions wake-up workflow.",
        responseFields: [
          { name: "status", type: '"ok" | "error"',    description: "API process status" },
          { name: "db",     type: '"connected" | "unreachable"', description: "Database connection status" },
        ],
        calledBy: "Railway health probe, GitHub Actions workflow",
      },
    ],
  },
  {
    id:          "payment-methods",
    label:       "Payment Methods",
    basePath:    "/api/v1/payment-methods",
    description: "Card, QR, voucher, wallet, and store card payment methods. Stored in the payment_methods table with area = 'Payment Methods'.",
    endpoints:   makeAreaEndpoints("Payment Methods", "payment-methods"),
  },
  {
    id:          "solution-tags",
    label:       "Solutions",
    basePath:    "/api/v1/solution-tags",
    description: "Solution tag entities. Stored in the solution_tags table.",
    endpoints:   makeAreaEndpoints("Solutions", "solution-tags"),
  },
  {
    id:          "channels",
    label:       "Channels",
    basePath:    "/api/v1/channels",
    description: "Transaction channels. Stored in the payment_methods table with area = 'Channels'.",
    endpoints:   makeAreaEndpoints("Channels", "channels"),
  },
  {
    id:          "platforms",
    label:       "Platforms",
    basePath:    "/api/v1/platforms",
    description: "Integration platforms. Stored in the payment_methods table with area = 'Platforms'.",
    endpoints:   makeAreaEndpoints("Platforms", "platforms"),
  },
  {
    id:          "countries",
    label:       "Countries",
    basePath:    "/api/v1/countries",
    description: "Country entities. Stored in the countries table.",
    endpoints:   makeAreaEndpoints("Countries", "countries"),
  },
  {
    id:          "banks",
    label:       "Banks",
    basePath:    "/api/v1/banks",
    description: "Issuing and acquiring banks. Stored in the banks table.",
    endpoints:   makeAreaEndpoints("Banks", "banks"),
  },
  {
    id:       "rules",
    label:    "Rules",
    basePath: "/api/v1/rules",
    description: "Transaction routing rules attached to entities. Stored in the rules table.",
    endpoints: [
      {
        method: "GET",
        path:   "/",
        summary: "List all rules (flat)",
        description: "Returns every rule across all entities, ordered by entity_id then sort_order. The frontend groups these by entity_id in-memory.",
        responseFields: [
          { name: "id",                type: "string",   description: "Rule UUID" },
          { name: "entity_id",         type: "string",   description: "Entity this rule belongs to" },
          { name: "transaction_types", type: "string[]", description: "ISO 8583 transaction type codes, e.g. [\"0100\"]" },
          { name: "field_type",        type: "string",   description: "Field the rule matches against" },
          { name: "operator",          type: "string",   description: "Comparison operator (eq, contains, begins_with, …)" },
          { name: "value",             type: "string",   description: "Value to compare against" },
        ],
        calledBy: "rules.ts — fetchAllRules (Config page on mount)",
      },
      {
        method: "GET",
        path:   "/:entityId",
        summary: "Rules for a single entity",
        pathParams: [{ name: "entityId", type: "string", description: "Entity slug identifier" }],
        responseFields: [
          { name: "id",                type: "string",   description: "Rule UUID" },
          { name: "entity_id",         type: "string",   description: "Entity this rule belongs to" },
          { name: "transaction_types", type: "string[]", description: "ISO 8583 MTI codes" },
          { name: "field_type",        type: "string",   description: "Matched field" },
          { name: "operator",          type: "string",   description: "Comparison operator" },
          { name: "value",             type: "string",   description: "Match value" },
        ],
        calledBy: "Not yet called by frontend (frontend fetches all at once)",
      },
      {
        method: "POST",
        path:   "/:entityId",
        summary: "Create a rule for an entity",
        pathParams: [{ name: "entityId", type: "string", description: "Entity slug identifier" }],
        requestBody: [
          { name: "transaction_types", type: "string[]", description: "ISO 8583 MTI codes (required)" },
          { name: "field_type",        type: "string",   description: "Field to match (required)" },
          { name: "operator",          type: "string",   description: "Comparison operator (required)" },
          { name: "value",             type: "string",   description: "Match value (required)" },
        ],
        responseFields: [
          { name: "id",                type: "string",   description: "Generated rule UUID" },
          { name: "entity_id",         type: "string",   description: "Entity identifier" },
          { name: "transaction_types", type: "string[]", description: "MTI codes" },
          { name: "field_type",        type: "string",   description: "Matched field" },
          { name: "operator",          type: "string",   description: "Operator" },
          { name: "value",             type: "string",   description: "Match value" },
        ],
        calledBy: "rules.ts — apiAddRule (Config page)",
      },
      {
        method: "PUT",
        path:   "/:entityId/:ruleId",
        summary: "Update an existing rule",
        pathParams: [
          { name: "entityId", type: "string", description: "Entity slug identifier" },
          { name: "ruleId",   type: "string", description: "Rule UUID" },
        ],
        requestBody: [
          { name: "transaction_types", type: "string[]", description: "Updated MTI codes" },
          { name: "field_type",        type: "string",   description: "Updated field" },
          { name: "operator",          type: "string",   description: "Updated operator" },
          { name: "value",             type: "string",   description: "Updated value" },
        ],
        responseFields: [
          { name: "id",                type: "string",   description: "Rule UUID" },
          { name: "entity_id",         type: "string",   description: "Entity identifier" },
          { name: "transaction_types", type: "string[]", description: "MTI codes" },
          { name: "field_type",        type: "string",   description: "Field" },
          { name: "operator",          type: "string",   description: "Operator" },
          { name: "value",             type: "string",   description: "Value" },
        ],
        calledBy: "rules.ts — apiUpdateRule (Config page)",
      },
      {
        method: "DELETE",
        path:   "/:entityId/:ruleId",
        summary: "Delete a rule",
        pathParams: [
          { name: "entityId", type: "string", description: "Entity slug identifier" },
          { name: "ruleId",   type: "string", description: "Rule UUID" },
        ],
        responseFields: [
          { name: "message", type: "string", description: '"Deleted"' },
        ],
        calledBy: "rules.ts — apiDeleteRule (Config page)",
      },
    ],
  },
];

// ─── Method badge ─────────────────────────────────────────────────────────────

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET:    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  POST:   "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  PUT:    "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  PATCH:  "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  DELETE: "bg-red-500/15 text-red-400 border border-red-500/30",
};

const MethodBadge = ({ method }: { method: HttpMethod }) => (
  <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold font-mono tracking-wider shrink-0", METHOD_STYLES[method])}>
    {method}
  </span>
);

// ─── Copy button ──────────────────────────────────────────────────────────────

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
};

// ─── Curl snippet ─────────────────────────────────────────────────────────────

function buildCurl(base: string, endpoint: Endpoint, apiBase: string): string {
  const fullPath = `${apiBase}${base}${endpoint.path}`.replace("/:id", "/{id}").replace("/:entityId", "/{entityId}").replace("/:ruleId", "/{ruleId}");
  const method = endpoint.method === "GET" ? "" : ` -X ${endpoint.method}`;
  const body = endpoint.requestBody
    ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(Object.fromEntries(endpoint.requestBody.map(f => [f.name, f.type.includes("[]") ? [] : f.type.includes("string") ? "" : 0])), null, 2)}'`
    : "";
  return `curl${method} "${fullPath}"${body}`;
}

// ─── Endpoint card ────────────────────────────────────────────────────────────

const EndpointCard = ({ endpoint, basePath, apiBase }: { endpoint: Endpoint; basePath: string; apiBase: string }) => {
  const [open, setOpen] = useState(false);
  const curl = buildCurl(basePath, endpoint, apiBase);

  return (
    <div className={cn("rounded-xl border transition-colors", open ? "border-border bg-card" : "border-border/50 bg-card/40 hover:bg-card/70")}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <MethodBadge method={endpoint.method} />
        <span className="flex-1 font-mono text-sm text-foreground/90 truncate">
          {basePath}{endpoint.path}
        </span>
        <span className="hidden sm:block text-xs text-muted-foreground/60 truncate max-w-[260px]">{endpoint.summary}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4 space-y-5">
          {/* Summary + description */}
          <div>
            <p className="font-semibold text-sm text-foreground">{endpoint.summary}</p>
            {endpoint.description && <p className="mt-1 text-sm text-muted-foreground">{endpoint.description}</p>}
          </div>

          {/* Called by */}
          {endpoint.calledBy && (
            <div className="flex items-start gap-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground/50 font-semibold mt-0.5 shrink-0">Called by</span>
              <span className="text-xs text-cyan font-mono">{endpoint.calledBy}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: params & body */}
            <div className="space-y-4">
              {endpoint.pathParams && endpoint.pathParams.length > 0 && (
                <ParamTable label="Path Parameters" params={endpoint.pathParams} />
              )}
              {endpoint.queryParams && endpoint.queryParams.length > 0 && (
                <ParamTable label="Query Parameters" params={endpoint.queryParams} />
              )}
              {endpoint.requestBody && endpoint.requestBody.length > 0 && (
                <FieldTable label="Request Body" fields={endpoint.requestBody} showRequired />
              )}
            </div>

            {/* Right: response */}
            <div>
              <FieldTable label="Response Fields" fields={endpoint.responseFields} />
            </div>
          </div>

          {/* Curl snippet */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground/50 font-semibold mb-1.5">Curl</div>
            <div className="relative rounded-lg bg-muted/50 border border-border px-4 py-3 font-mono text-xs text-foreground/80 whitespace-pre overflow-x-auto">
              {curl}
              <div className="absolute top-2 right-2">
                <CopyButton text={curl} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ParamTable = ({ label, params }: { label: string; params: Param[] }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground/50 font-semibold mb-2">{label}</div>
    <div className="rounded-lg border border-border divide-y divide-border">
      {params.map(p => (
        <div key={p.name} className="px-3 py-2 flex items-start gap-3">
          <span className="font-mono text-xs text-foreground/90 shrink-0 pt-0.5">{p.name}</span>
          <span className="font-mono text-[11px] text-violet-400/80 shrink-0 pt-0.5">{p.type}</span>
          {p.required === false && <span className="text-[10px] text-muted-foreground/40 shrink-0 pt-0.5">optional</span>}
          <span className="text-xs text-muted-foreground ml-auto text-right">{p.description}</span>
        </div>
      ))}
    </div>
  </div>
);

const FieldTable = ({ label, fields, showRequired }: { label: string; fields: Field[]; showRequired?: boolean }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground/50 font-semibold mb-2">{label}</div>
    <div className="rounded-lg border border-border divide-y divide-border">
      {fields.map(f => (
        <div key={f.name} className="px-3 py-2 flex items-start gap-3">
          <span className="font-mono text-xs text-foreground/90 shrink-0 pt-0.5 min-w-[100px]">{f.name}</span>
          <span className="font-mono text-[11px] text-violet-400/80 shrink-0 pt-0.5">{f.type}{f.nullable ? "?" : ""}</span>
          <span className="text-xs text-muted-foreground ml-auto text-right">{f.description}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const ApiDocs = () => {
  const [selectedGroup, setSelectedGroup] = useState(API_GROUPS[0].id);
  const group = API_GROUPS.find(g => g.id === selectedGroup) ?? API_GROUPS[0];
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

  const totalEndpoints = API_GROUPS.reduce((sum, g) => sum + g.endpoints.length, 0);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <MobileTopBar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <PageHeader
              title="API Reference"
              crumbs={[{ label: "Dev Tools" }, { label: "API" }]}
              right={
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground/50 font-semibold">Base URL</span>
                  <span className="font-mono text-xs text-cyan">{apiBase}</span>
                  <CopyButton text={apiBase} />
                </div>
              }
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {totalEndpoints} endpoints across {API_GROUPS.length} resources · All routes prefixed with{" "}
              <span className="font-mono text-foreground/80">/api/v1</span> except <span className="font-mono text-foreground/80">/health</span>
            </p>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Resource sidebar */}
            <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border overflow-y-auto bg-card/30">
              <div className="p-3 space-y-0.5">
                {API_GROUPS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGroup(g.id)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      selectedGroup === g.id
                        ? "bg-sidebar-accent text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <span>{g.label}</span>
                    <span className={cn(
                      "text-[11px] rounded-full px-1.5 py-0.5 font-semibold",
                      selectedGroup === g.id ? "bg-cyan/20 text-cyan" : "bg-muted text-muted-foreground/60"
                    )}>
                      {g.endpoints.length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Method legend */}
              <div className="mt-auto p-4 border-t border-border space-y-1.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground/40 font-semibold mb-2">Methods</div>
                {(["GET", "POST", "PATCH", "PUT", "DELETE"] as HttpMethod[]).map(m => (
                  <div key={m} className="flex items-center gap-2">
                    <MethodBadge method={m} />
                  </div>
                ))}
              </div>
            </aside>

            {/* Endpoint list */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl space-y-6">
                {/* Group header */}
                <div className="pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-2xl font-bold text-foreground">{group.label}</h2>
                    {group.basePath && (
                      <span className="font-mono text-xs text-muted-foreground/60 bg-muted/50 border border-border rounded px-2 py-0.5">
                        {group.basePath}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{group.description}</p>
                </div>

                {/* Mobile resource picker */}
                <div className="md:hidden">
                  <select
                    value={selectedGroup}
                    onChange={e => setSelectedGroup(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    {API_GROUPS.map(g => (
                      <option key={g.id} value={g.id}>{g.label} ({g.endpoints.length})</option>
                    ))}
                  </select>
                </div>

                {/* Endpoints */}
                <div className="space-y-2">
                  {group.endpoints.map((ep, i) => (
                    <EndpointCard
                      key={`${ep.method}-${ep.path}-${i}`}
                      endpoint={ep}
                      basePath={group.basePath}
                      apiBase={apiBase}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ApiDocs;
