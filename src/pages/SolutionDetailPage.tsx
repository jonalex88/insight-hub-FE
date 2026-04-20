import { useParams, useNavigate, Navigate } from "react-router-dom";
import { MobileTopBar, Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { SolutionDetail } from "@/components/SolutionDetail";
import { useAreaSolutions } from "@/hooks/useAreaSolutions";
import { Area } from "@/data/solutions";
import { ArrowLeft } from "lucide-react";

const AREA_BASE_PATH: Record<Area, string> = {
  "Payment Methods": "/payment-methods",
  "Solutions":       "/solutions",
  "Channels":        "/channels",
  "Platforms":       "/platforms",
  "Countries":       "/countries",
  "Banks":           "/banks",
};

interface Props { area: Area; }

const SolutionDetailPage = ({ area }: Props) => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const backPath = AREA_BASE_PATH[area];

  const { solutions, isLoading } = useAreaSolutions(area);
  const solution = solutions.find((s) => s.id === slug);

  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-background">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col">
          <MobileTopBar />
          <div className="flex-1 px-5 sm:px-8 lg:px-12 py-8 lg:py-10 space-y-8 max-w-[1600px] w-full mx-auto">
            <div className="h-10 w-64 rounded-xl bg-secondary animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-secondary animate-pulse" />)}
            </div>
            <div className="h-64 rounded-2xl bg-secondary animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!solution) return <Navigate to={backPath} replace />;

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar />
        <div className="flex-1 px-5 sm:px-8 lg:px-12 py-8 lg:py-10 space-y-8 max-w-[1600px] w-full mx-auto">
          <PageHeader
            title={solution.name}
            crumbs={[
              { label: "Insights Hub" },
              { label: area, to: backPath },
              { label: solution.name },
            ]}
            right={
              <button
                onClick={() => navigate(backPath)}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-card border border-border rounded-full px-4 py-2 shadow-card transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to {area}
              </button>
            }
          />
          <SolutionDetail solution={solution} />
        </div>
      </main>
    </div>
  );
};

export default SolutionDetailPage;
