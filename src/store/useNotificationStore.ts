

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

export type NotificationType = 'friend_request' | 'bill_shared' | 'support_reply' | 'system_announcement';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  createdAt: string;
  isRead: boolean;
  data?: {
    requestId?: string;
    billId?: string;
    shareId?: string;
    messageId?: string;
    i18n?: Partial<Record<'vi' | 'en' | 'ru' | 'zh', { title?: string; description?: string }>>;
  };
}

interface NotificationState {
  notifications: AppNotification[];
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
}

const readKey = (userId: string) => `fairshare_read_notifications_${userId}`;

function getReadIds(userId: string): Set<string> {
  try {
    const value = JSON.parse(localStorage.getItem(readKey(userId)) || '[]');
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(readKey(userId), JSON.stringify([...ids]));
  } catch {
    // localStorage may be unavailable in private browsing.
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  isLoading: false,

  fetchNotifications: async () => {
    const user = useAuthStore.getState().user;
    if (!user || !supabase) {
      set({ notifications: [] });
      return;
    }

    set({ isLoading: true });
    try {
      // 1. Lời mời kết bạn
      let friendshipQuery = supabase
        .from('friendships')
        .select('id, user_id, friend_id, friend_email, status, created_at')
        .eq('status', 'pending');
      friendshipQuery = user.email
        ? friendshipQuery.or(`friend_id.eq.${user.id},friend_email.ilike.${user.email}`)
        : friendshipQuery.eq('friend_id', user.id);
      const { data: friendshipRows, error: friendshipError } = await friendshipQuery.order('created_at', { ascending: false });
      if (friendshipError) throw friendshipError;

      const senderIds = (friendshipRows || []).map((row) => row.user_id).filter(Boolean);
      const { data: senderProfiles } = senderIds.length
        ? await supabase.from('profiles').select('id, display_name').in('id', senderIds)
        : { data: [] };
      const senderNames = new Map((senderProfiles || []).map((profile) => [profile.id, profile.display_name]));

      // 2. Hóa đơn được chia sẻ
      const { data: billRows, error: billError } = await supabase
        .from('bill_shares')
        .select('id, bill_id, created_at, bill:bills (id, title), sender:profiles!sender_id (display_name)')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });
      if (billError) throw billError;

      // 3. Phản hồi hỗ trợ từ Admin (lấy các tin nhắn của user đã có câu trả lời)
      const { data: supportRows } = await supabase
        .from('support_messages')
        .select('id, message, admin_reply, replied_at, created_at')
        .eq('user_id', user.id)
        .not('admin_reply', 'is', null)
        .order('replied_at', { ascending: false })
        .limit(10);

      const { data: systemRows } = await supabase
        .from('notifications')
        .select('id, type, title, description, data, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const readIds = getReadIds(user.id);

      const friendNotifications: AppNotification[] = (friendshipRows || []).map((row) => {
        const sender = senderNames.get(row.user_id) || row.friend_email?.split('@')[0] || 'Bạn mới';
        return {
          id: `friend_request:${row.id}`,
          type: 'friend_request',
          title: 'Lời mời kết bạn mới',
          description: `${sender} muốn kết bạn với bạn`,
          createdAt: row.created_at || new Date().toISOString(),
          isRead: readIds.has(`friend_request:${row.id}`),
          data: { requestId: row.id },
        };
      });

      const billNotifications: AppNotification[] = (billRows || []).flatMap((row) => {
        const bill = Array.isArray(row.bill) ? row.bill[0] : row.bill;
        if (!bill) return [];
        const sender = Array.isArray(row.sender) ? row.sender[0] : row.sender;
        const notificationId = `bill_shared:${row.id}`;
        return [{
          id: notificationId,
          type: 'bill_shared' as const,
          title: 'Hóa đơn được chia sẻ',
          description: `${sender?.display_name || 'Bạn bè'} đã chia sẻ “${bill.title || 'Hóa đơn'}” với bạn`,
          createdAt: row.created_at || new Date().toISOString(),
          isRead: readIds.has(notificationId),
          data: { billId: bill.id || row.bill_id },
        }];
      });

      const supportNotifications: AppNotification[] = (supportRows || []).map((row) => {
        const notificationId = `support_reply:${row.id}`;
        return {
          id: notificationId,
          type: 'support_reply',
          title: 'Phản hồi từ Quản trị viên',
          description: row.admin_reply
            ? `Admin đã trả lời: "${row.admin_reply}"`
            : 'Admin đã phản hồi tin nhắn hỗ trợ của bạn.',
          createdAt: row.replied_at || row.created_at || new Date().toISOString(),
          isRead: readIds.has(notificationId),
          data: { messageId: row.id },
        };
      });

      const systemNotifications: AppNotification[] = (systemRows || []).map((row: any) => ({
        id: row.id,
        type: row.type as NotificationType,
        title: row.title || row.type,
        description: row.description || '',
        createdAt: row.created_at || new Date().toISOString(),
        isRead: Boolean(row.is_read) || readIds.has(row.id),
        data: row.data || undefined,
      }));

      set({
        notifications: [...systemNotifications, ...friendNotifications, ...billNotifications, ...supportNotifications].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
        isLoading: false,
      });
    } catch (error) {
      console.error('Không thể tải thông báo:', error);
      set({ isLoading: false });
    }
  },

  markAsRead: (notificationId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const ids = getReadIds(user.id);
    ids.add(notificationId);
    saveReadIds(user.id, ids);
    void supabase?.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', user.id);
    set({ notifications: get().notifications.map((notification) => notification.id === notificationId ? { ...notification, isRead: true } : notification) });
  },

  markAllAsRead: () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const ids = getReadIds(user.id);
    get().notifications.forEach((notification) => ids.add(notification.id));
    saveReadIds(user.id, ids);
    set({ notifications: get().notifications.map((notification) => ({ ...notification, isRead: true })) });
  },
}));

export const getUnreadNotificationCount = (notifications: AppNotification[]) =>
  notifications.reduce((count, notification) => count + (notification.isRead ? 0 : 1), 0);