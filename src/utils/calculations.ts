import type { BillSession, MemberBreakdown, SettlementTransaction } from '../types/bill';

/**
 * Calculate proportional breakdown for each member
 * Each item is split equally among assigned members
 * Tax and tip are distributed proportionally based on subtotals
 */
export function calculateMemberBreakdowns(bill: BillSession): MemberBreakdown[] {
  const breakdowns: MemberBreakdown[] = [];

  // Calculate bill subtotal (sum of all items)
  const billSubtotal = bill.items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);

  if (billSubtotal === 0) {
    return bill.members.map(member => ({
      memberId: member.id,
      subtotal: 0,
      taxAmount: 0,
      tipAmount: 0,
      totalOwed: 0,
      netBalance: 0,
    }));
  }

  // Calculate each member's subtotal
  for (const member of bill.members) {
    let memberSubtotal = 0;

    for (const item of bill.items) {
      if (item.assignedMemberIds.includes(member.id)) {
        const itemTotal = item.price * item.quantity;
        const shareCount = item.assignedMemberIds.length;
        memberSubtotal += itemTotal / shareCount;
      }
    }

    // Calculate proportional tax and tip
    const proportion = memberSubtotal / billSubtotal;
    const totalTax = billSubtotal * (bill.taxPercent / 100);
    const totalTip = billSubtotal * (bill.tipPercent / 100);

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
      netBalance,
    });
  }

  return breakdowns;
}

/**
 * Min-Cash-Flow Debt Simplification Algorithm
 * Uses greedy approach to minimize number of transactions
 */
export function calculateSettlements(breakdowns: MemberBreakdown[]): SettlementTransaction[] {
  const TOLERANCE = 0.01;
  const settlements: SettlementTransaction[] = [];

  // Create working balances (positive = owed money, negative = owes money)
  const balances = breakdowns.map(b => ({
    memberId: b.memberId,
    balance: b.netBalance,
  })).filter(b => Math.abs(b.balance) > TOLERANCE);

  // Separate into creditors (positive) and debtors (negative)
  const creditors = balances.filter(b => b.balance > TOLERANCE)
    .sort((a, b) => b.balance - a.balance);
  const debtors = balances.filter(b => b.balance < -TOLERANCE)
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
