import React from 'react';
import { useAuth } from './useAuth';
import { AuthShell } from './AuthShell';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, fallback }) => {
  const { isAuthenticated, isLoading, profile } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Verifying student credentials...</p>
        </div>
      </div>
    );
  }

  if (profile && profile.status !== 'ACTIVE') {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card className="border-destructive/30">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <CardTitle className="text-destructive">Account Restricted</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground space-y-2">
            <p>
              Your student account status is currently <strong>{profile.status}</strong>.
            </p>
            <p>
              Please contact the ICEM administration or support coordinator to reactivate your access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : <AuthShell />;
  }

  return <>{children}</>;
};
