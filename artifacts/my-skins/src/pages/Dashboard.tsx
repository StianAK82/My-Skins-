import { useGetDashboardSummary, useGetProjects, useCreateProject } from "@workspace/api-client-react";
import { useLanguage } from "@/hooks/use-language";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Plus, Scissors, Layers, Settings, Gamepad2, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: recentProjects, isLoading: isProjectsLoading } = useGetProjects({ 
    limit: 4 
  });
  
  const createProject = useCreateProject();

  const handleCreate = (type: "shirt" | "pants") => {
    createProject.mutate({
      data: {
        title: `Untitled ${type === "shirt" ? "Shirt" : "Pants"}`,
        type: type,
      }
    }, {
      onSuccess: (project) => {
        setLocation(`/editor/${project.id}`);
      }
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground mt-1">Welcome back to your studio.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={() => handleCreate("shirt")} className="gap-2" disabled={createProject.isPending}>
            <Scissors className="w-4 h-4" />
            {t("dashboard.create.shirt")}
          </Button>
          <Button onClick={() => handleCreate("pants")} variant="secondary" className="gap-2" disabled={createProject.isPending}>
            <Layers className="w-4 h-4" />
            {t("dashboard.create.pants")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <StatsCard 
          title={t("dashboard.stats.projects")} 
          value={summary?.totalProjects ?? 0} 
          loading={isSummaryLoading} 
        />
        <StatsCard 
          title="Shirts" 
          value={summary?.shirtProjects ?? 0} 
          loading={isSummaryLoading} 
        />
        <StatsCard 
          title="Pants" 
          value={summary?.pantsProjects ?? 0} 
          loading={isSummaryLoading} 
        />
        <StatsCard 
          title={t("dashboard.stats.exports")} 
          value={summary?.totalExports ?? 0} 
          loading={isSummaryLoading} 
        />
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">{t("dashboard.recent")}</h2>
        <Link href="/projects" className="text-sm text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {isProjectsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : !recentProjects?.projects?.length ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border border-dashed">
          <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">{t("dashboard.empty")}</h3>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button onClick={() => handleCreate("shirt")} variant="outline">Create Shirt</Button>
            <Button onClick={() => handleCreate("pants")} variant="outline">Create Pants</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {recentProjects.projects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/editor/${project.id}`}>
                <div className="group rounded-xl bg-card border border-border overflow-hidden hover:border-primary/50 transition-colors cursor-pointer flex flex-col h-full">
                  <div className="aspect-square bg-muted/30 relative flex-shrink-0">
                    {project.thumbnailUrl ? (
                      <img src={project.thumbnailUrl} alt={project.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        {project.type === "shirt" ? <Scissors className="w-8 h-8 opacity-20" /> : <Layers className="w-8 h-8 opacity-20" />}
                      </div>
                    )}
                    <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-background/80 backdrop-blur rounded text-foreground uppercase tracking-wider">
                      {project.type}
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-medium text-lg truncate mb-1 group-hover:text-primary transition-colors">{project.title}</h3>
                    <p className="text-xs text-muted-foreground mt-auto">
                      Edited {format(new Date(project.updatedAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsCard({ title, value, loading }: { title: string, value: number, loading: boolean }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-16 bg-muted rounded animate-pulse" />
        ) : (
          <div className="text-3xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
