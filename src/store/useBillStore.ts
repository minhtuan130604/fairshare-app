import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BillSession, BillExpense, BillMode, Member, ExpenseItem, CurrencyCode, MemberGroup, BillCategory } from '../types/bill';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { isValidUUID } from '../utils/isValidUUID';

import { useProfileStore } from './useProfileStore';

interface BillState {
  currentBill: BillSession | null;
  history: BillSession[];
  savedGroups: MemberGroup[];
  sharedBills: (BillSession & { sharedBy?: string; shareId?: string; isSharedBill?: boolean })[];
  theme: 'dark' | 'light';
  isSyncing: boolean;
  syncError: string | null;
  addMemberToGroup: (groupId: string, member: Omit<Member, 'id'>) => void;
  toggleTransferSettled: (transferKey: string) => void;
  updateTransferConfirmation: (transferKey: string, role: 'payer' | 'receiver') => Promise<void>;
  updateBillCategory: (category: BillCategory) => void;
  // Actions
  initializeNewBill: () => void;
  updateBillTitle: (title: string) => void;
  updateCurrency: (currency: CurrencyCode) => void;
  updatePayer: (memberId: string) => void;
  updateTax: (percent: number) => void;
  updateTip: (percent: number) => void;
  setBillMode: (mode: BillMode) => void;
  addExpense: (expense?: Partial<BillExpense>) => void;
  updateExpense: (expenseId: string, updates: Partial<BillExpense>) => void;
  removeExpense: (expenseId: string) => void;
  clearAllExpenses: () => void;
  addItemToExpense: (expenseId: string, item: Omit<ExpenseItem, 'id'>) => void;
  updateExpenseItem: (expenseId: string, itemId: string, updates: Partial<ExpenseItem>) => void;
  removeExpenseItem: (expenseId: string, itemId: string) => void;
  ensureCurrentUserMember: () => void;
  syncProfileToMember: () => void;
  // Member actions
  addMember: (name: string) => void;
  removeMember: (memberId: string) => void;
  updateMember: (memberId: string, updates: Partial<Member>) => void;
  // Member Group actions (localStorage)
  saveCurrentMembersAsGroup: (name: string, members?: Omit<Member, 'id'>[]) => void;
  applyGroupToBill: (groupId: string) => void;
  deleteGroup: (groupId: string) => void;
  removeMemberFromGroup: (groupId: string, memberName: string) => void;
  // Cloud Sync cho Nhóm & Chia sẻ bạn bè
  syncGroupsToCloud: (groups?: MemberGroup[], force?: boolean) => Promise<void>;
  fetchUserGroups: () => Promise<void>;
  shareBillWithFriends: (billId: string, friendUserIds: string[]) => Promise<boolean>;
  // Item actions
  addItem: (item: Omit<ExpenseItem, 'id'>) => void;
  updateItem: (itemId: string, updates: Partial<ExpenseItem>) => void;
  removeItem: (itemId: string) => void;
  clearAllItems: () => void;
  toggleMemberOnItem: (itemId: string, memberId: string) => void;
  assignAllMembersToItem: (itemId: string) => void;
  deleteSharedBill: (shareId: string) => Promise<void>;
  // History
  saveBillToHistory: () => Promise<void>;
  loadBillFromHistory: (billId: string) => void | Promise<void>;
  deleteBillFromHistory: (billId: string) => Promise<void>;
  // Cloud Sync
  fetchUserBills: (force?: boolean) => Promise<void>;
  saveBillToCloud: (bill?: BillSession) => Promise<void>;
  deleteBillFromCloud: (billId: string) => Promise<void>;
  // Global Update
  updateGlobalDisplayName: (newName: string) => Promise<void>;
  // Theme
  toggleTheme: () => void;
  // Reset
  resetCurrentBill: () => void;
  resetSessionState: () => void;
  // Cloud links replace the former base64-in-query URL sharing.
  importBillFromURL: (encodedData: string) => boolean;
}

const AVATAR_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-amber-500',
  'bg-teal-500',
];

const generateId = () => Math.random().toString(36).substring(2, 11);
export const USER_SELF_ID = 'member_me_default';

const getCurrentUserMember = (): Member => {
  const user = useAuthStore.getState().user;
  const profile = useProfileStore.getState().profile;
  const defaultMemberName =
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    'Tôi';
  const defaultMemberId = user?.id || profile?.id || USER_SELF_ID;
  return {
    id: defaultMemberId,
    name: defaultMemberName,
    avatarColor: AVATAR_COLORS[0],
    avatar_url: profile?.avatar_url || '',
    bank_name: profile?.bank_name || '',
    account_number: profile?.account_number || '',
    account_holder: profile?.account_holder || '',
    phone_number: profile?.phone_number || '',
    russia_bank: profile?.russia_bank || '',
    custom_qr_url: profile?.custom_qr_url || '',
    russia_account_holder: profile?.russia_account_holder || '',
    russia_qr_url: profile?.russia_qr_url || '',
  };
};

const createEmptyBill = (): BillSession => ({
  id: generateId(),
  title: '',
  date: new Date().toISOString(),
  currency: 'VND',
  category: 'dining',
  members: [],
  items: [],
  paidByMemberId: '',
  taxPercent: 0,
  tipPercent: 0,
  splitMode: 'ITEMIZED',
  mode: 'SINGLE',
  expenses: [],
  timelineMembers: [],
});

const isValidHistoryBill = (bill: BillSession): boolean => {
  const normalizedTitle = bill.title?.trim().toLowerCase();
  const hasTitle = Boolean(normalizedTitle && normalizedTitle !== 'hóa đơn' && normalizedTitle !== 'hoa don');
  const hasValidTotal = createBillSummary(bill).total > 0;
  return Boolean(bill.id && (hasTitle || hasValidTotal));
};

const normalizeHistoryBills = (bills: BillSession[]): BillSession[] => {
  const unique = bills.filter((bill, index, self) => Boolean(bill?.id) && index === self.findIndex((candidate) => candidate?.id === bill.id));
  return unique.filter(isValidHistoryBill);
};

const withBillInHistory = (state: Pick<BillState, 'history'>, bill: BillSession): BillSession[] => {
  if (!Array.isArray(state.history)) return [];
  return normalizeHistoryBills([bill, ...state.history.filter((savedBill) => savedBill.id !== bill.id)]);
};


const BASE64_DATA_URL_RE = /^data:image\/[^;]+;base64,/i;

function createBillSummary(bill: BillSession) {
  const clean = stripBase64Images(bill);
  const mode = clean.mode || (clean.expenses?.length ? 'TIMELINE' : 'SINGLE');
  const total = mode === 'TIMELINE'
    ? (clean.expenses || []).reduce((sum, expense) => {
      const subtotal = (expense.items || []).reduce((itemsTotal, item) => itemsTotal + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
      return sum + subtotal + subtotal * ((Number(expense.taxPercent) || 0) / 100) + subtotal * ((Number(expense.tipPercent) || 0) / 100);
    }, 0)
    : (clean.items || []).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0)
      * (1 + (Number(clean.taxPercent) || 0) / 100 + (Number(clean.tipPercent) || 0) / 100);
  const members = mode === 'TIMELINE' ? clean.timelineMembers || clean.members || [] : clean.members || [];
  return {
    title: clean.title || 'Hóa đơn',
    currency: clean.currency || 'VND',
    total,
    memberCount: members.length,
  };
}


function stripBase64Images<T>(value: T): T {
  if (typeof value === 'string') return (BASE64_DATA_URL_RE.test(value) ? '' : value) as T;
  if (Array.isArray(value)) return value.map((item) => stripBase64Images(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, stripBase64Images(item)]),
    ) as T;
  }
  return value;
}

