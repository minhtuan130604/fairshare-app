import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useBillStore } from '../store/useBillStore';
import { useLocale } from './useLocale';

export function useRealtimeBills() {
  const user = useAuthStore((state) => state.user);
  const fetchUserBills = useBillStore((state) => state.fetchUserBills);
  const { locale } = useLocale();

  useEffect(() => {
    if (!user || !supabase) return;

    // Lắng nghe cả share mới/xóa và thay đổi xác nhận chuyển khoản của các bill.
    const channel = supabase
      .channel(`realtime-bills-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bill_shares',
          filter: `receiver_id=eq.${user.id}`,
        },
        async () => {
          // Tự động tải lại danh sách hóa đơn
          await fetchUserBills();

          const message =
            locale === 'en'
              ? 'You just received a new shared bill!'
              : locale === 'ru'
                ? 'Вам пришел новый общий счёт!'
                : locale === 'zh'
                  ? '您刚刚收到了一张新的共享账单！'
                  : 'Bạn vừa nhận được một hóa đơn được chia sẻ!';

          // Hiển thị thông báo trình duyệt / in-app alert nhẹ
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('FairShare', { body: message });
          } else {
            console.log('[FairShare Realtime]:', message);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bill_shares',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          void fetchUserBills();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bill_shares',
          filter: `sender_id=eq.${user.id}`,
        },
        () => {
          void fetchUserBills();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bills',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchUserBills();
        }
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [user, fetchUserBills, locale]);
}