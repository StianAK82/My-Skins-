import { useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { useGetProjects } from "@workspace/api-client-react";
import type { Project } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Scissors, Layers } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

type ProjectType = "all" | "shirt" | "pants";

export default function Projects() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<ProjectType>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useGetProjects({
    limit: 50,
    ...(filter !== "all" ? { type: filter } : {})
  });

  const projects: Project[] = data?.projects ?? [];
  
  const filteredProjects = projects.filter((p) => 
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("projects.title")}</h1>
          <p className="text-muted-foreground mt-1">Manage and organize all your creations.</p>
        </div>
        <Link href="/dashboard">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={t("projects.search")} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        
        <Tabs value={filter} onValueChange={(v) => setFilter(v as ProjectType)}>
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="all">{t("projects.filter.all")}</TabsTrigger>
            <TabsTrigger value="shirt">{t("projects.filter.shirt")}</TabsTrigger>
            <TabsTrigger value="pants">{t("projects.filter.pants")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-64 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-xl border border-border border-dashed">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No projects found</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {search ? "Try adjusting your search or filters." : "You haven't created any projects yet."}
          </p>
          {!search && (
            <div className="mt-6">
              <Link href="/dashboard">
                <Button variant="outline">Go to Dashboard</Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProjects.map((project: Project, i: number) => (
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
