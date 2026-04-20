import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AreaPage } from "./components/AreaPage.tsx";
import SolutionDetailPage from "./pages/SolutionDetailPage.tsx";
import BanksPage from "./pages/BanksPage.tsx";
import Config from "./pages/Config.tsx";
import Reports from "./pages/Reports.tsx";
import Compliance from "./pages/Compliance.tsx";
import ApiDocs from "./pages/ApiDocs.tsx";
import DbSchema from "./pages/DbSchema.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/solutions" element={<AreaPage area="Solutions" />} />
          <Route path="/solutions/:slug" element={<SolutionDetailPage area="Solutions" />} />
          <Route path="/channels" element={<AreaPage area="Channels" />} />
          <Route path="/channels/:slug" element={<SolutionDetailPage area="Channels" />} />
          <Route path="/platforms" element={<AreaPage area="Platforms" />} />
          <Route path="/platforms/:slug" element={<SolutionDetailPage area="Platforms" />} />
          <Route path="/countries" element={<AreaPage area="Countries" />} />
          <Route path="/countries/:slug" element={<SolutionDetailPage area="Countries" />} />
          <Route path="/banks" element={<BanksPage />} />
          <Route path="/banks/:slug" element={<SolutionDetailPage area="Banks" />} />
          <Route path="/payment-methods" element={<Index />} />
          <Route path="/payment-methods/:slug" element={<SolutionDetailPage area="Payment Methods" />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/config" element={<Config />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/dev/api"       element={<ApiDocs />} />
          <Route path="/dev/db-schema" element={<DbSchema />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
