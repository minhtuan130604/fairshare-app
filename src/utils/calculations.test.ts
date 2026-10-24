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

  it('should guarantee zero-sum invariant across all netBalances', () => {
    const breakdowns = calculateMemberBreakdowns(mockBill);
    const sumNetBalance = breakdowns.reduce((sum, b) => sum + b.netBalance, 0);

    expect(Math.abs(sumNetBalance)).toBeLessThan(0.001);
  });

  it('should handle decimal quantities accurately (e.g. OCR weight items)', () => {
    const decimalBill: BillSession = {
      ...mockBill,
      items: [
        { id: 'i1', name: 'Ốc hương (kg)', price: 650000, quantity: 1.5, assignedMemberIds: ['m1', 'm2'] },
      ],
      taxPercent: 8,
      tipPercent: 0,
    };

    const breakdowns = calculateMemberBreakdowns(decimalBill);
    const m1 = breakdowns.find(b => b.memberId === 'm1');
    const m2 = breakdowns.find(b => b.memberId === 'm2');

    expect(m1?.subtotal).toBeCloseTo(487500, 2);
    expect(m2?.subtotal).toBeCloseTo(487500, 2);
    expect(m1?.taxAmount).toBeCloseTo(39000, 2);
    expect(m2?.taxAmount).toBeCloseTo(39000, 2);
  });

  it('should not charge tax or tip to members with zero subtotal', () => {
    const billWithFreeRider: BillSession = {
      ...mockBill,
      items: [
        { id: 'i1', name: 'Hotpot', price: 200000, quantity: 1, assignedMemberIds: ['m1', 'm2'] },
      ],
      taxPercent: 10,
      tipPercent: 5,
    };

    const breakdowns = calculateMemberBreakdowns(billWithFreeRider);
    const m3 = breakdowns.find(b => b.memberId === 'm3');

    expect(m3?.subtotal).toBe(0);
    expect(m3?.taxAmount).toBe(0);
    expect(m3?.tipAmount).toBe(0);
    expect(m3?.totalOwed).toBe(0);
    expect(m3?.netBalance).toBe(0);
  });

  it('should verify settlements completely clear all debts', () => {
    const complexBill: BillSession = {
      ...mockBill,
      members: [
        { id: 'm1', name: 'Alice', avatarColor: 'bg-blue-500' },
        { id: 'm2', name: 'Bob', avatarColor: 'bg-green-500' },
        { id: 'm3', name: 'Charlie', avatarColor: 'bg-red-500' },
        { id: 'm4', name: 'David', avatarColor: 'bg-yellow-500' },
      ],
      items: [
        { id: 'i1', name: 'Món 1', price: 120000, quantity: 1, assignedMemberIds: ['m1', 'm2'] },
        { id: 'i2', name: 'Món 2', price: 80000, quantity: 1, assignedMemberIds: ['m3', 'm4'] },
      ],
      paidByMemberId: 'm1',
      taxPercent: 0,
      tipPercent: 0,
    };

    const breakdowns = calculateMemberBreakdowns(complexBill);
    const settlements = calculateSettlements(breakdowns);

    const remainingBalances = new Map(breakdowns.map(b => [b.memberId, b.netBalance]));
    for (const s of settlements) {
      remainingBalances.set(s.fromMemberId, (remainingBalances.get(s.fromMemberId) || 0) + s.amount);
      remainingBalances.set(s.toMemberId, (remainingBalances.get(s.toMemberId) || 0) - s.amount);
    }

    for (const balance of remainingBalances.values()) {
      expect(Math.abs(balance)).toBeLessThan(0.01);
    }
  });
});