function sanitizeBillForLocalStorage(bill: BillSession | null): BillSession | null {
  // Chỉ lọc ở persistence/UI cục bộ; không dùng kết quả này để ghi lên DB.
  return bill ? stripBase64Images(bill) : null;
}

const sanitizeGroups = (groups: MemberGroup[]): MemberGroup[] =>
  groups.map((group) => ({
    ...group,
    members: (group.members || []).map((member) => ({ ...member })),
  }));

const safeLocalStorage = createJSONStorage(() => {
  const storage = window.localStorage;
  return {
    getItem: (name: string) => storage.getItem(name),
    removeItem: (name: string) => storage.removeItem(name),
    setItem: (name: string, value: string) => {
      try {
        storage.setItem(name, value);
      } catch (error) {
        const isQuotaError =
          error instanceof DOMException &&
          (error.name === 'QuotaExceededError' || error.code === 22);
        if (isQuotaError) {
          console.warn('LocalStorage đầy quota, tự động dọn bớt cache cũ.');
          try {
            storage.removeItem(name);
            storage.setItem(name, value);
          } catch {
            // Bỏ qua ghi local để không làm crash ứng dụng; dữ liệu cloud vẫn được giữ.
          }
        }
      }
    },
  };
});

// Biến timer phục vụ cơ chế Debounce đồng bộ Cloud
// Đặt 2 biến này ngay phía trên export const useBillStore = create<BillState>()(
let cloudSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let lastLocalMutationTime = 0; // Khóa chống dội ngược từ Realtime Supabase
const persistedBillFingerprints = new Map<string, string>();
const lastSyncedGroupsByUser = new Map<string, string>();
const GROUPS_FETCH_COOLDOWN_MS = 30 * 1000;
const FETCH_BILLS_COOLDOWN_MS = 30 * 1000;
const BILLS_SYNC_TIME_KEY = 'fairshare_last_bills_fetch_time';
const GROUPS_SYNC_TIME_KEY = 'fairshare_last_groups_fetch_time';
let lastFetchGroupsTime = 0;
let isFetchingGroupsInProgress = false;
let lastFetchBillsTime = 0;
let isFetchingBills = false;

const getSessionSyncTime = (key: string, userId: string): number => {
  try {
    return Number(sessionStorage.getItem(`${key}:${userId}`) || 0);
  } catch {
    return 0;
  }
};

const setSessionSyncTime = (key: string, userId: string): void => {
  try {
    sessionStorage.setItem(`${key}:${userId}`, String(Date.now()));
  } catch {
    // sessionStorage có thể bị chặn trong private browsing.
  }
};


