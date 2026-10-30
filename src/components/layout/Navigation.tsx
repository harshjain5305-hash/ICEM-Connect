import React from 'react';
import { Home, PlusCircle, Car, User, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/useAuth';

export type NavTab = 'home' | 'find' | 'offer' | 'rides' | 'profile' | 'admin';

interface NavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange }) => {
  const { isAdmin } = useAuth();

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; isAction?: boolean }[] = [
    { id: 'home', label: 'Home', icon: <Home className="h-5 w-5" /> },
    { id: 'offer', label: 'Offer', icon: <PlusCircle className="h-6 w-6" />, isAction: true },
    { id: 'rides', label: 'My Rides', icon: <Car className="h-5 w-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="h-5 w-5" /> },
  ];

  if (isAdmin) {
    navItems.push({
      id: 'admin',
      label: 'Admin',
      icon: <ShieldCheck className="h-5 w-5 text-[#E85C0D]" />,
    });
  }

  const gridColsClass = isAdmin ? 'grid-cols-5' : 'grid-cols-4';

  return (
    <>
      {/* Mobile Bottom Navigation (Design.md §13) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className={cn('grid h-16 items-center px-1.5', gridColsClass)}>
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 transition-colors min-h-[48px] py-1 select-none active:opacity-75',
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                  item.isAction && 'text-primary'
                )}
                aria-label={item.label}
              >
                {item.isAction ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95">
                    {item.icon}
                  </div>
                ) : (
                  <div className={cn('relative flex items-center justify-center', isActive && 'scale-105 transition-transform')}>
                    {item.icon}
                  </div>
                )}
                <span className="text-[11px] leading-tight font-medium tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Top Sub-navigation (Design.md §14) */}
      <nav className="hidden border-b border-border bg-card md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-6">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-medium transition-colors min-h-[44px]',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground'
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
