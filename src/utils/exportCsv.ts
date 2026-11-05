import { calculateBillTotals, calculateMemberBreakdowns, calculateSettlements } from './calculations';
import type { BillSession, Member } from '../types/bill';


const EXCEL_I18N = {
  vi: {
    billTitle: 'Tên hóa đơn', date: 'Ngày', currency: 'Loại tiền', grandTotal: 'Tổng cộng',
    details: 'Chi tiết chi tiêu', item: 'Món / Khoản chi', stage: 'Chặng', payer: 'Người ứng tiền',
    time: 'Thời gian', unitPrice: 'Đơn giá', quantity: 'Số lượng', total: 'Thành tiền',
    participants: 'Người tham gia', settlements: 'Chuyển khoản / Bù trừ công nợ', sender: 'Người chuyển',
    receiver: 'Người nhận', amount: 'Số tiền', noAssignment: 'Chưa gán', subtotal: 'Tổng tạm tính',
  },
  ru: {
    billTitle: 'Название счёта', date: 'Дата', currency: 'Валюта', grandTotal: 'Общая сумма',
    details: 'Детали расходов', item: 'Позиция / Расход', stage: 'Этап', payer: 'Оплатил', time: 'Время',
    unitPrice: 'Цена за единицу', quantity: 'Количество', total: 'Сумма', participants: 'Участники',
    settlements: 'Переводы / Долги', sender: 'Отправитель', receiver: 'Получатель', amount: 'Сумма',
    noAssignment: 'Не назначено', subtotal: 'Промежуточный итог',
  },
  en: {
    billTitle: 'Bill Title', date: 'Date', currency: 'Currency', grandTotal: 'Total Amount',
    details: 'Expense Details', item: 'Item / Expense', stage: 'Stage', payer: 'Paid By', time: 'Time',
    unitPrice: 'Unit Price', quantity: 'Qty', total: 'Total', participants: 'Participants',
    settlements: 'Transfers / Debts', sender: 'Sender', receiver: 'Receiver', amount: 'Amount',
    noAssignment: 'Unassigned', subtotal: 'Subtotal',
  },
  zh: {
    billTitle: '账单名称', date: '日期', currency: '货币', grandTotal: '总金额', details: '费用明细',
    item: '项目 / 费用', stage: '阶段', payer: '付款人', time: '时间', unitPrice: '单价', quantity: '数量',
    total: '小计', participants: '参与人', settlements: '转账 / 结算', sender: '付款方', receiver: '收款方',
    amount: '金额', noAssignment: '未分配', subtotal: '小计',
  },
} as const;

type SupportedLocale = keyof typeof EXCEL_I18N;

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

