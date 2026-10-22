import { useBillStore } from '../../store/useBillStore';
import { calculateMemberBreakdowns } from '../../utils/calculations';
import { formatCurrency, formatShortDate } from '../../utils/formatters';
import { Avatar } from '../ui/Avatar';
import { useLocale, t } from '../../hooks/useLocale';

export function LiveReceiptCard() {
  const { currentBill } = useBillStore();
  const { locale } = useLocale();
  if (!currentBill) return null;

  const currency = currentBill.currency;
  const breakdowns = calculateMemberBreakdowns(currentBill);
  const billSubtotal = currentBill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalTax = billSubtotal * (currentBill.taxPercent / 100);
  const totalTip = billSubtotal * (currentBill.tipPercent / 100);
  const grandTotal = billSubtotal + totalTax + totalTip;
  const payer = currentBill.members.find((member) => member.id === currentBill.paidByMemberId);
  const average = currentBill.members.length > 0 ? grandTotal / currentBill.members.length : 0;

  return <section className="paper paper-edge bg-surface text-ink rounded-t-2xl px-5 pt-5 pb-6 mb-3 shadow-lg shadow-black/10">
    <header className="text-center pb-4">
      <h2 className="text-lg font-bold leading-snug break-words">{currentBill.title || t('receiptTitle', locale)}</h2>
      <p className="text-xs text-ink-3 mt-1 num">{formatShortDate(currentBill.date)}</p>
    </header>
    <div className="border-t border-dashed border-line pt-4 space-y-2 receipt-font text-sm">
      <div className="flex justify-between gap-3"><span className="text-ink-2">{t('itemSubtotalCount', locale, { count: currentBill.items.length })}</span><span>{formatCurrency(billSubtotal, currency)}</span></div>
      {currentBill.taxPercent > 0 && <div className="flex justify-between gap-3 text-ink-2"><span>{t('taxLabel', locale).replace(' (%)', '')} {currentBill.taxPercent}%</span><span>{formatCurrency(totalTax, currency)}</span></div>}
      {currentBill.tipPercent > 0 && <div className="flex justify-between gap-3 text-ink-2"><span>{t('serviceFee', locale)} {currentBill.tipPercent}%</span><span>{formatCurrency(totalTip, currency)}</span></div>}
    </div>
    <div className="mt-3 pt-3 border-t border-dashed border-line flex items-baseline justify-between gap-3"><span className="font-semibold">{t('total', locale)}</span><span className="receipt-font text-xl font-semibold text-accent">{formatCurrency(grandTotal, currency)}</span></div>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-xs text-ink-3">{t('averagePerPerson', locale)}</dt><dd className="font-semibold num">{formatCurrency(average, currency)}</dd></div>
      <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-xs text-ink-3">{t('payer', locale)}</dt><dd className="font-semibold truncate">{payer?.name ?? t('noPayerSelected', locale)}</dd></div>
    </dl>
    <div className="mt-5"><h3 className="text-sm font-semibold mb-2">{t('eachPersonPays', locale)}</h3>
      {breakdowns.length === 0 ? <p className="text-sm text-ink-3">{t('noMembersYet', locale)}</p> : <div className="divide-y divide-line border-y border-line">
        {breakdowns.map((breakdown) => {
          const member = currentBill.members.find((entry) => entry.id === breakdown.memberId);
          const isPayer = member?.id === currentBill.paidByMemberId;
          return <details key={breakdown.memberId} className="group"><summary className="flex items-center gap-3 py-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <Avatar member={member} size="sm" /><div className="flex-1 min-w-0"><span className="font-medium">{member?.name}</span>
              {isPayer && <span className="ml-2 text-xs text-warn">{t('payerShort', locale)}</span>}{breakdown.subtotal === 0 && <span className="ml-2 text-xs text-ink-3">{t('noItemsYet', locale)}</span>}</div>
            <span className="receipt-font text-sm font-semibold">{formatCurrency(breakdown.totalOwed, currency)}</span>
          </summary><div className="pb-3 pl-9 space-y-1 text-xs receipt-font text-ink-2">
            <div className="flex justify-between"><span>{t('food', locale)}</span><span>{formatCurrency(breakdown.subtotal, currency)}</span></div>
            {breakdown.taxAmount > 0 && <div className="flex justify-between"><span>{t('taxLabel', locale).replace(' (%)', '')}</span><span>{formatCurrency(breakdown.taxAmount, currency)}</span></div>}
            {breakdown.tipAmount > 0 && <div className="flex justify-between"><span>{t('serviceFee', locale)}</span><span>{formatCurrency(breakdown.tipAmount, currency)}</span></div>}
          </div></details>;
        })}
      </div>}
    </div>
  </section>;
}
