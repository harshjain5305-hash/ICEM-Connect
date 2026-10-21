import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { notificationService } from './notification.service';
import type { AppNotification } from './notification.types';
import { Bell, CheckCheck, Clock, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    try {
      const data = await notificationService.getUserNotifications(user.id);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifs();
    // Poll notifications every 30 seconds
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await notificationService.markAllAsRead(user.id);
      await fetchNotifs();
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    await notificationService.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* BELL BUTTON */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="View notifications"
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E85C0D] px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* DROPDOWN POPOVER */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-muted/40">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="warning" className="text-[10px] py-0 px-1.5 font-bold">
                  {unreadCount} new
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleMarkAllRead}
                  disabled={isLoading}
                  className="h-6 text-[11px] px-2 text-primary hover:text-primary gap-1"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </Button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* LIST */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No notifications right now
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => !item.read && handleMarkSingleRead(item.id)}
                  className={`p-3 text-xs transition-colors cursor-pointer space-y-1 ${
                    item.read
                      ? 'bg-card hover:bg-muted/30'
                      : 'bg-primary/5 hover:bg-primary/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`font-semibold ${
                        item.read ? 'text-foreground' : 'text-primary'
                      }`}
                    >
                      {item.title}
                    </span>
                    {!item.read && (
                      <span className="h-2 w-2 rounded-full bg-[#E85C0D] shrink-0 mt-1" />
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {item.message}
                  </p>

                  <div className="flex items-center justify-between pt-0.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="uppercase text-[9px] font-semibold tracking-wider text-muted-foreground/80">
                      {item.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
