import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BillSession, BillExpense, BillMode, Member, ExpenseItem, CurrencyCode, MemberGroup, BillCategory } from '../types/bill';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
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
  syncGroupsToCloud: (groups?: MemberGroup[]) => Promise<void>;
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
  loadBillFromHistory: (billId: string) => void;
  deleteBillFromHistory: (billId: string) => Promise<void>;
  // Cloud Sync
  fetchUserBills: () => Promise<void>;
  saveBillToCloud: (bill?: BillSession) => Promise<void>;
  deleteBillFromCloud: (billId: string) => Promise<void>;
  // Global Update
  updateGlobalDisplayName: (newName: string) => Promise<void>;
  // Theme
  toggleTheme: () => void;
  // Reset
  resetCurrentBill: () => void;
  // URL Sharing
  exportBillToURL: () => string;
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
    russia_bank: profile?.russia_bank || 'sber',
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
});

const withBillInHistory = (state: Pick<BillState, 'history'>, bill: BillSession): BillSession[] => {
  if (!Array.isArray(state.history)) return [];
  return state.history.map((savedBill) => (savedBill.id === bill.id ? bill : savedBill));
};

// Biến timer phục vụ cơ chế Debounce đồng bộ Cloud
// Đặt 2 biến này ngay phía trên export const useBillStore = create<BillState>()(
let cloudSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let lastLocalMutationTime = 0; // Khóa chống dội ngược từ Realtime Supabase

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
            data: billToStore,
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
            const { error: shareInsertError } = await supabase.from('bill_shares').insert(newShares);
            if (shareInsertError) throw shareInsertError;

            const senderName =
              useProfileStore.getState().profile?.display_name ||
              user.user_metadata?.display_name ||
              'Bạn bè';
            const notifications = newShares.map((s) => ({
              user_id: s.receiver_id,
              type: 'bill_shared',
              description: `${senderName} đã chia sẻ hóa đơn "${billToStore.title || 'Hóa đơn'}" với bạn.`,
              data: { billId: cloudBillId },
              is_read: false,
              created_at: new Date().toISOString(),
            }));
            await supabase.from('notifications').insert(notifications);
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

        // Đảo trạng thái (Nếu đang true thì thành false để HỦY XÁC NHẬN)
        const updatedStatus = role === 'payer' ? !current.payerConfirmed : !current.receiverConfirmed;
        const newConfirmation = {
          ...current,
          ...(role === 'payer'
            ? { payerConfirmed: updatedStatus }
            : { receiverConfirmed: updatedStatus }),
        };

        const updatedConfirmations = {
          ...(currentBill.transfer_confirmations ?? {}),
          [transferKey]: newConfirmation,
        };

        const currentSettled = Array.isArray(currentBill.settled_transfers)
          ? currentBill.settled_transfers
          : [];

        // Nếu người nhận xác nhận -> thêm vào settled; nếu người nhận HỦY -> xóa khỏi settled
        const settledTransfers = newConfirmation.receiverConfirmed
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
          await supabase
            .from('bills')
            .update({
              transfer_confirmations: updatedConfirmations,
              settled_transfers: settledTransfers,
              data: updatedBill,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentBill.id);

          // Bắn thông báo nếu người chuyển báo đã gửi tiền
          if (role === 'payer' && newConfirmation.payerConfirmed) {
            const currentUser = useAuthStore.getState().user;
            const currentProfile = useProfileStore.getState().profile;
            const senderName = currentProfile?.display_name || currentUser?.user_metadata?.display_name || 'Bạn bè';
            const receiverMemberId = currentBill.paidByMemberId;

            if (receiverMemberId && receiverMemberId !== currentUser?.id) {
              await supabase.from('notifications').insert({
                user_id: receiverMemberId,
                type: 'transfer_reported',
                description: `${senderName} đã báo chuyển tiền cho hóa đơn "${currentBill.title || 'Hóa đơn'}".`,
                data: { billId: currentBill.id, transferKey },
                is_read: false,
                created_at: new Date().toISOString(),
              });
            }
          }
        } catch (err) {
          console.error('Lỗi cập nhật xác nhận chuyển khoản:', err);
        }
      },

      syncGroupsToCloud: async (groupsToSync?: MemberGroup[]) => {
        const user = useAuthStore.getState().user;
        if (!user || !supabase) return;
        const groups = groupsToSync ?? get().savedGroups;
        try {
          await supabase.from('profiles').update({ member_groups: groups }).eq('id', user.id);
        } catch (err) {
          console.error('Lỗi lưu nhóm lên cloud:', err);
        }
      },

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
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('member_groups')
            .eq('id', user.id)
            .single();
          if (error) throw error;
          const cloudGroups = (data?.member_groups as MemberGroup[]) || [];
          const localGroups = get().savedGroups;
          const groupMap = new Map<string, MemberGroup>();
          localGroups.forEach((g) => groupMap.set(g.id, g));
          cloudGroups.forEach((g) => groupMap.set(g.id, g));
          const mergedGroups = Array.from(groupMap.values());
          set({ savedGroups: mergedGroups });
          if (mergedGroups.length !== cloudGroups.length) {
            void get().syncGroupsToCloud(mergedGroups);
          }
        } catch (err) {
          console.error('Lỗi tải nhóm từ cloud:', err);
        }
      },


      syncProfileToMember: () => {
        const { currentBill, savedGroups } = get();
        const profile = useProfileStore.getState().profile;
        const user = useAuthStore.getState().user;
        if (!profile && !user) return;
        const myId = user?.id || profile?.id || USER_SELF_ID;
        const pName = (profile?.display_name || user?.user_metadata?.display_name || '').trim().toLowerCase();
        const latestAvatar =
          profile?.avatar_url ||
          user?.user_metadata?.avatar_url ||
          user?.user_metadata?.picture ||
          '';
        const isMeMember = (m: { id?: string; name?: string }) => {
          const n = (m.name || '').trim().toLowerCase();
          return (
            m.id === myId ||
            m.id === USER_SELF_ID ||
            (pName && n === pName) ||
            n === 'tôi'
          );
        };

        let groupsUpdated = false;
        const updatedGroups = savedGroups.map((g) => ({
          ...g,
          members: g.members.map((gm) => {
            if (!isMeMember(gm)) return gm;
            if (gm.avatar_url !== latestAvatar || (profile?.display_name && gm.name !== profile.display_name)) {
              groupsUpdated = true;
              return {
                ...gm,
                name: profile?.display_name || gm.name,
                avatar_url: latestAvatar || gm.avatar_url,
              };
            }
            return gm;
          }),
        }));
        if (groupsUpdated) {
          set({ savedGroups: updatedGroups });
          void get().syncGroupsToCloud(updatedGroups);
        }

        if (!currentBill || currentBill.isSharedBill || !Array.isArray(currentBill.members)) return;
        let matchedMeOnce = false;
        const updatedMembers: Member[] = [];
        const seenIds = new Set<string>();
        for (const m of currentBill.members) {
          if (!m) continue;
          if (isMeMember(m)) {
            if (matchedMeOnce) continue;
            matchedMeOnce = true;
            seenIds.add(myId);
            updatedMembers.push({
              ...m,
              id: myId,
              name: profile?.display_name || m.name,
              avatar_url: latestAvatar || m.avatar_url,
              bank_name: profile?.bank_name || '',
              account_number: profile?.account_number || '',
              account_holder: profile?.account_holder || '',
              phone_number: profile?.phone_number || '',
              russia_bank: profile?.russia_bank || 'sber',
              custom_qr_url: profile?.custom_qr_url || '',
              russia_account_holder: profile?.russia_account_holder || '',
              russia_qr_url: profile?.russia_qr_url || '',
            });
          } else {
            const safeId = seenIds.has(m.id) ? generateId() : m.id;
            seenIds.add(safeId);
            updatedMembers.push({ ...m, id: safeId });
          }
        }
        const updatedBill: BillSession = {
          ...currentBill,
          members: updatedMembers,
          paidByMemberId:
            currentBill.paidByMemberId === USER_SELF_ID || !seenIds.has(currentBill.paidByMemberId)
              ? updatedMembers[0]?.id || myId
              : currentBill.paidByMemberId,
        };
        set((state) => ({
          currentBill: updatedBill,
          history: withBillInHistory(state, updatedBill),
        }));
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
              russia_bank: profile.russia_bank ?? m.russia_bank ?? 'sber',
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

      setBillMode: (mode: BillMode) => {
        const { currentBill } = get();
        if (!currentBill) return;
        if (mode === 'TIMELINE' && (!Array.isArray(currentBill.expenses) || currentBill.expenses.length === 0)) {
          const members = Array.isArray(currentBill.members) ? currentBill.members : [];
          const firstExpense: BillExpense = {
            id: crypto.randomUUID(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            title: currentBill.title || 'Chặng 1',
            payerId: currentBill.paidByMemberId || members[0]?.id || '',
            participantIds: members.map((member) => member.id),
            items: Array.isArray(currentBill.items) ? currentBill.items : [],
            taxPercent: currentBill.taxPercent,
            tipPercent: currentBill.tipPercent,
          };
          const updatedBill = { ...currentBill, mode, expenses: [firstExpense] };
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
        const members = Array.isArray(currentBill.members) ? currentBill.members : [];
        const currentExpenses = Array.isArray(currentBill.expenses) ? currentBill.expenses : [];
        const newExpense: BillExpense = {
          id: crypto.randomUUID(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          title: `Chặng ${currentExpenses.length + 1}`,
          payerId: members[0]?.id || '',
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
                russia_bank: profile.russia_bank || 'sber',
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
        void get().saveBillToCloud(updatedBill);
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
        void get().saveBillToCloud(updatedBill);
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
        void get().saveBillToCloud(updatedBill);
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
        void get().syncGroupsToCloud(updated);
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
            russia_bank: isMe ? (profile?.russia_bank || gm.russia_bank || 'sber') : (gm.russia_bank || 'sber'),
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

      loadBillFromHistory: (billId: string) => {
        const { history, sharedBills } = get();
        const bill = history.find((b) => b.id === billId) || sharedBills.find((b) => b.id === billId);
        if (bill) {
          set({
            currentBill: {
              ...bill,
              mode: bill.mode || (bill.expenses && bill.expenses.length > 0 ? 'TIMELINE' : 'SINGLE'),
              expenses: Array.isArray(bill.expenses) ? bill.expenses : [],
              items: Array.isArray(bill.items) ? bill.items : [],
              members: Array.isArray(bill.members) ? bill.members : [],
            },
          });
        }
      },

      deleteBillFromHistory: async (billId: string) => {
        const { history } = get();
        set({ history: history.filter((b) => b.id !== billId) });
        const user = useAuthStore.getState().user;
        if (user) {
          await get().deleteBillFromCloud(billId);
        }
      },

      fetchUserBills: async () => {
        const user = useAuthStore.getState().user;
        if (!user || !supabase) return;

        // NẾU NGƯỜI DÙNG VỪA BẤM TRÊN GIAO DIỆN TRONG VÒNG 4 GIÂY QUA -> BỎ QUA REALTIME FETCH ĐỂ KHÔNG BỊ GIẬT NGƯỢC STATE!
        if (Date.now() - lastLocalMutationTime < 4000) {
          return;
        }

        void get().fetchUserGroups();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalizeBillRow = (row: any): BillSession => {
          const raw = row?.data || row?.bill_data || row || {};
          return {
            id: row?.id || raw?.id || generateId(),
            title: raw?.title || row?.title || 'Hóa đơn',
            date: raw?.date || row?.created_at || new Date().toISOString(),
            currency: raw?.currency || 'VND',
            category: (raw?.category || row?.category || 'dining') as BillCategory,
            mode: raw?.mode || (Array.isArray(raw?.expenses) && raw.expenses.length > 0 ? 'TIMELINE' : 'SINGLE'),
            expenses: Array.isArray(raw?.expenses) ? raw.expenses : [],
            items: Array.isArray(raw?.items) ? raw.items : [],
            members: Array.isArray(raw?.members) ? raw.members : [],
            taxPercent: typeof raw?.taxPercent === 'number' ? raw.taxPercent : 0,
            tipPercent: typeof raw?.tipPercent === 'number' ? raw.tipPercent : 0,
            paidByMemberId: raw?.paidByMemberId || '',
            splitMode: raw?.splitMode || 'ITEMIZED',
            isSharedBill: Boolean(raw?.isSharedBill),
            shareId: raw?.shareId,
            sharedBy: raw?.sharedBy,
            transfer_confirmations:
              row?.transfer_confirmations ??
              raw?.transfer_confirmations ??
              {},
            settled_transfers:
              row?.settled_transfers ??
              raw?.settled_transfers ??
              [],
          };
        };

        try {
          const { data: myBillsData, error: myError } = await supabase
            .from('bills')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          if (myError) throw myError;

          const { data: sharedData } = await supabase
            .from('bill_shares')
            .select(`
              id,
              sender_id,
              bill:bills (*),
              sender:profiles!sender_id (display_name)
            `)
            .eq('receiver_id', user.id);

          const myBills = (myBillsData || [])
            .map((b) => normalizeBillRow(b))
            .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

          const sharedBillsList = (sharedData || [])
            .filter((item: any) => Boolean(item.bill))
            .map((item: any) => ({
              ...normalizeBillRow(item.bill),
              shareId: item.id,
              sharedBy: item.sender?.display_name || 'Bạn bè',
              isSharedBill: true,
            }));

          // Kiểm tra lại một lần nữa trước khi set state: nếu người dùng vừa bấm trong lúc đang tải mạng thì giữ nguyên currentBill của người dùng
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
        }
      },

      saveBillToCloud: async (billToSave?: BillSession) => {
        lastLocalMutationTime = Date.now(); // Gia hạn khóa chống ghi đè
        const targetBill = billToSave || get().currentBill;
        const user = useAuthStore.getState().user;
        if (!user || !supabase || !targetBill || targetBill.isSharedBill) return;

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
            const { error } = await supabase.from('bills').upsert({
              id: cleanBill.id,
              user_id: user.id,
              title: cleanBill.title || 'Hóa đơn',
              data: cleanBill,
              transfer_confirmations: cleanBill.transfer_confirmations || {},
              settled_transfers: cleanBill.settled_transfers || [],
              updated_at: new Date().toISOString(),
            });
            if (error) throw error;
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
            void get().syncGroupsToCloud();
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

      exportBillToURL: () => {
        const { currentBill } = get();
        if (!currentBill) return '';
        try {
          const json = JSON.stringify(currentBill);
          const base64 = btoa(unescape(encodeURIComponent(json)));
          const url = `${window.location.origin}${window.location.pathname}?bill=${base64}`;
          return url;
        } catch (error) {
          console.error('Failed to export bill:', error);
          return '';
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
      partialize: (state) => ({
        currentBill: state.currentBill,
        history: state.history,
        savedGroups: state.savedGroups,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
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