import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Create from "@/pages/Create";
import VisualTest from "@/pages/VisualTest";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Create} />
      {import.meta.env.MODE !== "production" || import.meta.env.VITE_ENABLE_VISUAL_TESTS === "true" ? <Route path="/visual-test" component={VisualTest} /> : null}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
