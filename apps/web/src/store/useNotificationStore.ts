import { create } from 'zustand';
import type { Notification } from '@/types';

const READ_NOTIFICATION_IDS_KEY = 'ricer-read-notifications';
const MAX_STORED_READ_IDS = 200;

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getStoredReadIds(): Set<string> {
  if (!canUseStorage()) return new Set();

  try {
    const raw = window.localStorage.getItem(READ_NOTIFICATION_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function storeReadIds(ids: Set<string>): void {
  if (!canUseStorage()) return;

  try {
    const limitedIds = Array.from(ids).slice(-MAX_STORED_READ_IDS);
    window.localStorage.setItem(READ_NOTIFICATION_IDS_KEY, JSON.stringify(limitedIds));
  } catch {
    // Storage is best-effort only; notifications still work for the current render.
  }
}

function rememberReadIds(ids: string[]): void {
  if (ids.length === 0) return;

  const storedIds = getStoredReadIds();
  ids.forEach((id) => storedIds.add(id));
  storeReadIds(storedIds);
}

function mergeStoredReadState(notifications: Notification[]): Notification[] {
  const storedIds = getStoredReadIds();
  return notifications.map((notification) =>
    storedIds.has(notification.id) ? { ...notification, read: true } : notification
  );
}

function countUnread(notifications: Notification[]): number {
  return notifications.filter((notification) => !notification.read).length;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => {
    const mergedNotifications = mergeStoredReadState(notifications);
    set({
      notifications: mergedNotifications,
      unreadCount: countUnread(mergedNotifications),
    });
  },

  markAsRead: (id) =>
    set((state) => {
      rememberReadIds([id]);
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications,
        unreadCount: countUnread(notifications),
      };
    }),

  markAllAsRead: () =>
    set((state) => {
      rememberReadIds(state.notifications.map((notification) => notification.id));
      return {
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      };
    }),
}));
