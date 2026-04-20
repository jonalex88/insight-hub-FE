import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  title: string;
  crumbs: { label: string; to?: string }[];
  right?: ReactNode;
}

export const PageHeader = ({ title, crumbs, right }: Props) => (
  <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-border pb-6">
    <div>
      <h1 className="font-display text-3xl md:text-4xl font-extrabold text-foreground">{title}</h1>
      <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
            {c.to ? (
              <Link to={c.to} className="hover:text-foreground transition-colors">{c.label}</Link>
            ) : (
              <span className={i === crumbs.length - 1 ? "text-foreground font-medium" : ""}>{c.label}</span>
            )}
          </span>
        ))}
      </div>
    </div>
    {right && <div className="flex items-center gap-3">{right}</div>}
  </header>
);
