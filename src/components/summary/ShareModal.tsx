import { Download, Copy, Check, Link2, Users } from 'lucide-react';
import { useBillStore } from '../../store/useBillStore';
import { useAuthStore } from '../../store/useAuthStore';
import { calculateMemberBreakdowns, calculateSettlements } from '../../utils/calculations';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { useLocale, t } from '../../hooks/useLocale';
import { ShareToFriendsModal } from './ShareToFriendsModal';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { currentBill, exportBillToURL } = useBillStore();
  const { user } = useAuthStore();
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isShareFriendsOpen, setIsShareFriendsOpen] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!currentBill) return null;

  const breakdowns = calculateMemberBreakdowns(currentBill);
  const settlements = calculateSettlements(breakdowns);
  const billSubtotal = currentBill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalTax = billSubtotal * (currentBill.taxPercent / 100);
  const totalTip = billSubtotal * (currentBill.tipPercent / 100);
  const grandTotal = billSubtotal + totalTax + totalTip;

  const generateTextSummary = () => {
    let text = `📄 ${currentBill.title}\n`;
    text += `📅 ${formatDate(currentBill.date)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `🍽️ ${t('itemsNav', locale).toUpperCase()}:\n`;
    currentBill.items.forEach((item, idx) => {
      text += `${idx + 1}. ${item.name} x${item.quantity} - ${formatCurrency(item.price * item.quantity, currentBill.currency)}\n`;
      const members = item.assignedMemberIds
        .map(id => currentBill.members.find(m => m.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      text += `   👥 ${members || t('noAssignment', locale)}\n`;
    });

    text += `\n💰 ${t('summaryNav', locale).toUpperCase()}:\n`;
    text += `${t('totalItems', locale)}: ${formatCurrency(billSubtotal, currentBill.currency)}\n`;
    if (currentBill.taxPercent > 0) {
      text += `${t('taxLabel', locale).replace(' (%)', '')} (${currentBill.taxPercent}%): ${formatCurrency(totalTax, currentBill.currency)}\n`;
    }
    if (currentBill.tipPercent > 0) {
      text += `${t('serviceFee', locale)} (${currentBill.tipPercent}%): ${formatCurrency(totalTip, currentBill.currency)}\n`;
    }
    text += `${t('total', locale).toUpperCase()}: ${formatCurrency(grandTotal, currentBill.currency)}\n`;

    text += `\n👥 ${t('eachPersonDetails', locale).toUpperCase()}:\n`;
    breakdowns.forEach((breakdown, idx) => {
      const member = currentBill.members.find(m => m.id === breakdown.memberId);
      const isPayer = member?.id === currentBill.paidByMemberId;
      text += `${idx + 1}. ${member?.name}${isPayer ? ' 👑' : ''}: ${formatCurrency(breakdown.totalOwed, currentBill.currency)}\n`;
    });

    if (settlements.length > 0) {
      text += `\n💸 ${t('payments', locale).toUpperCase()}:\n`;
      settlements.forEach((settlement, idx) => {
        const fromMember = currentBill.members.find(m => m.id === settlement.fromMemberId);
        const toMember = currentBill.members.find(m => m.id === settlement.toMemberId);
        text += `${idx + 1}. ${fromMember?.name} → ${toMember?.name}: ${formatCurrency(settlement.amount, currentBill.currency)}\n`;
      });
    }

    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `✨ ${t('createdBy', locale)}\n`;

    return text;
  };

  const handleCopyText = async () => {
    const text = generateTextSummary();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyURL = async () => {
    const url = exportBillToURL();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
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
      {/* Nút gửi cho bạn bè qua tài khoản (chỉ hiện khi đã đăng nhập) */}
      {user && (
        <button
          type="button"
          onClick={() => setIsShareFriendsOpen(true)}
          className="btn btn-secondary w-full py-2.5 text-xs flex items-center justify-center gap-2 text-accent border-accent/30 hover:border-accent hover:bg-accent/5 transition-colors font-medium"
        >
          <Users className="w-4 h-4" />
          <span>{t('shareToFriends', locale)}</span>
        </button>
      )}

      <div className="flex gap-3">
        <button onClick={handleExportImage} disabled={exporting} className="btn btn-primary flex-1">
          <Download className="w-4 h-4" />
          {exporting ? t('exporting', locale) : t('downloadPng', locale)}
        </button>
        <button onClick={handleCopyText} className="btn btn-secondary flex-1">
          {copied ? (
            <>
              <Check className="w-4 h-4 text-accent" />
              {t('copied', locale)}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              {t('copyText', locale)}
            </>
          )}
        </button>
      </div>

      <button onClick={handleCopyURL} className="btn btn-secondary w-full">
        {urlCopied ? (
          <>
            <Check className="w-4 h-4 text-accent" />
            {t('copiedLink', locale)}
          </>
        ) : (
          <>
            <Link2 className="w-4 h-4" />
            {t('copyShareLink', locale)}
          </>
        )}
      </button>
      <p className="text-xs text-ink-3 text-center">{t('shareLinkDesc', locale)}</p>
    </div>
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={t('shareBill', locale)} footer={footer} maxWidth="max-w-xl">
        <div
          ref={receiptRef}
          className="paper bg-surface text-ink border border-dashed border-line rounded-xl p-6 space-y-4 receipt-font text-sm"
        >
          <div className="text-center border-b border-dashed border-line pb-4">
            <div className="text-xl font-bold break-words">{currentBill.title}</div>
            <div className="text-ink-3 text-xs mt-1">{formatDate(currentBill.date)}</div>
          </div>

          <div className="space-y-2">
            {currentBill.items.map((item, idx) => (
              <div key={item.id} className="flex justify-between gap-3">
                <span>
                  {idx + 1}. {item.name} x{item.quantity}
                </span>
                <span className="shrink-0">{formatCurrency(item.price * item.quantity, currentBill.currency)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-line pt-3 space-y-1">
            <div className="flex justify-between text-ink-2">
              <span>{t('totalItems', locale)}</span>
              <span>{formatCurrency(billSubtotal, currentBill.currency)}</span>
            </div>
            {currentBill.taxPercent > 0 && (
              <div className="flex justify-between text-ink-2">
                <span>{t('taxLabel', locale).replace(' (%)', '')} {currentBill.taxPercent}%</span>
                <span>{formatCurrency(totalTax, currentBill.currency)}</span>
              </div>
            )}
            {currentBill.tipPercent > 0 && (
              <div className="flex justify-between text-ink-2">
                <span>{t('serviceFee', locale)} {currentBill.tipPercent}%</span>
                <span>{formatCurrency(totalTip, currentBill.currency)}</span>
              </div>
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
                    <span>
                      {from?.name} → {to?.name}
                    </span>
                    <span className="shrink-0">{formatCurrency(s.amount, currentBill.currency)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center text-xs text-ink-3 border-t border-dashed border-line pt-3">{t('createdBy', locale)}</div>
        </div>
      </Modal>

      {/* Modal gửi trực tiếp hóa đơn cho danh sách bạn bè */}
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