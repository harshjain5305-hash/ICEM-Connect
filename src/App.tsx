import React, { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Navigation, type NavTab } from '@/components/layout/Navigation';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AuthShell } from '@/features/auth/AuthShell';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { ProfileView } from '@/features/profile/ProfileView';
import { AdminPanel } from '@/features/admin/AdminPanel';
import { HomeDashboard } from '@/features/home/HomeDashboard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Compass, Car, Search, PlusCircle, ArrowLeft, LogIn } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const { user, profile, isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const renderTabContent = () => {
    switch (currentTab) {
      case 'home':
        return (
          <HomeDashboard
            userEmail={user?.email || null}
            onFindRideClick={() => setCurrentTab('find')}
            onOfferRideClick={() => setCurrentTab('offer')}
          />
        );

      case 'find':
        return (
          <ProtectedRoute
            fallback={
              <div className="mx-auto max-w-md px-4 py-8">
                <div className="mb-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    Verified ICEM student identity required before finding rides.
                  </p>
                </div>
                <AuthShell onSuccess={() => setCurrentTab('find')} />
              </div>
            }
          >
            <div className="mx-auto max-w-2xl px-4 py-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    <CardTitle>Find a Ride (Verified Student Segment)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <Compass className="h-4 w-4 text-primary" />
                      <span>Phase 1 Verification Satisfied</span>
                    </div>
                    <p>
                      Logged in as <strong>{profile?.name}</strong> ({profile?.email}). Ride discovery &amp; deterministic route matching will activate in <strong>Phase 5</strong> after Phase 2 (Locations &amp; Data Model).
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setCurrentTab('home')} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                  </Button>
                </CardContent>
              </Card>
            </div>
          </ProtectedRoute>
        );

      case 'offer':
        return (
          <ProtectedRoute
            fallback={
              <div className="mx-auto max-w-md px-4 py-8">
                <div className="mb-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    Verified student login required before offering seats.
                  </p>
                </div>
                <AuthShell onSuccess={() => setCurrentTab('offer')} />
              </div>
            }
          >
            <div className="mx-auto max-w-2xl px-4 py-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <PlusCircle className="h-5 w-5 text-primary" />
                    <CardTitle>Offer a Ride</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <Compass className="h-4 w-4 text-primary" />
                      <span>Phase 1 Verification Satisfied</span>
                    </div>
                    <p>
                      Host identity verified for <strong>{profile?.name}</strong>. Ride lifecycle &amp; capacity transactions will activate in <strong>Phase 3</strong>.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setCurrentTab('home')} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                  </Button>
                </CardContent>
              </Card>
            </div>
          </ProtectedRoute>
        );

      case 'rides':
        return (
          <ProtectedRoute
            fallback={
              <div className="mx-auto max-w-md px-4 py-8">
                <AuthShell onSuccess={() => setCurrentTab('rides')} />
              </div>
            }
          >
            <div className="mx-auto max-w-2xl px-4 py-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-primary" />
                    <CardTitle>My Rides</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Active ride coordination and memberships for {profile?.name} will be tracked here in Phase 6-8.
                  </p>
                  <Button variant="outline" onClick={() => setCurrentTab('home')} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                  </Button>
                </CardContent>
              </Card>
            </div>
          </ProtectedRoute>
        );

      case 'profile':
        return isAuthenticated ? (
          <ProfileView />
        ) : (
          <div className="mx-auto max-w-md px-4 py-6">
            <AuthShell onSuccess={() => setCurrentTab('profile')} />
          </div>
        );

      case 'admin':
        return <AdminPanel />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-6">
      <AppHeader />
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />

      {!isAuthenticated && currentTab === 'home' && (
        <div className="border-b border-border bg-[#003C84]/5 px-4 py-2 text-center text-xs text-primary">
          <span>Are you an ICEM student? </span>
          <button
            onClick={() => setShowAuthModal(true)}
            className="font-semibold underline hover:text-[#00A2A5] inline-flex items-center gap-1 ml-1"
          >
            <LogIn className="h-3 w-3" /> Sign in or Register with @indiraicem.ac.in
          </button>
        </div>
      )}

      <main className="flex-1">
        {showAuthModal ? (
          <div className="relative py-4">
            <div className="mx-auto max-w-md px-4 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuthModal(false)}
                className="gap-1 text-xs text-muted-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
              </Button>
            </div>
            <AuthShell onSuccess={() => setShowAuthModal(false)} />
          </div>
        ) : (
          renderTabContent()
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
