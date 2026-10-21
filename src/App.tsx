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
import { LocationSelect } from '@/features/locations/LocationSelect';
import type { Location } from '@/features/locations/location.schema';
import { Compass, Car, Search, PlusCircle, ArrowLeft, LogIn, MapPin } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const { user, profile, isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [findPickup, setFindPickup] = useState<Location | null>(null);
  const [findDrop, setFindDrop] = useState<Location | null>(null);
  const [offerOrigin, setOfferOrigin] = useState<Location | null>(null);
  const [offerDest, setOfferDest] = useState<Location | null>(null);

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
            <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    <CardTitle>Find a Ride (Verified Student Segment)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LocationSelect
                      label="Pickup Location"
                      placeholder="e.g. ICEM Gate or Somatne Phata"
                      value={findPickup?.id}
                      onSelect={setFindPickup}
                    />
                    <LocationSelect
                      label="Destination"
                      placeholder="e.g. Talegaon Station or Bhosari"
                      value={findDrop?.id}
                      onSelect={setFindDrop}
                    />
                  </div>

                  {findPickup && findDrop && (
                    <div className="rounded-xl border border-primary/20 bg-[#003C84]/5 p-3.5 text-xs text-primary space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-[#00A2A5]" />
                        <span>Selected Route Segment</span>
                      </div>
                      <p className="text-foreground">
                        {findPickup.name} &rarr; {findDrop.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Phase 2 Relational Model active. Deterministic route matching and join requests activate in Phase 5 &amp; 6.
                      </p>
                    </div>
                  )}

                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <Compass className="h-4 w-4 text-primary" />
                      <span>Phase 2 — Relational Locations Active</span>
                    </div>
                    <p>
                      Locations are dynamically retrieved from the PostgreSQL <code>locations</code> seed table rather than hard-coded strings.
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
            <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <PlusCircle className="h-5 w-5 text-primary" />
                    <CardTitle>Offer a Ride</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LocationSelect
                      label="Trip Origin"
                      placeholder="e.g. ICEM Main Campus"
                      value={offerOrigin?.id}
                      onSelect={setOfferOrigin}
                    />
                    <LocationSelect
                      label="Trip Destination"
                      placeholder="e.g. Bhosari Bus Stand"
                      value={offerDest?.id}
                      onSelect={setOfferDest}
                    />
                  </div>

                  {offerOrigin && offerDest && (
                    <div className="rounded-xl border border-primary/20 bg-[#003C84]/5 p-3.5 text-xs text-primary space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-[#00A2A5]" />
                        <span>Planned Trip Corridor</span>
                      </div>
                      <p className="text-foreground">
                        {offerOrigin.name} &rarr; {offerDest.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Ready for Phase 3 ride publishing, seat capacity, and waypoint sequencing.
                      </p>
                    </div>
                  )}

                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <Compass className="h-4 w-4 text-primary" />
                      <span>Phase 2 — Core Data Model Verified</span>
                    </div>
                    <p>
                      Host identity verified for <strong>{profile?.name}</strong>. Full ride publication and state machine transitions activate in <strong>Phase 3</strong>.
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
