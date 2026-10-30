import { useBillStore } from '../../store/useBillStore';
import { calculateBillTotals, calculateMemberBreakdowns } from '../../utils/calculations';
import { formatCurrency, formatShortDate } from '../../utils/formatters';
import { Avatar } from '../ui/Avatar';
import { useLocale, t } from '../../hooks/useLocale';

export function LiveReceiptCard() {
  const { currentBill, updateTax, updateTip } = useBillStore();
  const { locale } = useLocale();

  if (!currentBill) return null;

  const members = Array.isArray(currentBill.members) ? currentBill.members : [];
  const currency = currentBill.currency || 'VND';
  const isReadOnly = Boolean(currentBill.isSharedBill);
  const isTimeline = currentBill.mode === 'TIMELINE';

  const breakdowns = calculateMemberBreakdowns(currentBill);
  const { subtotal: billSubtotal, tax: totalTax, tip: totalTip, total: grandTotal, itemCount } = calculateBillTotals(currentBill);
  const taxPercent = Number(currentBill.taxPercent) || 0;
  const tipPercent = Number(currentBill.tipPercent) || 0;

  const payer = !isTimeline ? members.find((member) => member.id === currentBill.paidByMemberId) : undefined;
  const average = members.length > 0 ? grandTotal / members.length : 0;

  return (
    <section className="paper paper-edge bg-surface text-ink rounded-t-2xl px-4 sm:px-5 pt-5 pb-6 mb-3 shadow-lg shadow-black/10 w-full max-w-full overflow-hidden">
      <header className="text-center pb-4">
        <h2 className="text-base sm:text-lg font-bold leading-snug break-words px-2">
          {currentBill.title || t('receiptTitle', locale)}
        </h2>
        <p className="text-xs text-ink-3 mt-1 num">
          {formatShortDate(currentBill.date || new Date().toISOString(), locale)}
        </p>
      </header>

      <div className="border-t border-dashed border-line pt-4 space-y-2 receipt-font text-xs sm:text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-2 truncate">
            {t('itemSubtotalCount', locale, { count: itemCount })}
          </span>
          <span className="font-semibold shrink-0">{formatCurrency(billSubtotal, currency)}</span>
        </div>
        {totalTax > 0 && (
          <div className="flex items-center justify-between gap-3 text-ink-2">
            <span className="truncate">
              {t('taxLabel', locale).replace(' (%)', '')}{!isTimeline && ` ${taxPercent}%`}
            </span>
            <span className="shrink-0">{formatCurrency(totalTax, currency)}</span>
          </div>
        )}
        {totalTip > 0 && (
          <div className="flex items-center justify-between gap-3 text-ink-2">
            <span className="truncate">
              {t('serviceFee', locale)}{!isTimeline && ` ${tipPercent}%`}
            </span>
            <span className="shrink-0">{formatCurrency(totalTip, currency)}</span>
          </div>
        )}
      </div>

      {/* DÒNG TỔNG CỘNG ĐÃ ĐƯỢC CHỐNG TRÀN VÀ ĐIỀU CHỈNH FONT MOBILE */}
      <div className="mt-3 pt-3 border-t border-dashed border-line flex items-baseline justify-between gap-2">
        <span className="font-bold text-sm shrink-0">{t('total', locale)}</span>
        <span className="receipt-font text-lg sm:text-2xl font-bold text-accent tracking-tight truncate text-right">
          {formatCurrency(grandTotal, currency)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
        <div className="rounded-xl bg-surface-2 p-2.5 sm:px-3 sm:py-2 min-w-0">
          <dt className="text-[11px] sm:text-xs text-ink-3 truncate">{t('averagePerPerson', locale)}</dt>
          <dd className="font-bold num truncate mt-0.5">{formatCurrency(average, currency)}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-2.5 sm:px-3 sm:py-2 min-w-0">
          <dt className="text-[11px] sm:text-xs text-ink-3 truncate">{t('payer', locale)}</dt>
          <dd className="font-bold truncate mt-0.5">{payer?.name ?? t('noPayerSelected', locale)}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <h3 className="text-xs sm:text-sm font-semibold mb-2">{t('eachPersonPays', locale)}</h3>
        {breakdowns.length === 0 ? (
          <p className="text-xs sm:text-sm text-ink-3">{t('noMembersYet', locale)}</p>
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {breakdowns.map((breakdown) => {
              const member = members.find((entry) => entry.id === breakdown.memberId);
              const isPayer = !isTimeline && member?.id === currentBill.paidByMemberId;
              return (
                <details key={breakdown.memberId} className="group">
                  <summary className="flex items-center gap-2.5 sm:gap-3 py-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <Avatar member={member} size="sm" className="shrink-0" />
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-medium text-xs sm:text-sm truncate">{member?.name}</span>
                        {isPayer && (
                          <span className="shrink-0 text-[10px] font-semibold text-warn bg-warn/10 px-1.5 py-0.5 rounded">
                            {t('payerShort', locale)}
                          </span>
                        )}
                      </div>
                      {breakdown.subtotal === 0 && (
                        <span className="text-[10px] text-ink-3 block truncate">{t('noItemsYet', locale)}</span>
                      )}
                    </div>
                    <span className="receipt-font text-xs sm:text-sm font-bold text-ink shrink-0">
                      {formatCurrency(breakdown.totalOwed, currency)}
                    </span>
                  </summary>

                  <div className="pb-3 pl-8 sm:pl-9 space-y-1 text-xs receipt-font text-ink-2">
                    <div className="flex justify-between gap-2">
                      <span className="truncate">{t('food', locale)}</span>
                      <span className="shrink-0">{formatCurrency(breakdown.subtotal, currency)}</span>
                    </div>
                    {breakdown.taxAmount > 0 && (
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{t('taxLabel', locale).replace(' (%)', '')}</span>
                        <span className="shrink-0">{formatCurrency(breakdown.taxAmount, currency)}</span>
                      </div>
                    )}
                    {breakdown.tipAmount > 0 && (
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{t('serviceFee', locale)}</span>
                        <span className="shrink-0">{formatCurrency(breakdown.tipAmount, currency)}</span>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>

      {!isReadOnly && currentBill.mode === 'SINGLE' && (
        <details className="mt-4 sm:mt-5 rounded-xl border border-line px-3 py-2 text-xs sm:text-sm">
          <summary className="cursor-pointer text-ink-3 font-medium select-none">+ {t('taxAndServiceFee', locale)}</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-[11px] sm:text-xs text-ink-2">
              {t('taxLabel', locale)}
              <div className="mt-1 flex items-center gap-2">
                <input
                  aria-label={t('taxLabel', locale)}
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={taxPercent === 0 ? '' : taxPercent}
                  placeholder="0"
                  onChange={(event) => {
                    const val = event.target.value;
                    const num = val === '' ? 0 : Number(val);
                    updateTax(Math.min(100, Math.max(0, num)));
                  }}
                  className="field h-8 sm:h-9 min-w-0 pr-2 num text-xs sm:text-sm"
                />
                <span className="shrink-0 font-bold">%</span>
              </div>
            </label>
            <label className="text-[11px] sm:text-xs text-ink-2">
              {t('serviceLabel', locale)}
              <div className="mt-1 flex items-center gap-2">
                <input
                  aria-label={t('serviceLabel', locale)}
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={tipPercent === 0 ? '' : tipPercent}
                  placeholder="0"
                  onChange={(event) => {
                    const val = event.target.value;
                    const num = val === '' ? 0 : Number(val);
                    updateTip(Math.min(100, Math.max(0, num)));
                  }}
                  className="field h-8 sm:h-9 min-w-0 pr-2 num text-xs sm:text-sm"
                />
                <span className="shrink-0 font-bold">%</span>
              </div>
            </label>
          </div>
        </details>
      )}
    </section>
  );
}