import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";

const DEV_PREVIEW = import.meta.env.DEV;

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe({
    query: { queryKey: ["/api/auth/me"], retry: false }
  });

  useEffect(() => {
    if (!DEV_PREVIEW && !isLoading && isError) {
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
    if (DEV_PREVIEW) {
      return <>{children}</>;
    }
    return null;
  }

  return <>{children}</>;
}
