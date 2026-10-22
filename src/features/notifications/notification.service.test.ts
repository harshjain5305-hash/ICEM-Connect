import { describe, it, expect, beforeEach } from 'vitest';
import { notificationService } from './notification.service';

describe('Notification Service (Phase 6)', () => {
  const userId = 'student_test_user_101';

  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and lists notifications for a student', async () => {
    const notif = await notificationService.notify({
      user_id: userId,
      title: 'New Join Request',
      message: 'Rahul Sharma requested 1 seat.',
      type: 'REQUEST_RECEIVED',
    });

    expect(notif).toBeDefined();
    expect(notif.user_id).toBe(userId);
    expect(notif.read).toBe(false);

    const list = await notificationService.getUserNotifications(userId);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(notif.id);
  });

  it('accurately counts unread notifications and marks single as read', async () => {
    const n1 = await notificationService.notify({
      user_id: userId,
      title: 'First Update',
      message: 'Message 1',
    });
    await notificationService.notify({
      user_id: userId,
      title: 'Second Update',
      message: 'Message 2',
    });

    let unreadCount = await notificationService.getUnreadCount(userId);
    expect(unreadCount).toBe(2);

    await notificationService.markAsRead(n1.id);

    unreadCount = await notificationService.getUnreadCount(userId);
    expect(unreadCount).toBe(1);
  });

  it('marks all notifications as read', async () => {
    await notificationService.notify({
      user_id: userId,
      title: 'First Update',
      message: 'Message 1',
    });
    await notificationService.notify({
      user_id: userId,
      title: 'Second Update',
      message: 'Message 2',
    });

    await notificationService.markAllAsRead(userId);

    const unreadCount = await notificationService.getUnreadCount(userId);
    expect(unreadCount).toBe(0);
  });

  it('immediately deletes a single notification (database & storage)', async () => {
    const n1 = await notificationService.notify({
      user_id: userId,
      title: 'Dismiss Me',
      message: 'Slide or click delete',
    });
    const n2 = await notificationService.notify({
      user_id: userId,
      title: 'Keep Me',
      message: 'Stay active',
    });

    let list = await notificationService.getUserNotifications(userId);
    expect(list.length).toBe(2);

    await notificationService.deleteNotification(n1.id);

    list = await notificationService.getUserNotifications(userId);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(n2.id);
  });

  it('immediately clears all notifications for a user', async () => {
    await notificationService.notify({
      user_id: userId,
      title: 'Notif 1',
      message: 'One',
    });
    await notificationService.notify({
      user_id: userId,
      title: 'Notif 2',
      message: 'Two',
    });

    let list = await notificationService.getUserNotifications(userId);
    expect(list.length).toBe(2);

    await notificationService.clearAll(userId);

    list = await notificationService.getUserNotifications(userId);
    expect(list.length).toBe(0);

    const unread = await notificationService.getUnreadCount(userId);
    expect(unread).toBe(0);
  });
});
