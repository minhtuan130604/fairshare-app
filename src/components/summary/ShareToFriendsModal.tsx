import { useEffect, useState, useMemo } from 'react';
import {
  X,
  Send,
  Loader2,
  Check,
  Users,
  UserCheck,
  Filter,
} from 'lucide-react';
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

function normalizeString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

export function ShareToFriendsModal({
  isOpen,
  onClose,
  billId,
}: ShareToFriendsModalProps) {
  const { user } = useAuthStore();
  const { shareBillWithFriends, currentBill, savedGroups } = useBillStore() as any;
  const { locale } = useLocale();

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Tập hợp tên các thành viên có trong hóa đơn hiện tại để so khớp
  const billMemberNames = useMemo(() => {
    if (!currentBill || !Array.isArray(currentBill.members)) return new Set<string>();
    return new Set(
      currentBill.members.map((m: any) => normalizeString(m.name || ''))
    );
  }, [currentBill?.members]);

  useEffect(() => {
    let cancelled = false;

    async function loadFriends() {
      if (!isOpen) return;

      setSelectedFriendIds([]);
      setSuccessMsg('');
      setErrorMsg('');
      setFriends([]);
      setSelectedGroupId('all');

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

        // Tự động tick chọn sẵn những bạn bè có tên trong hóa đơn hiện tại
        const matchedInBillIds = list
          .filter((f) => billMemberNames.has(normalizeString(f.display_name)))
          .map((f) => f.id);

        setSelectedFriendIds(matchedInBillIds);
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
  }, [isOpen, user?.id, locale, billMemberNames]);

  // Lọc danh sách hiển thị theo Nhóm đã chọn
  const displayedFriends = useMemo(() => {
    if (selectedGroupId === 'all') return friends;

    const group = (savedGroups || []).find((g: any) => g.id === selectedGroupId);
    if (!group || !Array.isArray(group.members)) return friends;

    const groupMemberNames = new Set(
      group.members.map((m: any) => normalizeString(m.name || ''))
    );

    return friends.filter((f) =>
      groupMemberNames.has(normalizeString(f.display_name))
    );
  }, [friends, selectedGroupId, savedGroups]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedFriendIds((previous) =>
      previous.includes(id)
        ? previous.filter((selectedId) => selectedId !== id)
        : [...previous, id],
    );
  };

  // Chọn toàn bộ người trong danh sách đang hiển thị
  const handleSelectAll = () => {
    const currentDisplayedIds = displayedFriends.map((f) => f.id);
    setSelectedFriendIds((prev) => Array.from(new Set([...prev, ...currentDisplayedIds])));
  };

  // Bỏ chọn toàn bộ người trong danh sách đang hiển thị
  const handleDeselectAll = () => {
    const currentDisplayedIds = new Set(displayedFriends.map((f) => f.id));
    setSelectedFriendIds((prev) => prev.filter((id) => !currentDisplayedIds.has(id)));
  };

  // Chỉ chọn những người có tên trong hóa đơn
  const handleSelectOnlyInBill = () => {
    const inBillIds = displayedFriends
      .filter((f) => billMemberNames.has(normalizeString(f.display_name)))
      .map((f) => f.id);
    setSelectedFriendIds(inBillIds);
  };

  const handleSend = async () => {
    if (isSending || selectedFriendIds.length === 0) return;

    setIsSending(true);
    setErrorMsg('');
    try {
      const ok = await shareBillWithFriends(billId, selectedFriendIds);
      if (ok) {
        setSuccessMsg(t('billSharedSuccess', locale));
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
        className="bg-surface border border-line rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h3
            id="share-friends-title"
            className="font-bold text-sm sm:text-base flex items-center gap-2 text-ink"
          >
            <Users className="w-4 h-4 text-accent" />
            <span>{t('shareToFriends', locale)}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="icon-btn p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 flex-1 overflow-y-auto">
          {successMsg ? (
            <div className="p-4 rounded-xl bg-accent/15 border border-accent/30 text-accent text-center text-xs font-semibold flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          ) : (
            <>
              {errorMsg && (
                <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500">
                  {errorMsg}
                </p>
              )}

              {/* Tabs lọc theo nhóm đã lưu */}
              {savedGroups && savedGroups.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-ink-3">
                    {locale === 'vi' ? 'Lọc theo nhóm bạn:' : 'Filter by group:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedGroupId('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition ${
                        selectedGroupId === 'all'
                          ? 'bg-accent text-white shadow-sm'
                          : 'bg-surface-2 text-ink-2 hover:bg-surface-3'
                      }`}
                    >
                      {locale === 'vi' ? 'Tất cả bạn bè' : 'All friends'}
                    </button>
                    {savedGroups.map((group: any) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition flex items-center gap-1 ${
                          selectedGroupId === group.id
                            ? 'bg-accent text-white shadow-sm'
                            : 'bg-surface-2 text-ink-2 hover:bg-surface-3'
                        }`}
                      >
                        <Users className="w-3 h-3 opacity-70" />
                        <span className="truncate max-w-[120px]">{group.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Thanh thao tác nhanh */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-line/60">
                <div className="flex items-center gap-2 text-ink-3">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="hover:text-accent cursor-pointer underline text-[11px]"
                  >
                    {locale === 'vi' ? 'Chọn hết' : 'Select all'}
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="hover:text-accent cursor-pointer underline text-[11px]"
                  >
                    {locale === 'vi' ? 'Bỏ chọn' : 'Deselect all'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSelectOnlyInBill}
                  className="flex items-center gap-1 text-accent font-semibold hover:underline cursor-pointer text-[11px]"
                  title={locale === 'vi' ? 'Chỉ chọn người có tên trong hóa đơn' : 'Select members in this bill'}
                >
                  <Filter className="w-3 h-3" />
                  <span>{locale === 'vi' ? 'Chỉ người trong bill' : 'Only in bill'}</span>
                </button>
              </div>

              {/* Danh sách bạn bè */}
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-ink-3" />
                </div>
              ) : displayedFriends.length === 0 ? (
                !errorMsg && (
                  <p className="text-xs text-ink-3 italic text-center py-8">
                    {selectedGroupId === 'all'
                      ? t('noFriendsYet', locale)
                      : (locale === 'vi' ? 'Nhóm này chưa có ai trong danh sách bạn bè.' : 'No friends found in this group.')}
                  </p>
                )
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                  {displayedFriends.map((friend) => {
                    const isSelected = selectedFriendIds.includes(friend.id);
                    const isInBill = billMemberNames.has(normalizeString(friend.display_name));

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
                              className="w-7 h-7 rounded-full object-cover border border-line shrink-0"
                            />
                          ) : (
                            <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {friend.display_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="text-xs font-medium truncate text-ink block">
                              {friend.display_name}
                            </span>
                            {isInBill && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-medium">
                                <UserCheck className="w-2.5 h-2.5" />
                                <span>{locale === 'vi' ? 'Có trong bill' : 'In bill'}</span>
                              </span>
                            )}
                          </span>
                        </span>

                        <span
                          aria-hidden="true"
                          className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-accent border-accent text-white'
                              : 'border-line bg-surface'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {!successMsg && (
          <div className="p-4 border-t border-line flex items-center justify-between gap-3 bg-surface-2/40">
            <span className="text-xs text-ink-3">
              {locale === 'vi'
                ? `Đã chọn: ${selectedFriendIds.length} người`
                : `Selected: ${selectedFriendIds.length}`}
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary text-xs py-1.5 px-3 cursor-pointer"
              >
                {locale === 'vi' ? 'Hủy' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isSending || isLoading || selectedFriendIds.length === 0}
                className="btn btn-primary text-xs py-1.5 px-4 font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{t('sendBillBtn', locale)}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}