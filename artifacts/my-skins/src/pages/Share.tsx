import { useGetSharedProject } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function ShareView() {
  const { token } = useParams<{ token: string }>();
  const { data: shared, isLoading, isError } = useGetSharedProject(token);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (isError || !shared) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">Project not found</h1>
        <p className="text-muted-foreground mb-6">This link might be invalid or the project is no longer public.</p>
        <Link href="/">
          <Button>Return Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 py-12">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="aspect-video bg-muted flex items-center justify-center relative">
            {shared.project.thumbnailUrl ? (
              <img src={shared.project.thumbnailUrl} alt={shared.project.title} className="w-full h-full object-contain" />
            ) : (
              <div className="text-muted-foreground">No preview available</div>
            )}
          </div>
          <div className="p-8">
            <h1 className="text-3xl font-bold mb-2">{shared.project.title}</h1>
            <p className="text-muted-foreground">
              Created by <span className="font-medium text-foreground">{shared.author.displayName || shared.author.username}</span>
            </p>
            <div className="mt-8">
              <Link href="/">
                <Button>Create your own with My Skins</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
