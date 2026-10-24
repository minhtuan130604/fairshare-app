import { ArrowRight, CheckCircle2, Circle, QrCode, X, Copy, Check } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { calculateMemberBreakdowns, calculateSettlements } from '../../utils/calculations';
import { formatCurrency } from '../../utils/formatters';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { Avatar } from '../ui/Avatar';
import { useLocale, t } from '../../hooks/useLocale';

interface ActiveQrData {
  fromName: string;
  toName: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  phoneNumber?: string;
  russiaBank?: string;
  customQrUrl?: string;
}

export function DebtSettlementFlow() {
  const { currentBill } = useBillStore();
  const { locale } = useLocale();

  const [paid, setPaid] = useState<Set<string>>(new Set());
  const [activeQr, setActiveQr] = useState<ActiveQrData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const members = Array.isArray(currentBill?.members) ? currentBill.members : [];

  const settlements = useMemo(
    () => (currentBill ? calculateSettlements(calculateMemberBreakdowns(currentBill)) : []),
    [currentBill]
  );

  const keyOf = (settlement: (typeof settlements)[number]) =>
    `${settlement.fromMemberId}>${settlement.toMemberId}:${Math.round(settlement.amount)}`;

  const paidCount = settlements.filter((settlement) => paid.has(keyOf(settlement))).length;
  const allPaid = settlements.length > 0 && paidCount === settlements.length;

  useEffect(() => {
    if (!allPaid) return;
    const end = Date.now() + 1500;
    let raf = 0;
    const frame = () => {
      const colors = ['#0f7b66', '#48c7a3', '#e3ac5a'];
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [allPaid]);

  if (!currentBill) return null;

  const toggle = (key: string) =>
    setPaid((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (settlements.length === 0) {
    return (
      <section className="card p-5">
        <h2 className="text-base font-semibold">{t('settlementTitle', locale)}</h2>
        <p className="mt-3 text-sm text-ink-3">{t('noSettlements', locale)}</p>
      </section>
    );
  }

  const currency = (currentBill.currency as string) || 'VND';
  const isRub = currency === 'RUB';

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <>
      <section className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t('settlementTitle', locale)}</h2>
            <p className="text-sm text-ink-3">
              {t('settlementCount', locale, { count: settlements.length })}
            </p>
          </div>
          <span className="text-xs font-medium text-ink-2 bg-surface-2 rounded-full px-3 py-1 num shrink-0">
            {t('doneCount', locale, { paid: paidCount, total: settlements.length })}
          </span>
        </div>

        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden" aria-hidden="true">
          <motion.div
            initial={false}
            animate={{ width: `${(paidCount / settlements.length) * 100}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="h-full bg-accent rounded-full"
          />
        </div>

        <ul className="space-y-2">
          {settlements.map((settlement) => {
            const key = keyOf(settlement);
            const from = members.find((m) => m.id === settlement.fromMemberId);
            const to = members.find((m) => m.id === settlement.toMemberId);
            const isPaid = paid.has(key);

            const recipient = to;
            const hasPaymentInfo = Boolean(
              recipient?.account_number ||
              (isRub && (recipient?.phone_number || recipient?.russia_bank)) ||
              recipient?.custom_qr_url
            );

            return (
              <li
                key={key}
                className={`rounded-xl border border-line bg-surface-2/60 p-3 transition-colors space-y-2 ${
                  isPaid ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0 max-w-[35%] shrink-0">
                      <Avatar member={from} size="sm" className="shrink-0" />
                      <span className="font-medium text-xs sm:text-sm truncate text-ink">
                        {from?.name}
                      </span>
                    </div>

                    <div className="flex flex-col items-center shrink-0 px-1">
                      <span
                        className={`text-xs font-semibold num whitespace-nowrap ${
                          isPaid ? 'line-through text-ink-3' : 'text-accent'
                        }`}
                      >
                        {formatCurrency(settlement.amount, currency)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-ink-3" />
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Avatar member={to} size="sm" className="shrink-0" />
                      <span className="font-medium text-xs sm:text-sm truncate text-ink">
                        {to?.name}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-pressed={isPaid}
                    className={`icon-btn shrink-0 p-1 ${
                      isPaid ? 'text-accent' : 'text-ink-3 hover:text-ink'
                    }`}
                  >
                    {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  </button>
                </div>

                {!isPaid && (
                  <div className="flex items-center justify-between pt-1 border-t border-line/40 text-xs">
                    {hasPaymentInfo ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveQr({
                            fromName: from?.name || '',
                            toName: to?.name || '',
                            amount: settlement.amount,
                            bankName: to?.bank_name || '',
                            accountNumber: to?.account_number || '',
                            accountHolder: to?.account_holder || '',
                            phoneNumber: to?.phone_number,
                            russiaBank: to?.russia_bank,
                            customQrUrl: to?.custom_qr_url,
                          })
                        }
                        className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 text-accent border-accent/30 shrink-0 ml-auto"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{isRub ? 'СБП / QR' : 'VietQR'}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-amber-500/90 italic ml-auto">
                        {t('noPaymentInfoShort', locale, { name: to?.name || '' })}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Modal QR Code & Thông tin chuyển khoản */}
      {activeQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-line rounded-2xl p-5 max-w-xs sm:max-w-sm w-full space-y-4 text-center relative shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveQr(null)}
              className="absolute top-3 right-3 icon-btn text-ink-3 hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="font-bold text-base">
              {isRub ? 'Thanh toán СБП' : 'Mã chuyển khoản QR'}
            </h4>

            {activeQr.customQrUrl ? (
              <div className="bg-white p-3 rounded-xl border border-line inline-block mx-auto">
                <img
                  src={activeQr.customQrUrl}
                  alt="Custom QR"
                  className="w-56 h-auto mx-auto rounded"
                />
              </div>
            ) : isRub ? (
              <div className="text-left bg-surface-2 p-3.5 rounded-xl text-xs space-y-2.5">
                {activeQr.phoneNumber && (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-ink-3 block text-[10px]">Số điện thoại / SBP</span>
                      <span className="font-bold text-sm text-ink">{activeQr.phoneNumber}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeQr.phoneNumber!, 'phone')}
                      className="icon-btn p-1.5 text-accent hover:bg-accent/10 rounded"
                      title="Copy"
                    >
                      {copiedKey === 'phone' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {activeQr.russiaBank && (
                  <div>
                    <span className="text-ink-3 block text-[10px]">Ngân hàng</span>
                    <span className="font-medium text-ink">{activeQr.russiaBank}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-line/60 flex items-center justify-between">
                  <span className="text-ink-3">Số tiền cần chuyển:</span>
                  <span className="font-bold text-sm text-accent">
                    {Math.round(activeQr.amount).toLocaleString()} ₽
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-white p-3 rounded-xl border border-line inline-block shadow-inner mx-auto">
                  <img
                    src={`https://img.vietqr.io/image/${activeQr.bankName || 'MB'}-${activeQr.accountNumber}-compact2.png?amount=${Math.round(
                      activeQr.amount
                    )}&addInfo=${encodeURIComponent(
                      (currentBill.title || 'FairShare').slice(0, 25)
                    )}&accountName=${encodeURIComponent(activeQr.accountHolder || '')}`}
                    className="w-56 h-auto mx-auto rounded"
                    alt="VietQR"
                  />
                </div>
                {activeQr.accountNumber && (
                  <div className="text-xs text-ink-3 flex items-center justify-center gap-1.5">
                    <span>STK: <b>{activeQr.accountNumber}</b> ({activeQr.bankName})</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeQr.accountNumber, 'acc')}
                      className="text-accent hover:underline inline-flex items-center gap-0.5"
                    >
                      {copiedKey === 'acc' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}