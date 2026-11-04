import { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Moon, 
  Sun, 
  Receipt, 
  LogOut, 
  User, 
  Bell, 
  CreditCard, 
  UserRound, 
  FileText, 
  Inbox, 
  MessageSquareText,
  DollarSign,
  Megaphone,
} from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { AuthModal } from '../auth/AuthModal';
import { LanguageSelector } from './LanguageSelector';
import { useLocale, t } from '../../hooks/useLocale';
import { useNotificationStore, getUnreadNotificationCount } from '../../store/useNotificationStore';
import { formatCurrency } from '../../utils/formatters';
import { supabase } from '../../lib/supabase';

export type ActivePage = 'workspace' | 'history' | 'groups' | 'analytics' | 'profile';

interface HeaderProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
}

interface PaymentNotification {
  id: string;
  billId: string;
  billTitle: string;
  fromName: string;
  amount: number;
  currency: string;
}

function normalizeString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

export function Header({ activePage, onNavigate }: HeaderProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const { user, signOut } = useAuthStore();
  const { profile } = useProfileStore();
  const { theme, toggleTheme, currentBill, history, loadBillFromHistory } = useBillStore();
  const { locale } = useLocale();

  const getLocalizedNotificationText = (notification: { title: string; description: string; data?: { i18n?: Partial<Record<'vi' | 'en' | 'ru' | 'zh', { title?: string; description?: string }>> } }) => {
    const translation = notification.data?.i18n?.[locale];
    return {
      title: translation?.title || notification.title,
      description: translation?.description || notification.description,
    };
  };
  const notifications = useNotificationStore((state) => state.notifications);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

  // 1. Quét tất cả các hóa đơn trong lịch sử & hóa đơn hiện tại để lọc yêu cầu thanh toán cần xác nhận
  // Bỏ chặn isSharedBill để chuông thông báo quét được cả các bill được chia sẻ
  // 1. Quét thông báo thanh toán - CHỈ HIỂN THỊ DUY NHẤT CHO NGƯỜI NHẬN TIỀN (RECEIVER)
  const pendingPaymentNotifications: PaymentNotification[] = useMemo(() => {
    const allBillsMap = new Map();
    if (Array.isArray(history)) {
      history.forEach((b) => {
        if (b?.id) allBillsMap.set(b.id, b);
      });
    }
    if (currentBill?.id) {
      allBillsMap.set(currentBill.id, currentBill);
    }

    const list: PaymentNotification[] = [];
    const myId = user?.id || profile?.id;
    const myEmail = user?.email?.toLowerCase().trim();
    const myNameNorm = normalizeString(profile?.display_name || user?.user_metadata?.display_name || '');

    allBillsMap.forEach((bill) => {
      const confirmations = bill.transfer_confirmations;
      if (!confirmations || typeof confirmations !== 'object') return;

      const members = Array.isArray(bill.members) ? bill.members : [];

      Object.entries(confirmations).forEach(([key, conf]: [string, any]) => {
        // Có người đã báo gửi tiền nhưng chưa được người nhận xác nhận
        if (conf?.payerConfirmed && !conf?.receiverConfirmed) {
          const [fromTo, amtStr] = key.split(':');
          const [fromId, toId] = (fromTo || '').split('>');

          const fromMember = members.find((m: any) => m.id === fromId);
          const toMember = members.find((m: any) => m.id === toId);

          const fromMemberNameNorm = normalizeString(fromMember?.name || '');
          const toMemberNameNorm = normalizeString(toMember?.name || '');

          // ĐIỀU KIỆN 1: Nếu người xem chính là NGƯỜI TRẢ TIỀN (Payer) -> LOẠI BỎ NGAY LẬP TỨC
          const isMePayer =
            fromId === myId ||
            (myNameNorm && fromMemberNameNorm === myNameNorm) ||
            (fromMember && myEmail && (fromMember as any).email?.toLowerCase().trim() === myEmail);

          if (isMePayer) return;

          // ĐIỀU KIỆN 2: Người xem phải đúng là NGƯỜI NHẬN TIỀN (Receiver)
          const isMeReceiver =
            toId === myId ||
            (myNameNorm && toMemberNameNorm === myNameNorm) ||
            (toMember && myEmail && (toMember as any).email?.toLowerCase().trim() === myEmail);

          if (isMeReceiver) {
            list.push({
              id: `${bill.id}_${key}`,
              billId: bill.id,
              billTitle: bill.title || t('untitledBill', locale) || 'Hóa đơn',
              fromName: fromMember?.name || t('aFriend', locale) || 'Thành viên',
              amount: Number(amtStr) || 0,
              currency: bill.currency || 'VND',
            });
          }
        }
      });
    });

    return list;
  }, [history, currentBill, user?.id, user?.email, profile?.id, profile?.display_name, user?.user_metadata?.display_name, locale]);

  const systemUnreadCount = getUnreadNotificationCount(notifications);
  const unreadCount = systemUnreadCount + pendingPaymentNotifications.length;

  useEffect(() => {
    void fetchNotifications();
  }, [user?.id]);

  // Lắng nghe Realtime INSERT vào bảng notifications của Supabase để chuông tự động nhảy tức thì
  useEffect(() => {
    if (!user?.id || !supabase) return;

    const channelName = `realtime_user_notifs_${user.id}_${Math.random().toString(36).substring(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [user?.id, fetchNotifications]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  if (!currentBill) return null;

  const relativeTime = (date: string) => {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 86400)}d`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const isDark = theme === 'dark';
  const copy = {
    vi: { 
      workspace: 'Workspace', 
      history: 'Lịch sử', 
      groups: 'Bạn bè', 
      analytics: 'Báo cáo',
      profile: 'Cài đặt hồ sơ & Thanh toán', 
      signOut: 'Đăng xuất', 
      account: 'Tài khoản', 
      adminReplyNotification: 'Phản hồi từ Quản trị viên',
      reportedPaidTitle: 'Xác nhận chuyển khoản',
      reportedPaidDesc: 'đã báo chuyển tiền cho hóa đơn',
      tapToOpenBill: '👉 Nhấn để mở hóa đơn và xác nhận',
    },
    en: { 
      workspace: 'Workspace', 
      history: 'History', 
      groups: 'Groups', 
      analytics: 'Analytics',
      profile: 'Profile & Payment Settings', 
      signOut: 'Sign Out', 
      account: 'Account', 
      adminReplyNotification: 'Admin Response',
      reportedPaidTitle: 'Payment Confirmation',
      reportedPaidDesc: 'reported payment for bill',
      tapToOpenBill: '👉 Tap to open bill and confirm',
    },
    ru: { 
      workspace: 'Рабочее пространство', 
      history: 'История', 
      groups: 'Группы', 
      analytics: 'Аналитика',
      profile: 'Настройки профиля и оплаты', 
      signOut: 'Выйти', 
      account: 'Аккаунт', 
      adminReplyNotification: 'Ответ администратора',
      reportedPaidTitle: 'Подтверждение оплаты',
      reportedPaidDesc: 'сообщил(а) об оплате по счёту',
      tapToOpenBill: '👉 Нажмите, чтобы открыть счёт и подтвердить',
    },
    zh: { 
      workspace: '工作区', 
      history: '历史记录', 
      groups: '群组', 
      analytics: '统计分析',
      profile: '个人资料与付款设置', 
      signOut: '退出登录', 
      account: '账户', 
      adminReplyNotification: '管理员回复',
      reportedPaidTitle: '转账确认',
      reportedPaidDesc: '已标记支付账单',
      tapToOpenBill: '👉 点击查看账单并确认',
    },
  }[locale];

  const metadata = user?.user_metadata;

  const displayName =
    profile?.display_name ||
    (
      [
        metadata?.display_name,
        metadata?.full_name,
        metadata?.name,
      ].find(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )?.trim()
    ) ||
    user?.email?.split('@')[0] ||
    'Người dùng';

  const avatarUrl = profile?.avatar_url || metadata?.avatar_url || metadata?.picture;

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U';

  const navItems = [
    { key: 'workspace' as const, label: copy.workspace },
    { key: 'history' as const, label: copy.history },
    { key: 'groups' as const, label: copy.groups },
    { key: 'analytics' as const, label: copy.analytics },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
          {/* Logo Brand */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-500/30 bg-surface shadow-sm">
              <img
                src="/logo.png"
                alt="FairShare Logo"
                className="h-full w-full object-cover scale-125"
              />
            </div>
            <span className="hidden text-lg font-bold tracking-tight sm:block font-sans">FairShare</span>
          </div>

          {/* Thanh điều hướng giữa Header */}
          {/* Thanh điều hướng giữa Header: Ẩn trên Mobile (dùng MobileNav), chỉ hiện từ tablet/desktop */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const isActive = activePage === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  className={`relative px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer rounded-xl flex items-center gap-1.5 ${
                    isActive
                      ? 'text-emerald-400 font-bold bg-emerald-500/10'
                      : 'text-ink-3 hover:text-ink-1 hover:bg-surface-2/60'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Các nút chức năng bên phải */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <LanguageSelector />
            
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn border border-line"
              aria-label={isDark ? t('switchToLight', locale) : t('switchToDark', locale)}
              title={isDark ? t('switchToLight', locale) : t('switchToDark', locale)}
            >
              {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>

            {/* Notification Center */}
            <div ref={notificationRef} className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((open) => !open)}
                className="icon-btn relative border border-line"
                aria-label={t('notifications', locale)}
                title={t('notifications', locale)}
                aria-expanded={isNotificationsOpen}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500 ring-2 ring-surface" />
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 z-50 mt-3 flex max-h-[30rem] w-80 flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 p-3 text-white shadow-2xl sm:w-96">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold">{t('notifications', locale)}</h2>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-[11px] text-emerald-300 hover:text-emerald-200 cursor-pointer"
                      >
                        {t('markAllAsRead', locale)}
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-84 space-y-1.5 overflow-y-auto pr-1 pt-2">
                    {/* Danh sách thông báo Báo chuyển tiền cần xác nhận (Từ pendingPaymentNotifications) */}
                    {pendingPaymentNotifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          loadBillFromHistory(item.billId);
                          onNavigate('workspace');
                        }}
                        className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition cursor-pointer bg-amber-400/10 text-white hover:bg-amber-400/20 border border-amber-400/20"
                      >
                        <span className="mt-0.5 rounded-lg p-2 bg-amber-500/20 text-amber-300 shrink-0">
                          <DollarSign className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-1">
                            <span className="block text-xs font-bold text-amber-300 truncate">
                              {copy.reportedPaidTitle}
                            </span>
                            <span className="text-[10px] font-mono text-amber-200/70 shrink-0 font-semibold">
                              {formatCurrency(item.amount, item.currency)}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs leading-4 text-white/80">
                            <b>{item.fromName}</b> {copy.reportedPaidDesc} <i className="text-emerald-300 not-italic">"{item.billTitle}"</i>.
                          </span>
                          <span className="mt-1.5 block text-[10px] text-amber-400/90 font-medium">
                            {copy.tapToOpenBill}
                          </span>
                        </span>
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
                      </button>
                    ))}

                    {/* Danh sách thông báo từ hệ thống Supabase */}
                    {notifications.length === 0 && pendingPaymentNotifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center text-white/40">
                        <Inbox className="h-8 w-8" />
                        <p className="mt-2 text-xs">{t('noNotifications', locale)}</p>
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const notifType = notification.type as string;

                        const localizedText = getLocalizedNotificationText(notification);
                        return (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => {
                              markAsRead(notification.id);
                              setIsNotificationsOpen(false);

                              if (notifType === 'support_reply') {
                                window.dispatchEvent(new CustomEvent('open-support-widget'));
                                return;
                              }

                              const targetBillId = notification.data?.billId || notification.data?.shareId || (notification as any).bill_id;
                              if (targetBillId) {
                                loadBillFromHistory(targetBillId);
                              }

                              onNavigate(notifType === 'friend_request' ? 'groups' : 'workspace');
                            }}
                            className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition cursor-pointer ${
                              notification.isRead
                                ? 'bg-white/[0.03] text-white/60 hover:bg-white/[0.07]'
                                : 'bg-emerald-400/10 text-white hover:bg-emerald-400/15'
                            }`}
                          >
                            <span
                              className={`mt-0.5 rounded-lg p-2 shrink-0 ${
                                notifType === 'system_announcement'
                                  ? 'bg-teal-500/20 text-teal-300'
                                  : notifType === 'support_reply'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : notifType === 'friend_request'
                                  ? 'bg-blue-400/15 text-blue-300'
                                  : notifType === 'transfer_reported'
                                  ? 'bg-amber-400/20 text-amber-300'
                                  : 'bg-emerald-400/15 text-emerald-300'
                              }`}
                            >
                              {notifType === 'system_announcement' ? (
                                <Megaphone className="h-4 w-4" />
                              ) : notifType === 'support_reply' ? (
                                <MessageSquareText className="h-4 w-4" />
                              ) : notifType === 'friend_request' ? (
                                <UserRound className="h-4 w-4" />
                              ) : notifType === 'transfer_reported' ? (
                                <DollarSign className="h-4 w-4" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <h4 className="block text-xs font-semibold">
                                {localizedText.title || (notification.type === 'bill_shared' ? t('billSharedTitle', locale) : 'Thông báo')}
                              </h4>
                              <span className="mt-1 block text-xs leading-5 text-white/55">
                                {localizedText.description}
                              </span>
                              <span className="mt-1 block text-[10px] text-white/35 font-mono">
                                {relativeTime(notification.createdAt)}
                              </span>
                            </span>
                            {!notification.isRead && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Menu Avatar / Đăng nhập */}
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAvatarMenuOpen((open) => !open)}
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-emerald-400/30 bg-emerald-500/15 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/25 cursor-pointer"
                  aria-label={displayName}
                  aria-haspopup="menu"
                  aria-expanded={isAvatarMenuOpen}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </button>

                {isAvatarMenuOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40 cursor-default"
                      aria-label="Close menu"
                      onClick={() => setIsAvatarMenuOpen(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0c1411] p-2 text-white shadow-2xl shadow-black/80"
                    >
                      <div className="border-b border-white/10 px-3 py-3">
                        <p className="truncate text-sm font-semibold">{displayName}</p>
                        <p className="mt-1 truncate text-xs text-white/50 font-mono">{user.email || copy.account}</p>
                      </div>

                      {/* Các mục điều hướng chính - Tiện ích trên mobile */}
                      <div className="py-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAvatarMenuOpen(false);
                            onNavigate('workspace');
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition cursor-pointer ${
                            activePage === 'workspace'
                              ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                              : 'text-white/80 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <Receipt className="h-4 w-4 text-emerald-400" />
                          <span>{copy.workspace}</span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAvatarMenuOpen(false);
                            onNavigate('history');
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition cursor-pointer ${
                            activePage === 'history'
                              ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                              : 'text-white/80 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <FileText className="h-4 w-4 text-emerald-400" />
                          <span>{copy.history}</span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAvatarMenuOpen(false);
                            onNavigate('groups');
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition cursor-pointer ${
                            activePage === 'groups'
                              ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                              : 'text-white/80 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <UserRound className="h-4 w-4 text-emerald-400" />
                          <span>{copy.groups}</span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAvatarMenuOpen(false);
                            onNavigate('analytics');
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition cursor-pointer ${
                            activePage === 'analytics'
                              ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                              : 'text-white/80 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <CreditCard className="h-4 w-4 text-emerald-400" />
                          <span>{copy.analytics}</span>
                        </button>
                      </div>

                      <div className="my-1 border-t border-white/10" />

                      {/* Cài đặt Hồ sơ & Thanh toán */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsAvatarMenuOpen(false);
                          onNavigate('profile');
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition cursor-pointer ${
                          activePage === 'profile'
                            ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                            : 'text-white/80 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <User className="h-4 w-4 text-emerald-300" />
                        <span>{copy.profile}</span>
                      </button>

                      <div className="my-1 border-t border-white/10" />

                      {/* Nút Đăng xuất */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsAvatarMenuOpen(false);
                          void signOut();
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-rose-300 transition hover:bg-rose-400/10 cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>{copy.signOut}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="icon-btn border border-line"
                aria-label={t('notLoggedIn', locale)}
                title={t('notLoggedIn', locale)}
              >
                <User className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}