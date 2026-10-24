import { useEffect, useState } from 'react';
import { X, Send, Loader2, Check, Users } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useBillStore } from '../../store/useBillStore';
import { useLocale, t, type Locale } from '../../hooks/useLocale';
import { supabase } from '../../lib/supabase';
import type { FriendProfile } from '../profile/UserDashboardModal';

interface ShareToFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  billId: string;
}

const localizeShareError = (
  error: string,
  locale: Locale,
): string => {
  if (
    error.trim() ===
    'Bạn không thể chia sẻ tiếp hóa đơn được nhận từ tài khoản khác.'
  ) {
    return t('cannotReshareReceivedBill', locale);
  }

  return error;
};

const getMessage = (
  locale: string,
  messages: { vi: string; en: string; ru: string; zh: string },
) => messages[locale as keyof typeof messages] ?? messages.vi;

export function ShareToFriendsModal({
  isOpen,
  onClose,
  billId,
}: ShareToFriendsModalProps) {
  const { user } = useAuthStore();
  const { shareBillWithFriends } = useBillStore();
  const { locale } = useLocale();

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadFriends() {
      if (!isOpen) return;

      setSelectedFriendIds([]);
      setSuccessMsg('');
      setErrorMsg('');
      setFriends([]);

      if (!user?.id || !supabase) {
        setIsLoading(false);
        setErrorMsg(
          getMessage(locale, {
            vi: 'Bạn cần đăng nhập để xem danh sách bạn bè.',
            en: 'Sign in to view your friends.',
            ru: 'Войдите, чтобы увидеть список друзей.',
            zh: '请登录后查看好友列表。',
          }),
        );
        return;
      }

      setIsLoading(true);
      try {
        // Chỉ lấy quan hệ bạn bè có liên quan đến tài khoản hiện tại.
        const { data: friendships, error: friendshipError } = await supabase
          .from('friendships')
          .select('user_id, friend_id, friend_email')
          .eq('status', 'accepted')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

        if (friendshipError) throw friendshipError;
        if (cancelled) return;

        const targetUserIds = Array.from(
          new Set(
            (friendships ?? [])
              .map((friendship) =>
                friendship.user_id === user.id
                  ? friendship.friend_id
                  : friendship.user_id,
              )
              .filter((id): id is string => Boolean(id) && id !== user.id),
          ),
        );

        if (targetUserIds.length === 0) {
          setFriends([]);
          return;
        }

        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', targetUserIds);

        if (profilesError) throw profilesError;
        if (cancelled) return;

        const profilesById = new Map(
          (profiles ?? []).map((profile) => [profile.id, profile]),
        );

        // Giữ thứ tự và danh sách ID đã lấy từ friendships; bỏ bản ghi trùng.
        const list: FriendProfile[] = targetUserIds.map((id) => {
          const profile = profilesById.get(id);
          return {
            id,
            email: '',
            display_name: profile?.display_name || 'Bạn bè',
            avatar_url: profile?.avatar_url || null,
            friendship_id: '',
          };
        });

        setFriends(list);
      } catch (error) {
        console.error('Không thể tải danh sách bạn bè:', error);
        if (!cancelled) {
          setErrorMsg(
            getMessage(locale, {
              vi: 'Không thể tải danh sách bạn bè. Hãy thử tải lại.',
              en: 'Could not load friends. Please try again.',
              ru: 'Не удалось загрузить друзей. Попробуйте ещё раз.',
              zh: '无法加载好友列表，请重试。',
            }),
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadFriends();
    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id, locale]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedFriendIds((previous) =>
      previous.includes(id)
        ? previous.filter((selectedId) => selectedId !== id)
        : [...previous, id],
    );
  };

  const handleSend = async () => {
    if (isSending || selectedFriendIds.length === 0) return;

    setIsSending(true);
    setErrorMsg('');
    try {
      const ok = await shareBillWithFriends(billId, selectedFriendIds);
      if (ok) {
        setSuccessMsg(t('billSharedSuccess', locale));
        // Làm mới dữ liệu cloud để trạng thái chia sẻ được đồng bộ.
        void useBillStore.getState().fetchUserBills();
        window.setTimeout(() => {
          setSuccessMsg('');
          onClose();
        }, 1800);
      } else {
        const storeError = useBillStore.getState().syncError;
        setErrorMsg(
          storeError
            ? localizeShareError(storeError, locale)
            : getMessage(locale, {
                vi: 'Chia sẻ hóa đơn thất bại. Hãy thử lại.',
                en: 'Could not share the bill. Please try again.',
                ru: 'Не удалось поделиться счётом. Попробуйте ещё раз.',
                zh: '分享账单失败，请重试。',
              }),
        );
      }
    } catch (error) {
      console.error('Lỗi khi chia sẻ hóa đơn:', error);
      setErrorMsg(
        getMessage(locale, {
          vi: 'Đã xảy ra lỗi khi chia sẻ hóa đơn.',
          en: 'An error occurred while sharing the bill.',
          ru: 'При отправке счёта произошла ошибка.',
          zh: '分享账单时发生错误。',
        }),
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-friends-title"
        className="bg-surface border border-line rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h3
            id="share-friends-title"
            className="font-bold text-sm sm:text-base flex items-center gap-2"
          >
            <Users className="w-4 h-4 text-accent" />
            <span>{t('shareToFriends', locale)}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="icon-btn p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {successMsg ? (
            <div className="p-4 rounded-xl bg-accent/15 border border-accent/30 text-accent text-center text-xs font-semibold flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-ink-2">
                {t('selectFriendsToShare', locale)}:
              </p>

              {errorMsg && (
                <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500">
                  {errorMsg}
                </p>
              )}

              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-ink-3" />
                </div>
              ) : friends.length === 0 ? (
                !errorMsg && (
                  <p className="text-xs text-ink-3 italic text-center py-6">
                    {t('noFriendsYet', locale)}
                  </p>
                )
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {friends.map((friend) => {
                    const isSelected = selectedFriendIds.includes(friend.id);
                    return (
                      <button
                        key={friend.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleSelect(friend.id)}
                        className={`w-full text-left p-2.5 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent/10'
                            : 'border-line bg-surface-2 hover:bg-surface-3'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          {friend.avatar_url ? (
                            <img
                              src={friend.avatar_url}
                              alt={friend.display_name}
                              className="w-7 h-7 rounded-full object-cover border border-line"
                            />
                          ) : (
                            <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">
                              {friend.display_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="text-xs font-medium truncate text-ink">
                            {friend.display_name}
                          </span>
                        </span>

                        <span
                          aria-hidden="true"
                          className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                            isSelected
                              ? 'bg-accent border-accent text-white'
                              : 'border-line'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isSending || isLoading || selectedFriendIds.length === 0}
                className="btn btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{t('sendBillBtn', locale)} ({selectedFriendIds.length})</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