export const useBillStore = create<BillState>()(
  persist(
    (set, get) => ({
      currentBill: null,
      history: [],
      savedGroups: [],
      sharedBills: [],
      theme: 'dark',
      isSyncing: false,
      syncError: null,

      addMemberToGroup: (groupId: string, member: Omit<Member, 'id'>) => {
        const { savedGroups } = get();
        const updated = savedGroups.map((g) => {
          if (g.id !== groupId) return g;
          if (g.members.some((m) => m.name.toLowerCase() === member.name.toLowerCase())) {
            return g;
          }
          return {
            ...g,
            members: [...g.members, member],
          };
        });
        set({ savedGroups: updated });
        void get().syncGroupsToCloud(updated);
      },

      removeMemberFromGroup: (groupId: string, memberName: string) => {
        const { savedGroups } = get();
        const updated = savedGroups.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            members: g.members.filter(
              (m) => m.name.toLowerCase() !== memberName.toLowerCase()
            ),
          };
        });
        set({ savedGroups: updated });
        void get().syncGroupsToCloud(updated);
      },

      shareBillWithFriends: async (billId: string, friendUserIds: string[]) => {
        const user = useAuthStore.getState().user;
        const currentBill = get().currentBill;
        if (!user || !supabase) {
          set({ isSyncing: false, syncError: 'Vui lòng đăng nhập để chia sẻ hóa đơn.' });
          return false;
        }
        if (!currentBill) {
          set({ isSyncing: false, syncError: 'Không tìm thấy hóa đơn cần chia sẻ.' });
          return false;
        }
        const receiverIds = [
          ...new Set(
            friendUserIds.filter((id) => typeof id === 'string' && id.length > 0 && id !== user.id)
          ),
        ];
        if (receiverIds.length === 0) {
          set({
            isSyncing: false,
            syncError: 'Vui lòng chọn ít nhất một người nhận khác tài khoản của bạn.',
          });
          return false;
        }
        const isAlreadyShared =
          Boolean((currentBill as BillSession & { isSharedBill?: boolean }).isSharedBill) ||
          get().sharedBills.some((bill) => bill.id === currentBill.id && bill.isSharedBill);
        if (isAlreadyShared) {
          set({
            isSyncing: false,
            syncError: 'Bạn không thể chia sẻ tiếp hóa đơn được nhận từ tài khoản khác.',
          });
          return false;
        }
        set({ isSyncing: true, syncError: null });
        try {
          const cloudBillId = currentBill.id || billId;
          const billToStore: BillSession = { ...currentBill, id: cloudBillId };
          const updatedAt = new Date().toISOString();

          const { error: upsertError } = await supabase.from('bills').upsert({
            id: cloudBillId,
            user_id: user.id,
            title: billToStore.title || 'Hóa đơn',
            data: stripBase64Images(billToStore),
            summary: createBillSummary(billToStore),
            transfer_confirmations: billToStore.transfer_confirmations || {},
            settled_transfers: billToStore.settled_transfers || [],
            updated_at: updatedAt,
          });
          if (upsertError) throw upsertError;

          const { data: existingShares } = await supabase
            .from('bill_shares')
            .select('receiver_id')
            .eq('bill_id', cloudBillId)
            .eq('sender_id', user.id)
            .in('receiver_id', receiverIds);
          const alreadySharedWith = new Set(
            (existingShares ?? []).map((row) => row.receiver_id as string)
          );
          const newShares = receiverIds
            .filter((receiverId) => !alreadySharedWith.has(receiverId))
            .map((receiverId) => ({
              bill_id: cloudBillId,
              sender_id: user.id,
              receiver_id: receiverId,
            }));
          if (newShares.length > 0) {
            const { data: insertedShares, error: shareInsertError } = await supabase
              .from('bill_shares')
              .insert(newShares)
              .select('id, receiver_id');
            if (shareInsertError) throw shareInsertError;

            const senderName =
              useProfileStore.getState().profile?.display_name ||
              user.user_metadata?.display_name ||
              'Bạn bè';
            const notifications = (insertedShares ?? []).map((share) => ({
              user_id: share.receiver_id,
              type: 'bill_shared',
              description: `${senderName} đã chia sẻ hóa đơn "${billToStore.title || 'Hóa đơn'}" với bạn.`,
              data: { billId: cloudBillId, shareId: share.id },
              is_read: false,
              created_at: new Date().toISOString(),
            }));
            if (notifications.length > 0) {
              const { error: notificationError } = await supabase
                .from('notifications')
                .insert(notifications);
              if (notificationError) throw notificationError;
            }
          }
          set({ isSyncing: false, syncError: null });
          return true;
        } catch (err: unknown) {
          const message =
            err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
              ? err.message
              : 'Không thể chia sẻ hóa đơn. Vui lòng thử lại.';
          console.error('Lỗi chia sẻ hóa đơn cho bạn bè:', err);
          set({ isSyncing: false, syncError: message });
          return false;
        }
      },

      updateBillCategory: (category: BillCategory) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const updatedBill = { ...currentBill, category };
        set((state) => ({
          currentBill: updatedBill,
          history: withBillInHistory(state, updatedBill),
        }));
        const user = useAuthStore.getState().user;
        if (user && !updatedBill.isSharedBill) {
          void get().saveBillToCloud(updatedBill);
        }
      },

      toggleTransferSettled: (transferKey: string) => {
        set((state) => {
          if (!state.currentBill) return state;
          const currentSettled = Array.isArray(state.currentBill.settled_transfers)
            ? state.currentBill.settled_transfers
            : [];
          const exists = currentSettled.includes(transferKey);
          const updatedSettled = exists
            ? currentSettled.filter((k) => k !== transferKey)
            : [...currentSettled, transferKey];
          const updatedBill = {
            ...state.currentBill,
            settled_transfers: updatedSettled,
          };
          const updatedHistory = state.history.map((b) =>
            b.id === updatedBill.id ? updatedBill : b
          );
          return {
            currentBill: updatedBill,
            history: updatedHistory,
          };
        });
        const active = get().currentBill;
        if (active && !active.isSharedBill) {
          void get().saveBillToCloud(active);
        }
      },

      updateTransferConfirmation: async (transferKey: string, role: 'payer' | 'receiver') => {
        const { currentBill } = get();
        if (!currentBill || !supabase) return;

        const current = currentBill.transfer_confirmations?.[transferKey] ?? {
          payerConfirmed: false,
          receiverConfirmed: false,
        };

        // Payer báo chuyển tiền lần đầu; bấm lại để hủy toàn bộ handshake.
        // Khi payer hủy, receiver luôn bị đưa về trạng thái chưa xác nhận.
        const newConfirmation =
          role === 'payer'
            ? {
                payerConfirmed: !current.payerConfirmed,
                receiverConfirmed: false,
              }
            : {
                ...current,
                receiverConfirmed: !current.receiverConfirmed,
              };

        const updatedConfirmations = {
          ...(currentBill.transfer_confirmations ?? {}),
          [transferKey]: newConfirmation,
        };

        const currentSettled = Array.isArray(currentBill.settled_transfers)
          ? currentBill.settled_transfers
          : [];

        const isSettled = newConfirmation.payerConfirmed && newConfirmation.receiverConfirmed;

        const settledTransfers = isSettled
          ? currentSettled.includes(transferKey)
            ? currentSettled
            : [...currentSettled, transferKey]
          : currentSettled.filter((k) => k !== transferKey);





        const updatedBill: BillSession = {
          ...currentBill,
          transfer_confirmations: updatedConfirmations,
          settled_transfers: settledTransfers,
        };

        // Cập nhật State cục bộ ngay lập tức
        set((state) => ({
          currentBill: updatedBill,
          history: withBillInHistory(state, updatedBill),
        }));

        try {
          // Lưu ngay lên Supabase
          const { error: billUpdateError } = await supabase
            .from('bills')
            .update({
              transfer_confirmations: updatedConfirmations,
              settled_transfers: settledTransfers,
              data: updatedBill,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentBill.id);
          if (billUpdateError) throw billUpdateError;

          const transferChannel = supabase.channel(`bill-transfer-${currentBill.id}`);
          await transferChannel.send({
            type: 'broadcast',
            event: 'transfer_confirmation_updated',
            payload: {
              billId: currentBill.id,
              transfer_confirmations: updatedConfirmations,
              settled_transfers: settledTransfers,
            },
          });
          void supabase.removeChannel(transferChannel);

          // Bắn thông báo nếu người chuyển báo đã gửi tiền
          if (role === 'payer' && newConfirmation.payerConfirmed) {
            const currentUser = useAuthStore.getState().user;
            const currentProfile = useProfileStore.getState().profile;
            const senderName = currentProfile?.display_name || currentUser?.user_metadata?.display_name || 'Bạn bè';
            const receiverMemberId = currentBill.paidByMemberId;

            if (
              receiverMemberId &&
              receiverMemberId !== currentUser?.id &&
              isValidUUID(receiverMemberId)
            ) {
              const { error: notificationError } = await supabase
                .from('notifications')
                .insert({
                  user_id: receiverMemberId,
                  type: 'transfer_reported',
                  description: `${senderName} đã báo chuyển tiền cho hóa đơn "${currentBill.title || 'Hóa đơn'}".`,
                  data: { billId: currentBill.id, transferKey },
                  is_read: false,
                  created_at: new Date().toISOString(),
                });
              if (notificationError) throw notificationError;
            }
          }
        } catch (err) {
          console.error('Lỗi cập nhật xác nhận chuyển khoản:', err);
        }
      },

      // Nhóm được lưu trong state/localStorage. Không ghi ngược member_groups vào
      // profiles tự động; profiles chỉ được ghi bởi thao tác Lưu hồ sơ.
      syncGroupsToCloud: async () => {},

      deleteSharedBill: async (shareId: string) => {
        if (!supabase || !shareId) return;
        const { sharedBills } = get();
        set({ sharedBills: sharedBills.filter((b) => b.shareId !== shareId) });
        try {
          const { error } = await supabase.from('bill_shares').delete().eq('id', shareId);
          if (error) throw error;
        } catch (err) {
          console.error('Lỗi xóa hóa đơn được chia sẻ:', err);
          set({ sharedBills });
        }
      },

      fetchUserGroups: async () => {
        const user = useAuthStore.getState().user;
        if (!user || !supabase) return;

        const now = Date.now();
        if (isFetchingGroupsInProgress) return;
        if (now - lastFetchGroupsTime < GROUPS_FETCH_COOLDOWN_MS) return;
        if (now - getSessionSyncTime(GROUPS_SYNC_TIME_KEY, user.id) < GROUPS_FETCH_COOLDOWN_MS) return;

        isFetchingGroupsInProgress = true;
        setSessionSyncTime(GROUPS_SYNC_TIME_KEY, user.id);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('member_groups')
            .eq('id', user.id)
            .single();
          if (error) throw error;
          const rawCloudGroups = Array.isArray(data?.member_groups)
            ? (data.member_groups as MemberGroup[])
            : [];
          const cloudGroups = sanitizeGroups(rawCloudGroups);
          lastSyncedGroupsByUser.set(user.id, JSON.stringify(rawCloudGroups));
          const localGroups = sanitizeGroups(get().savedGroups);
          const groupMap = new Map<string, MemberGroup>();
          localGroups.forEach((g) => groupMap.set(g.id, g));
          cloudGroups.forEach((g) => groupMap.set(g.id, g));
          set({ savedGroups: Array.from(groupMap.values()) });
        } catch (err) {
          console.error('Lỗi tải nhóm từ cloud:', err);
        } finally {
          isFetchingGroupsInProgress = false;
          lastFetchGroupsTime = Date.now();
        }
      },


      syncProfileToMember: () => {
        const { currentBill, history, savedGroups } = get();
        const profile = useProfileStore.getState().profile;
        const user = useAuthStore.getState().user;
        if (!profile && !user) return;

        const myId = user?.id || profile?.id || USER_SELF_ID;
        const myEmail = (user?.email || '').trim().toLowerCase();
        const newDisplayName = (profile?.display_name || user?.user_metadata?.display_name || '').trim();
        const pName = newDisplayName.toLowerCase();
        const latestAvatar =
          profile?.avatar_url ||
          user?.user_metadata?.avatar_url ||
          user?.user_metadata?.picture ||
          '';

        // Kiểm tra thực tế xem người dùng còn bật VietQR hay SBP không
        const hasVietQr = Boolean(profile?.account_number && profile.account_number.trim());
        const hasSbp = Boolean(
          (profile?.phone_number && profile.phone_number.trim()) ||
          (profile?.russia_qr_url && profile.russia_qr_url.trim())
        );

        // Hàm nhận diện thành viên là CHÍNH TÔI (kể cả khi đang mang tên cũ trong bill)
        const isMeMember = (m: any, index: number, billOwnerId?: string) => {
          if (!m) return false;
          const n = (m.name || '').trim().toLowerCase();
          const mEmail = (m.email || '').trim().toLowerCase();
          return (
            m.id === myId ||
            m.userId === myId ||
            m.id === USER_SELF_ID ||
            (myEmail && mEmail === myEmail) ||
            (pName && n === pName) ||
            n === 'tôi' ||
            (latestAvatar && m.avatar_url === latestAvatar) ||
            // Nếu mình là chủ bill và đây là thành viên có gắn avatar/thông tin ngân hàng của mình
            ((!billOwnerId || billOwnerId === myId) && index === 0 && Boolean(m.avatar_url || m.phone_number || m.account_number))
          );
        };

        const updateMemberData = (m: Member): Member => ({
          ...m,
          id: myId,
          name: newDisplayName || m.name,
          avatar_url: latestAvatar || m.avatar_url,
          bank_name: hasVietQr ? (profile?.bank_name || '') : '',
          account_number: hasVietQr ? (profile?.account_number || '') : '',
          account_holder: hasVietQr ? (profile?.account_holder || '') : '',
          phone_number: hasSbp ? (profile?.phone_number || '') : '',
          russia_bank: hasSbp ? (profile?.russia_bank || '') : '',
          russia_account_holder: hasSbp ? (profile?.russia_account_holder || '') : '',
          russia_qr_url: hasSbp ? (profile?.russia_qr_url || '') : '',
          custom_qr_url: profile?.custom_qr_url || '',
        });

        // 1. Cập nhật các nhóm đã lưu
        const updatedGroups = savedGroups.map((g: any) => ({
          ...g,
          members: Array.isArray(g.members)
            ? g.members.map((gm: any, idx: number) => (isMeMember(gm, idx, myId) ? updateMemberData(gm) : gm))
            : [],
        }));

        // 2. Hàm cập nhật một Bill bất kỳ (đổi cả ID trong items, expenses và payerId)
        const syncSingleBill = (bill: BillSession): BillSession => {
          if (!bill || bill.isSharedBill || !Array.isArray(bill.members)) return bill;
          let oldMyMemberId: string | null = null;
          let matchedOnce = false;

          const newMembers = bill.members.map((m, idx) => {
            if (!matchedOnce && isMeMember(m, idx, (bill as any).user_id)) {
              matchedOnce = true;
              oldMyMemberId = m.id;
              return updateMemberData(m);
            }
            return m;
          });

          if (!matchedOnce) return bill;

          const replaceId = (id: string) => (oldMyMemberId && id === oldMyMemberId ? myId : id);

          const newItems = Array.isArray(bill.items)
            ? bill.items.map((it) => ({
                ...it,
                assignedMemberIds: Array.isArray(it.assignedMemberIds)
                  ? Array.from(new Set(it.assignedMemberIds.map(replaceId)))
                  : [],
              }))
            : [];

          const newExpenses = Array.isArray(bill.expenses)
            ? bill.expenses.map((exp) => ({
                ...exp,
                payerId: replaceId(exp.payerId),
                participantIds: Array.isArray(exp.participantIds)
                  ? Array.from(new Set(exp.participantIds.map(replaceId)))
                  : [],
                items: Array.isArray(exp.items)
                  ? exp.items.map((it) => ({
                      ...it,
                      assignedMemberIds: Array.isArray(it.assignedMemberIds)
                        ? Array.from(new Set(it.assignedMemberIds.map(replaceId)))
                        : [],
                    }))
                  : [],
              }))
            : [];

          return {
            ...bill,
            members: newMembers,
            paidByMemberId: replaceId(bill.paidByMemberId),
            items: newItems,
            expenses: newExpenses,
          };
        };

        const updatedCurrentBill = currentBill ? syncSingleBill(currentBill) : null;
        const updatedHistory = Array.isArray(history) ? history.map(syncSingleBill) : [];

        set({
          savedGroups: updatedGroups,
          currentBill: updatedCurrentBill,
          history: updatedHistory,
        });

        if (updatedCurrentBill) {
          void get().saveBillToCloud(updatedCurrentBill);
        }
      },

      setBillMode: (mode: BillMode) => {
        const { currentBill } = get();
        if (!currentBill) return;

        // Nếu chuyển sang TIMELINE và chưa có chặng nào, tạo chặng khởi đầu với đúng người trả trước hiện tại
        if (mode === 'TIMELINE' && (!Array.isArray(currentBill.expenses) || currentBill.expenses.length === 0)) {
          const timelineMembers = Array.isArray(currentBill.timelineMembers)
            ? currentBill.timelineMembers
            : (Array.isArray(currentBill.members) ? currentBill.members : []);
          const existingIds = new Set(
            (Array.isArray(currentBill.members) ? currentBill.members : []).map((member) => member.id)
          );
          const newUniqueMembers = timelineMembers.filter((member) => !existingIds.has(member.id));
          const updatedMembers = [
            ...(Array.isArray(currentBill.members) ? currentBill.members : []),
            ...newUniqueMembers,
          ];
          const initialPayerId = currentBill.paidByMemberId || timelineMembers[0]?.id || '';

          const firstExpense: BillExpense = {
            id: crypto.randomUUID(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            title: currentBill.title || 'Chặng 1',
            payerId: initialPayerId,
            participantIds: timelineMembers.map((member) => member.id),
            items: Array.isArray(currentBill.items) ? currentBill.items : [],
            taxPercent: currentBill.taxPercent,
            tipPercent: currentBill.tipPercent,
          };
          const updatedBill = {
            ...currentBill,
            mode,
            timelineMembers: timelineMembers,
            members: updatedMembers,
            expenses: [firstExpense],
          };
          set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
          void get().saveBillToCloud(updatedBill);
          return;
        }

        const updatedBill = { ...currentBill, mode };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      addExpense: (expense?: Partial<BillExpense>) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const members = [
          ...(Array.isArray(currentBill.members) ? currentBill.members : []),
          ...(Array.isArray(currentBill.timelineMembers) ? currentBill.timelineMembers : []),
        ].filter((member, index, list) => list.findIndex((candidate) => candidate.id === member.id) === index);
        const currentExpenses = Array.isArray(currentBill.expenses) ? currentBill.expenses : [];
        
        // Ưu tiên chọn người trả tiền theo chặng trước đó hoặc người trả tiền mặc định của bill
        const defaultPayer =
          expense?.payerId ||
          currentExpenses[currentExpenses.length - 1]?.payerId ||
          currentBill.paidByMemberId ||
          members[0]?.id ||
          '';

        const newExpense: BillExpense = {
          id: crypto.randomUUID(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          title: `Chặng ${currentExpenses.length + 1}`,
          payerId: defaultPayer,
          participantIds: members.map((member) => member.id),
          items: [],
          taxPercent: 0,
          tipPercent: 0,
          ...expense,
        };

        const updatedBill = {
          ...currentBill,
          mode: 'TIMELINE' as const,
          expenses: [...currentExpenses, newExpense],
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      ensureCurrentUserMember: () => {
        const { currentBill } = get();
        const defaultMember = getCurrentUserMember();
        if (!currentBill) {
          get().initializeNewBill();
          return;
        }
        const safeMembers = Array.isArray(currentBill.members) ? currentBill.members : [];
        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        const existingIndex = safeMembers.findIndex(
          (m) =>
            m.id === defaultMember.id ||
            m.id === USER_SELF_ID ||
            m.name.trim().toLowerCase() === defaultMember.name.trim().toLowerCase() ||
            m.name === 'Tôi'
        );
        if (existingIndex >= 0) {
          const updatedMembers = [...safeMembers];
          updatedMembers[existingIndex] = {
            ...updatedMembers[existingIndex],
            ...defaultMember,
            id: updatedMembers[existingIndex].id,
          };
          set({
            currentBill: {
              ...currentBill,
              items: safeItems,
              members: updatedMembers,
            },
          });
        } else {
          set({
            currentBill: {
              ...currentBill,
              items: safeItems,
              members: [defaultMember, ...safeMembers],
              paidByMemberId: currentBill.paidByMemberId || defaultMember.id,
            },
          });
        }
      },

      initializeNewBill: () => {
        const defaultMember = getCurrentUserMember();
        const emptyBill = createEmptyBill();
        set({
          currentBill: {
            ...emptyBill,
            members: [defaultMember],
            paidByMemberId: defaultMember.id,
          },
        });
      },

      updateBillTitle: (title: string) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const updatedBill = { ...currentBill, title };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      updateCurrency: (currency: CurrencyCode) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const updatedBill = { ...currentBill, currency };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      updatePayer: (memberId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const profile = useProfileStore.getState().profile;
        const user = useAuthStore.getState().user;
        const isMe =
          memberId === user?.id ||
          memberId === USER_SELF_ID ||
          (profile?.display_name &&
            currentBill.members.find((m) => m.id === memberId)?.name === profile.display_name);
        const updatedMembers = currentBill.members.map((m) => {
          if (m.id !== memberId) return m;
          if (isMe && profile) {
            return {
              ...m,
              bank_name: profile.bank_name ?? m.bank_name,
              account_number: profile.account_number ?? m.account_number,
              account_holder: profile.account_holder ?? m.account_holder,
              phone_number: profile.phone_number ?? m.phone_number,
              russia_bank: profile.russia_bank ?? m.russia_bank ?? '',
              russia_account_holder: profile.russia_account_holder ?? m.russia_account_holder ?? '',
              russia_qr_url: profile.russia_qr_url ?? m.russia_qr_url ?? '',
              custom_qr_url: profile.custom_qr_url ?? m.custom_qr_url,
            };
          }
          return m;
        });
        const updatedBill = {
          ...currentBill,
          paidByMemberId: memberId,
          members: updatedMembers,
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        if (user && !updatedBill.isSharedBill) {
          void get().saveBillToCloud(updatedBill);
        }
      },

      updateTax: (percent: number) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const updatedBill = { ...currentBill, taxPercent: percent };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      updateTip: (percent: number) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const updatedBill = { ...currentBill, tipPercent: percent };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      

      
      updateExpense: (expenseId: string, updates: Partial<BillExpense>) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const expenses = Array.isArray(currentBill.expenses) ? currentBill.expenses : [];
        const updatedBill = {
          ...currentBill,
          expenses: expenses.map((expense) =>
            expense.id === expenseId ? { ...expense, ...updates, id: expense.id } : expense
          ),
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      removeExpense: (expenseId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const expenses = (Array.isArray(currentBill.expenses) ? currentBill.expenses : []).filter(
          (expense) => expense.id !== expenseId
        );
        const updatedBill = { ...currentBill, expenses };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      clearAllExpenses: () => {
        const { currentBill } = get();
        if (!currentBill) return;
        const updatedBill = { ...currentBill, expenses: [] };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      addItemToExpense: (expenseId: string, item: Omit<ExpenseItem, 'id'>) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const expenses = Array.isArray(currentBill.expenses) ? currentBill.expenses : [];
        const updatedBill = {
          ...currentBill,
          expenses: expenses.map((expense) =>
            expense.id === expenseId
              ? {
                  ...expense,
                  items: [...(Array.isArray(expense.items) ? expense.items : []), { ...item, id: generateId() }],
                }
              : expense
          ),
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      updateExpenseItem: (expenseId: string, itemId: string, updates: Partial<ExpenseItem>) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const expenses = Array.isArray(currentBill.expenses) ? currentBill.expenses : [];
        const updatedBill = {
          ...currentBill,
          expenses: expenses.map((expense) =>
            expense.id === expenseId
              ? {
                  ...expense,
                  items: (Array.isArray(expense.items) ? expense.items : []).map((item) =>
                    item.id === itemId ? { ...item, ...updates, id: item.id } : item
                  ),
                }
              : expense
          ),
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      removeExpenseItem: (expenseId: string, itemId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const expenses = Array.isArray(currentBill.expenses) ? currentBill.expenses : [];
        const updatedBill = {
          ...currentBill,
          expenses: expenses.map((expense) =>
            expense.id === expenseId
              ? {
                  ...expense,
                  items: (Array.isArray(expense.items) ? expense.items : []).filter((item) => item.id !== itemId),
                }
              : expense
          ),
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      addMember: (name: string) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const safeMembers = Array.isArray(currentBill.members) ? currentBill.members : [];
        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        const user = useAuthStore.getState().user;
        const profile = useProfileStore.getState().profile;
        const myName = (profile?.display_name || user?.user_metadata?.display_name || '').trim().toLowerCase();
        const isAddingMe = myName && name.trim().toLowerCase() === myName;
        const newMember: Member = {
          id: isAddingMe ? (user?.id || profile?.id || generateId()) : generateId(),
          name: name.trim(),
          avatarColor: AVATAR_COLORS[safeMembers.length % AVATAR_COLORS.length],
          ...(isAddingMe && profile
            ? {
                avatar_url: profile.avatar_url || user?.user_metadata?.avatar_url || '',
                bank_name: profile.bank_name || '',
                account_number: profile.account_number || '',
                account_holder: profile.account_holder || '',
                phone_number: profile.phone_number || '',
                russia_bank: profile.russia_bank || '',
                russia_account_holder: profile.russia_account_holder || '',
                russia_qr_url: profile.russia_qr_url || '',
                custom_qr_url: profile.custom_qr_url || '',
              }
            : {}),
        };
        const updatedMembers = [...safeMembers, newMember];
        const updatedItems = safeItems.map((item) => {
          const assigned = Array.isArray(item.assignedMemberIds) ? item.assignedMemberIds : [];
          const wasAssignedToAll = safeMembers.length > 0 && assigned.length === safeMembers.length;
          const isUnassigned = assigned.length === 0;
          if (isUnassigned || wasAssignedToAll) {
            return {
              ...item,
              assignedMemberIds: updatedMembers.map((m) => m.id),
            };
          }
          return item;
        });
        const updatedBill = {
          ...currentBill,
          members: updatedMembers,
          items: updatedItems,
          paidByMemberId: currentBill.paidByMemberId || newMember.id,
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
      },

      removeMember: (memberId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const safeMembers = Array.isArray(currentBill.members) ? currentBill.members : [];
        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        const updatedMembers = safeMembers.filter((m) => m.id !== memberId);
        const updatedItems = safeItems.map((item) => ({
          ...item,
          assignedMemberIds: (item.assignedMemberIds || []).filter((id) => id !== memberId),
        }));
        const updatedBill = {
          ...currentBill,
          members: updatedMembers,
          items: updatedItems,
          paidByMemberId:
            currentBill.paidByMemberId === memberId
              ? updatedMembers[0]?.id || ''
              : currentBill.paidByMemberId,
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
      },

      updateMember: (memberId: string, updates: Partial<Member>) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const safeMembers = Array.isArray(currentBill.members) ? currentBill.members : [];
        const updatedBill = {
          ...currentBill,
          members: safeMembers.map((m) =>
            m.id === memberId ? { ...m, ...updates } : m
          ),
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
      },

      saveCurrentMembersAsGroup: (name: string, selectedMembers?: Omit<Member, 'id'>[]) => {
        const { currentBill, savedGroups } = get();
        if (!name.trim()) return;
        const groupMembers: Omit<Member, 'id'>[] = selectedMembers ?? (currentBill?.members || []).map((m) => ({
          name: m.name,
          avatarColor: m.avatarColor,
          avatar_url: m.avatar_url,
          bank_name: m.bank_name,
          account_number: m.account_number,
          account_holder: m.account_holder,
          phone_number: m.phone_number,
          russia_bank: m.russia_bank,
          custom_qr_url: m.custom_qr_url,
          russia_account_holder: m.russia_account_holder || '',
          russia_qr_url: m.russia_qr_url || '',
          bankInfo: m.bankInfo,
        }));
        if (!groupMembers.length) return;
        const newGroup: MemberGroup = {
          id: generateId(),
          name: name.trim(),
          members: groupMembers,
          createdAt: new Date().toISOString(),
        };
        const updated = [newGroup, ...savedGroups];
        set({ savedGroups: updated });
        void get().syncGroupsToCloud(updated, true);
      },

      applyGroupToBill: (groupId: string) => {
        const { currentBill, savedGroups } = get();
        if (!currentBill || currentBill.isSharedBill) return;
        const group = savedGroups.find((g) => g.id === groupId);
        if (!group || !Array.isArray(group.members) || group.members.length === 0) return;
        const user = useAuthStore.getState().user;
        const profile = useProfileStore.getState().profile;
        const myId = user?.id || profile?.id || USER_SELF_ID;
        const myName = (profile?.display_name || user?.user_metadata?.display_name || '').trim().toLowerCase();
        const myLatestAvatar = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';
        const safeMembers = Array.isArray(currentBill.members) ? currentBill.members : [];
        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        const currentMemberNames = new Set(
          safeMembers.map((m) => (m.name || '').trim().toLowerCase())
        );
        const newMembersToAdd: Member[] = [];
        group.members.forEach((gm, idx) => {
          const rawName = (gm.name || '').trim();
          if (!rawName) return;
          if (currentMemberNames.has(rawName.toLowerCase())) return;
          const isMe = myName && rawName.toLowerCase() === myName;
          newMembersToAdd.push({
            id: isMe ? myId : generateId(),
            name: isMe && profile?.display_name ? profile.display_name : rawName,
            avatarColor:
              gm.avatarColor ||
              AVATAR_COLORS[(safeMembers.length + idx) % AVATAR_COLORS.length],
            avatar_url: isMe ? (myLatestAvatar || gm.avatar_url || '') : (gm.avatar_url || ''),
            bank_name: isMe ? (profile?.bank_name || gm.bank_name || '') : (gm.bank_name || ''),
            account_number: isMe ? (profile?.account_number || gm.account_number || '') : (gm.account_number || ''),
            account_holder: isMe ? (profile?.account_holder || gm.account_holder || '') : (gm.account_holder || ''),
            phone_number: isMe ? (profile?.phone_number || gm.phone_number || '') : (gm.phone_number || ''),
            russia_bank: isMe ? (profile?.russia_bank || gm.russia_bank || '') : (gm.russia_bank || ''),
            custom_qr_url: isMe ? (profile?.custom_qr_url || gm.custom_qr_url || '') : (gm.custom_qr_url || ''),
            russia_account_holder: isMe ? (profile?.russia_account_holder || '') : (gm.russia_account_holder || ''),
            russia_qr_url: isMe ? (profile?.russia_qr_url || '') : (gm.russia_qr_url || ''),
            bankInfo: gm.bankInfo,
          });
          currentMemberNames.add(rawName.toLowerCase());
        });

        const syncedExistingMembers = safeMembers.map((m) => {
          const isMe = m.id === myId || m.id === USER_SELF_ID || (myName && m.name.trim().toLowerCase() === myName);
          if (!isMe) return m;
          return {
            ...m,
            avatar_url: myLatestAvatar || m.avatar_url,
          };
        });
        const updatedMembers = [...syncedExistingMembers, ...newMembersToAdd];
        const updatedItems = safeItems.map((item) => {
          const assigned = Array.isArray(item.assignedMemberIds) ? item.assignedMemberIds : [];
          const wasAssignedToAll = safeMembers.length > 0 && assigned.length === safeMembers.length;
          const isUnassigned = assigned.length === 0;
          if (isUnassigned || wasAssignedToAll) {
            return {
              ...item,
              assignedMemberIds: updatedMembers.map((m) => m.id),
            };
          }
          return item;
        });
        const updatedBill = {
          ...currentBill,
          members: updatedMembers,
          items: updatedItems,
          paidByMemberId: currentBill.paidByMemberId || updatedMembers[0]?.id || '',
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      deleteGroup: (groupId: string) => {
        const { savedGroups } = get();
        const updated = savedGroups.filter((g) => g.id !== groupId);
        set({ savedGroups: updated });
        void get().syncGroupsToCloud(updated);
      },

      addItem: (item: Omit<ExpenseItem, 'id'>) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        const newItem: ExpenseItem = {
          ...item,
          id: generateId(),
        };
        const updatedBill = {
          ...currentBill,
          items: [...safeItems, newItem],
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      updateItem: (itemId: string, updates: Partial<ExpenseItem>) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        const updatedBill = {
          ...currentBill,
          items: safeItems.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
          ),
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      removeItem: (itemId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        const updatedBill = {
          ...currentBill,
          items: safeItems.filter((item) => item.id !== itemId),
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      clearAllItems: () => {
        const { currentBill } = get();
        if (!currentBill) return;
        const updatedBill = {
          ...currentBill,
          items: [],
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      toggleMemberOnItem: (itemId: string, memberId: string) => {
        lastLocalMutationTime = Date.now(); // Đánh dấu vừa thao tác cục bộ
        const { currentBill } = get();
        if (!currentBill) return;
        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        const updatedBill = {
          ...currentBill,
          items: safeItems.map((item) => {
            if (item.id !== itemId) return item;
            const assigned = Array.isArray(item.assignedMemberIds) ? item.assignedMemberIds : [];
            const isAssigned = assigned.includes(memberId);
            return {
              ...item,
              assignedMemberIds: isAssigned
                ? assigned.filter((id) => id !== memberId)
                : [...assigned, memberId],
            };
          }),
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      assignAllMembersToItem: (itemId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;
        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        const safeMembers = Array.isArray(currentBill.members) ? currentBill.members : [];
        const updatedBill = {
          ...currentBill,
          items: safeItems.map((item) =>
            item.id === itemId
              ? { ...item, assignedMemberIds: safeMembers.map((m) => m.id) }
              : item
          ),
        };
        set((state) => ({ currentBill: updatedBill, history: withBillInHistory(state, updatedBill) }));
        void get().saveBillToCloud(updatedBill);
      },

      saveBillToHistory: async () => {
        const { currentBill, history } = get();
        if (!currentBill) return;
        const existingIndex = history.findIndex((b) => b.id === currentBill.id);
        const updatedHistory =
          existingIndex >= 0
            ? history.map((b, i) => (i === existingIndex ? currentBill : b))
            : [currentBill, ...history];
        set({ history: updatedHistory });
        const user = useAuthStore.getState().user;
        if (user) {
          await get().saveBillToCloud(currentBill);
        }
      },

      loadBillFromHistory: async (billId: string) => {
        const { history, sharedBills } = get();
        const bill = history.find((b) => b.id === billId)
          || sharedBills.find((b) => b.id === billId || b.shareId === billId);
        if (bill) {
          const userId = useAuthStore.getState().user?.id;
          const ownerId = bill.user_id || (history.some((item) => item.id === bill.id) ? userId : undefined);
          const isOwnedBill = Boolean(userId && ownerId === userId);
          set({
            currentBill: {
              ...bill,
              user_id: ownerId,
              isSharedBill: isOwnedBill ? false : Boolean(bill.isSharedBill && ownerId && userId && ownerId !== userId),
              mode: bill.mode || (bill.expenses && bill.expenses.length > 0 ? 'TIMELINE' : 'SINGLE'),
              expenses: Array.isArray(bill.expenses) ? bill.expenses : [],
              items: Array.isArray(bill.items) ? bill.items : [],
              members: Array.isArray(bill.members) ? bill.members : [],
            },
          });
          return;
        }

        const user = useAuthStore.getState().user;
        if (!user || !supabase) return;
        const { data: ownedBill, error: ownedError } = await supabase.from('bills').select('*').eq('id', billId).maybeSingle();
        if (ownedError) return;
        let data = ownedBill;
        let shareId: string | undefined;
        if (!data) {
          const { data: shareRow, error: shareError } = await supabase.from('bill_shares')
            .select('id, bill:bills (*)').eq('id', billId).eq('receiver_id', user.id).maybeSingle();
          if (shareError) return;
          data = shareRow?.bill as any;
          shareId = shareRow?.id;
        }
        if (!data) return;
        const raw = (data as any).data || data;
        const loadedBill: BillSession = {
          ...(raw as BillSession),
          id: data.id,
          user_id: data.user_id,
          isSharedBill: data.user_id !== user.id,
          shareId: data.user_id !== user.id ? (shareId || billId) : undefined,
        };
        set((state) => ({
          currentBill: loadedBill,
          history: loadedBill.isSharedBill ? state.history : withBillInHistory(state, loadedBill),
        }));
      },

      deleteBillFromHistory: async (billId: string) => {
        const { history } = get();
        set({ history: history.filter((b) => b.id !== billId) });
        const user = useAuthStore.getState().user;
        if (user) {
          await get().deleteBillFromCloud(billId);
        }
      },

      fetchUserBills: async (force = false) => {
        const user = useAuthStore.getState().user;
        if (!user || !supabase) return;

        const now = Date.now();
        const hasHistory = get().history.length > 0;
        if (isFetchingBills) return;
        // Chỉ cooldown khi store đã có dữ liệu. State rỗng luôn phải được hydrate từ cloud.
        if (!force && hasHistory && now - lastFetchBillsTime < FETCH_BILLS_COOLDOWN_MS) return;
        if (!force && hasHistory && now - getSessionSyncTime(BILLS_SYNC_TIME_KEY, user.id) < FETCH_BILLS_COOLDOWN_MS) return;

        // Không chặn thao tác Đồng bộ chủ động bởi khóa chống dội ngược.
        if (!force && hasHistory && Date.now() - lastLocalMutationTime < 4000) {
          return;
        }

        isFetchingBills = true;
        setSessionSyncTime(BILLS_SYNC_TIME_KEY, user.id);
          // The bill payload is authoritative. Keep summary only as optional metadata.
          const normalizeBillRow = (row: any): BillSession => {
            const raw = row?.data && typeof row.data === 'object' ? row.data : {};
            return {
              ...(raw as BillSession),
              id: row?.id || raw.id || generateId(),
              user_id: row?.user_id,
              title: raw.title || row?.title || 'Hóa đơn',
              date: raw.date || row?.created_at || new Date().toISOString(),
              currency: raw.currency || row?.summary?.currency || 'VND',
              mode: raw.mode || (Array.isArray(raw.expenses) && raw.expenses.length > 0 ? 'TIMELINE' : 'SINGLE'),
              items: Array.isArray(raw.items) ? raw.items : [],
              expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
              members: Array.isArray(raw.members) ? raw.members : [],
              timelineMembers: Array.isArray(raw.timelineMembers) ? raw.timelineMembers : [],
              transfer_confirmations: row?.transfer_confirmations ?? raw.transfer_confirmations ?? {},
              settled_transfers: row?.settled_transfers ?? raw.settled_transfers ?? [],
            };
          };

        try {
          const { data: myBillsData, error: myError } = await supabase
            .from('bills')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (myError) throw myError;

          const { data: sharedData, error: sharedError } = await supabase
            .from('bill_shares')
            .select('id, bill:bills (*), sender:profiles!sender_id (display_name)')
            .eq('receiver_id', user.id);
          if (sharedError) throw sharedError;

          const myBills = normalizeHistoryBills((myBillsData || [])
            .map((row) => ({ ...normalizeBillRow(row), user_id: user.id, isSharedBill: false })))
            .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

          const sharedBillsList = (sharedData || [])
            .filter((item: any) => Boolean(item.bill))
            .map((item: any) => ({
              ...normalizeBillRow(item.bill),
              user_id: item.bill.user_id,
              shareId: item.id,
              sharedBy: item.sender?.display_name || 'Bạn bè',
              isSharedBill: item.bill.user_id !== user.id,
            }));

          // Keep the active bill untouched if a local edit happened during the fetch.
          if (Date.now() - lastLocalMutationTime < 4000) {
            set({ history: myBills, sharedBills: sharedBillsList, isSyncing: false });
            return;
          }

          const activeBill = get().currentBill;
          let refreshedCurrentBill = activeBill;
          if (activeBill) {
            const matchedCloudBill =
              myBills.find((b) => b.id === activeBill.id) ||
              sharedBillsList.find((b) => b.id === activeBill.id);
            if (matchedCloudBill) {
              refreshedCurrentBill = {
                ...matchedCloudBill,
                currency: activeBill.currency || matchedCloudBill.currency,
                transfer_confirmations:
                  matchedCloudBill.transfer_confirmations ?? activeBill.transfer_confirmations ?? {},
                settled_transfers:
                  matchedCloudBill.settled_transfers ?? activeBill.settled_transfers ?? [],
              };
            }
          }

          set({
            history: myBills,
            sharedBills: sharedBillsList,
            currentBill: refreshedCurrentBill,
            isSyncing: false,
          });
        } catch (err) {
          set({
            isSyncing: false,
            syncError: err instanceof Error ? err.message : 'Lỗi đồng bộ',
          });
        } finally {
          isFetchingBills = false;
          lastFetchBillsTime = Date.now();
        }
      },

      saveBillToCloud: async (billToSave?: BillSession) => {
        const targetBill = billToSave || get().currentBill;
        const user = useAuthStore.getState().user;
        if (!user || !supabase || !targetBill || targetBill.isSharedBill) return;
        if ((!targetBill.items || targetBill.items.length === 0) && (!targetBill.members || targetBill.members.length <= 1)) return;
        const fingerprint = (bill: BillSession) => JSON.stringify({ id: bill.id, user_id: user.id, title: bill.title || 'Hóa đơn', data: { ...bill, currency: bill.currency || 'VND', mode: bill.mode || (bill.expenses?.length ? 'TIMELINE' : 'SINGLE'), expenses: Array.isArray(bill.expenses) ? bill.expenses : [] }, transfer_confirmations: bill.transfer_confirmations || {}, settled_transfers: bill.settled_transfers || [] });
        const initialFingerprint = fingerprint(targetBill);
        if (persistedBillFingerprints.get(`${user.id}:${targetBill.id}`) === initialFingerprint) return;
        lastLocalMutationTime = Date.now(); // Gia hạn khóa chống ghi đè

        if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);

        cloudSyncTimeout = setTimeout(async () => {
          if (!supabase) return;
          try {
            lastLocalMutationTime = Date.now();
            // Lưu ngầm trong nền (Silent Background Sync), KHÔNG bật/tắt isSyncing liên tục để tránh nháy thông báo sao lưu
            const latestBill = get().currentBill?.id === targetBill.id ? get().currentBill! : targetBill;
            const cleanBill: BillSession = {
              ...latestBill,
              currency: latestBill.currency || 'VND',
              mode: latestBill.mode || (latestBill.expenses && latestBill.expenses.length > 0 ? 'TIMELINE' : 'SINGLE'),
              expenses: Array.isArray(latestBill.expenses) ? latestBill.expenses : [],
            };
            const timelineExpenses = cleanBill.expenses || [];
            const billsToSummarize: BillSession[] = cleanBill.mode === 'TIMELINE' && timelineExpenses.length > 0
              ? timelineExpenses.map((expense) => ({
                ...cleanBill,
                items: expense.items || [],
                taxPercent: expense.taxPercent,
                tipPercent: expense.tipPercent,
              }))
              : [cleanBill];
            const total = billsToSummarize.reduce((sum, billPart) => {
              const subtotal = (billPart.items || []).reduce((itemSum, item) =>
                itemSum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
              return sum + subtotal
                + subtotal * ((Number(billPart.taxPercent) || 0) / 100)
                + subtotal * ((Number(billPart.tipPercent) || 0) / 100);
            }, 0);
            const summary = {
              title: cleanBill.title || 'Hóa đơn',
              currency: cleanBill.currency,
              total,
              memberCount: (cleanBill.mode === 'TIMELINE' ? cleanBill.timelineMembers || cleanBill.members : cleanBill.members).length,
            };
            const finalFingerprint = fingerprint(cleanBill);
            if (persistedBillFingerprints.get(`${user.id}:${cleanBill.id}`) === finalFingerprint) return;
            const { error } = await supabase.from('bills').upsert({
              id: cleanBill.id,
              user_id: user.id,
              title: cleanBill.title || 'Hóa đơn',
              data: stripBase64Images(cleanBill),
              summary,
              transfer_confirmations: cleanBill.transfer_confirmations || {},
              settled_transfers: cleanBill.settled_transfers || [],
              updated_at: new Date().toISOString(),
            });
            if (error) throw error;
            persistedBillFingerprints.set(`${user.id}:${cleanBill.id}`, finalFingerprint);
          } catch (err) {
            console.error('Lỗi lưu cloud ngầm:', err);
          }
        }, 800);
      },

      updateGlobalDisplayName: async (newName: string) => {
        const user = useAuthStore.getState().user;
        if (!newName.trim()) return;
        const trimmed = newName.trim();
        const myId = user?.id || USER_SELF_ID;
        const myEmail = user?.email?.toLowerCase().trim();
        let targetBillToSave: BillSession | null = null;
        set((state) => {
          let updatedCurrentBill = state.currentBill;
          if (updatedCurrentBill) {
            const updatedMembers = updatedCurrentBill.members.map((m) => {
              const isMe =
                m.id === myId ||
                (myEmail && (m as any).email?.toLowerCase().trim() === myEmail) ||
                m.name === 'Tôi' ||
                m.name.toLowerCase().includes('tuân') ||
                m.name.toLowerCase().includes('tuan');
              return isMe ? { ...m, name: trimmed } : m;
            });
            updatedCurrentBill = { ...updatedCurrentBill, members: updatedMembers };
            targetBillToSave = updatedCurrentBill;
          }
          const updatedHistory = state.history.map((bill) => {
            const updatedMembers = bill.members.map((m) => {
              const isMe =
                m.id === myId ||
                (myEmail && (m as any).email?.toLowerCase().trim() === myEmail) ||
                m.name === 'Tôi' ||
                m.name.toLowerCase().includes('tuân') ||
                m.name.toLowerCase().includes('tuan');
              return isMe ? { ...m, name: trimmed } : m;
            });
            return { ...bill, members: updatedMembers };
          });
          const updatedGroups = state.savedGroups.map((g) => ({
            ...g,
            members: g.members.map((m) => {
              const isMe =
                (myEmail && (m as any).email?.toLowerCase().trim() === myEmail) ||
                m.name === 'Tôi' ||
                m.name.toLowerCase().includes('tuân') ||
                m.name.toLowerCase().includes('tuan');
              return isMe ? { ...m, name: trimmed } : m;
            }),
          }));
          return {
            currentBill: updatedCurrentBill,
            history: updatedHistory,
            savedGroups: updatedGroups,
          };
        });

        if (user && supabase) {
          try {
            const billToSync: BillSession | null = targetBillToSave;
            if (billToSync && !Boolean((billToSync as any).isSharedBill)) {
              void get().saveBillToCloud(billToSync);
            }
          } catch (err) {
            console.error('Lỗi lưu đồng bộ tên lên Cloud:', err);
          }
        }
      },

      deleteBillFromCloud: async (billId: string) => {
        if (!supabase) return;
        set({ isSyncing: true, syncError: null });
        try {
          const { error } = await supabase.from('bills').delete().eq('id', billId);
          if (error) throw error;
          set({ isSyncing: false });
        } catch (err) {
          set({
            syncError:
              'Lỗi xóa cloud: ' +
              (err instanceof Error ? err.message : 'Lỗi không xác định'),
            isSyncing: false,
          });
        }
      },

      toggleTheme: () => {
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
      },

      resetCurrentBill: () => {
        const defaultMember = getCurrentUserMember();
        const emptyBill = createEmptyBill();
        set({
          currentBill: {
            ...emptyBill,
            members: [defaultMember],
            paidByMemberId: defaultMember.id,
          },
        });
      },

      resetSessionState: () => {
        if (cloudSyncTimeout) {
          clearTimeout(cloudSyncTimeout);
          cloudSyncTimeout = null;
        }
        lastLocalMutationTime = 0;
        set({
          currentBill: null,
          history: [],
          savedGroups: [],
          sharedBills: [],
          isSyncing: false,
          syncError: null,
        });
        try {
          window.localStorage.removeItem('fairshare-storage');
        } catch {
          // localStorage có thể bị chặn trong private browsing.
        }
      },

      importBillFromURL: (encodedData: string) => {
        try {
          const json = decodeURIComponent(escape(atob(encodedData)));
          const bill = JSON.parse(json) as BillSession;
          if (
            !bill.id ||
            !bill.title ||
            !Array.isArray(bill.members) ||
            !Array.isArray(bill.items)
          ) {
            console.error('Invalid bill data structure');
            return false;
          }
          set({ currentBill: bill });
          return true;
        } catch (error) {
          console.error('Failed to import bill:', error);
          return false;
        }
      },
    }),
    {
      name: 'fairshare-storage',
      storage: safeLocalStorage,
      partialize: (state) => ({
        currentBill: sanitizeBillForLocalStorage(state.currentBill),
        currency: state.currentBill?.currency ?? 'VND',
        history: state.history.slice(0, 5).map((bill) => sanitizeBillForLocalStorage(bill)),
        savedGroups: stripBase64Images(state.savedGroups),
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (Array.isArray(state.savedGroups)) {
          state.savedGroups = sanitizeGroups(state.savedGroups);
        }
        if (Array.isArray(state.history)) {
          state.history = state.history.map((b) => ({
            ...b,
            mode: b?.mode || (Array.isArray(b?.expenses) && b.expenses.length > 0 ? 'TIMELINE' : 'SINGLE'),
            expenses: Array.isArray(b?.expenses) ? b.expenses : [],
            items: Array.isArray(b?.items) ? b.items : [],
            members: Array.isArray(b?.members) ? b.members : [],
          }));
        } else {
          state.history = [];
        }
        if (!state.currentBill) return;
        state.currentBill.mode =
          state.currentBill.mode ||
          (Array.isArray(state.currentBill.expenses) && state.currentBill.expenses.length > 0 ? 'TIMELINE' : 'SINGLE');
        state.currentBill.expenses = Array.isArray(state.currentBill.expenses) ? state.currentBill.expenses : [];
        if (!Array.isArray(state.currentBill.items)) {
          state.currentBill.items = [];
        }
        const members = state.currentBill.members;
        if (!Array.isArray(members) || members.length === 0) {
          const defaultMember = getCurrentUserMember();
          state.currentBill.members = [defaultMember];
          state.currentBill.paidByMemberId = defaultMember.id;
          return;
        }
        const seenNames = new Set<string>();
        const uniqueMembers: Member[] = [];
        for (const m of members) {
          if (!m) continue;
          const isMe = m.id === USER_SELF_ID || m.name === 'Tôi';
          if (isMe) {
            if (!seenNames.has('__ME__')) {
              seenNames.add('__ME__');
              uniqueMembers.push(m);
            }
          } else {
            uniqueMembers.push(m);
          }
        }
        state.currentBill.members = uniqueMembers;
      },
    }
  )
);