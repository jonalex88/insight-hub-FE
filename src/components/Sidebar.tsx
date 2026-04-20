import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const NavItem = ({ to, label, sub = false, end = false, onNavigate }: { to: string; label: string; sub?: boolean; end?: boolean; onNavigate?: () => void }) => (
  <NavLink
    to={to}
    end={end}
    onClick={onNavigate}
    className={({ isActive }) =>
      cn(
        "group relative flex items-center rounded-lg transition-all duration-300",
        sub
          ? "pl-9 pr-4 py-2.5 text-[13px] font-medium"
          : "px-4 py-3 text-[15px] font-semibold",
        isActive
          ? "bg-sidebar-accent text-navy-foreground"
          : "text-navy-foreground/65 hover:text-navy-foreground hover:bg-sidebar-accent/50"
      )
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-cyan shadow-cyan" />
        )}
        <span>{label}</span>
      </>
    )}
  </NavLink>
);

const SectionLabel = ({ label }: { label: string }) => (
  <div className="px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-navy-foreground/35 select-none">
    {label}
  </div>
);

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
  <>
    <div className="px-7 pt-8 pb-6">
      <img src="/logo.png" alt="Transaction Junction" className="h-14 w-auto object-contain" />
    </div>

    <div className="px-7 pb-6">
      <div className="font-display text-2xl font-bold text-cyan">Insights Hub</div>
    </div>

    <nav className="flex-1 px-4 space-y-0.5">
      <NavItem to="/dashboard" label="Dashboard" onNavigate={onNavigate} />

      <SectionLabel label="Reports" />
      <NavItem to="/"          label="Payment Methods" sub end onNavigate={onNavigate} />
      <NavItem to="/solutions" label="Solutions"       sub onNavigate={onNavigate} />
      <NavItem to="/channels"  label="Channels"        sub onNavigate={onNavigate} />
      <NavItem to="/platforms" label="Platforms"       sub onNavigate={onNavigate} />
      <NavItem to="/countries" label="Countries"       sub onNavigate={onNavigate} />
      <NavItem to="/banks"     label="Banks"           sub onNavigate={onNavigate} />

      <div className="pt-2" />
      <NavItem to="/reports" label="Data"   onNavigate={onNavigate} />
      <NavItem to="/config"  label="Config" onNavigate={onNavigate} />

      <SectionLabel label="Dev Tools" />
      <NavItem to="/compliance"   label="Engineering Compliance" sub onNavigate={onNavigate} />
      <NavItem to="/dev/api"      label="API"                    sub onNavigate={onNavigate} />
      <NavItem to="/dev/db-schema" label="DB Schemas"            sub onNavigate={onNavigate} />
    </nav>

    <div className="m-4 rounded-xl bg-sidebar-accent/60 p-4 border border-sidebar-border">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-cyan/20 grid place-items-center text-cyan font-bold">A</div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Analytics Team</div>
          <div className="text-xs text-navy-foreground/60">analytics@tj.co.za</div>
        </div>
      </div>
    </div>
  </>
);

export const Sidebar = () => (
  <aside className="hidden md:flex md:w-72 lg:w-80 shrink-0 flex-col bg-gradient-sidebar text-navy-foreground sticky top-0 h-screen overflow-y-auto">
    <SidebarContent />
  </aside>
);

export const MobileTopBar = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Top bar */}
      <div className="md:hidden flex items-center justify-between bg-gradient-sidebar text-navy-foreground px-5 py-4">
        <button
          onClick={() => setOpen(true)}
          className="p-1 -ml-1 rounded-md text-cyan hover:bg-sidebar-accent/50 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="font-display font-extrabold tracking-wide">INSIGHTS HUB</div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={cn(
        "md:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-gradient-sidebar text-navy-foreground transform transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-md text-navy-foreground/60 hover:text-navy-foreground hover:bg-sidebar-accent/50 transition-colors"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>

        <SidebarContent onNavigate={() => setOpen(false)} />
      </div>
    </>
  );
};
