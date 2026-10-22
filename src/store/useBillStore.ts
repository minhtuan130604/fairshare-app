import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BillSession, Member, ExpenseItem, CurrencyCode } from '../types/bill';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { useProfileStore } from './useProfileStore';

interface BillState {
  currentBill: BillSession | null;
  history: BillSession[];
  theme: 'dark' | 'light';
  isSyncing: boolean;
  syncError: string | null;

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

  // Item actions
  addItem: (item: Omit<ExpenseItem, 'id'>) => void;
  updateItem: (itemId: string, updates: Partial<ExpenseItem>) => void;
  removeItem: (itemId: string) => void;
  clearAllItems: () => void;
  toggleMemberOnItem: (itemId: string, memberId: string) => void;
  assignAllMembersToItem: (itemId: string) => void;

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

const getInitialTheme = (): 'dark' | 'light' =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

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
      theme: getInitialTheme(),
      isSyncing: false,
      syncError: null,

      // Đồng bộ thông tin từ Profile sang thành viên của tôi trong Bill
      syncProfileToMember: () => {
        const { currentBill } = get();
        if (!currentBill || !currentBill.members.length) return;

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

        // Kiểm tra xem đã có mình chưa (khớp ID hoặc tên 'Tôi' hoặc tên display_name)
        const existingIndex = currentBill.members.findIndex(
          (m) =>
            m.id === defaultMember.id ||
            m.id === USER_SELF_ID ||
            m.name === defaultMember.name ||
            m.name === 'Tôi'
        );

        if (existingIndex >= 0) {
          // Nếu đã có rồi thì chỉ cập nhật thông tin mới nhất, không chèn thêm
          const updatedMembers = [...currentBill.members];
          updatedMembers[existingIndex] = {
            ...updatedMembers[existingIndex],
            ...defaultMember,
            id: updatedMembers[existingIndex].id, // giữ nguyên id hiện hành
          };
          set({
            currentBill: {
              ...currentBill,
              members: updatedMembers,
            },
          });
        } else {
          // Nếu thực sự chưa có thì mới chèn vào đầu
          set({
            currentBill: {
              ...currentBill,
              members: [defaultMember, ...currentBill.members],
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

        const newMember: Member = {
          id: generateId(),
          name,
          avatarColor: AVATAR_COLORS[currentBill.members.length % AVATAR_COLORS.length],
        };

        set({
          currentBill: {
            ...currentBill,
            members: [...currentBill.members, newMember],
            paidByMemberId: currentBill.paidByMemberId || newMember.id,
          },
        });
      },

      removeMember: (memberId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;

        const updatedMembers = currentBill.members.filter((m) => m.id !== memberId);
        const updatedItems = currentBill.items.map((item) => ({
          ...item,
          assignedMemberIds: item.assignedMemberIds.filter((id) => id !== memberId),
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

        set({
          currentBill: {
            ...currentBill,
            members: currentBill.members.map((m) =>
              m.id === memberId ? { ...m, ...updates } : m
            ),
          },
        });
      },

      addItem: (item: Omit<ExpenseItem, 'id'>) => {
        const { currentBill } = get();
        if (!currentBill) return;

        const newItem: ExpenseItem = {
          ...item,
          id: generateId(),
        };

        set({
          currentBill: {
            ...currentBill,
            items: [...currentBill.items, newItem],
          },
        });
      },

      updateItem: (itemId: string, updates: Partial<ExpenseItem>) => {
        const { currentBill } = get();
        if (!currentBill) return;

        set({
          currentBill: {
            ...currentBill,
            items: currentBill.items.map((item) =>
              item.id === itemId ? { ...item, ...updates } : item
            ),
          },
        });
      },

      removeItem: (itemId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;

        set({
          currentBill: {
            ...currentBill,
            items: currentBill.items.filter((item) => item.id !== itemId),
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

        set({
          currentBill: {
            ...currentBill,
            items: currentBill.items.map((item) => {
              if (item.id !== itemId) return item;

              const isAssigned = item.assignedMemberIds.includes(memberId);
              return {
                ...item,
                assignedMemberIds: isAssigned
                  ? item.assignedMemberIds.filter((id) => id !== memberId)
                  : [...item.assignedMemberIds, memberId],
              };
            }),
          },
        });
      },

      assignAllMembersToItem: (itemId: string) => {
        const { currentBill } = get();
        if (!currentBill) return;

        set({
          currentBill: {
            ...currentBill,
            items: currentBill.items.map((item) =>
              item.id === itemId
                ? { ...item, assignedMemberIds: currentBill.members.map((m) => m.id) }
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
          set({ currentBill: { ...bill } });
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

        set({ isSyncing: true, syncError: null });
        try {
          const { data, error } = await supabase
            .from('bills')
            .select('data')
            .eq('user_id', user.id);

          if (error) throw error;

          const bills = data.map((b) => b.data as BillSession);
          set({ history: bills, isSyncing: false });
        } catch (err) {
          set({
            syncError:
              'Không thể đồng bộ dữ liệu: ' +
              (err instanceof Error ? err.message : 'Lỗi không xác định'),
            isSyncing: false,
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
        theme: state.theme,
      }),
      // Khi khôi phục từ localStorage, làm sạch các thành viên 'Tôi' bị trùng lặp trước đó
      onRehydrateStorage: () => (state) => {
        if (!state || !state.currentBill) return;

        const members = state.currentBill.members;
        if (!members || members.length === 0) {
          const defaultMember = getCurrentUserMember();
          state.currentBill.members = [defaultMember];
          state.currentBill.paidByMemberId = defaultMember.id;
          return;
        }

        // Lọc sạch các bản sao trùng lặp nếu trong quá khứ bị sinh nhiều người tên 'Tôi'
        const seenNames = new Set<string>();
        const uniqueMembers: Member[] = [];

        for (const m of members) {
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