const renderExcelNumberCell = (val: number, isCurrency = true): string => {
  if (typeof val !== 'number' || Number.isNaN(val)) return '<td class="number-cell">0</td>';

  const isInt = Number.isInteger(val);
  const numFormat = isInt
    ? (isCurrency ? '#,##0' : '0')
    : (isCurrency ? '#,##0.00' : '0.##');
  const formattedText = isInt
    ? Math.round(val).toLocaleString('en-US')
    : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<td class="number-cell" style="mso-number-format:'${numFormat}';">${escapeHtml(formattedText)}</td>`;
};


function headerCell(value: string): string {
  return `<th>${escapeHtml(value)}</th>`;
}

function memberNames(ids: string[] | undefined, members: Member[]): string {
  if (!Array.isArray(ids)) return '';
  return ids.map((id) => members.find((member) => member.id === id)?.name).filter(Boolean).join(', ');
}

export function exportBillToCsv(bill: BillSession, locale: string): void {
  const currentLocale: SupportedLocale = (['vi', 'ru', 'en', 'zh'].includes(locale) ? locale : 'vi') as SupportedLocale;
  const dict = EXCEL_I18N[currentLocale];
  const localeMap: Record<SupportedLocale, string> = {
    vi: 'vi-VN',
    ru: 'ru-RU',
    zh: 'zh-CN',
    en: 'en-US',
  };
  const formattedDate = new Intl.DateTimeFormat(localeMap[currentLocale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(bill.date || Date.now()));
  const members = [
    ...(Array.isArray(bill.members) ? bill.members : []),
    ...(bill.mode === 'TIMELINE' && Array.isArray(bill.timelineMembers) ? bill.timelineMembers : []),
  ].filter((member, index, list) => list.findIndex((candidate) => candidate.id === member.id) === index);

  const totals = calculateBillTotals(bill);
  const overviewRows = [
    `<tr>${textCell(dict.billTitle)}${textCell(bill.title || dict.billTitle)}</tr>`,
    `<tr>${textCell(dict.date)}${textCell(formattedDate)}</tr>`,
    `<tr>${textCell(dict.currency)}${textCell(bill.currency)}</tr>`,
    `<tr>${textCell(dict.grandTotal)}${renderExcelNumberCell(totals.total)}</tr>`,
  ].join('');

  let detailRows = '';
  if (bill.mode === 'TIMELINE') {
    for (const [index, expense] of (bill.expenses || []).entries()) {
      const payerName = members.find((member) => member.id === expense.payerId)?.name || '';
      const participantNames = memberNames(expense.participantIds, members);
      detailRows += `<tr class="expense-heading"><th colspan="5">${escapeHtml(`${dict.stage} ${index + 1}: ${expense.title || ''} | ${dict.payer}: ${payerName || dict.noAssignment} | ${dict.time}: ${expense.time || dict.noAssignment}`)}</th></tr>`;
      detailRows += `<tr>${headerCell(dict.item)}${headerCell(dict.unitPrice)}${headerCell(dict.quantity)}${headerCell(dict.total)}${headerCell(dict.participants)}</tr>`;
      for (const item of expense.items || []) {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        const itemParticipants = item.assignedMemberIds?.length ? item.assignedMemberIds : expense.participantIds;
        detailRows += `<tr>${textCell(item.name)}${renderExcelNumberCell(price)}${renderExcelNumberCell(quantity, false)}${renderExcelNumberCell(price * quantity)}${textCell(memberNames(itemParticipants, members) || participantNames || dict.noAssignment)}</tr>`;
      }
      const expenseSubtotal = (expense.items || []).reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
        0,
      );
      detailRows += `<tr class="subtotal-row">${textCell(dict.subtotal)}${textCell('')}${textCell('')}${renderExcelNumberCell(expenseSubtotal)}${textCell('')}</tr>`;
    }
  } else {
    detailRows += `<tr>${headerCell(dict.item)}${headerCell(dict.unitPrice)}${headerCell(dict.quantity)}${headerCell(dict.total)}${headerCell(dict.participants)}</tr>`;
    for (const item of bill.items || []) {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      detailRows += `<tr>${textCell(item.name)}${renderExcelNumberCell(price)}${renderExcelNumberCell(quantity, false)}${renderExcelNumberCell(price * quantity)}${textCell(memberNames(item.assignedMemberIds, members) || dict.noAssignment)}</tr>`;
    }
  }

  const settlements = calculateSettlements(calculateMemberBreakdowns(bill));
  let settlementTable = '';
  if (settlements.length > 0) {
    const settlementRows = settlements.map((settlement) => `<tr>${textCell(members.find((member) => member.id === settlement.fromMemberId)?.name || '')}${textCell(members.find((member) => member.id === settlement.toMemberId)?.name || '')}${renderExcelNumberCell(settlement.amount)}</tr>`).join('');
    settlementTable = `<h2>${escapeHtml(dict.settlements)}</h2><table><tr>${headerCell(dict.sender)}${headerCell(dict.receiver)}${headerCell(dict.amount)}</tr>${settlementRows}</table>`;
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
    .number-cell { text-align: right; }
    .text-cell { text-align: left; }
  </style>
</head>
<body>
  <h1>${escapeHtml(bill.title || dict.billTitle)}</h1>
  <table>${overviewRows}</table>
  <h2>${escapeHtml(dict.details)}</h2>
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
