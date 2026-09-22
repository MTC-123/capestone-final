import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from '@/store/useNotificationStore';
import type { Notification } from '@/types';

// Helper to create test notifications
function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? '1',
    type: overrides.type ?? 'FIRE_DETECTION',
    title: overrides.title ?? 'Test Notification',
    body: overrides.body ?? 'Test body',
    read: overrides.read ?? false,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
    referenceId: overrides.referenceId,
    referenceUrl: overrides.referenceUrl,
  };
}

describe('useNotificationStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Reset store to initial state before each test
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
    });
  });

  describe('setNotifications', () => {
    it('sets the notifications array', () => {
      const notifications = [
        makeNotification({ id: '1', read: false }),
        makeNotification({ id: '2', read: true }),
        makeNotification({ id: '3', read: false }),
      ];

      useNotificationStore.getState().setNotifications(notifications);

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(3);
      expect(state.notifications[0].id).toBe('1');
      expect(state.notifications[1].id).toBe('2');
      expect(state.notifications[2].id).toBe('3');
    });

    it('calculates unreadCount based on unread notifications', () => {
      const notifications = [
        makeNotification({ id: '1', read: false }),
        makeNotification({ id: '2', read: true }),
        makeNotification({ id: '3', read: false }),
      ];

      useNotificationStore.getState().setNotifications(notifications);

      expect(useNotificationStore.getState().unreadCount).toBe(2);
    });

    it('sets unreadCount to 0 when all notifications are read', () => {
      const notifications = [
        makeNotification({ id: '1', read: true }),
        makeNotification({ id: '2', read: true }),
      ];

      useNotificationStore.getState().setNotifications(notifications);

      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('handles an empty array', () => {
      useNotificationStore.getState().setNotifications([]);

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(0);
      expect(state.unreadCount).toBe(0);
    });

    it('replaces existing notifications entirely', () => {
      useNotificationStore.getState().setNotifications([
        makeNotification({ id: 'old-1' }),
        makeNotification({ id: 'old-2' }),
      ]);

      useNotificationStore.getState().setNotifications([
        makeNotification({ id: 'new-1' }),
      ]);

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].id).toBe('new-1');
    });

    it('preserves locally read notifications when new poll data arrives', () => {
      useNotificationStore.getState().setNotifications([
        makeNotification({ id: 'same-1', read: false }),
      ]);
      useNotificationStore.getState().markAsRead('same-1');

      useNotificationStore.getState().setNotifications([
        makeNotification({ id: 'same-1', read: false }),
        makeNotification({ id: 'same-2', read: false }),
      ]);

      const state = useNotificationStore.getState();
      expect(state.notifications[0].read).toBe(true);
      expect(state.notifications[1].read).toBe(false);
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('marks a single notification as read by id', () => {
      useNotificationStore.getState().setNotifications([
        makeNotification({ id: '1', read: false }),
        makeNotification({ id: '2', read: false }),
        makeNotification({ id: '3', read: false }),
      ]);

      useNotificationStore.getState().markAsRead('2');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].read).toBe(false);
      expect(state.notifications[1].read).toBe(true);
      expect(state.notifications[2].read).toBe(false);
    });

    it('updates unreadCount after marking as read', () => {
      useNotificationStore.getState().setNotifications([
        makeNotification({ id: '1', read: false }),
        makeNotification({ id: '2', read: false }),
      ]);

      expect(useNotificationStore.getState().unreadCount).toBe(2);

      useNotificationStore.getState().markAsRead('1');

      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('does not change already-read notifications', () => {
      useNotificationStore.getState().setNotifications([
        makeNotification({ id: '1', read: true }),
        makeNotification({ id: '2', read: false }),
      ]);

      useNotificationStore.getState().markAsRead('1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].read).toBe(true);
      expect(state.unreadCount).toBe(1);
    });

    it('is a no-op when id does not exist', () => {
      useNotificationStore.getState().setNotifications([
        makeNotification({ id: '1', read: false }),
      ]);

      useNotificationStore.getState().markAsRead('nonexistent');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].read).toBe(false);
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read', () => {
      useNotificationStore.getState().setNotifications([
        makeNotification({ id: '1', read: false }),
        makeNotification({ id: '2', read: false }),
        makeNotification({ id: '3', read: true }),
      ]);

      useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications.every((n) => n.read)).toBe(true);
    });

    it('sets unreadCount to 0', () => {
      useNotificationStore.getState().setNotifications([
        makeNotification({ id: '1', read: false }),
        makeNotification({ id: '2', read: false }),
      ]);

      expect(useNotificationStore.getState().unreadCount).toBe(2);

      useNotificationStore.getState().markAllAsRead();

      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('works when there are no notifications', () => {
      useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(0);
      expect(state.unreadCount).toBe(0);
    });
  });
});
