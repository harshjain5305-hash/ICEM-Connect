import { notificationRepository } from './notification.repository';
import { createNotificationSchema } from './notification.schema';
import type { AppNotification, CreateNotificationInput } from './notification.types';

export const notificationService = {
  async notify(input: CreateNotificationInput): Promise<AppNotification> {
    const validated = createNotificationSchema.parse(input);
    return await notificationRepository.createNotification(validated);
  },

  async getUserNotifications(userId: string): Promise<AppNotification[]> {
    if (!userId) return [];
    return await notificationRepository.listByUser(userId);
  },

  async getUnreadCount(userId: string): Promise<number> {
    if (!userId) return 0;
    const notifs = await notificationRepository.listByUser(userId);
    return notifs.filter((n) => !n.read).length;
  },

  async markAsRead(notificationId: string): Promise<void> {
    if (!notificationId) return;
    await notificationRepository.markAsRead(notificationId);
  },

  async markAllAsRead(userId: string): Promise<void> {
    if (!userId) return;
    await notificationRepository.markAllAsRead(userId);
  },

  async deleteNotification(notificationId: string): Promise<void> {
    if (!notificationId) return;
    await notificationRepository.deleteNotification(notificationId);
  },

  async clearAll(userId: string): Promise<void> {
    if (!userId) return;
    await notificationRepository.clearAllNotifications(userId);
  },
};
