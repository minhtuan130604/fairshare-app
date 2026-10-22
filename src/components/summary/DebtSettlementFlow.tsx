import { ArrowRight, CheckCircle2, Circle, QrCode, X } from 'lucide-react';
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

  const isVnd = (currentBill.currency as string) === 'VND' || (currentBill.currency as string) === 'VNĐ';
  const isRub = (currentBill.currency as string) === 'RUB';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} đã được sao chép!`);
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
            const from = currentBill.members.find((member) => member.id === settlement.fromMemberId);
            const to = currentBill.members.find((member) => member.id === settlement.toMemberId);
            const isPaid = paid.has(key);
            const markerLabel = isPaid ? t('unmarkPaid', locale) : t('markPaid', locale);

            // Lấy thông tin thanh toán: Lấy trực tiếp từ thành viên nhận tiền
            const recipientMember = to;
            const recipientBankName = recipientMember?.bank_name || '';
            const recipientAccountNumber = recipientMember?.account_number || recipientMember?.bankInfo || '';
            const recipientAccountHolder = recipientMember?.account_holder || recipientMember?.name || '';
            const recipientPhoneNumber = recipientMember?.phone_number || '';
            const recipientRussiaBank = recipientMember?.russia_bank || '';
            const recipientCustomQrUrl = recipientMember?.custom_qr_url || '';

            // Kiểm tra xem đã có thông tin nhận tiền chưa
            const hasPaymentInfo = Boolean(
              recipientAccountNumber ||
              (isRub && (recipientPhoneNumber || recipientRussiaBank || recipientCustomQrUrl)) ||
              (!isRub && !isVnd && recipientCustomQrUrl)
            );

            return (
              <li
                key={key}
                className={`rounded-xl border border-line bg-surface-2/60 p-3 transition-colors space-y-2 ${
                  isPaid ? 'opacity-60' : ''
                }`}
              >
                {/* HÀNG TRÊN: Luồng tiền và nút check hoàn thành */}
                <div className="flex items-center justify-between gap-2">
                  {/* Cụm luồng tiền: Từ -> Tiền -> Đến */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Người gửi */}
                    <div className="flex items-center gap-1.5 min-w-0 max-w-[35%] shrink-0">
                      <Avatar member={from} size="sm" className="shrink-0" />
                      <span className="font-medium text-xs sm:text-sm truncate text-ink">{from?.name}</span>
                    </div>

                    {/* Số tiền & Mũi tên */}
                    <div className="flex flex-col items-center shrink-0 px-1">
                      <span
                        className={`text-xs font-semibold num whitespace-nowrap ${
                          isPaid ? 'line-through text-ink-3' : 'text-accent'
                        }`}
                      >
                        {formatCurrency(settlement.amount, currentBill.currency)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-ink-3" />
                    </div>

                    {/* Người nhận */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Avatar member={to} size="sm" className="shrink-0" />
                      <span className="font-medium text-xs sm:text-sm truncate text-ink">{to?.name}</span>
                    </div>
                  </div>

                  {/* Nút check hoàn thành cố định ở góc phải */}
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-pressed={isPaid}
                    className={`icon-btn shrink-0 p-1 ${isPaid ? 'text-accent' : 'text-ink-3 hover:text-ink'}`}
                    title={markerLabel}
                    aria-label={markerLabel}
                  >
                    {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  </button>
                </div>

                {/* HÀNG DƯỚI: Nút QR hoặc Dòng trạng thái chưa có thông tin */}
                {!isPaid && (
                  <div className="flex items-center justify-between pt-1 border-t border-line/40 text-xs">
                    {hasPaymentInfo ? (
                      <div className="flex items-center gap-2 w-full justify-between">
                        <span className="text-[11px] text-ink-3 truncate">
                          {recipientBankName ? `${recipientBankName} - ${recipientAccountNumber}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveQr({
                              fromName: from?.name || 'Thành viên',
                              toName: to?.name || 'Người nhận',
                              amount: settlement.amount,
                              bankName: recipientBankName,
                              accountNumber: recipientAccountNumber,
                              accountHolder: recipientAccountHolder,
                              phoneNumber: recipientPhoneNumber,
                              russiaBank: recipientRussiaBank,
                              customQrUrl: recipientCustomQrUrl,
                            })
                          }
                          className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 text-accent border-accent/30 shrink-0 ml-auto"
                          title={isRub ? "Thanh toán СБП / QR" : "Xem mã QR"}
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>{isRub ? 'СБП/QR' : 'QR'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="w-full text-right">
                        <span className="text-[11px] text-amber-500/90 italic">
                          {t('noPaymentInfoShort', locale, { name: to?.name || '' })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {allPaid && (
          <p className="text-center text-sm font-semibold text-accent bg-accent-soft rounded-xl py-3">
            {t('everyonePaid', locale)}
          </p>
        )}
      </section>

      {activeQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-line rounded-2xl p-5 max-w-xs sm:max-w-sm w-full space-y-4 text-center relative shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveQr(null)}
              className="absolute top-3 right-3 icon-btn"
            >
              <X className="w-4 h-4" />
            </button>

            {isRub ? (
              <div className="space-y-4">
                <h4 className="font-bold text-base">Thanh toán СБП / QR</h4>
                {activeQr.customQrUrl && (
                  <img
                    src={`https://img.vietqr.io/image/${activeQr.bankName || 'MB'}-${activeQr.accountNumber}-compact2.png?amount=${Math.round(
                      activeQr.amount
                    )}&addInfo=${encodeURIComponent(
                      (currentBill.title || 'FairShare').slice(0, 25)
                    )}&accountName=${encodeURIComponent(activeQr.accountHolder)}`}
                    alt="Mã VietQR"
                    className="w-56 h-auto mx-auto rounded"
                  />
                )}
                <div className="text-left bg-surface-2 p-3 rounded-xl text-xs space-y-2">
                  {activeQr.phoneNumber && (
                    <div className="flex justify-between items-center">
                      <span>SĐT: <span className="font-bold">{activeQr.phoneNumber}</span></span>
                      <button onClick={() => copyToClipboard(activeQr.phoneNumber || '', 'SĐT')} className="text-accent underline">Copy</button>
                    </div>
                  )}
                  {activeQr.russiaBank && (
                    <div>Ngân hàng: <span className="font-medium">{activeQr.russiaBank}</span></div>
                  )}
                  <div className="flex justify-between items-center">
                    <span>Số tiền: <span className="font-bold">{activeQr.amount} ₽</span></span>
                    <button onClick={() => copyToClipboard(activeQr.amount.toString(), 'Số tiền')} className="text-accent underline">Copy</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="font-bold text-base">Thanh toán qua VietQR</h4>
                <div className="bg-white p-3 rounded-xl border border-line inline-block shadow-inner mx-auto">
                  <img
                    src={`https://img.vietqr.io/image/${activeQr.bankName}-${activeQr.accountNumber}-compact2.png?amount=${Math.round(
                      activeQr.amount
                    )}&addInfo=${encodeURIComponent(
                      (currentBill.title || 'FairShare').slice(0, 25)
                    )}&accountName=${encodeURIComponent(activeQr.accountHolder)}`}
                    alt="Mã VietQR"
                    className="w-56 h-auto mx-auto rounded"
                  />
                </div>
                <div className="text-left bg-surface-2 p-3 rounded-xl text-xs space-y-1">
                  <div>Chủ TK: <span className="font-medium">{activeQr.accountHolder}</span></div>
                  <div className="flex justify-between items-center">
                    <span>STK: <span className="font-medium">{activeQr.accountNumber}</span></span>
                    <button onClick={() => copyToClipboard(activeQr.accountNumber, 'STK')} className="text-accent underline">Copy</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}