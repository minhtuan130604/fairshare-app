import { describe, it, expect } from 'vitest';
import { calculateMemberBreakdowns, calculateSettlements } from './calculations';
import type { BillSession } from '../types/bill';

describe('Bill Calculations', () => {
  const mockBill: BillSession = {
    id: 'test-1',
    title: 'Test Bill',
    date: '2026-10-18',
    currency: 'VND',
    members: [
      { id: 'm1', name: 'Alice', avatarColor: 'bg-blue-500' },
      { id: 'm2', name: 'Bob', avatarColor: 'bg-green-500' },
      { id: 'm3', name: 'Charlie', avatarColor: 'bg-red-500' },
    ],
    items: [
      { id: 'i1', name: 'Pizza', price: 100000, quantity: 1, assignedMemberIds: ['m1', 'm2', 'm3'] },
      { id: 'i2', name: 'Pasta', price: 60000, quantity: 1, assignedMemberIds: ['m1', 'm2'] },
      { id: 'i3', name: 'Drink', price: 15000, quantity: 3, assignedMemberIds: ['m1', 'm2', 'm3'] },
    ],
    paidByMemberId: 'm1',
    taxPercent: 10,
    tipPercent: 5,
    splitMode: 'ITEMIZED',
  };

  it('should calculate member breakdowns correctly', () => {
    const breakdowns = calculateMemberBreakdowns(mockBill);

    // Verify all members have breakdowns
    expect(breakdowns).toHaveLength(3);

    // Alice: Pizza (100k/3) + Pasta (60k/2) + Drink (45k/3) = 33.33k + 30k + 15k = 78.33k
    const alice = breakdowns.find(b => b.memberId === 'm1');
    expect(alice?.subtotal).toBeCloseTo(78333.33, 0);

    // Bob: Pizza (100k/3) + Pasta (60k/2) + Drink (45k/3) = 33.33k + 30k + 15k = 78.33k
    const bob = breakdowns.find(b => b.memberId === 'm2');
    expect(bob?.subtotal).toBeCloseTo(78333.33, 0);

    // Charlie: Pizza (100k/3) + Drink (45k/3) = 33.33k + 15k = 48.33k
    const charlie = breakdowns.find(b => b.memberId === 'm3');
    expect(charlie?.subtotal).toBeCloseTo(48333.33, 0);
  });

  it('should calculate tax and tip proportionally', () => {
    const breakdowns = calculateMemberBreakdowns(mockBill);
    const totalBill = 205000; // 100k + 60k + 45k
    const totalTax = totalBill * 0.1; // 20.5k
    const totalTip = totalBill * 0.05; // 10.25k

    const sumTax = breakdowns.reduce((sum, b) => sum + b.taxAmount, 0);
    const sumTip = breakdowns.reduce((sum, b) => sum + b.tipAmount, 0);

    expect(sumTax).toBeCloseTo(totalTax, 0);
    expect(sumTip).toBeCloseTo(totalTip, 0);
  });

  it('should calculate settlements with min transactions', () => {
    const breakdowns = calculateMemberBreakdowns(mockBill);
    const settlements = calculateSettlements(breakdowns);

    // Verify total settlement amounts balance
    const totalPaid = settlements.reduce((sum, s) => sum + s.amount, 0);
    expect(totalPaid).toBeGreaterThan(0);

    // Alice paid upfront, so she should be a creditor
    expect(settlements.every(s => s.toMemberId === 'm1')).toBe(true);
  });

  it('should handle empty items', () => {
    const emptyBill: BillSession = {
      ...mockBill,
      items: [],
    };

    const breakdowns = calculateMemberBreakdowns(emptyBill);
    expect(breakdowns.every(b => b.totalOwed === 0)).toBe(true);
  });

  it('should handle unassigned items', () => {
    const billWithUnassigned: BillSession = {
      ...mockBill,
      items: [
        { id: 'i1', name: 'Item', price: 100, quantity: 1, assignedMemberIds: [] },
      ],
    };

    const breakdowns = calculateMemberBreakdowns(billWithUnassigned);
    expect(breakdowns.every(b => b.subtotal === 0)).toBe(true);
  });
});
