import { useState } from "react";
import { MobileTopBar, Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

interface Field {
  name: string;
  type: string;
  pk?: boolean;
  fk?: string;       // referenced table
  nullable?: boolean;
  default?: string;
  note?: string;
}

interface Table {
  name: string;
  description: string;
  fields: Field[];
  indexes?: string[];
}

interface Group {
  label: string;
  color: string;      // tailwind bg for group badge
  tables: Table[];
}

const GROUPS: Group[] = [
  {
    label: "Dimension Tables",
    color: "bg-cyan/20 text-cyan border-cyan/30",
    tables: [
      {
        name: "payment_methods",
        description: "One row per payment method / channel / platform entity. Shared dimension used by daily and monthly stats.",
        fields: [
          { name: "id",          type: "VARCHAR(64)",   pk: true },
          { name: "name",        type: "VARCHAR(255)",  nullable: false },
          { name: "short_name",  type: "VARCHAR(64)",   nullable: false },
          { name: "area",        type: "VARCHAR(64)",   nullable: false, note: "'Payment Methods' | 'Channels' | 'Platforms'" },
          { name: "tag",         type: "VARCHAR(64)",   nullable: true,  note: "Filter tag within area e.g. 'Card', 'QR'" },
          { name: "logo",        type: "TEXT",          nullable: true },
          { name: "description", type: "TEXT",          nullable: true },
          { name: "sort_order",  type: "INTEGER",       nullable: false, default: "0" },
          { name: "created_at",  type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
      },
      {
        name: "solution_tags",
        description: "Solution / add-on tags (e.g. DCC, Tokenisation). A transaction can have multiple tags — each increments its row independently.",
        fields: [
          { name: "id",          type: "VARCHAR(64)",   pk: true },
          { name: "name",        type: "VARCHAR(255)",  nullable: false },
          { name: "short_name",  type: "VARCHAR(64)",   nullable: false },
          { name: "area",        type: "VARCHAR(64)",   nullable: false, note: "Always 'Solutions'" },
          { name: "tag",         type: "VARCHAR(64)",   nullable: true },
          { name: "logo",        type: "TEXT",          nullable: true },
          { name: "description", type: "TEXT",          nullable: true },
          { name: "sort_order",  type: "INTEGER",       nullable: false, default: "0" },
          { name: "created_at",  type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
      },
      {
        name: "countries",
        description: "Country dimension. Originally ISO alpha-2 codes; widened to TEXT to support slug-style IDs for user-created entries.",
        fields: [
          { name: "id",          type: "TEXT",          pk: true, note: "ISO alpha-2 or slug e.g. 'za', 'namibia'" },
          { name: "name",        type: "VARCHAR(255)",  nullable: false },
          { name: "short_name",  type: "TEXT",          nullable: true },
          { name: "logo",        type: "TEXT",          nullable: true },
          { name: "description", type: "TEXT",          nullable: true },
          { name: "sort_order",  type: "INTEGER",       nullable: false, default: "0" },
          { name: "created_at",  type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
      },
      {
        name: "banks",
        description: "Acquiring bank dimension — independent from payment_methods. A transaction has one payment method AND one acquiring bank.",
        fields: [
          { name: "id",          type: "VARCHAR(64)",   pk: true },
          { name: "name",        type: "VARCHAR(255)",  nullable: false },
          { name: "short_name",  type: "VARCHAR(64)",   nullable: false },
          { name: "tag",         type: "VARCHAR(64)",   nullable: true,  note: "e.g. 'Big 4', 'Challenger', 'Pan-African'" },
          { name: "logo",        type: "TEXT",          nullable: true },
          { name: "description", type: "TEXT",          nullable: true },
          { name: "region",      type: "VARCHAR(64)",   nullable: true,  note: "e.g. 'South Africa', 'Africa'" },
          { name: "sort_order",  type: "INTEGER",       nullable: false, default: "0" },
          { name: "created_at",  type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
      },
    ],
  },
  {
    label: "Daily Stats  (30-day rolling)",
    color: "bg-violet/20 text-violet border-violet/30",
    tables: [
      {
        name: "daily_pm_stats",
        description: "One row per (date × payment method). Rolling 30-day retention. approval_rate is NULL for the current open day.",
        fields: [
          { name: "date",               type: "DATE",          pk: true },
          { name: "payment_method_id",  type: "VARCHAR(64)",   pk: true, fk: "payment_methods" },
          { name: "total_count",        type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_count",     type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_value",     type: "NUMERIC(18,2)", nullable: false, default: "0" },
          { name: "active_merchants",   type: "INTEGER",       nullable: false, default: "0" },
          { name: "approval_rate",      type: "NUMERIC(5,2)",  nullable: true,  note: "NULL while day is open" },
          { name: "updated_at",         type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
        indexes: ["date DESC", "payment_method_id, date DESC"],
      },
      {
        name: "daily_tag_stats",
        description: "One row per (date × solution tag). Same structure as daily_pm_stats.",
        fields: [
          { name: "date",             type: "DATE",          pk: true },
          { name: "solution_tag_id",  type: "VARCHAR(64)",   pk: true, fk: "solution_tags" },
          { name: "total_count",      type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_count",   type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_value",   type: "NUMERIC(18,2)", nullable: false, default: "0" },
          { name: "active_merchants", type: "INTEGER",       nullable: false, default: "0" },
          { name: "approval_rate",    type: "NUMERIC(5,2)",  nullable: true,  note: "NULL while day is open" },
          { name: "updated_at",       type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
        indexes: ["date DESC", "solution_tag_id, date DESC"],
      },
      {
        name: "daily_country_stats",
        description: "One row per (date × country). Rolling 30-day retention.",
        fields: [
          { name: "date",             type: "DATE",          pk: true },
          { name: "country_id",       type: "TEXT",          pk: true, fk: "countries" },
          { name: "total_count",      type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_count",   type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_value",   type: "NUMERIC(18,2)", nullable: false, default: "0" },
          { name: "active_merchants", type: "INTEGER",       nullable: false, default: "0" },
          { name: "approval_rate",    type: "NUMERIC(5,2)",  nullable: true,  note: "NULL while day is open" },
          { name: "updated_at",       type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
        indexes: ["date DESC", "country_id, date DESC"],
      },
      {
        name: "daily_bank_stats",
        description: "One row per (date × bank). Rolling 30-day retention.",
        fields: [
          { name: "date",             type: "DATE",          pk: true },
          { name: "bank_id",          type: "VARCHAR(64)",   pk: true, fk: "banks" },
          { name: "total_count",      type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_count",   type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_value",   type: "NUMERIC(18,2)", nullable: false, default: "0" },
          { name: "active_merchants", type: "INTEGER",       nullable: false, default: "0" },
          { name: "approval_rate",    type: "NUMERIC(5,2)",  nullable: true,  note: "NULL while day is open" },
          { name: "updated_at",       type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
        indexes: ["date DESC", "bank_id, date DESC"],
      },
    ],
  },
  {
    label: "Monthly Stats  (36-month rolling)",
    color: "bg-emerald/20 text-emerald border-emerald/30",
    tables: [
      {
        name: "monthly_pm_stats",
        description: "One row per (year_month × payment method). 36-month retention. approval_rate and growth_pct are NULL for the current open month.",
        fields: [
          { name: "year_month",         type: "CHAR(7)",       pk: true, note: "'YYYY-MM' SAST boundaries" },
          { name: "payment_method_id",  type: "VARCHAR(64)",   pk: true, fk: "payment_methods" },
          { name: "total_count",        type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_count",     type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_value",     type: "NUMERIC(18,2)", nullable: false, default: "0" },
          { name: "active_merchants",   type: "INTEGER",       nullable: false, default: "0" },
          { name: "approval_rate",      type: "NUMERIC(5,2)",  nullable: true,  note: "NULL while month is open" },
          { name: "growth_pct",         type: "NUMERIC(5,2)",  nullable: true,  note: "Month-on-month growth %" },
          { name: "updated_at",         type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
        indexes: ["year_month DESC", "payment_method_id, year_month DESC"],
      },
      {
        name: "monthly_tag_stats",
        description: "One row per (year_month × solution tag). 36-month retention.",
        fields: [
          { name: "year_month",       type: "CHAR(7)",       pk: true, note: "'YYYY-MM'" },
          { name: "solution_tag_id",  type: "VARCHAR(64)",   pk: true, fk: "solution_tags" },
          { name: "total_count",      type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_count",   type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_value",   type: "NUMERIC(18,2)", nullable: false, default: "0" },
          { name: "active_merchants", type: "INTEGER",       nullable: false, default: "0" },
          { name: "approval_rate",    type: "NUMERIC(5,2)",  nullable: true },
          { name: "growth_pct",       type: "NUMERIC(5,2)",  nullable: true },
          { name: "updated_at",       type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
        indexes: ["year_month DESC", "solution_tag_id, year_month DESC"],
      },
      {
        name: "monthly_country_stats",
        description: "One row per (year_month × country). 36-month retention.",
        fields: [
          { name: "year_month",       type: "CHAR(7)",       pk: true, note: "'YYYY-MM'" },
          { name: "country_id",       type: "TEXT",          pk: true, fk: "countries" },
          { name: "total_count",      type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_count",   type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_value",   type: "NUMERIC(18,2)", nullable: false, default: "0" },
          { name: "active_merchants", type: "INTEGER",       nullable: false, default: "0" },
          { name: "approval_rate",    type: "NUMERIC(5,2)",  nullable: true },
          { name: "growth_pct",       type: "NUMERIC(5,2)",  nullable: true },
          { name: "updated_at",       type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
        indexes: ["year_month DESC", "country_id, year_month DESC"],
      },
      {
        name: "monthly_bank_stats",
        description: "One row per (year_month × bank). 36-month retention.",
        fields: [
          { name: "year_month",       type: "CHAR(7)",       pk: true, note: "'YYYY-MM'" },
          { name: "bank_id",          type: "VARCHAR(64)",   pk: true, fk: "banks" },
          { name: "total_count",      type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_count",   type: "BIGINT",        nullable: false, default: "0" },
          { name: "approved_value",   type: "NUMERIC(18,2)", nullable: false, default: "0" },
          { name: "active_merchants", type: "INTEGER",       nullable: false, default: "0" },
          { name: "approval_rate",    type: "NUMERIC(5,2)",  nullable: true },
          { name: "growth_pct",       type: "NUMERIC(7,2)",  nullable: true },
          { name: "updated_at",       type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
        indexes: ["year_month DESC", "bank_id, year_month DESC"],
      },
    ],
  },
  {
    label: "System Tables",
    color: "bg-amber/20 text-amber border-amber/30",
    tables: [
      {
        name: "rules",
        description: "Configurable rules attached to any entity (payment method, solution tag, country, or bank) via entity_id.",
        fields: [
          { name: "id",                type: "TEXT",          pk: true },
          { name: "entity_id",         type: "TEXT",          nullable: false, note: "Loose FK to any dimension table id" },
          { name: "transaction_types", type: "TEXT[]",        nullable: false, default: "'{}'" },
          { name: "field_type",        type: "TEXT",          nullable: false },
          { name: "operator",          type: "TEXT",          nullable: false, default: "'eq'" },
          { name: "value",             type: "TEXT",          nullable: false, default: "''" },
          { name: "sort_order",        type: "INTEGER",       nullable: false, default: "0" },
          { name: "created_at",        type: "TIMESTAMPTZ",   nullable: false, default: "NOW()" },
        ],
        indexes: ["entity_id"],
      },
      {
        name: "_migrations",
        description: "Tracks which migration scripts have been applied. Prevents re-running migrations on restart.",
        fields: [
          { name: "filename",   type: "VARCHAR(255)", pk: true },
          { name: "applied_at", type: "TIMESTAMPTZ",  nullable: false, default: "NOW()" },
        ],
      },
    ],
  },
];

const RELATIONSHIPS = [
  { from: "daily_pm_stats.payment_method_id",    to: "payment_methods.id" },
  { from: "monthly_pm_stats.payment_method_id",  to: "payment_methods.id" },
  { from: "daily_tag_stats.solution_tag_id",     to: "solution_tags.id" },
  { from: "monthly_tag_stats.solution_tag_id",   to: "solution_tags.id" },
  { from: "daily_country_stats.country_id",      to: "countries.id" },
  { from: "monthly_country_stats.country_id",    to: "countries.id" },
  { from: "daily_bank_stats.bank_id",            to: "banks.id" },
  { from: "monthly_bank_stats.bank_id",          to: "banks.id" },
];

function FieldBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded font-mono", color)}>
      {label}
    </span>
  );
}

function TableCard({ table, groupColor }: { table: Table; groupColor: string }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={cn("text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border", groupColor)}>
            table
          </span>
          <span className="font-mono font-semibold text-sm">{table.name}</span>
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{table.description}</p>

          <div className="rounded-xl overflow-hidden border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[32%]">Column</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[22%]">Type</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[18%]">Constraints</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody>
                {table.fields.map((f, i) => (
                  <tr
                    key={f.name}
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      f.pk ? "bg-cyan/5" : i % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                    )}
                  >
                    <td className="px-3 py-2 font-mono font-medium flex items-center gap-1.5 flex-wrap">
                      {f.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{f.type}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {f.pk && <FieldBadge label="PK" color="bg-cyan/20 text-cyan border border-cyan/30" />}
                        {f.fk && <FieldBadge label={`FK → ${f.fk}`} color="bg-violet/20 text-violet border border-violet/30" />}
                        {!f.nullable && !f.pk && <FieldBadge label="NOT NULL" color="bg-muted text-muted-foreground border border-border" />}
                        {f.default && <FieldBadge label={`DEFAULT ${f.default}`} color="bg-muted/60 text-muted-foreground border border-border" />}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground italic">{f.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {table.indexes && table.indexes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-muted-foreground">Indexes:</span>
              {table.indexes.map(idx => (
                <span key={idx} className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  ({idx})
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DbSchema() {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const visibleGroups = activeGroup
    ? GROUPS.filter(g => g.label === activeGroup)
    : GROUPS;

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar />
        <div className="flex-1 px-5 sm:px-8 lg:px-12 py-8 lg:py-10 space-y-6 max-w-[1600px] w-full mx-auto">
        <PageHeader
          title="DB Schema"
          crumbs={[{ label: "Insights Hub" }, { label: "Dev Tools" }, { label: "DB Schema" }]}
          right={
            <span className="text-xs text-muted-foreground bg-card border border-border rounded-full px-4 py-2 shadow-card">
              {GROUPS.reduce((s, g) => s + g.tables.length, 0)} tables · {RELATIONSHIPS.length} FK relationships
            </span>
          }
        />

        {/* Group filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveGroup(null)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              activeGroup === null
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            All tables
          </button>
          {GROUPS.map(g => (
            <button
              key={g.label}
              onClick={() => setActiveGroup(g.label === activeGroup ? null : g.label)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                activeGroup === g.label
                  ? cn("border-current", g.color)
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Relationship map */}
        {!activeGroup && (
          <div className="mb-8 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-4">Foreign Key Relationships</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RELATIONSHIPS.map(r => (
                <div key={r.from} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-violet font-medium">{r.from}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-cyan font-medium">{r.to}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
              <span className="font-semibold">Note:</span> <code className="font-mono">rules.entity_id</code> is a loose reference — it stores any dimension table <code className="font-mono">id</code> without a hard FK constraint, allowing rules to attach to payment methods, solution tags, countries, or banks.
            </div>
          </div>
        )}

        {/* Table groups */}
        <div className="space-y-8">
          {visibleGroups.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-4">
                <span className={cn("text-xs font-semibold px-3 py-1 rounded-full border", group.color)}>
                  {group.label}
                </span>
                <span className="text-xs text-muted-foreground">{group.tables.length} tables</span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {group.tables.map(t => (
                  <TableCard key={t.name} table={t} groupColor={group.color} />
                ))}
              </div>
            </div>
          ))}
        </div>

        </div>
      </main>
    </div>
  );
}
