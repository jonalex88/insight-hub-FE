import { useState } from "react";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { MobileTopBar, Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

type Status = "compliant" | "non-compliant" | "partial";
type Risk = "high" | "medium" | "low";
type Category = "general" | "api" | "frontend";

interface ComplianceRow {
  area: string;
  status: Status;
  risk: Risk;
  details: string;
  category: Category;
}

const rows: ComplianceRow[] = [
  // General
  {
    category: "general",
    area: "Authentication & Authorization (Keycloak JWT)",
    status: "non-compliant",
    risk: "high",
    details: "No auth on any page or API. Any user can read or modify rules. Must add Keycloak before production.",
  },
  {
    category: "general",
    area: "Secrets Management (AWS Secrets Manager)",
    status: "non-compliant",
    risk: "high",
    details: "DB credentials in .env. Fine for dev; must migrate to Secrets Manager before going to production.",
  },
  {
    category: "general",
    area: "PCI DSS — No PAN/CVV Exposure",
    status: "compliant",
    risk: "low",
    details: "App shows aggregate stats only. No card data stored, displayed, or transmitted. No action required.",
  },
  {
    category: "general",
    area: "POPIA — Personal Data Handling",
    status: "compliant",
    risk: "low",
    details: "No personal identifiers in API responses or logs. Compliant for current scope.",
  },
  {
    category: "general",
    area: "Test Coverage (Unit + E2E / TestContainers)",
    status: "non-compliant",
    risk: "medium",
    details: "Zero tests. Add API integration tests (rules CRUD) and a smoke test before going live.",
  },
  {
    category: "general",
    area: "CI/CD Pipeline (Bitbucket + AWS CDK)",
    status: "non-compliant",
    risk: "medium",
    details: "Using GitHub + Vercel/Railway — intentional deviation. Acceptable if lint and build checks run on push.",
  },
  {
    category: "general",
    area: "Containerisation (Docker + ECS/RDS)",
    status: "non-compliant",
    risk: "low",
    details: "Using Railway/Render + Neon — managed equivalents. No action required at current scale.",
  },
  {
    category: "general",
    area: "Branch Strategy (dev / sit / uat / master)",
    status: "non-compliant",
    risk: "low",
    details: "Single main branch. Adopt feature branches and PR reviews at minimum.",
  },
  {
    category: "general",
    area: "Documentation (user-guide, release-notes, functional-spec)",
    status: "partial",
    risk: "low",
    details: "ARCHITECTURE.md and DATABASE_SCHEMA.md in place. Missing user guide and release notes.",
  },
  // API / Backend
  {
    category: "api",
    area: "OWASP / Input Validation / No Stack Traces",
    status: "partial",
    risk: "medium",
    details: "try/catch on all routes; no stack traces in responses. Input sanitisation on rule fields still needed.",
  },
  {
    category: "api",
    area: "API Versioning (/v1/ prefix)",
    status: "compliant",
    risk: "low",
    details: "All routes mounted at /api/v1/*. Versioning in place.",
  },
  {
    category: "api",
    area: "Standard Error Response Format ({code, message})",
    status: "non-compliant",
    risk: "low",
    details: "API returns {error: string}. Easy to align but not worth refactoring until the API shape stabilises.",
  },
  // Frontend
  {
    category: "frontend",
    area: "API Base URL Configuration (VITE_API_URL)",
    status: "compliant",
    risk: "low",
    details: "VITE_API_URL env var used via shared apiBase.ts; fallback to localhost:4000 keeps dev zero-config.",
  },
  {
    category: "frontend",
    area: "Frontend State Management (Redux Toolkit + RTK Query)",
    status: "non-compliant",
    risk: "low",
    details: "Uses useState/useEffect + custom fetch. Intentional lighter stack for this app size. No action required.",
  },
  {
    category: "frontend",
    area: "UI Library (MUI v6 + TJ Design System)",
    status: "non-compliant",
    risk: "low",
    details: "Uses Tailwind CSS + shadcn/ui — different design language than TJ standard. Intentional product decision.",
  },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "general", label: "General" },
  { id: "api", label: "API / Backend" },
  { id: "frontend", label: "Frontend" },
];

const StatusIcon = ({ status }: { status: Status }) => {
  if (status === "compliant")
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "partial")
    return <AlertCircle className="h-5 w-5 text-amber-400" />;
  return <XCircle className="h-5 w-5 text-rose-500" />;
};

