import React, { useState, useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Navigation, type NavTab } from '@/components/layout/Navigation';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AuthShell, type AuthMode } from '@/features/auth/AuthShell';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { ProfileView } from '@/features/profile/ProfileView';
import { AdminPanel } from '@/features/admin/AdminPanel';
import { HomeDashboard } from '@/features/home/HomeDashboard';
import { Button } from '@/components/ui/Button';
import { OfferRideForm } from '@/features/rides/OfferRideForm';
import { MyRidesView } from '@/features/rides/MyRidesView';
import { RideDetailModal } from '@/features/rides/RideDetailModal';
import type { Ride } from '@/features/rides/ride.types';
import { ArrowLeft, LogIn } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const { user, isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<AuthMode>('signin');
  const [selectedRideForModal, setSelectedRideForModal] = useState<Ride | null>(null);

  // Deep-link navigation from PWA App Shortcuts or Password Reset / Auth callback links
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as NavTab | null;
      if (tabParam) {
        if (tabParam === 'find') {
          setCurrentTab('home');
        } else if (['home', 'offer', 'rides', 'profile', 'admin'].includes(tabParam)) {
          setCurrentTab(tabParam);
        }
      }

      // Check if user landed on https://icem-connect.vercel.app/ from a password recovery link
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      if (
        hash.includes('type=recovery') ||
        search.includes('type=recovery') ||
        hash.includes('recovery_token')
      ) {
        setAuthInitialMode('reset_password');
        setShowAuthModal(true);
      }
    } catch {
      // ignore
    }

    if (isSupabaseConfigured()) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setAuthInitialMode('reset_password');
          setShowAuthModal(true);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const renderTabContent = () => {
    switch (currentTab) {
      case 'find':
      case 'home':
        return (
          <HomeDashboard
            userEmail={user?.email || null}
            onOfferRideClick={() => setCurrentTab('offer')}
            onInspectRide={(ride) => setSelectedRideForModal(ride)}
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
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6">
      <AppHeader />
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />
      <PwaInstallPrompt />

      {!isAuthenticated && currentTab === 'home' && (
        <div className="border-b border-border bg-[#003C84]/5 px-3 py-1.5 text-center text-xs text-primary flex flex-wrap items-center justify-center gap-1.5">
          <span>Are you an ICEM student?</span>
          <button
            onClick={() => {
              setAuthInitialMode('signin');
              setShowAuthModal(true);
            }}
            className="font-semibold underline hover:text-[#00A2A5] inline-flex items-center gap-1"
          >
            <LogIn className="h-3 w-3" /> Sign in or Register
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
            <AuthShell
              initialMode={authInitialMode}
              onSuccess={() => setShowAuthModal(false)}
            />
          </div>
        ) : (
          renderTabContent()
        )}
      </main>

      {/* Ride Detail Inspection & Seat Request Modal */}
      {selectedRideForModal && (
        <RideDetailModal
          ride={selectedRideForModal}
          isOpen={true}
          onClose={() => setSelectedRideForModal(null)}
          onRideUpdated={(updated) => setSelectedRideForModal(updated)}
        />
      )}
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
