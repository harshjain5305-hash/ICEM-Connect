import React, { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Navigation, type NavTab } from '@/components/layout/Navigation';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AuthShell } from '@/features/auth/AuthShell';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { ProfileView } from '@/features/profile/ProfileView';
import { AdminPanel } from '@/features/admin/AdminPanel';
import { HomeDashboard } from '@/features/home/HomeDashboard';
import { Button } from '@/components/ui/Button';
import { OfferRideForm } from '@/features/rides/OfferRideForm';
import { MyRidesView } from '@/features/rides/MyRidesView';
import { FindRideView } from '@/features/matching/FindRideView';
import { ArrowLeft, LogIn } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const { user, isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedCorridor, setSelectedCorridor] = useState<{
    pickupLocationId: string;
    dropLocationId: string;
    timestamp?: number;
  } | null>(null);

  const renderTabContent = () => {
    switch (currentTab) {
      case 'home':
        return (
          <HomeDashboard
            userEmail={user?.email || null}
            onFindRideClick={(corridor) => {
              setSelectedCorridor(corridor || null);
              setCurrentTab('find');
            }}
            onOfferRideClick={() => setCurrentTab('offer')}
          />
        );

      case 'find':
        return (
          <FindRideView
            initialCorridor={selectedCorridor}
            onOfferClick={() => setCurrentTab('offer')}
            onViewRequestsClick={() => setCurrentTab('rides')}
            onRequestAuth={() => setShowAuthModal(true)}
          />
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
              <OfferRideForm
                onSuccess={() => setCurrentTab('rides')}
                onCancel={() => setCurrentTab('home')}
              />
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
            <MyRidesView
              onOfferNewClick={() => setCurrentTab('offer')}
              onFindRidesClick={() => setCurrentTab('find')}
            />
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
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
