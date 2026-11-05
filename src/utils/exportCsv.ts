import type { Locale } from '../hooks/useLocale';
import { t } from '../hooks/useLocale';
import { calculateBillTotals, calculateMemberBreakdowns, calculateSettlements } from './calculations';
import type { BillSession, Member } from '../types/bill';
import { formatDate } from './formatters';

function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function memberNames(ids: string[] | undefined, members: Member[]): string {
  if (!Array.isArray(ids)) return '';
  return ids.map((id) => members.find((member) => member.id === id)?.name).filter(Boolean).join(', ');
}

export function exportBillToCsv(bill: BillSession, locale: string): void {
  const supportedLocale: Locale = locale === 'vi' || locale === 'ru' || locale === 'zh' ? locale : 'en';
  const label = (key: string) => t(key, supportedLocale);
  const members = bill.mode === 'TIMELINE' && Array.isArray(bill.timelineMembers)
    ? bill.timelineMembers
    : bill.members;
  const totals = calculateBillTotals(bill);
  const rows: (string | number)[][] = [
    [label('csvTitle'), bill.title || label('receiptTitle')],
    [label('csvDate'), formatDate(bill.date, supportedLocale)],
    [label('csvCurrency'), bill.currency],
    [label('csvTotal'), totals.total],
    [],
    [label('csvDetails')],
  ];

  if (bill.mode === 'TIMELINE') {
    rows.push([label('csvExpense'), label('csvPayer'), label('csvAmount'), label('csvBeneficiaries')]);
    for (const expense of bill.expenses || []) {
      const subtotal = (expense.items || []).reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
        0,
      );
      const amount = subtotal * (1 + (Number(expense.taxPercent) || 0) / 100 + (Number(expense.tipPercent) || 0) / 100);
      const beneficiaries = Array.isArray(expense.participantIds)
        ? memberNames(expense.participantIds, members)
        : '';
      rows.push([
        expense.title || '',
        members.find((member) => member.id === expense.payerId)?.name || '',
        amount,
        beneficiaries,
      ]);
    }
  } else {
    rows.push([label('csvItem'), label('csvUnitPrice'), label('csvQuantity'), label('csvAmount'), label('csvParticipants')]);
    for (const item of bill.items || []) {
      rows.push([
        item.name,
        Number(item.price) || 0,
        Number(item.quantity) || 0,
        (Number(item.price) || 0) * (Number(item.quantity) || 0),
        memberNames(item.assignedMemberIds, members),
      ]);
    }
  }

  const settlements = calculateSettlements(calculateMemberBreakdowns(bill));
  if (settlements.length > 0) {
    rows.push([], [label('csvTransfers')], [label('csvSender'), label('csvRecipient'), label('csvAmount')]);
    for (const settlement of settlements) {
      rows.push([
        members.find((member) => member.id === settlement.fromMemberId)?.name || '',
        members.find((member) => member.id === settlement.toMemberId)?.name || '',
        settlement.amount,
      ]);
    }
  }

  const csvString = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const csvBlob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const downloadUrl = URL.createObjectURL(csvBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${(bill.title || 'bill').replace(/\s+/g, '_')}_fairshare.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
