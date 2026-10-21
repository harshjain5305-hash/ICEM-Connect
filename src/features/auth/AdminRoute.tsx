import React from 'react';
import { useAuth } from './useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ShieldX } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Checking administrator privileges...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-12" role="alert" aria-label="Access Denied">
        <Card className="border-destructive/30 shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldX className="h-7 w-7" />
            </div>
            <CardTitle className="text-destructive text-lg">Access Denied (403)</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-xs text-muted-foreground space-y-2">
            <p>
              Administrative privilege is strictly required to view this panel.
            </p>
            <p className="font-medium text-foreground">
              Ordinary verified student accounts cannot access administrative or moderation controls.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
