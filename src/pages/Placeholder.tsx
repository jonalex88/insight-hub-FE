import { MobileTopBar, Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";

interface Props {
  title: string;
  description: string;
}

const Placeholder = ({ title, description }: Props) => (
  <div className="min-h-screen flex bg-background">
    <Sidebar />
    <main className="flex-1 min-w-0 flex flex-col">
      <MobileTopBar />
      <div className="flex-1 px-5 sm:px-8 lg:px-12 py-8 lg:py-10 space-y-8 max-w-[1600px] w-full mx-auto">
        <PageHeader title={title} crumbs={[{ label: "Insights Hub" }, { label: title }]} />
        <div className="bg-card rounded-2xl border border-dashed border-border p-16 text-center shadow-card">
          <h3 className="font-display text-xl font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{description}</p>
          <p className="text-xs text-muted-foreground/70 mt-4 uppercase tracking-[0.18em]">Coming soon</p>
        </div>
      </div>
    </main>
  </div>
);

export default Placeholder;
