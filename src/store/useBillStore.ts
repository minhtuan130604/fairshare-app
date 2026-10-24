import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BillSession, Member, ExpenseItem, CurrencyCode, MemberGroup } from '../types/bill';
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

  // Actions
  initializeNewBill: () => void;
  loadDemoData: () => void;
  updateBillTitle: (title: string) => void;
  updateCurrency: (currency: CurrencyCode) => void;
  updatePayer: (memberId: string) => void;
  updateTax: (percent: number) => void;
  updateTip: (percent: number) => void;
  ensureCurrentUserMember: () => void;
  syncProfileToMember: () => void;

  // Member actions
  addMember: (name: string) => void;
  removeMember: (memberId: string) => void;
  updateMember: (memberId: string, updates: Partial<Member>) => void;

  // Member Group actions (localStorage)
  saveCurrentMembersAsGroup: (name: string) => void;
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
  saveBillToCloud: (bill: BillSession) => Promise<void>;
  deleteBillFromCloud: (billId: string) => Promise<void>;

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

// Dùng ID cố định nếu người dùng chưa đăng nhập để không sinh ID mới khi F5
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
  };
};

const createEmptyBill = (): BillSession => ({
  id: generateId(),
  title: 'Hóa đơn mới',
  date: new Date().toISOString(),
  currency: 'VND',
  members: [],
  items: [],
  paidByMemberId: '',
  taxPercent: 0,
  tipPercent: 0,
  splitMode: 'ITEMIZED',
});

