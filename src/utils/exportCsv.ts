import type { Locale } from '../hooks/useLocale';
import { t } from '../hooks/useLocale';
import { calculateBillTotals, calculateMemberBreakdowns, calculateSettlements } from './calculations';
import type { BillSession, Member } from '../types/bill';
import { formatDate } from './formatters';

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textCell(value: string | number): string {
  return `<td class="text-cell">${escapeHtml(value)}</td>`;
}

function numberCell(value: string | number): string {
  return `<td class="number-cell">${escapeHtml(value)}</td>`;
}

function headerCell(value: string): string {
  return `<th>${escapeHtml(value)}</th>`;
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
  const overviewRows = [
    `<tr>${textCell(label('csvTitle'))}${textCell(bill.title || label('receiptTitle'))}</tr>`,
    `<tr>${textCell(label('csvDate'))}${textCell(formatDate(bill.date, supportedLocale))}</tr>`,
    `<tr>${textCell(label('csvCurrency'))}${textCell(bill.currency)}</tr>`,
    `<tr>${textCell(label('csvTotal'))}${numberCell(totals.total)}</tr>`,
  ].join('');

  let detailRows = '';
  if (bill.mode === 'TIMELINE') {
    detailRows += `<tr>${headerCell(label('csvExpense'))}${headerCell(label('csvPayer'))}${headerCell(label('csvAmount'))}${headerCell(label('csvBeneficiaries'))}</tr>`;
    for (const expense of bill.expenses || []) {
      const subtotal = (expense.items || []).reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
        0,
      );
      const amount = subtotal * (1 + (Number(expense.taxPercent) || 0) / 100 + (Number(expense.tipPercent) || 0) / 100);
      detailRows += `<tr>${textCell(expense.title || '')}${textCell(members.find((member) => member.id === expense.payerId)?.name || '')}${numberCell(amount)}${textCell(Array.isArray(expense.participantIds) ? memberNames(expense.participantIds, members) : '')}</tr>`;
    }
  } else {
    detailRows += `<tr>${headerCell(label('csvItem'))}${headerCell(label('csvUnitPrice'))}${headerCell(label('csvQuantity'))}${headerCell(label('csvAmount'))}${headerCell(label('csvParticipants'))}</tr>`;
    for (const item of bill.items || []) {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      detailRows += `<tr>${textCell(item.name)}${numberCell(price)}${numberCell(quantity)}${numberCell(price * quantity)}${textCell(memberNames(item.assignedMemberIds, members))}</tr>`;
    }
  }

  const settlements = calculateSettlements(calculateMemberBreakdowns(bill));
  let settlementTable = '';
  if (settlements.length > 0) {
    const settlementRows = settlements.map((settlement) => `<tr>${textCell(members.find((member) => member.id === settlement.fromMemberId)?.name || '')}${textCell(members.find((member) => member.id === settlement.toMemberId)?.name || '')}${numberCell(settlement.amount)}</tr>`).join('');
    settlementTable = `<h2>${escapeHtml(label('csvTransfers'))}</h2><table><tr>${headerCell(label('csvSender'))}${headerCell(label('csvRecipient'))}${headerCell(label('csvAmount'))}</tr>${settlementRows}</table>`;
  }

  const template = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="text/html; charset=UTF-8" />
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; margin-bottom: 18px; }
    th { background-color: #10b981; color: #ffffff; font-weight: bold; border: 1px solid #d1d5db; padding: 6px 12px; }
    td { border: 1px solid #e5e7eb; padding: 6px 10px; }
    h1 { font-family: Arial, sans-serif; font-size: 18px; color: #111827; }
    h2 { font-family: Arial, sans-serif; font-size: 14px; color: #111827; }
    .number-cell { text-align: right; mso-number-format: "#,##0.00"; }
    .text-cell { text-align: left; }
  </style>
</head>
<body>
  <h1>${escapeHtml(bill.title || label('receiptTitle'))}</h1>
  <table>${overviewRows}</table>
  <h2>${escapeHtml(label('csvDetails'))}</h2>
  <table>${detailRows}</table>
  ${settlementTable}
</body>
</html>`;

  const excelBlob = new Blob(['\uFEFF' + template], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const downloadUrl = URL.createObjectURL(excelBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${(bill.title || 'bill').replace(/\s+/g, '_')}_fairshare.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
