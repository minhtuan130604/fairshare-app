import { useEffect, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useLocale } from '../../hooks/useLocale';

export function GlobalAnnouncementModal() {
  const user = useAuthStore((state) => state.user);
  const { locale } = useLocale();
  const notifications = useNotificationStore((state) => state.notifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const dismissedAnnouncementId = useRef<string | null>(null);

  useEffect(() => {
    dismissedAnnouncementId.current = null;
    setIsOpen(false);

    if (user) {
      void fetchNotifications();
    }
  }, [user?.id, fetchNotifications]);

  const unreadAnnouncement = notifications.find(
    (notification) => notification.type === 'system_announcement' && !notification.isRead,
  );

  useEffect(() => {
    if (
      unreadAnnouncement &&
      dismissedAnnouncementId.current !== unreadAnnouncement.id
    ) {
      setIsOpen(true);
    }
  }, [unreadAnnouncement]);

  if (!user || !isOpen || !unreadAnnouncement) return null;

  const localizedText = unreadAnnouncement.data?.i18n?.[locale];
  const announcementTitle = localizedText?.title || unreadAnnouncement.title;
  const announcementDescription = localizedText?.description || unreadAnnouncement.description;

  const close = async () => {
    dismissedAnnouncementId.current = unreadAnnouncement.id;
    setIsOpen(false);
    await markAsRead(unreadAnnouncement.id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-announcement-title"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-400/30 bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-line bg-emerald-500/10 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
            <Megaphone className="h-5 w-5" />
          </span>
          <h2 id="global-announcement-title" className="text-base font-bold text-ink-1">
            Thông báo từ Ban quản trị
          </h2>
        </div>
        <div className="space-y-3 px-5 py-6">
          <h3 className="text-lg font-semibold text-ink-1">{announcementTitle}</h3>
          <p className="whitespace-pre-wrap text-sm leading-6 text-ink-2">{announcementDescription}</p>
        </div>
        <div className="flex justify-end border-t border-line px-5 py-4">
          <button type="button" onClick={() => void close()} className="btn btn-primary cursor-pointer">
            Đã hiểu / Đóng
          </button>
        </div>
      </div>
    </div>
  );
}


