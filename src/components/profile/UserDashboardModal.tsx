
import { useState, useEffect, useCallback } from 'react';
import {
  X,
  History,
  CreditCard,
  Shield,
  Cloud,
  Loader2,
  Plus,
  Trash2,
  FileText,
  Users,
  UserPlus,
  Check,
  UserCheck,
  Clock,
  ChevronRight,
  UserPlus2,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useBillStore } from '../../store/useBillStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useLocale, t } from '../../hooks/useLocale';
import { supabase } from '../../lib/supabase';
import type { MemberGroup, Member } from '../../types/bill';
import { RUSSIA_BANKS } from '../../constants/banks';

const VN_BANKS = [
  { code: 'MBBANK', name: 'MB Bank (Quân Đội)' },
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'VBA', name: 'Agribank' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'STB', name: 'Sacombank' },
  { code: 'HDB', name: 'HDBank' },
];

interface UserDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'bills' | 'payment' | 'account' | 'friends';
}

export interface FriendProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  phone_number?: string;
  russia_bank?: string;
  russia_account_holder?: string;
  russia_qr_url?: string;
  friendship_id: string;
}

const compressImage = (file: File, maxDim = 500, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function UserDashboardModal({ isOpen, onClose, defaultTab = 'bills' }: UserDashboardModalProps) {
  const [tab, setTab] = useState<'bills' | 'payment' | 'account' | 'friends'>(defaultTab);
  const { user, signOut } = useAuthStore();
  const {
    history,
    loadBillFromHistory,
    deleteBillFromHistory,
    initializeNewBill,
    fetchUserBills,
    sharedBills,
    isSyncing,
    syncProfileToMember,
    savedGroups,
    deleteGroup,
    addMemberToGroup,
    removeMemberFromGroup,
    deleteSharedBill,
  } = useBillStore();
  const { profile, saveProfile, isLoading: isSavingProfile } = useProfileStore();
  const { locale } = useLocale();
  const [openMenuFriendId, setOpenMenuFriendId] = useState<string | null>(null);
  

  // Profile Form States
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bankName, setBankName] = useState(profile?.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(profile?.account_number || '');
  const [accountHolder, setAccountHolder] = useState(profile?.account_holder || '');
  const [russiaAccountHolder, setRussiaAccountHolder] = useState(profile?.russia_account_holder || profile?.account_holder || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [russiaBank, setRussiaBank] = useState(profile?.russia_bank || '');
  const [russiaQrUrl, setRussiaQrUrl] = useState(profile?.russia_qr_url || '');
  const [billsSubTab, setBillsSubTab] = useState<'my' | 'shared'>('my');

  const [showVnSection, setShowVnSection] = useState(
    Boolean(profile?.bank_name || profile?.account_number)
  );
  const [showRuSection, setShowRuSection] = useState(
    Boolean(profile?.phone_number || profile?.russia_bank || profile?.russia_account_holder || profile?.russia_qr_url)
  );
  const [newPassword, setNewPassword] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Friends & Groups States
  const [friendEmailInput, setFriendEmailInput] = useState('');
  const [friendsList, setFriendsList] = useState<FriendProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ id: string; email: string }[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<MemberGroup | null>(null);

  // Tải danh sách bạn bè kèm Profile đầy đủ
  const loadFriendshipsAndProfiles = useCallback(async () => {
    if (!user || !supabase) return;
    setIsLoadingFriends(true);
    try {
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const myEmail = user.email?.toLowerCase();
      const pending: { id: string; email: string }[] = [];
      const acceptedTargetIds: { id: string; friendshipId: string; email: string }[] = [];

      for (const f of friendships || []) {
        if (f.status === 'pending') {
          if (f.friend_email?.toLowerCase() === myEmail || f.friend_id === user.id) {
            pending.push({ id: f.id, email: f.friend_email });
          }
        } else if (f.status === 'accepted') {
          const targetUserId = f.user_id === user.id ? f.friend_id : f.user_id;
          acceptedTargetIds.push({
            id: targetUserId || '',
            friendshipId: f.id,
            email: f.friend_email,
          });
        }
      }

      setPendingRequests(pending);

      // Lấy Profile thật của bạn bè
      const validIds = acceptedTargetIds.map((item) => item.id).filter(Boolean);
      if (validIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, bank_name, account_number, account_holder, phone_number, russia_bank, russia_account_holder, russia_qr_url, custom_qr_url')
          .in('id', validIds);

        const profileMap = new Map((profilesData || []).map((p) => [p.id, p]));

        const uniqueAcceptedFriends = Array.from(
          new Map(acceptedTargetIds.map((item) => [item.id || item.email, item])).values()
        );
        const combinedFriends: FriendProfile[] = uniqueAcceptedFriends.map((item) => {
          const p = profileMap.get(item.id);
          return {
            id: item.id,
            email: item.email,
            display_name: p?.display_name || item.email.split('@')[0],
            avatar_url: p?.avatar_url,
            bank_name: p?.bank_name,
            account_number: p?.account_number,
            phone_number: p?.phone_number,
            russia_bank: p?.russia_bank,
            friendship_id: item.friendshipId,
          };
        });
        setFriendsList(combinedFriends);
      } else {
        setFriendsList([]);
      }
    } catch (err) {
      console.error('Error fetching friends:', err);
    } finally {
      setIsLoadingFriends(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && tab === 'friends' && user) {
      void loadFriendshipsAndProfiles();
    }
  }, [isOpen, tab, user, loadFriendshipsAndProfiles]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBankName(profile.bank_name || '');
      setAccountNumber(profile.account_number || '');
      setAccountHolder(profile.account_holder || '');
      setRussiaAccountHolder(profile.russia_account_holder || profile.account_holder || '');
      setPhoneNumber(profile.phone_number || '');
      setRussiaBank(profile.russia_bank || '');
      setRussiaQrUrl(profile.russia_qr_url || '');

      if (profile.bank_name || profile.account_number) setShowVnSection(true);
      if (profile.phone_number || profile.russia_bank || profile.russia_account_holder || profile.russia_qr_url) setShowRuSection(true);
    }
  }, [profile]);

  if (!isOpen) return null;

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = friendEmailInput.trim().toLowerCase();
    if (!targetEmail || !user || !supabase) return;

    if (targetEmail === user.email?.toLowerCase()) {
      setAccountMessage('Không thể gửi lời mời cho chính mình');
      setTimeout(() => setAccountMessage(''), 3000);
      return;
    }

    if (
      friendsList.some((friend) => friend.email.toLowerCase() === targetEmail) ||
      pendingRequests.some((request) => request.email.toLowerCase() === targetEmail)
    ) {
      setAccountMessage(t('alreadyInFriends', locale));
      setTimeout(() => setAccountMessage(''), 3000);
      return;
    }

    setIsSendingRequest(true);
    try {
      const { data: existingRequests, error: existingError } = await supabase
        .from('friendships')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('friend_email', targetEmail)
        .in('status', ['pending', 'accepted']);
      if (existingError) throw existingError;
      if (existingRequests?.length) {
        throw new Error(t('alreadyInFriends', locale));
      }

      const { error } = await supabase.from('friendships').insert({
        user_id: user.id,
        friend_email: targetEmail,
        status: 'pending',
      });
      if (error) throw error;
      setFriendEmailInput('');
      setAccountMessage(t('friendRequestSent', locale));
      await loadFriendshipsAndProfiles();
    } catch (err: unknown) {
      setAccountMessage(err instanceof Error ? err.message : 'Lỗi gửi lời mời');
    } finally {
      setIsSendingRequest(false);
      setTimeout(() => setAccountMessage(''), 3000);
    }
  };

  const handleRespondRequest = async (id: string, status: 'accepted' | 'rejected') => {
    if (!supabase || !user) return;
    try {
      if (status === 'accepted') {
        const { data: request, error: requestError } = await supabase
          .from('friendships')
          .select('user_id, friend_id')
          .eq('id', id)
          .maybeSingle();
        if (requestError) throw requestError;

        const senderId = request?.user_id;
        if (senderId) {
          const { data: existingFriendship, error: existingError } = await supabase
            .from('friendships')
            .select('id')
            .eq('status', 'accepted')
            .or(`and(user_id.eq.${senderId},friend_id.eq.${user.id}),and(user_id.eq.${user.id},friend_id.eq.${senderId})`)
            .maybeSingle();
          if (existingError) throw existingError;
          if (existingFriendship) {
            const { error: deleteError } = await supabase.from('friendships').delete().eq('id', id);
            if (deleteError) throw deleteError;
            await loadFriendshipsAndProfiles();
            return;
          }
        }
      }

      const { error } = await supabase
        .from('friendships')
        .update({ status, friend_id: user.id })
        .eq('id', id);
      if (error) throw error;
      await loadFriendshipsAndProfiles();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFriend = async (friendshipId: string) => {
    if (!supabase) return;
    try {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      await loadFriendshipsAndProfiles();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddFriendToGroup = (group: MemberGroup, friend: FriendProfile) => {
    const newMember: Omit<Member, 'id'> = {
      name: friend.display_name,
      avatarColor: 'bg-emerald-500',
      avatar_url: friend.avatar_url,
      bank_name: friend.bank_name,
      account_number: friend.account_number,
      phone_number: friend.phone_number,
      russia_bank: friend.russia_bank,
    };
    addMemberToGroup(group.id, newMember);
    setAccountMessage(
      t('addedFriendToGroupSuccess', locale, {
        friendName: friend.display_name,
        groupName: group.name,
      })
    );
    setTimeout(() => setAccountMessage(''), 2500);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await compressImage(file, 400, 0.8);
      await saveProfile({
        display_name: displayName || profile?.display_name || 'Tôi',
        bank_name: bankName || profile?.bank_name || '',
        account_number: accountNumber || profile?.account_number || '',
        account_holder: accountHolder || profile?.account_holder || '',
        russia_account_holder: russiaAccountHolder || accountHolder || profile?.russia_account_holder || profile?.account_holder || '',
        phone_number: phoneNumber || profile?.phone_number || '',
        russia_bank: russiaBank || profile?.russia_bank || '',
        custom_qr_url: '',
        russia_qr_url: russiaQrUrl || profile?.russia_qr_url || '',
        avatar_url: base64,
      });
      syncProfileToMember();
      setAccountMessage(t('avatarSuccess', locale));
    } catch {
      setAccountMessage(t('avatarError', locale));
    } finally {
      setTimeout(() => setAccountMessage(''), 3000);
    }
  };

  const handleUploadRussiaQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedQr = await compressImage(file, 600, 0.75);
      setRussiaQrUrl(compressedQr);
      await saveProfile({
        display_name: displayName || profile?.display_name || 'Tôi',
        bank_name: bankName || profile?.bank_name || '',
        account_number: accountNumber || profile?.account_number || '',
        account_holder: accountHolder || profile?.account_holder || '',
        russia_account_holder: russiaAccountHolder,
        phone_number: phoneNumber,
        russia_bank: russiaBank,
        custom_qr_url: '',
        russia_qr_url: compressedQr,
        avatar_url: profile?.avatar_url || '',
      });
      syncProfileToMember();
      setAccountMessage(t('updateProfileSuccess', locale));
    } catch {
      setAccountMessage(t('avatarError', locale));
    } finally {
      setTimeout(() => setAccountMessage(''), 3000);
    }
  };

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setIsUpdatingName(true);
    try {
      await saveProfile({
        display_name: displayName.trim(),
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
        russia_account_holder: russiaAccountHolder,
        phone_number: phoneNumber,
        russia_bank: russiaBank,
        custom_qr_url: '',
        russia_qr_url: russiaQrUrl,
        avatar_url: profile?.avatar_url || '',
      });
      syncProfileToMember();
      if (supabase) {
        await supabase.auth.updateUser({
          data: { display_name: displayName.trim(), full_name: displayName.trim() },
        });
      }
      setAccountMessage(t('updateDisplayNameSuccess', locale));
    } catch (err: unknown) {
      setAccountMessage(err instanceof Error ? err.message : 'Error');
    } finally {
      setIsUpdatingName(false);
      setTimeout(() => setAccountMessage(''), 3000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfile({
      display_name: displayName,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder: accountHolder,
      phone_number: phoneNumber,
      russia_bank: russiaBank,
      russia_account_holder: russiaAccountHolder,
      custom_qr_url: '',
      russia_qr_url: russiaQrUrl,
      avatar_url: profile?.avatar_url || '',
    });
    useBillStore.getState().syncProfileToMember();
    setAccountMessage(t('updateProfileSuccess', locale));
    setTimeout(() => setAccountMessage(''), 3000);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setAccountMessage(t('minPasswordLen', locale));
      return;
    }
    if (!supabase) {
      setAccountMessage(t('supabaseNotConnected', locale));
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setAccountMessage(t('updatePasswordSuccess', locale));
    } catch (err: unknown) {
      setAccountMessage(err instanceof Error ? err.message : 'Error');
    } finally {
      setIsUpdatingPassword(false);
      setTimeout(() => setAccountMessage(''), 3000);
    }
  };

  const isVnActive = showVnSection || Boolean(bankName || accountNumber || accountHolder);
  const isRuActive = showRuSection || Boolean(phoneNumber || russiaBank || russiaAccountHolder || russiaQrUrl);


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
            {t('dashboardTitle', locale)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn hover:bg-surface-2 p-1.5 rounded-lg shrink-0"
            aria-label={t('close', locale)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line bg-surface-2/40 px-3 pt-2 gap-2 text-xs sm:text-sm font-medium overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setTab('bills')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              tab === 'bills' ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>{t('tabSavedBills', locale)}</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('friends')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              tab === 'friends' ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>{t('tabFriends', locale)}</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('payment')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              tab === 'payment' ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>{t('tabPaymentSettings', locale)}</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('account')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              tab === 'account' ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span>{t('tabAccountSecurity', locale)}</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: BILLS */}
          {tab === 'bills' && (
            <div className="space-y-4">
              {/* Header: Trạng thái Cloud & Nút hành động */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-2">
                  {user ? t('syncedWithCloud', locale) : t('localDeviceOnly', locale)}
                </span>
                <div className="flex gap-2">
                  {user && (
                    <button
                      type="button"
                      onClick={() => void fetchUserBills()}
                      disabled={isSyncing}
                      className="btn btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5 shrink-0"
                    >
                      {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                      <span>{t('syncButton', locale)}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      initializeNewBill();
                      onClose();
                    }}
                    className="btn btn-primary text-xs py-1.5 px-2.5 flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('newBillButton', locale)}</span>
                  </button>
                </div>
              </div>

              {/* Thanh chuyển đổi tab con: Hóa đơn của tôi vs Được chia sẻ với tôi */}
              <div className="flex gap-2 p-1 bg-surface-2 rounded-xl border border-line">
                <button
                  type="button"
                  onClick={() => setBillsSubTab('my')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    billsSubTab === 'my'
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {t('myBillsTab', locale)} ({history.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBillsSubTab('shared')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    billsSubTab === 'shared'
                      ? 'bg-surface text-accent shadow-sm'
                      : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{t('sharedWithMeTab', locale)} ({sharedBills?.length || 0})</span>
                </button>
              </div>

              {/* PHẦN 1: Hóa đơn của tôi */}
              {billsSubTab === 'my' && (
                <>
                  {history.length === 0 ? (
                    <div className="text-center py-10 space-y-3">
                      <FileText className="w-10 h-10 mx-auto text-ink-3" />
                      <p className="text-sm text-ink-2">{t('emptyBillsHistory', locale)}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((bill) => {
                        const total = bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                        return (
                          <div
                            key={bill.id}
                            className="bg-card border border-line rounded-xl p-3 flex items-center justify-between gap-3"
                          >
                            <div
                              className="flex-1 cursor-pointer min-w-0"
                              onClick={() => {
                                loadBillFromHistory(bill.id);
                                onClose();
                              }}
                            >
                              <h4 className="font-semibold text-sm truncate">{bill.title || t('unnamedBill', locale)}</h4>
                              <p className="text-xs text-ink-2 mt-0.5">
                                {t('membersCount', locale, { count: bill.members.length })} • {total.toLocaleString()} {bill.currency}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  loadBillFromHistory(bill.id);
                                  onClose();
                                }}
                                className="btn btn-secondary text-xs py-1 px-2.5 shrink-0"
                              >
                                {t('openBill', locale)}
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteBillFromHistory(bill.id)}
                                className="icon-btn text-ink-3 hover:text-rose-500 p-1 shrink-0"
                                title={t('deleteBill', locale)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* PHẦN 2: Hóa đơn được bạn bè gửi */}
              {billsSubTab === 'shared' && (
                <div className="space-y-2">
                  {!sharedBills || sharedBills.length === 0 ? (
                    <div className="text-center py-10 space-y-3">
                      <Users className="w-10 h-10 mx-auto text-ink-3 opacity-60" />
                      <p className="text-xs text-ink-3 italic">{t('noSharedBills', locale)}</p>
                    </div>
                  ) : (
                    sharedBills.map((bill) => {
                      const total = (bill.items || []).reduce((sum, item) => sum + item.price * item.quantity, 0);
                      return (
                        <div
                          key={bill.shareId || bill.id}
                          className="bg-card border border-line border-l-4 border-l-accent rounded-xl p-3 flex items-center justify-between gap-3 hover:bg-surface-2/60 transition-colors"
                        >
                          <div
                            className="flex-1 cursor-pointer min-w-0"
                            onClick={() => {
                              useBillStore.setState({
                                currentBill: {
                                  ...bill,
                                  items: Array.isArray(bill.items) ? bill.items : [],
                                  members: Array.isArray(bill.members) ? bill.members : [],
                                  isSharedBill: Boolean(bill.user_id && user?.id && bill.user_id !== user.id),
                                },
                              });
                              onClose();
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm truncate text-ink">
                                {bill.title || t('unnamedBill', locale)}
                              </h4>
                              <span className="text-[10px] bg-accent/15 text-accent font-medium px-2 py-0.5 rounded-full border border-accent/20 shrink-0">
                                {t('sharedBy', locale, { name: bill.sharedBy || 'Bạn bè' })}
                              </span>
                            </div>
                            <p className="text-xs text-ink-2 mt-0.5">
                              {t('membersCount', locale, { count: bill.members?.length || 0 })} • {total.toLocaleString()} {bill.currency}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Nút Mở hóa đơn */}
                            <button
                              type="button"
                              onClick={() => {
                                useBillStore.setState({
                                  currentBill: {
                                    ...bill,
                                    items: Array.isArray(bill.items) ? bill.items : [],
                                    members: Array.isArray(bill.members) ? bill.members : [],
                                     isSharedBill: Boolean(bill.user_id && user?.id && bill.user_id !== user.id),
                                  },
                                });
                                onClose();
                              }}
                              className="btn btn-secondary text-xs py-1 px-2.5 shrink-0 text-accent border-accent/30 hover:border-accent"
                            >
                              {t('openBill', locale)}
                            </button>

                            {/* Nút Xóa hóa đơn được chia sẻ */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const confirmMsg =
                                  locale === 'en'
                                    ? 'Remove this shared bill from your list?'
                                    : locale === 'ru'
                                      ? 'Удалить этот общий счёт из списка?'
                                      : locale === 'zh'
                                        ? '从列表中删除此共享账单？'
                                        : 'Xóa hóa đơn được chia sẻ này khỏi danh sách của bạn?';

                                if (window.confirm(confirmMsg) && bill.shareId) {
                                  void deleteSharedBill(bill.shareId);
                                }
                              }}
                              className="icon-btn text-ink-3 hover:text-rose-500 p-1 shrink-0 transition-colors"
                              title={t('deleteBill', locale)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FRIENDS & GROUPS */}
          {tab === 'friends' && (
            <div className="space-y-5">
              {accountMessage && (
                <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent text-center font-medium">
                  {accountMessage}
                </div>
              )}

              {/* Form gửi kết bạn */}
              <div className="p-4 bg-surface-2/60 border border-line rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>{t('tabFriends', locale)}</span>
                </h4>

                {user ? (
                  <form onSubmit={handleSendFriendRequest} className="flex gap-2">
                    <input
                      type="email"
                      value={friendEmailInput}
                      onChange={(e) => setFriendEmailInput(e.target.value)}
                      placeholder={t('friendEmailPlaceholder', locale)}
                      className="field flex-1 min-w-0 text-xs py-1.5"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isSendingRequest || !friendEmailInput.trim()}
                      className="btn btn-primary text-xs py-1.5 px-3 shrink-0 flex items-center gap-1"
                    >
                      {isSendingRequest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{t('sendFriendRequest', locale)}</span>
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-ink-3 italic">{t('notLoggedIn', locale)}</p>
                )}
              </div>

              {/* Lời mời đang chờ */}
              {pendingRequests.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-warn">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('pendingRequests', locale)} ({pendingRequests.length})</span>
                  </div>

                  <div className="space-y-1.5">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-2.5 rounded-xl border border-line bg-surface-2 flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-medium truncate flex-1 min-w-0">{req.email}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleRespondRequest(req.id, 'accepted')}
                            className="btn btn-primary text-xs py-1 px-2.5 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{t('acceptFriend', locale)}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRespondRequest(req.id, 'rejected')}
                            className="btn btn-secondary text-xs py-1 px-2.5 text-rose-500 hover:bg-rose-500/10"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>{t('rejectFriend', locale)}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Danh sách bạn bè đã kết nối (kèm Avatar & Tên thật) */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                  <UserCheck className="w-4 h-4 text-accent shrink-0" />
                  <span>{t('friendsList', locale, { count: friendsList.length })}</span>
                </div>

                {isLoadingFriends ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-ink-3" />
                  </div>
                ) : friendsList.length === 0 ? (
                  <p className="text-xs text-ink-3 italic py-2">{t('noFriendsYet', locale)}</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {friendsList.map((f) => (
                      <div
                        key={f.id}
                        className="p-2.5 rounded-xl border border-line bg-surface-2/60 flex items-center justify-between gap-2 relative"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {f.avatar_url ? (
                            <img
                              src={f.avatar_url}
                              alt={f.display_name}
                              className="w-8 h-8 rounded-full object-cover border border-line shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs shrink-0">
                              {f.display_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate text-ink">{f.display_name}</p>
                            <p className="text-[10px] text-ink-3 truncate">{f.email}</p>
                          </div>
                        </div>

                        {/* Thêm bạn bè vào Nhóm bằng Click - Ổn định tuyệt đối, không dùng hover */}
                        {savedGroups.length > 0 && (
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuFriendId(openMenuFriendId === f.id ? null : f.id);
                              }}
                              className={`icon-btn p-1.5 rounded-lg transition-colors ${
                                openMenuFriendId === f.id
                                  ? 'bg-accent/20 text-accent'
                                  : 'text-accent hover:bg-accent/10'
                              }`}
                              title={t('addToGroup', locale)}
                            >
                              <UserPlus2 className="w-4 h-4" />
                            </button>

                            {openMenuFriendId === f.id && (
                              <>
                                {/* Backdrop vô hình bao quanh toàn màn hình để bấm ra ngoài thì tự đóng menu */}
                                <div
                                  className="fixed inset-0 z-30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuFriendId(null);
                                  }}
                                />

                                {/* Danh sách nhóm hiển thị khi click */}
                                <div
                                  className="absolute right-0 top-full mt-1.5 flex flex-col bg-surface border border-line shadow-2xl rounded-xl p-1.5 z-40 min-w-[150px] animate-fadeIn"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-[10px] text-ink-3 px-2 py-1 font-semibold border-b border-line/60">
                                    {t('addToGroup', locale)}:
                                  </span>
                                  <div className="max-h-40 overflow-y-auto space-y-0.5 pt-1">
                                    {savedGroups.map((g) => (
                                      <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => {
                                          handleAddFriendToGroup(g, f);
                                          setOpenMenuFriendId(null);
                                        }}
                                        className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-surface-2 rounded-lg truncate transition-colors text-ink font-medium"
                                      >
                                        {g.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleDeleteFriend(f.friendship_id)}
                          className="icon-btn text-ink-3 hover:text-rose-500 p-1.5 rounded-lg shrink-0"
                          title="Hủy kết bạn"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danh sách các Nhóm đã lưu (Hiện Avatar & Thông tin thành viên) */}
              <div className="pt-4 border-t border-line/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-accent shrink-0" />
                    <span>{t('groupsTitle', locale)} ({savedGroups.length})</span>
                  </span>
                </div>

                {savedGroups.length === 0 ? (
                  <p className="text-xs text-ink-3 italic">{t('noSavedGroups', locale)}</p>
                ) : (
                  <div className="space-y-2">
                    {savedGroups.map((group) => {
                      const isSelected = selectedGroupDetail?.id === group.id;
                      return (
                        <div key={group.id} className="border border-line rounded-xl bg-surface-2/40 overflow-hidden">
                          <div
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-surface-2 transition-colors"
                            onClick={() => setSelectedGroupDetail(isSelected ? null : group)}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <ChevronRight className={`w-4 h-4 text-ink-3 transition-transform shrink-0 ${isSelected ? 'rotate-90' : ''}`} />
                              <span className="font-semibold text-xs truncate">{group.name}</span>
                              <span className="text-[10px] text-ink-3 bg-surface-1 px-1.5 py-0.5 rounded-full border border-line shrink-0">
                                {group.members.length} {t('membersNav', locale)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteGroup(group.id);
                                if (selectedGroupDetail?.id === group.id) setSelectedGroupDetail(null);
                              }}
                              className="icon-btn text-ink-3 hover:text-rose-500 p-1 shrink-0"
                              title={t('deleteGroupTitle', locale)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {isSelected && (
                            <div className="p-3 border-t border-line/60 bg-surface/50 space-y-2 text-xs">
                              <span className="text-[11px] font-semibold text-ink-3">
                                {t('groupMembersTitle', locale, { name: group.name })}
                              </span>
                              <div className="space-y-1.5">
                                {group.members.map((m, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 rounded-lg bg-surface-2/80 border border-line flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      {/* Hiển thị avatar thực tế nếu có */}
                                      {m.avatar_url ? (
                                        <img
                                          src={m.avatar_url}
                                          alt={m.name}
                                          className="w-6 h-6 rounded-full object-cover border border-line shrink-0"
                                        />
                                      ) : (
                                        <div
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white shrink-0 font-bold ${
                                            m.avatarColor || 'bg-accent'
                                          }`}
                                        >
                                          {m.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="font-medium truncate text-ink">{m.name}</span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[11px] text-ink-3 truncate max-w-[150px] hidden sm:inline">
                                        {m.bank_name
                                          ? `${m.bank_name} - ${m.account_number}`
                                          : m.phone_number || ''}
                                      </span>

                                      {/* Nút xóa thành viên khỏi nhóm */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeMemberFromGroup(group.id, m.name);
                                          if (selectedGroupDetail?.id === group.id) {
                                            setSelectedGroupDetail({
                                              ...selectedGroupDetail,
                                              members: selectedGroupDetail.members.filter(
                                                (mem) => mem.name.toLowerCase() !== m.name.toLowerCase()
                                              ),
                                            });
                                          }
                                        }}
                                        className="icon-btn text-ink-3 hover:text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg transition-colors shrink-0"
                                        title={t('removeMemberFromGroup', locale)}
                                        aria-label={`${t('removeMemberFromGroup', locale)}: ${m.name}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PAYMENT */}
          {tab === 'payment' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {accountMessage && (
                <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent text-center font-medium">
                  {accountMessage}
                </div>
              )}

              {/* VN SECTION */}
              {isVnActive && (
                <div className="p-4 bg-surface-2/60 border border-line rounded-xl space-y-3 relative">
                  <div className="flex items-center justify-between border-b border-line/60 pb-2">
                    <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                      🇻🇳 {t('methodVietQR', locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setBankName('');
                        setAccountNumber('');
                        setAccountHolder('');
                        setShowVnSection(false);
                      }}
                      className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('removePaymentCard', locale)}</span>
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-ink-2 mb-1">{t('bankCodeLabel', locale)}</label>
                      <select
                        value={VN_BANKS.some((b) => b.code === bankName) ? bankName : bankName ? 'OTHER' : ''}
                        onChange={(e) => {
                          if (e.target.value !== 'OTHER') {
                            setBankName(e.target.value);
                          } else {
                            setBankName('OTHER_BANK');
                          }
                        }}
                        className="field py-1.5 text-xs bg-surface"
                      >
                        <option value="">{t('selectBankPlaceholder', locale)}</option>
                        {VN_BANKS.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                        <option value="OTHER">{t('otherBank', locale)}</option>
                      </select>

                      {!VN_BANKS.some((b) => b.code === bankName) && bankName !== '' && (
                        <input
                          type="text"
                          value={bankName === 'OTHER_BANK' ? '' : bankName}
                          onChange={(e) => setBankName(e.target.value.toUpperCase())}
                          placeholder="VD: OCB, MSB, SHB..."
                          className="field py-1.5 text-xs uppercase mt-2"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-ink-2 mb-1">{t('accountNumberLabel', locale)}</label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="19073967754011"
                        className="field py-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-ink-2 mb-1 text-xs">{t('accountHolderLabel', locale)}</label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                      placeholder="HA PHAM MINH TUAN"
                      className="field py-1.5 text-xs uppercase font-mono"
                    />
                  </div>
                </div>
              )}

              {/* RU SECTION */}
              {isRuActive && (
                <div className="p-4 bg-surface-2/60 border border-line rounded-xl space-y-3 relative">
                  <div className="flex items-center justify-between border-b border-line/60 pb-2">
                    <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                      🇷🇺 {t('methodRussiaSBP', locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneNumber('');
                        setRussiaBank('');
                        setShowRuSection(false);
                      }}
                      className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('removePaymentCard', locale)}</span>
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-ink-2 mb-1">{t('phoneSbpLabel', locale)}</label>
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+7 930 074-27-04"
                        className="field py-1.5 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-2 mb-1">{t('russiaAccountHolderLabel', locale)}</label>
                      <input
                        type="text"
                        value={russiaAccountHolder}
                        onChange={(e) => setRussiaAccountHolder(e.target.value)}
                        placeholder="IVAN I."
                        className="field py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-2 mb-1">{t('bankRuLabel', locale)}</label>
                      <select
                        value={RUSSIA_BANKS.some((bank) => bank.value === russiaBank) ? russiaBank : russiaBank ? 'OTHER' : ''}
                        onChange={(e) => {
                          if (e.target.value !== 'OTHER') {
                            setRussiaBank(e.target.value);
                          } else {
                            setRussiaBank('OTHER_BANK');
                          }
                        }}
                        className="field py-1.5 text-xs bg-surface"
                      >
                        <option value="">{t('selectBankPlaceholder', locale)}</option>
                        {RUSSIA_BANKS.map((bank) => (
                          <option key={bank.value} value={bank.value}>
                            {bank.label}
                          </option>
                        ))}
                        <option value="OTHER">{t('otherBank', locale)}</option>
                      </select>

                      {!RUSSIA_BANKS.some((bank) => bank.value === russiaBank) && russiaBank !== '' && (
                        <input
                          type="text"
                          value={russiaBank === 'OTHER_BANK' ? '' : russiaBank}
                          onChange={(e) => setRussiaBank(e.target.value)}
                          placeholder="Название банка..."
                          className="field py-1.5 text-xs mt-2"
                        />
                      )}
                    </div>
                  </div>

                  <div className="border-t border-line/60 pt-3 space-y-2">
                    <label className="block text-ink-2 text-xs">{t('uploadRussiaQr', locale)}</label>
                    <input type="file" accept="image/*" onChange={handleUploadRussiaQrImage} className="text-xs text-ink-2 block w-full file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:bg-accent file:text-white cursor-pointer" />
                    {russiaQrUrl && (
                      <div className="flex items-center gap-3">
                        <img src={russiaQrUrl} alt={t('paymentQrAlt', locale)} className="w-24 h-24 rounded-lg border border-line object-contain bg-white p-1" />
                        <button type="button" onClick={() => {
                          setRussiaQrUrl('');
                          void saveProfile({ display_name: displayName, bank_name: bankName, account_number: accountNumber, account_holder: accountHolder, russia_account_holder: russiaAccountHolder, phone_number: phoneNumber, russia_bank: russiaBank, custom_qr_url: '', russia_qr_url: '', avatar_url: profile?.avatar_url || '' });
                          syncProfileToMember();
                        }} className="text-xs text-rose-500 hover:underline">{t('deleteQrImg', locale)}</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isVnActive && !isRuActive && (
                <div className="text-center py-6 border border-dashed border-line rounded-xl">
                  <p className="text-xs text-ink-2">{t('noPaymentMethodConfigured', locale)}</p>
                </div>
              )}

              {(!isVnActive || !isRuActive) && (
                <div className="pt-1">
                  <label className="block text-[11px] text-ink-3 uppercase font-semibold mb-2">
                    {t('addPaymentMethod', locale)}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {!isVnActive && (
                      <button
                        type="button"
                        onClick={() => setShowVnSection(true)}
                        className="btn btn-secondary text-xs py-1.5 px-3 border-dashed hover:border-accent hover:text-accent"
                      >
                        + 🇻🇳 {t('methodVietQR', locale)}
                      </button>
                    )}
                    {!isRuActive && (
                      <button
                        type="button"
                        onClick={() => setShowRuSection(true)}
                        className="btn btn-secondary text-xs py-1.5 px-3 border-dashed hover:border-accent hover:text-accent"
                      >
                        + 🇷🇺 {t('methodRussiaSBP', locale)}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingProfile}
                className="btn btn-primary w-full py-2.5 text-xs font-semibold shadow-md"
              >
                {isSavingProfile ? t('savingProfile', locale) : t('saveProfileBtn', locale)}
              </button>
            </form>
          )}

          {/* TAB 4: ACCOUNT */}
          {tab === 'account' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-2">{t('avatarLabel', locale)}</label>
                <div className="flex items-center gap-4">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-14 h-14 rounded-full object-cover border border-line"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center text-xl border border-line">
                      👤
                    </div>
                  )}

                  <label className="btn btn-secondary cursor-pointer text-xs py-1.5 px-3">
                    <span>{t('changeAvatar', locale)}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>
              </div>

              {accountMessage && (
                <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent text-center font-medium">
                  {accountMessage}
                </div>
              )}

              <form
                onSubmit={handleUpdateDisplayName}
                className="p-3.5 bg-surface-2/50 border border-line rounded-xl space-y-3"
              >
                <h4 className="text-xs font-bold text-ink uppercase">{t('accountInfo', locale)}</h4>
                <p className="text-xs text-ink-2">
                  Email: <span className="font-medium text-ink">{user?.email || t('notLoggedIn', locale)}</span>
                </p>
                <div>
                  <label className="block text-ink-2 mb-1 text-xs">{t('displayNameLabel', locale)}</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="field py-1.5 text-xs"
                    placeholder={t('displayNameLabel', locale)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUpdatingName || !displayName.trim()}
                  className="btn btn-secondary text-xs py-1.5 px-3"
                >
                  {isUpdatingName ? '...' : t('saveDisplayName', locale)}
                </button>
              </form>

              {user && (
                <form
                  onSubmit={handleUpdatePassword}
                  className="p-3.5 bg-surface-2/50 border border-line rounded-xl space-y-3"
                >
                  <h4 className="text-xs font-bold text-ink uppercase">{t('changePassword', locale)}</h4>
                  <div>
                    <label className="block text-ink-2 mb-1 text-xs">{t('newPassword', locale)}</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="field py-1.5 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="btn btn-secondary text-xs py-1.5 px-3"
                  >
                    {isUpdatingPassword ? '...' : t('changePassword', locale)}
                  </button>
                </form>
              )}

              {user && (
                <button
                  type="button"
                  onClick={() => {
                    void signOut();
                    onClose();
                  }}
                  className="btn btn-secondary w-full text-xs text-rose-500 border-rose-500/20 hover:bg-rose-500/10"
                >
                  {t('logoutAccount', locale)}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}