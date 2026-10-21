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

export const notificationRepository = {
  async createNotification(input: CreateNotificationInput): Promise<AppNotification> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
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
          .single();

        if (error || !data) {
          throw new Error(error?.message || 'Failed to create notification');
        }
        return data as unknown as AppNotification;
      } catch (err) {
        console.warn('Live notification create error, falling back to local mode:', err);
      }
    }

    // Local mode
    const store = getLocalData<AppNotification>(LOCAL_STORAGE_NOTIFS_KEY);
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newNotif: AppNotification = {
      id,
      user_id: input.user_id,
      title: input.title,
      message: input.message,
      type: input.type || 'SYSTEM',
      read: false,
      data: input.data || null,
      created_at: new Date().toISOString(),
    };

    store[id] = newNotif;
    saveLocalData(LOCAL_STORAGE_NOTIFS_KEY, store);
    return newNotif;
  },

  async listByUser(userId: string): Promise<AppNotification[]> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as unknown as AppNotification[];
        }
      } catch (err) {
        console.warn('Live notification list error, falling back to local mode:', err);
      }
    }

    // Local mode
    const store = getLocalData<AppNotification>(LOCAL_STORAGE_NOTIFS_KEY);
    return Object.values(store)
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async markAsRead(notificationId: string): Promise<void> {
    const isLive = isSupabaseConfigured();

    if (isLive) {
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

    if (isLive) {
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
};
