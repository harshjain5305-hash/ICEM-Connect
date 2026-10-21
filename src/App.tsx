import React, { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Navigation, type NavTab } from '@/components/layout/Navigation';
import { AuthShell } from '@/features/auth/AuthShell';
import { HomeDashboard } from '@/features/home/HomeDashboard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Compass, Car, User, Search, PlusCircle, ArrowLeft } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleAuthSuccess = (email: string) => {
    setUserEmail(email);
    setShowAuthModal(false);
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 'home':
        return (
          <HomeDashboard
            userEmail={userEmail}
            onFindRideClick={() => setCurrentTab('find')}
            onOfferRideClick={() => setCurrentTab('offer')}
          />
        );

      case 'find':
        return (
          <div className="mx-auto max-w-2xl px-4 py-8">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  <CardTitle>Find a Ride</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Compass className="h-4 w-4 text-primary" />
                    <span>Phase 0 Dependency Check</span>
                  </div>
                  <p>
                    Full ride search and deterministic route matching will activate in <strong>Phase 5</strong> after Phase 1 (Auth + Student Identity) and Phase 2 (Locations + Core Data Model) are established.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setCurrentTab('home')} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'offer':
        return (
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
                    <span>Phase 0 Dependency Check</span>
                  </div>
                  <p>
                    Ride creation and route waypoints will be implemented in <strong>Phase 3 &amp; 4</strong> once student verification and relational tables are verified.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setCurrentTab('home')} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'rides':
        return (
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
                  Active ride sessions and temporary coordination messages will be displayed here in Phase 6-8.
                </p>
                <Button variant="outline" onClick={() => setCurrentTab('home')} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'profile':
        return (
          <div className="mx-auto max-w-md px-4 py-8">
            {userEmail ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <CardTitle>Verified Student Profile</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                    <div><strong>Email:</strong> {userEmail}</div>
                    <div><strong>Domain:</strong> @indiraicem.ac.in (Verified)</div>
                    <div><strong>Status:</strong> Active Student</div>
                  </div>
                  <Button variant="destructive" onClick={() => setUserEmail(null)} className="w-full">
                    Sign Out
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <AuthShell onSuccess={handleAuthSuccess} />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-6">
      <AppHeader />
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />

      <main className="flex-1">
        {showAuthModal ? (
          <div className="relative py-6">
            <div className="mx-auto max-w-md px-4 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuthModal(false)}
                className="gap-1 text-xs text-muted-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            </div>
            <AuthShell onSuccess={handleAuthSuccess} />
          </div>
        ) : (
          renderTabContent()
        )}
      </main>
    </div>
  );
};
export default App;
