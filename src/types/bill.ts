export type CurrencyCode = 'VND' | 'USD' | 'EUR' | 'RUB' | 'CNY';

export interface Member {
  id: string;
  name: string;
  avatarColor: string; // Tailwind color class or hex
  bankInfo?: string;   // Thêm dòng này để tương thích với MemberManager và DebtSettlementFlow
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  phone_number?: string;
  russia_bank?: string;
  custom_qr_url?: string;
  avatar_url?: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedMemberIds: string[]; // IDs of members sharing this specific item
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
}

export interface MemberBreakdown {
  memberId: string;
  subtotal: number;       // Sum of items they shared
  taxAmount: number;      // Proportional tax based on their subtotal
  tipAmount: number;      // Proportional tip based on their subtotal
  totalOwed: number;      // Final amount this member needs to pay
  netBalance: number;     // totalPaidUpfront - totalOwed
}

export interface SettlementTransaction {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}