const RiskBadge = ({ risk }: { risk: Risk }) => {
  const styles: Record<Risk, string> = {
    high: "bg-rose-500/15 text-rose-500 border-rose-500/30",
    medium: "bg-amber-400/15 text-amber-400 border-amber-400/30",
    low: "bg-slate-400/15 text-slate-400 border-slate-400/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles[risk]}`}>
      {risk}
    </span>
  );
};

interface SummaryStats {
  compliant: number;
  partial: number;
  nonCompliant: number;
  total: number;
}

function getStats(categoryRows: ComplianceRow[]): SummaryStats {
  return {
    compliant: categoryRows.filter((r) => r.status === "compliant").length,
    partial: categoryRows.filter((r) => r.status === "partial").length,
    nonCompliant: categoryRows.filter((r) => r.status === "non-compliant").length,
    total: categoryRows.length,
  };
}

function SummaryCard({ label, stats, active, onClick }: { label: string; stats: SummaryStats; active: boolean; onClick: () => void }) {
  const hasHighRisk = rows
    .filter((r) => r.category === CATEGORIES.find((c) => c.label === label)?.id)
    .some((r) => r.risk === "high" && r.status !== "compliant");

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 min-w-[160px] rounded-xl border p-4 text-left transition-all",
        active
          ? "border-cyan bg-cyan/5 shadow-sm"
          : "border-border bg-card hover:border-cyan/40 hover:bg-cyan/5"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {hasHighRisk && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-500 uppercase tracking-wide">
            <AlertCircle className="h-3 w-3" /> High risk
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-emerald-500 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" /> {stats.compliant}
        </span>
        {stats.partial > 0 && (
          <span className="flex items-center gap-1 text-amber-400 font-medium">
            <AlertCircle className="h-3.5 w-3.5" /> {stats.partial}
          </span>
        )}
        <span className="flex items-center gap-1 text-rose-500 font-medium">
          <XCircle className="h-3.5 w-3.5" /> {stats.nonCompliant}
        </span>
        <span className="text-foreground/40 ml-auto">{stats.total} areas</span>
      </div>
    </button>
  );
}

function ComplianceTable({ categoryRows }: { categoryRows: ComplianceRow[] }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-semibold text-foreground/70 w-[35%]">Area</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground/70 w-[70px]">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground/70 w-[90px]">Risk</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground/70">Details</th>
            </tr>
          </thead>
          <tbody>
            {categoryRows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <td className="px-4 py-3.5 font-medium text-foreground/90 leading-snug">{row.area}</td>
                <td className="px-4 py-3.5 text-center">
                  <div className="flex justify-center">
                    <StatusIcon status={row.status} />
                  </div>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <div className="flex justify-center">
                    <RiskBadge risk={row.risk} />
                  </div>
                </td>
                <td className="px-4 py-3.5 text-foreground/65 leading-relaxed">{row.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const RISK_ORDER: Record<Risk, number> = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER: Record<Status, number> = { "non-compliant": 0, "partial": 1, "compliant": 2 };

function sortedRows(categoryRows: ComplianceRow[]) {
  return [...categoryRows].sort((a, b) =>
    RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );
}

export default function Compliance() {
  const [activeTab, setActiveTab] = useState<Category>("general");

  const activeRows = sortedRows(rows.filter((r) => r.category === activeTab));

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <MobileTopBar />
        <div className="flex-1 flex flex-col px-5 sm:px-8 lg:px-12 py-8 lg:py-10 gap-6 min-h-0 overflow-y-auto">
          <PageHeader title="TJ Dev Compliance" crumbs={[{ label: "Insights Hub" }, { label: "TJ Dev Compliance" }]} />

          {/* Summary cards */}
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map((cat) => (
              <SummaryCard
                key={cat.id}
                label={cat.label}
                stats={getStats(rows.filter((r) => r.category === cat.id))}
                active={activeTab === cat.id}
                onClick={() => setActiveTab(cat.id)}
              />
            ))}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-border">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                  activeTab === cat.id
                    ? "border-cyan text-cyan"
                    : "border-transparent text-foreground/55 hover:text-foreground"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Table for active tab */}
          <ComplianceTable categoryRows={activeRows} />
        </div>
      </main>
    </div>
  );
}
