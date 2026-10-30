export type CurrencyCode = 'VND' | 'RUB';
export type Currency = CurrencyCode; // Alias tương thích với các component dùng type Currency

export type BillMode = 'SINGLE' | 'TIMELINE';

export interface Member {
  id: string;
  name: string;
  email?: string;
  avatarColor: string; // Tailwind color class or hex
  bankInfo?: string;   // Tương thích với MemberManager và DebtSettlementFlow
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  phone_number?: string;
  russia_bank?: string;
  custom_qr_url?: string;
  // Russian SBP fields; custom_qr_url/account_holder remain supported for legacy data.
  russia_account_holder?: string;
  russia_qr_url?: string;
  avatar_url?: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedMemberIds: string[]; // IDs of members sharing this specific item
}

export interface BillExpense {
  id: string;
  time: string; // HH:mm
  title: string;
  payerId: string;
  participantIds: string[];
  items: ExpenseItem[];
  taxPercent: number;
  tipPercent: number;
  notes?: string;
}

export interface BillSession {
  id: string;
  title: string;
  date: string;
  currency: CurrencyCode;
  members: Member[];
  items: ExpenseItem[];
  paidByMemberId: string; // ID of the member who paid the bill upfront
  taxPercent: number;     // VAT %
  tipPercent: number;     // Service charge / Tip %
  splitMode: 'ITEMIZED' | 'EQUAL';
  mode?: BillMode;
  expenses?: BillExpense[];
  shareId?: string;
  sharedBy?: string;
  isSharedBill?: boolean;
  transfer_confirmations?: Record<string, { payerConfirmed: boolean; receiverConfirmed: boolean }>;
  settled_transfers?: string[]; // Lưu mảng key các khoản chuyển khoản đã tick hoàn thành
}

// Alias định danh Bill tương đương với BillSession để các component dùng linh hoạt
export type Bill = BillSession;

export interface MemberBreakdown {
  memberId: string;
  subtotal: number;       // Sum of items they shared
  taxAmount: number;      // Proportional tax based on their subtotal
  tipAmount: number;      // Proportional tip based on their subtotal
  totalOwed: number;      // Final amount this member needs to pay
  totalPaidUpfront: number;
  netBalance: number;     // totalPaidUpfront - totalOwed
}

export interface SettlementTransaction {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

// Kiểu dữ liệu cho Nhóm bạn (Member Groups)
export interface MemberGroup {
  id: string;
  name: string;
  members: Omit<Member, 'id'>[]; // Lưu name, avatarColor, avatar_url, và toàn bộ thông tin thanh toán
  createdAt: string;
}

export type BillCategory = 'dining' | 'shopping' | 'transport' | 'entertainment' | 'travel' | 'other';

export interface BillSession {
  id: string;
  title: string;
  date: string;
  currency: CurrencyCode;
  members: Member[];
  items: ExpenseItem[];
  paidByMemberId: string;
  taxPercent: number;
  tipPercent: number;
  splitMode: 'EQUAL' | 'ITEMIZED';
  mode?: BillMode;
  expenses?: BillExpense[];
  category?: BillCategory; // <-- Thêm trường danh mục
  isSharedBill?: boolean;
  shareId?: string;
  sharedBy?: string;
  transfer_confirmations?: Record<string, { payerConfirmed: boolean; receiverConfirmed: boolean }>;
  settled_transfers?: string[];
}