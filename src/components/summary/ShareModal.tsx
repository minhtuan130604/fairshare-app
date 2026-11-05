
import { Download, Check, Users, QrCode, Smartphone, Share2 } from 'lucide-react';
import { exportBillToCsv } from '../../utils/exportCsv';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/useAuthStore';
import { calculateMemberBreakdowns, calculateSettlements } from '../../utils/calculations';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { useLocale, t } from '../../hooks/useLocale';
import { ShareToFriendsModal } from './ShareToFriendsModal';
import { Avatar } from '../ui/Avatar';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { currentBill } = useBillStore();
  const { user } = useAuthStore();
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isShareFriendsOpen, setIsShareFriendsOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!currentBill) return null;

  const currency = (currentBill.currency as string) || 'VND';
  const isVnd = currency === 'VND';
  const isRub = currency === 'RUB';

  const breakdowns = calculateMemberBreakdowns(currentBill);
  const settlements = calculateSettlements(breakdowns);
  const expenses = currentBill.mode === 'TIMELINE' && Array.isArray(currentBill.expenses) ? currentBill.expenses : [];
  
  const billSubtotal = currentBill.mode === 'TIMELINE'
    ? expenses.reduce((sum, expense) => sum + expense.items.reduce((subtotal, item) => subtotal + item.price * item.quantity, 0), 0)
    : currentBill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const totalTax = currentBill.mode === 'TIMELINE'
    ? expenses.reduce((sum, expense) => {
        const subtotal = expense.items.reduce((value, item) => value + item.price * item.quantity, 0);
        return sum + (subtotal * (expense.taxPercent || 0)) / 100;
      }, 0)
    : (billSubtotal * (currentBill.taxPercent || 0)) / 100;

  const totalTip = currentBill.mode === 'TIMELINE'
    ? expenses.reduce((sum, expense) => {
        const subtotal = expense.items.reduce((value, item) => value + item.price * item.quantity, 0);
        return sum + (subtotal * (expense.tipPercent || 0)) / 100;
      }, 0)
    : (billSubtotal * (currentBill.tipPercent || 0)) / 100;

  const grandTotal = billSubtotal + totalTax + totalTip;
  const payableBreakdowns = breakdowns.filter((breakdown) => breakdown.totalOwed > 0);
  const activeBreakdown = payableBreakdowns.find((breakdown) => breakdown.memberId === selectedMemberId) ?? payableBreakdowns[0];
  const activeMember = currentBill.members.find((member) => member.id === activeBreakdown?.memberId);
  const personAmount = activeBreakdown?.totalOwed ?? 0;

  const hasVietQrAccount = Boolean(activeMember?.bank_name && activeMember?.account_number);
  const dynamicVietQrUrl = hasVietQrAccount && activeMember
    ? `https://img.vietqr.io/image/${activeMember.bank_name}-${activeMember.account_number}-compact2.png?amount=${Math.round(personAmount)}&addInfo=${encodeURIComponent(currentBill.title || 'FairShare')}&accountName=${encodeURIComponent(activeMember.account_holder || '')}`
    : '';

  const qrUrl = isVnd
    ? (hasVietQrAccount ? dynamicVietQrUrl : activeMember?.custom_qr_url || '')
    : activeMember?.custom_qr_url || '';

  const getShareURL = () => `${window.location.origin}/bill/${encodeURIComponent(currentBill.id)}`;

  const handleShareURL = async () => {
    const shareUrl = getShareURL();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: currentBill.title || 'FairShare', url: shareUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy share URL:', error);
    }
  };

  const handleExportCsv = () => {
    exportBillToCsv(currentBill, locale);
  };

  const handleExportImage = async () => {
    if (!receiptRef.current) return;

    setExporting(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });

      const link = document.createElement('a');
      link.download = `fairshare-${currentBill.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export:', err);
    } finally {
      setExporting(false);
    }
  };

  const footer = (
    <div className="space-y-3">
      {user && (
        <button
          type="button"
          onClick={() => setIsShareFriendsOpen(true)}
          className="btn btn-secondary w-full py-2.5 text-xs flex items-center justify-center gap-2 text-accent border-accent/30 hover:border-accent hover:bg-accent/5 transition-colors font-medium cursor-pointer"
        >
          <Users className="w-4 h-4" />
          <span>{t('shareToFriends', locale)}</span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={handleExportCsv} className="btn btn-secondary min-w-0 cursor-pointer">
          <Download className="w-4 h-4" />
          {t('exportCsv', locale)}
        </button>
        <button type="button" onClick={handleExportImage} disabled={exporting} className="btn btn-primary min-w-0 cursor-pointer">
          <Download className="w-4 h-4" />
          {exporting ? t('exporting', locale) : t('downloadPng', locale)}
        </button>
      </div>

      <button type="button" onClick={handleShareURL} className="btn btn-primary w-full cursor-pointer">
        {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        {copied ? t('copiedLink', locale) : t('shareBill', locale)}
      </button>
    </div>
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={t('shareAndCollect', locale)} footer={footer} maxWidth="max-w-2xl">
        <div className="mb-4 space-y-3">
          <div>
            <h2 className="text-xl font-semibold">{t('shareAndCollect', locale)}</h2>
            <p className="text-xs text-ink-3">{t('shareCollectSubtitle', locale)}</p>
          </div>

          {/* HIỂN THỊ PHƯƠNG THỨC THANH TOÁN THEO TIỀN TỆ */}
          {isVnd ? (
            <div className="flex rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 items-center justify-center gap-2 text-xs font-semibold text-emerald-400">
              <QrCode className="h-4 w-4" />
              <span>{t('methodVietQR', locale)}</span>
            </div>
          ) : isRub ? (
            <div className="flex rounded-2xl border border-line bg-surface-2 p-2.5 items-center justify-center gap-2 text-xs font-semibold text-ink-2">
              <Smartphone className="h-4 w-4 text-accent" />
              <span>{t('methodRussiaSBP', locale)}</span>
            </div>
          ) : activeMember?.custom_qr_url ? (
            <div className="flex rounded-2xl border border-line bg-surface-2 p-2.5 items-center justify-center gap-2 text-xs font-semibold text-ink-2">
              <QrCode className="h-4 w-4 text-accent" />
              <span>{t('methodCustomQR', locale)}</span>
            </div>
          ) : null}

          {/* Danh sách người cần thanh toán */}
          {payableBreakdowns.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {payableBreakdowns.map((breakdown) => {
                const member = currentBill.members.find((item) => item.id === breakdown.memberId);
                const selected = member?.id === activeMember?.id;
                return (
                  <button
                    type="button"
                    key={breakdown.memberId}
                    onClick={() => setSelectedMemberId(breakdown.memberId)}
                    className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs transition-colors cursor-pointer ${
                      selected ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface-2 text-ink-2'
                    }`}
                  >
                    <Avatar member={member} size="sm" />
                    {member?.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Hóa đơn in ảnh PNG */}
        <div
          ref={receiptRef}
          className="paper bg-surface text-ink border border-dashed border-line rounded-xl p-6 space-y-4 receipt-font text-sm"
        >
          {activeMember && (
            <div className="rounded-2xl border border-line bg-surface-2 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-ink-3">{activeMember.name}</p>
                  <p className="mt-1 text-lg font-semibold text-accent">
                    {t('memberPays', locale, { name: activeMember.name, amount: formatCurrency(personAmount, currentBill.currency) })}
                  </p>
                </div>
                {qrUrl && (
                  <img
                    src={qrUrl}
                    alt={t('paymentQrAlt', locale)}
                    className="h-32 w-32 rounded-xl bg-white p-2 object-contain shadow-sm"
                  />
                )}
              </div>

              {/* Thông tin chuyển khoản tương ứng */}
              <div className="mt-3 space-y-1.5 text-xs text-ink-2">
                {isVnd && hasVietQrAccount ? (
                  <>
                    <p>{t('bankLabel', locale)}: {activeMember.bank_name}</p>
                    <p className="flex items-center gap-2">
                      {t('accountNumberLabel', locale)}: {activeMember.account_number}
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(activeMember.account_number || '')}
                        className="text-accent hover:underline cursor-pointer"
                      >
                        {t('copyShort', locale)}
                      </button>
                    </p>
                    <p>{t('accountHolderLabel', locale)}: {activeMember.account_holder || '—'}</p>
                  </>
                ) : isRub && (activeMember.phone_number || activeMember.russia_bank) ? (
                  <>
                    {activeMember.phone_number && (
                      <p className="flex items-center gap-2">
                        {t('phoneSbpLabel', locale)}: {activeMember.phone_number}
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard.writeText(activeMember.phone_number || '')}
                          className="text-accent hover:underline cursor-pointer"
                        >
                          {t('copyShort', locale)}
                        </button>
                      </p>
                    )}
                    {activeMember.russia_bank && <p>{t('bankRuLabel', locale)}: {activeMember.russia_bank}</p>}
                    <p>{t('accountHolderLabel', locale)}: {activeMember.account_holder || activeMember.name}</p>
                  </>
                ) : activeMember.custom_qr_url ? (
                  <p>{t('customQrSection', locale)}</p>
                ) : (
                  <p className="italic text-ink-3">{t('noPaymentInfoShort', locale, { name: activeMember.name })}</p>
                )}
              </div>
            </div>
          )}

          <div className="text-center border-b border-dashed border-line pb-4">
            <div className="text-xl font-bold break-words">{currentBill.title}</div>
            <div className="text-ink-3 text-xs mt-1">{formatDate(currentBill.date, locale)}</div>
          </div>

          {currentBill.mode === 'TIMELINE' ? (
            <div className="space-y-3">
              {expenses.map((expense, expenseIndex) => (
                <div key={expense.id} className="rounded-xl border border-line/60 bg-surface-2/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">
                      {expense.time || '--:--'} — {expense.title || `${t('timeLabel', locale)} ${expenseIndex + 1}`}
                    </div>
                    <span className="shrink-0 font-medium text-accent">
                      {formatCurrency(
                        expense.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * (1 + ((expense.taxPercent || 0) + (expense.tipPercent || 0)) / 100),
                        currentBill.currency
                      )}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-ink-3">
                    {t('payerLabel', locale)}: {currentBill.members.find((member) => member.id === expense.payerId)?.name || t('noAssignment', locale)}
                  </div>
                  <div className="mt-2 space-y-1">
                    {expense.items.map((item, itemIndex) => (
                      <div key={item.id} className="flex justify-between gap-3 text-xs">
                        <span>{itemIndex + 1}. {item.name} x{item.quantity}</span>
                        <span className="shrink-0">{formatCurrency(item.price * item.quantity, currentBill.currency)}</span>
                      </div>
                    ))}
                  </div>
                  {((expense.taxPercent || 0) > 0 || (expense.tipPercent || 0) > 0) && (
                    <div className="mt-2 border-t border-dashed border-line/60 pt-1.5 text-[11px] text-ink-3 space-y-0.5">
                      {(expense.taxPercent || 0) > 0 && (
                        <div className="flex justify-between">
                          <span>{t('taxLabel', locale).replace(' (%)', '')} {expense.taxPercent}%</span>
                          <span>{formatCurrency(expense.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * (expense.taxPercent / 100), currentBill.currency)}</span>
                        </div>
                      )}
                      {(expense.tipPercent || 0) > 0 && (
                        <div className="flex justify-between">
                          <span>{t('serviceFee', locale)} {expense.tipPercent}%</span>
                          <span>{formatCurrency(expense.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * (expense.tipPercent / 100), currentBill.currency)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {currentBill.items.map((item, idx) => (
                <div key={item.id} className="flex justify-between gap-3">
                  <span>{idx + 1}. {item.name} x{item.quantity}</span>
                  <span className="shrink-0">{formatCurrency(item.price * item.quantity, currentBill.currency)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-dashed border-line pt-3 space-y-1">
            <div className="flex justify-between text-ink-2">
              <span>{t('totalItems', locale)}</span>
              <span>{formatCurrency(billSubtotal, currentBill.currency)}</span>
            </div>
            {currentBill.mode === 'TIMELINE' ? (
              <>
                {expenses.some((expense) => (expense.taxPercent || 0) > 0) && (
                  <div className="flex justify-between text-ink-2">
                    <span>{t('taxLabel', locale).replace(' (%)', '')}</span>
                    <span>{formatCurrency(totalTax, currentBill.currency)}</span>
                  </div>
                )}
                {expenses.some((expense) => (expense.tipPercent || 0) > 0) && (
                  <div className="flex justify-between text-ink-2">
                    <span>{t('serviceFee', locale)}</span>
                    <span>{formatCurrency(totalTip, currentBill.currency)}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {(currentBill.taxPercent || 0) > 0 && (
                  <div className="flex justify-between text-ink-2">
                    <span>{t('taxLabel', locale).replace(' (%)', '')} {currentBill.taxPercent}%</span>
                    <span>{formatCurrency(totalTax, currentBill.currency)}</span>
                  </div>
                )}
                {(currentBill.tipPercent || 0) > 0 && (
                  <div className="flex justify-between text-ink-2">
                    <span>{t('serviceFee', locale)} {currentBill.tipPercent}%</span>
                    <span>{formatCurrency(totalTip, currentBill.currency)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between text-base font-semibold text-accent pt-2 border-t border-dashed border-line">
              <span>{t('total', locale)}</span>
              <span>{formatCurrency(grandTotal, currentBill.currency)}</span>
            </div>
          </div>

          {breakdowns.length > 0 && (
            <div className="border-t border-dashed border-line pt-3 space-y-1">
              <div className="font-semibold mb-1">{t('eachPersonPays', locale)}</div>
              {breakdowns.map((b) => {
                const member = currentBill.members.find((m) => m.id === b.memberId);
                return (
                  <div key={b.memberId} className="flex justify-between">
                    <span>{member?.name}</span>
                    <span>{formatCurrency(b.totalOwed, currentBill.currency)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {settlements.length > 0 && (
            <div className="border-t border-dashed border-line pt-3 space-y-1">
              <div className="font-semibold mb-1">{t('settlementTitle', locale)}</div>
              {settlements.map((s, idx) => {
                const from = currentBill.members.find((m) => m.id === s.fromMemberId);
                const to = currentBill.members.find((m) => m.id === s.toMemberId);
                return (
                  <div key={idx} className="flex justify-between gap-3">
                    <span>{from?.name} → {to?.name}</span>
                    <span className="shrink-0">{formatCurrency(s.amount, currentBill.currency)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center text-xs text-ink-3 border-t border-dashed border-line pt-3">{t('createdBy', locale)}</div>
        </div>
      </Modal>

      {currentBill && (
        <ShareToFriendsModal
          isOpen={isShareFriendsOpen}
          onClose={() => setIsShareFriendsOpen(false)}
          billId={currentBill.id}
        />
      )}
    </>
  );
}