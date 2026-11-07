import type {
  BillExpense,
  BillSession,
  Member,
  MemberBreakdown,
  SettlementTransaction,
} from '../types/bill';

/** Calculate one timeline expense. */
export function calculateSingleExpenseBreakdown(
  expense: BillExpense,
  members: Member[],
): MemberBreakdown[] {
  const items = Array.isArray(expense.items) ? expense.items : [];
  const participants = Array.isArray(expense.participantIds) ? expense.participantIds : [];
  const subtotal = items.reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 0), 0);
  const totalTip = subtotal * ((Number(expense.tipPercent) || 0) / 100);
  const totalTax = (subtotal + totalTip) * ((Number(expense.taxPercent) || 0) / 100);

  return members.map((member) => {
    let memberSubtotal = 0;
    for (const item of items) {
      const assignedIds = Array.isArray(item.assignedMemberIds) && item.assignedMemberIds.length > 0
        ? item.assignedMemberIds
        : participants;
      if (assignedIds.includes(member.id) && assignedIds.length > 0) {
        memberSubtotal += ((Number(item.price) || 0) * (Number(item.quantity) || 0)) / assignedIds.length;
      }
    }
    const proportion = subtotal > 0 ? memberSubtotal / subtotal : 0;
    const taxAmount = totalTax * proportion;
    const tipAmount = totalTip * proportion;
    const totalOwed = memberSubtotal + taxAmount + tipAmount;
    const totalPaidUpfront = member.id === expense.payerId ? subtotal + totalTax + totalTip : 0;
    return {
      memberId: member.id,
      subtotal: memberSubtotal,
      taxAmount,
      tipAmount,
      totalOwed,
      totalPaidUpfront,
      netBalance: totalPaidUpfront - totalOwed,
    };
  });
}

function getAllBillMembers(bill: BillSession): Member[] {
  return [
    ...(Array.isArray(bill.members) ? bill.members : []),
    ...(Array.isArray(bill.timelineMembers) ? bill.timelineMembers : []),
  ].filter((member, index, list) => list.findIndex((candidate) => candidate.id === member.id) === index);
}

/** Aggregate all timeline expenses into one breakdown per member. */
export function calculateTimelineBreakdowns(bill: BillSession): MemberBreakdown[] {
  const members = getAllBillMembers(bill);
  const totals = new Map(members.map((member) => [member.id, {
    memberId: member.id,
    subtotal: 0,
    taxAmount: 0,
    tipAmount: 0,
    totalOwed: 0,
    totalPaidUpfront: 0,
    netBalance: 0,
  }]));
  for (const expense of bill.expenses || []) {
    for (const breakdown of calculateSingleExpenseBreakdown(expense, members)) {
      const total = totals.get(breakdown.memberId);
      if (!total) continue;
      total.subtotal += breakdown.subtotal;
      total.taxAmount += breakdown.taxAmount;
      total.tipAmount += breakdown.tipAmount;
      total.totalOwed += breakdown.totalOwed;
      total.totalPaidUpfront += breakdown.totalPaidUpfront;
      total.netBalance += breakdown.netBalance;
    }
  }
  return Array.from(totals.values());
}

/** Calculate the bill total using only the active bill mode's source data. */
export function calculateBillTotals(bill: BillSession): {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  itemCount: number;
} {
  if (bill.mode === 'TIMELINE') {
    const expenses = Array.isArray(bill.expenses) ? bill.expenses : [];
    const totals = expenses.reduce((result, expense) => {
      const subtotal = (Array.isArray(expense.items) ? expense.items : []).reduce(
        (sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 0),
        0,
      );
      result.subtotal += subtotal;
      const tip = subtotal * ((Number(expense.tipPercent) || 0) / 100);
      result.tip += tip;
      result.tax += (subtotal + tip) * ((Number(expense.taxPercent) || 0) / 100);
      result.itemCount += Array.isArray(expense.items) ? expense.items.length : 0;
      return result;
    }, { subtotal: 0, tax: 0, tip: 0, itemCount: 0 });
    return { ...totals, total: totals.subtotal + totals.tax + totals.tip };
  }

  const items = Array.isArray(bill.items) ? bill.items : [];
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 0),
    0,
  );
  const tip = subtotal * ((Number(bill.tipPercent) || 0) / 100);
  const tax = (subtotal + tip) * ((Number(bill.taxPercent) || 0) / 100);
  return { subtotal, tax, tip, total: subtotal + tax + tip, itemCount: items.length };
}