const createDemoBill = (): BillSession => ({
  id: generateId(),
  title: 'Lẩu nướng cuối tuần 🍲',
  date: new Date().toISOString(),
  currency: 'VND',
  members: [
    { id: 'm1', name: 'An', avatarColor: AVATAR_COLORS[0], bank_name: '', account_number: '0123456789' },
    { id: 'm2', name: 'Bình', avatarColor: AVATAR_COLORS[1], bank_name: '', account_number: '0987654321' },
    { id: 'm3', name: 'Chi', avatarColor: AVATAR_COLORS[2] },
    { id: 'm4', name: 'Dũng', avatarColor: AVATAR_COLORS[3] },
  ],
  items: [
    { id: 'i1', name: 'Lẩu Thái', price: 350000, quantity: 1, assignedMemberIds: ['m1', 'm2', 'm3', 'm4'] },
    { id: 'i2', name: 'Thịt bò Úc', price: 180000, quantity: 2, assignedMemberIds: ['m1', 'm2', 'm4'] },
    { id: 'i3', name: 'Hải sản tươi', price: 220000, quantity: 1, assignedMemberIds: ['m2', 'm3'] },
    { id: 'i4', name: 'Rau củ tổng hợp', price: 80000, quantity: 1, assignedMemberIds: ['m1', 'm2', 'm3', 'm4'] },
    { id: 'i5', name: 'Nước ngọt', price: 15000, quantity: 4, assignedMemberIds: ['m1', 'm2', 'm3', 'm4'] },
  ],
  paidByMemberId: 'm1',
  taxPercent: 8,
  tipPercent: 5,
  splitMode: 'ITEMIZED',
});

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

      // Chia sẻ hóa đơn an toàn: chỉ cập nhật hóa đơn do người gửi sở hữu.
      // Nếu ID local trùng với hóa đơn của tài khoản khác, tạo ID cloud mới
      // thay vì upsert và cố ghi đè bản ghi không thuộc người dùng hiện tại.
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

        const receiverIds = [...new Set(
          friendUserIds.filter((id) => typeof id === 'string' && id.length > 0 && id !== user.id),
        )];

        if (receiverIds.length === 0) {
          set({ isSyncing: false, syncError: 'Vui lòng chọn ít nhất một người nhận khác tài khoản của bạn.' });
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
          // Luôn dựa trên ID của hóa đơn hiện tại trong store.
          let cloudBillId = currentBill.id || billId;
          let billToStore: BillSession = { ...currentBill, id: cloudBillId };
          const updatedAt = new Date().toISOString();

          // Chỉ tìm bản ghi có cùng ID và thuộc chính người gửi.
          const { data: ownedBill, error: lookupError } = await supabase
            .from('bills')
            .select('id')
            .eq('id', cloudBillId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (lookupError) throw lookupError;

          if (ownedBill) {
            // Cập nhật riêng bản ghi thuộc người dùng hiện tại; không dùng upsert.
            const { error: updateError } = await supabase
              .from('bills')
              .update({
                title: billToStore.title || 'Hóa đơn',
                data: billToStore,
                updated_at: updatedAt,
              })
              .eq('id', cloudBillId)
              .eq('user_id', user.id);

            if (updateError) throw updateError;
          } else {
            // Tạo bản ghi mới nếu chưa có hóa đơn của người gửi với ID này.
            const { error: insertError } = await supabase
              .from('bills')
              .insert({
                id: cloudBillId,
                user_id: user.id,
                title: billToStore.title || 'Hóa đơn',
                data: billToStore,
                updated_at: updatedAt,
              });

            if (insertError?.code === '23505') {
              // ID đã được dùng bởi một bản ghi mà người gửi không sở hữu.
              // Dùng UUID mới để không sửa/ghi đè hóa đơn của tài khoản khác.
              const previousId = cloudBillId;
              cloudBillId = crypto.randomUUID();
              billToStore = { ...currentBill, id: cloudBillId };

              const { error: retryInsertError } = await supabase
                .from('bills')
                .insert({
                  id: cloudBillId,
                  user_id: user.id,
                  title: billToStore.title || 'Hóa đơn',
                  data: billToStore,
                  updated_at: new Date().toISOString(),
                });

              if (retryInsertError) throw retryInsertError;

              // Đồng bộ ID mới vào state/local history để các lần chia sẻ sau
              // tiếp tục dùng cùng một hóa đơn của người gửi.
              const latestState = get();
              set({
                currentBill:
                  latestState.currentBill?.id === previousId
                    ? billToStore
                    : latestState.currentBill,
                history: latestState.history.map((bill) =>
                  bill.id === previousId ? billToStore : bill,
                ),
              });
            } else if (insertError) {
              throw insertError;
            }
          }

          // Lấy các lượt chia sẻ đã tồn tại để không phụ thuộc vào
          // ON CONFLICT (bill_id, receiver_id) có unique constraint hay không.
          const { data: existingShares, error: existingSharesError } = await supabase
            .from('bill_shares')
            .select('receiver_id')
            .eq('bill_id', cloudBillId)
            .eq('sender_id', user.id)
            .in('receiver_id', receiverIds);

          if (existingSharesError) throw existingSharesError;

          const alreadySharedWith = new Set(
            (existingShares ?? []).map((row) => row.receiver_id as string),
          );

          const newShares = receiverIds
            .filter((receiverId) => !alreadySharedWith.has(receiverId))
            .map((receiverId) => ({
              bill_id: cloudBillId,
              sender_id: user.id,
              receiver_id: receiverId,
            }));

          if (newShares.length > 0) {
            const { error: shareInsertError } = await supabase
              .from('bill_shares')
              .insert(newShares);

            if (shareInsertError) throw shareInsertError;
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

      syncGroupsToCloud: async (groupsToSync?: MemberGroup[]) => {
        const user = useAuthStore.getState().user;
        if (!user || !supabase) return;

        const groups = groupsToSync ?? get().savedGroups;
        try {
          await supabase
            .from('profiles')
            .update({ member_groups: groups })
            .eq('id', user.id);
        } catch (err) {
          console.error('Lỗi lưu nhóm lên cloud:', err);
        }
      },

      deleteSharedBill: async (shareId: string) => {
        if (!supabase || !shareId) return;

        // Cập nhật giao diện ngay lập tức
        const { sharedBills } = get();
        set({ sharedBills: sharedBills.filter((b) => b.shareId !== shareId) });

        try {
          const { error } = await supabase
            .from('bill_shares')
            .delete()
            .eq('id', shareId);

          if (error) throw error;
        } catch (err) {
          console.error('Lỗi xóa hóa đơn được chia sẻ:', err);
          // Hoàn tác nếu lỗi
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
        const { currentBill } = get();
        if (!currentBill || !Array.isArray(currentBill.members) || !currentBill.members.length) return;

        const profile = useProfileStore.getState().profile;
        if (!profile) return;

        const user = useAuthStore.getState().user;
        const myId = user?.id || profile.id || USER_SELF_ID;

        const hasMe = currentBill.members.some(
          (m: Member) =>
            m.id === myId ||
            m.id === USER_SELF_ID ||
            (profile.display_name && m.name === profile.display_name) ||
            m.name === 'Tôi'
        );

        const updatedMembers: Member[] = currentBill.members.map((m: Member, index: number) => {
          const isTarget = hasMe
            ? m.id === myId ||
              m.id === USER_SELF_ID ||
              (profile.display_name && m.name === profile.display_name) ||
              m.name === 'Tôi'
            : index === 0;

          if (!isTarget) return m;

          return {
            ...m,
            id: myId,
            name: profile.display_name || m.name,
            avatar_url: profile.avatar_url ?? m.avatar_url,
            bank_name: profile.bank_name ?? m.bank_name,
            account_number: profile.account_number ?? m.account_number,
            account_holder: profile.account_holder ?? m.account_holder,
            phone_number: profile.phone_number ?? m.phone_number,
            russia_bank: profile.russia_bank ?? m.russia_bank,
            custom_qr_url: profile.custom_qr_url ?? m.custom_qr_url,
          };
        });

        set({
          currentBill: {
            ...currentBill,
            members: updatedMembers,
            paidByMemberId: currentBill.paidByMemberId === USER_SELF_ID ? myId : currentBill.paidByMemberId,
          },
        });
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
            m.name === defaultMember.name ||
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

      loadDemoData: () => {
        set({ currentBill: createDemoBill() });
      },

      updateBillTitle: (title: string) => {
        const { currentBill } = get();
        if (!currentBill) return;
        set({ currentBill: { ...currentBill, title } });
      },

      updateCurrency: (currency: CurrencyCode) => {
        const { currentBill } = get();
        if (!currentBill) return;
        set({ currentBill: { ...currentBill, currency } });
      },

      updatePayer: (memberId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;
        set({ currentBill: { ...currentBill, paidByMemberId: memberId } });
      },

      updateTax: (percent: number) => {
        const { currentBill } = get();
        if (!currentBill) return;
        set({ currentBill: { ...currentBill, taxPercent: percent } });
      },

      updateTip: (percent: number) => {
        const { currentBill } = get();
        if (!currentBill) return;
        set({ currentBill: { ...currentBill, tipPercent: percent } });
      },

      addMember: (name: string) => {
        const { currentBill } = get();
        if (!currentBill) return;

        const safeMembers = Array.isArray(currentBill.members) ? currentBill.members : [];
        const newMember: Member = {
          id: generateId(),
          name,
          avatarColor: AVATAR_COLORS[safeMembers.length % AVATAR_COLORS.length],
        };

        set({
          currentBill: {
            ...currentBill,
            members: [...safeMembers, newMember],
            paidByMemberId: currentBill.paidByMemberId || newMember.id,
          },
        });
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

        set({
          currentBill: {
            ...currentBill,
            members: updatedMembers,
            items: updatedItems,
            paidByMemberId:
              currentBill.paidByMemberId === memberId
                ? updatedMembers[0]?.id || ''
                : currentBill.paidByMemberId,
          },
        });
      },

      updateMember: (memberId: string, updates: Partial<Member>) => {
        const { currentBill } = get();
        if (!currentBill) return;

        const safeMembers = Array.isArray(currentBill.members) ? currentBill.members : [];
        set({
          currentBill: {
            ...currentBill,
            members: safeMembers.map((m) =>
              m.id === memberId ? { ...m, ...updates } : m
            ),
          },
        });
      },

      saveCurrentMembersAsGroup: (name: string) => {
        const { currentBill, savedGroups } = get();
        if (!currentBill || !Array.isArray(currentBill.members) || !currentBill.members.length || !name.trim()) return;

        const groupMembers: Omit<Member, 'id'>[] = currentBill.members.map((m) => ({
          name: m.name,
          avatarColor: m.avatarColor,
          avatar_url: m.avatar_url,
          bank_name: m.bank_name,
          account_number: m.account_number,
          account_holder: m.account_holder,
          phone_number: m.phone_number,
          russia_bank: m.russia_bank,
          custom_qr_url: m.custom_qr_url,
          bankInfo: m.bankInfo,
        }));

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
        if (!currentBill) return;

        // Nếu là bill chỉ đọc thì không cho áp dụng nhóm
        // @ts-expect-error isSharedBill flag
        if (currentBill.isSharedBill) return;

        const group = savedGroups.find((g) => g.id === groupId);
        if (!group || !Array.isArray(group.members) || group.members.length === 0) return;

        const safeMembers = Array.isArray(currentBill.members) ? currentBill.members : [];

        // Lấy danh sách tên thành viên hiện tại trên bill (chuyển về chữ thường để so sánh)
        const currentMemberNames = new Set(
          safeMembers.map((m) => (m.name || '').trim().toLowerCase())
        );

        const newMembersToAdd: Member[] = [];

        group.members.forEach((gm, idx) => {
          const rawName = (gm.name || '').trim();
          if (!rawName) return;

          // Nếu tên đã có trên Bill thì không thêm trùng
          if (currentMemberNames.has(rawName.toLowerCase())) {
            return;
          }

          newMembersToAdd.push({
            id: generateId(),
            name: rawName,
            avatarColor:
              gm.avatarColor ||
              AVATAR_COLORS[(safeMembers.length + idx) % AVATAR_COLORS.length],
            avatar_url: gm.avatar_url || '',
            bank_name: gm.bank_name || '',
            account_number: gm.account_number || '',
            account_holder: gm.account_holder || '',
            phone_number: gm.phone_number || '',
            russia_bank: gm.russia_bank || '',
            custom_qr_url: gm.custom_qr_url || '',
            bankInfo: gm.bankInfo,
          });

          // Đánh dấu đã thêm tên này
          currentMemberNames.add(rawName.toLowerCase());
        });

        if (newMembersToAdd.length === 0) return;

        const updatedMembers = [...safeMembers, ...newMembersToAdd];

        set({
          currentBill: {
            ...currentBill,
            members: updatedMembers,
            paidByMemberId: currentBill.paidByMemberId || updatedMembers[0]?.id || '',
          },
        });
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

        set({
          currentBill: {
            ...currentBill,
            items: [...safeItems, newItem],
          },
        });
      },

      updateItem: (itemId: string, updates: Partial<ExpenseItem>) => {
        const { currentBill } = get();
        if (!currentBill) return;

        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        set({
          currentBill: {
            ...currentBill,
            items: safeItems.map((item) =>
              item.id === itemId ? { ...item, ...updates } : item
            ),
          },
        });
      },

      removeItem: (itemId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;

        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        set({
          currentBill: {
            ...currentBill,
            items: safeItems.filter((item) => item.id !== itemId),
          },
        });
      },

      clearAllItems: () => {
        const { currentBill } = get();
        if (!currentBill) return;

        set({
          currentBill: {
            ...currentBill,
            items: [],
          },
        });
      },

      toggleMemberOnItem: (itemId: string, memberId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;

        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        set({
          currentBill: {
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
          },
        });
      },

      assignAllMembersToItem: (itemId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;

        const safeItems = Array.isArray(currentBill.items) ? currentBill.items : [];
        const safeMembers = Array.isArray(currentBill.members) ? currentBill.members : [];
        set({
          currentBill: {
            ...currentBill,
            items: safeItems.map((item) =>
              item.id === itemId
                ? { ...item, assignedMemberIds: safeMembers.map((m) => m.id) }
                : item
            ),
          },
        });
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
        const { history } = get();
        const bill = history.find((b) => b.id === billId);
        if (bill) {
          set({
            currentBill: {
              ...bill,
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

        void get().fetchUserGroups();
        set({ isSyncing: true, syncError: null });

        // Hàm phụ giúp chuẩn hóa 1 bản ghi bill từ Supabase (hỗ trợ cả cột data và bill_data)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalizeBillRow = (row: any): BillSession => {
          const raw = row?.data || row?.bill_data || row || {};
          return {
            id: row?.id || raw?.id || generateId(),
            title: raw?.title || row?.title || 'Hóa đơn',
            date: raw?.date || row?.created_at || new Date().toISOString(),
            currency: raw?.currency || 'VND',
            items: Array.isArray(raw?.items) ? raw.items : [],
            members: Array.isArray(raw?.members) ? raw.members : [],
            taxPercent: typeof raw?.taxPercent === 'number' ? raw.taxPercent : 0,
            tipPercent: typeof raw?.tipPercent === 'number' ? raw.tipPercent : 0,
            paidByMemberId: raw?.paidByMemberId || '',
            splitMode: raw?.splitMode || 'ITEMIZED',
          };
        };

        try {
          // 1. Kéo hóa đơn cá nhân
          const { data: myBillsData, error: myError } = await supabase
            .from('bills')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

          if (myError) throw myError;

          // 2. Kéo hóa đơn được bạn bè chia sẻ
          const { data: sharedData, error: shareError } = await supabase
            .from('bill_shares')
            .select(`
              id,
              sender_id,
              bill:bills (*),
              sender:profiles!sender_id (display_name)
            `)
            .eq('receiver_id', user.id);

          if (shareError) {
            console.warn('Không tải được danh sách shared bills:', shareError);
          }

          const myBills = (myBillsData || []).map((b) => normalizeBillRow(b));

          const sharedBillsList = (sharedData || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((item: any) => Boolean(item.bill))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((item: any) => ({
              ...normalizeBillRow(item.bill),
              shareId: item.id,
              sharedBy: item.sender?.display_name || 'Bạn bè',
              isSharedBill: true,
            }));

          set({
            history: myBills,
            sharedBills: sharedBillsList,
            isSyncing: false,
          });
        } catch (err) {
          set({
            isSyncing: false,
            syncError: err instanceof Error ? err.message : 'Lỗi đồng bộ',
          });
        }
      },

      saveBillToCloud: async (bill: BillSession) => {
        const user = useAuthStore.getState().user;
        if (!user || !supabase) return;

        set({ isSyncing: true, syncError: null });
        try {
          const { error } = await supabase.from('bills').upsert({
            id: bill.id,
            user_id: user.id,
            title: bill.title,
            data: bill,
            updated_at: new Date().toISOString(),
          });

          if (error) throw error;
          set({ isSyncing: false });
        } catch (err) {
          set({
            syncError:
              'Lỗi lưu cloud: ' +
              (err instanceof Error ? err.message : 'Lỗi không xác định'),
            isSyncing: false,
          });
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
      // Tự động phục hồi dữ liệu an toàn khi nạp từ localStorage (F5 không bao giờ crash)
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Chuẩn hóa history nếu có bản ghi thiếu items/members
        if (Array.isArray(state.history)) {
          state.history = state.history.map((b) => ({
            ...b,
            items: Array.isArray(b?.items) ? b.items : [],
            members: Array.isArray(b?.members) ? b.members : [],
          }));
        } else {
          state.history = [];
        }

        if (!state.currentBill) return;

        // Đảm bảo items luôn là mảng hợp lệ
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