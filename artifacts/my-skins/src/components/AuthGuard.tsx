import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe({
    query: { queryKey: ["/api/auth/me"], retry: false }
  });

  useEffect(() => {
    if (!isLoading && isError) {
      setLocation("/");
    }
  }, [isLoading, isError, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError || !user) {
    return null;
  }

  return <>{children}</>;
}