/**
 * Calculate proportional breakdown for each member
 * Each item is split equally among assigned members
 * Tax and tip are distributed proportionally based on subtotals
 */
export function calculateMemberBreakdowns(bill: BillSession | null | undefined): MemberBreakdown[] {
  if (!bill) return [];

  if (bill.mode === 'TIMELINE') {
    return calculateTimelineBreakdowns(bill);
  }

  const items = Array.isArray(bill.items) ? bill.items : [];
  const members = getAllBillMembers(bill);
  const taxPercent = typeof bill.taxPercent === 'number' ? bill.taxPercent : 0;
  const tipPercent = typeof bill.tipPercent === 'number' ? bill.tipPercent : 0;

  if (members.length === 0) return [];

  const breakdowns: MemberBreakdown[] = [];

  // Calculate bill subtotal (sum of all items)
  const billSubtotal = items.reduce((sum, item) => {
    const price = Number(item?.price) || 0;
    const quantity = Number(item?.quantity) || 0;
    return sum + price * quantity;
  }, 0);

  if (billSubtotal === 0) {
    return members.map(member => ({
      memberId: member.id,
      subtotal: 0,
      taxAmount: 0,
      tipAmount: 0,
      totalOwed: 0,
      totalPaidUpfront: 0,
      netBalance: 0,
    }));
  }

  // Calculate each member's subtotal
  for (const member of members) {
    let memberSubtotal = 0;

    for (const item of items) {
      const assignedIds = Array.isArray(item?.assignedMemberIds) ? item.assignedMemberIds : [];
      if (assignedIds.includes(member.id) && assignedIds.length > 0) {
        const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
        const shareCount = assignedIds.length;
        memberSubtotal += itemTotal / shareCount;
      }
    }

    // Calculate proportional tax and tip
    const proportion = memberSubtotal / billSubtotal;
    const totalTip = billSubtotal * (tipPercent / 100);
    const totalTax = (billSubtotal + totalTip) * (taxPercent / 100);

    const memberTax = totalTax * proportion;
    const memberTip = totalTip * proportion;
    const memberTotal = memberSubtotal + memberTax + memberTip;

    // Calculate net balance (for the person who paid)
    const totalPaidUpfront = member.id === bill.paidByMemberId
      ? billSubtotal + totalTax + totalTip
      : 0;
    const netBalance = totalPaidUpfront - memberTotal;

    breakdowns.push({
      memberId: member.id,
      subtotal: memberSubtotal,
      taxAmount: memberTax,
      tipAmount: memberTip,
      totalOwed: memberTotal,
      totalPaidUpfront,
      netBalance,
    });
  }

  return breakdowns;
}

/**
 * Min-Cash-Flow Debt Simplification Algorithm
 * Uses greedy approach to minimize number of transactions
 */
export function calculateSettlements(breakdowns: MemberBreakdown[] | null | undefined): SettlementTransaction[] {
  if (!Array.isArray(breakdowns) || breakdowns.length === 0) return [];

  const TOLERANCE = 0.01;
  const settlements: SettlementTransaction[] = [];

  // Create working balances (positive = owed money, negative = owes money)
  const balances = breakdowns
    .map(b => ({
      memberId: b.memberId,
      balance: Number(b.netBalance) || 0,
    }))
    .filter(b => Math.abs(b.balance) > TOLERANCE);

  // Separate into creditors (positive) and debtors (negative)
  const creditors = balances
    .filter(b => b.balance > TOLERANCE)
    .sort((a, b) => b.balance - a.balance);
  const debtors = balances
    .filter(b => b.balance < -TOLERANCE)
    .sort((a, b) => a.balance - b.balance);

  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const transferAmount = Math.min(creditor.balance, Math.abs(debtor.balance));

    if (transferAmount > TOLERANCE) {
      settlements.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount: transferAmount,
      });

      creditor.balance -= transferAmount;
      debtor.balance += transferAmount;
    }

    // Move to next creditor or debtor when balance is settled
    if (Math.abs(creditor.balance) < TOLERANCE) i++;
    if (Math.abs(debtor.balance) < TOLERANCE) j++;
  }

  return settlements;
}