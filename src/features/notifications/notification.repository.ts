import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { AppNotification, CreateNotificationInput } from './notification.types';

const LOCAL_STORAGE_NOTIFS_KEY = 'icem_notifications_v1';

function getLocalData<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalData<T>(key: string, data: Record<string, T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to save data to localStorage key ${key}:`, err);
  }
}

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export const notificationRepository = {
  async createNotification(input: CreateNotificationInput): Promise<AppNotification> {
    const isLive = isSupabaseConfigured();
    let liveNotif: AppNotification | null = null;

    if (isLive && isValidUuid(input.user_id)) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .insert({
            user_id: input.user_id,
            title: input.title,
            message: input.message,
            type: input.type || 'SYSTEM',
            data: input.data || null,
            read: false,
          })
          .select()
          .maybeSingle();

        if (!error && data) {
          liveNotif = data as unknown as AppNotification;
        } else if (error) {
          console.warn('Live notification insert error (persisting locally):', error.message);
        }
      } catch (err) {
        console.warn('Live notification create error, persisting locally:', err);
      }
    }

    // Always mirror to local store so notification is guaranteed to be visible
    const store = getLocalData<AppNotification>(LOCAL_STORAGE_NOTIFS_KEY);
    const id = liveNotif?.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newNotif: AppNotification = liveNotif || {
      id,
      user_id: input.user_id,
      title: input.title,
      message: input.message,
      type: input.type || 'SYSTEM',
      read: false,
      data: input.data || null,
      created_at: new Date().toISOString(),
    };

    store[newNotif.id] = newNotif;
    saveLocalData(LOCAL_STORAGE_NOTIFS_KEY, store);
    return newNotif;
  },

  async listByUser(userId: string): Promise<AppNotification[]> {
    const isLive = isSupabaseConfigured();
    const liveResults: AppNotification[] = [];

    if (isLive && isValidUuid(userId)) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          liveResults.push(...(data as unknown as AppNotification[]));
        }
      } catch (err) {
        console.warn('Live notification list error, falling back to local mode:', err);
      }
    }

    // Always merge with local storage notifications
    const store = getLocalData<AppNotification>(LOCAL_STORAGE_NOTIFS_KEY);
    const localList = Object.values(store).filter((n) => n.user_id === userId);

    const combinedMap = new Map<string, AppNotification>();
    for (const n of liveResults) {
      combinedMap.set(n.id, n);
    }
    for (const n of localList) {
      if (!combinedMap.has(n.id)) {
        combinedMap.set(n.id, n);
      }
    }

    return Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async markAsRead(notificationId: string): Promise<void> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(notificationId)) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);
      } catch (err) {
        console.warn('Live notification mark-as-read error:', err);
      }
    }

    const store = getLocalData<AppNotification>(LOCAL_STORAGE_NOTIFS_KEY);
    if (store[notificationId]) {
      store[notificationId].read = true;
      saveLocalData(LOCAL_STORAGE_NOTIFS_KEY, store);
    }
  },

  async markAllAsRead(userId: string): Promise<void> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(userId)) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId);
      } catch (err) {
        console.warn('Live notification markAllAsRead error:', err);
      }
    }

    const store = getLocalData<AppNotification>(LOCAL_STORAGE_NOTIFS_KEY);
    for (const id of Object.keys(store)) {
      if (store[id].user_id === userId) {
        store[id].read = true;
      }
    }
    saveLocalData(LOCAL_STORAGE_NOTIFS_KEY, store);
  },

  async deleteNotification(notificationId: string): Promise<void> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(notificationId)) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId);
      } catch (err) {
        console.warn('Live notification delete error:', err);
      }
    }

    const store = getLocalData<AppNotification>(LOCAL_STORAGE_NOTIFS_KEY);
    if (store[notificationId]) {
      delete store[notificationId];
      saveLocalData(LOCAL_STORAGE_NOTIFS_KEY, store);
    }
  },

  async clearAllNotifications(userId: string): Promise<void> {
    const isLive = isSupabaseConfigured();

    if (isLive && isValidUuid(userId)) {
      try {
        // Use RPC if available or direct delete query
        const { error } = await supabase.rpc('clear_user_notifications', {
          p_user_id: userId,
        });
        if (error) {
          await supabase
            .from('notifications')
            .delete()
            .eq('user_id', userId);
        }
      } catch (err) {
        console.warn('Live notification clearAll error:', err);
      }
    }

    const store = getLocalData<AppNotification>(LOCAL_STORAGE_NOTIFS_KEY);
    for (const id of Object.keys(store)) {
      if (store[id].user_id === userId) {
        delete store[id];
      }
    }
    saveLocalData(LOCAL_STORAGE_NOTIFS_KEY, store);
  },
};
